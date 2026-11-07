import type { GenericDataSource } from "@/wab/shared/data-sources-meta/data-source-registry";
import { buildSqlStringForFilterTemplateArg } from "@/wab/shared/data-sources/to-sql";
import { deserCompositeExpr, serCompositeExprMaybe } from "@/wab/shared/core/exprs";
import { ObjectPath, ensureKnownCompositeExpr } from "@/wab/shared/model/classes";
import {
  getEmptyQuery,
  isQueryComplete,
  queryFromJsonLogic,
  queryToJsonLogic,
} from "@/wab/shared/query-builder";
import type { Field, RuleGroupType } from "@react-querybuilder/core";
import { describe, expect, it } from "vitest";
const fields: Field[] = [
  { name: "age", label: "Age", datatype: "number" },
  {
    name: "name",
    label: "Name",
    datatype: "text",
    operators: [
      "=",
      "!=",
      "null",
      "notNull",
      "contains",
      "doesNotContain",
      "regex",
    ].map((name) => ({ name, label: name })),
  },
  { name: "enabled", label: "Enabled", datatype: "boolean" },
  {
    name: "status",
    label: "Status",
    datatype: "select",
    valueEditorType: "select",
    values: ["open", "closed"].map((name) => ({ name, label: name })),
  },
  { name: "created", label: "Created", datatype: "date", inputType: "date" },
];
const query = (field: string, operator: string, value: any): RuleGroupType => ({
  id: "root",
  combinator: "and",
  rules: [{ id: "rule", field, operator, value }],
});
describe("native query persistence and JsonLogic", () => {
  it.each([
    ["age", "=", 0, { "==": [{ var: "age" }, 0] }],
    ["enabled", "=", false, { "==": [{ var: "enabled" }, false] }],
    ["name", "=", "001", { "==": [{ var: "name" }, "001"] }],
    ["age", "between", [0, 18], { "<=": [0, { var: "age" }, 18] }],
    [
      "status",
      "in",
      ["open", "closed"],
      { in: [{ var: "status" }, ["open", "closed"]] },
    ],
    [
      "status",
      "notIn",
      ["closed"],
      { "!": { in: [{ var: "status" }, ["closed"]] } },
    ],
    ["name", "null", undefined, { "==": [{ var: "name" }, null] }],
    ["name", "notNull", undefined, { "!=": [{ var: "name" }, null] }],
    ["name", "contains", "Ada", { in: ["Ada", { var: "name" }] }],
    ["name", "regex", "^A", { regex: [{ var: "name" }, "^A"] }],
    [
      "created",
      ">=",
      "2026-01-01",
      { ">=": [{ var: "created" }, "2026-01-01"] },
    ],
  ])("exports and imports %s %s", (field, operator, value, logic) => {
    expect(
      queryToJsonLogic(
        query(field as string, operator as string, value),
        fields,
      ),
    ).toEqual({ and: [logic] });
    const imported = queryFromJsonLogic(logic as any, fields);
    expect(queryToJsonLogic(imported, fields)).toEqual({ and: [logic] });
    expect(imported.id).toEqual(expect.any(String));
  });
  it("preserves nested AND/OR/NOT semantics", () => {
    const logic = {
      "!": {
        or: [
          { "==": [{ var: "age" }, 0] },
          { "==": [{ var: "enabled" }, false] },
        ],
      },
    };
    expect(queryToJsonLogic(queryFromJsonLogic(logic, fields), fields)).toEqual(
      logic,
    );
  });
  it("retains Studio expressions as native rule values", () => {
    const expression = new ObjectPath({
      path: ["$ctx", "age"],
      fallback: undefined,
    });
    const logic = { "==": [{ var: "age" }, expression] };
    const imported = queryFromJsonLogic(logic as any, fields);
    expect((imported.rules[0] as any).value).toBe(expression);
    expect(queryToJsonLogic(imported, fields)).toEqual({ and: [logic] });
    expect(Object.isFrozen(expression)).toBe(false);
  });
  it.each(["contains", "doesNotContain"])(
    "preserves dynamic %s values",
    (operator) => {
      const value = new ObjectPath({
        path: ["$ctx", "search"],
        fallback: undefined,
      });
      const logic = queryToJsonLogic(query("name", operator, value), fields);
      expect(
        queryToJsonLogic(queryFromJsonLogic(logic, fields), fields),
      ).toEqual(logic);
    },
  );
  it.each(["between", "notBetween"])(
    "preserves dynamic %s endpoints",
    (operator) => {
      const value = [
        new ObjectPath({ path: ["$ctx", "min"], fallback: undefined }),
        18,
      ];
      const logic = queryToJsonLogic(query("age", operator, value), fields);
      expect(
        queryToJsonLogic(queryFromJsonLogic(logic, fields), fields),
      ).toEqual(logic);
    },
  );
  it("roundtrips Studio composite bindings through the native query", () => {
    const expression = new ObjectPath({path: ["$ctx", "min"], fallback: undefined});
    const logic = queryToJsonLogic(query("age", "between", [expression, 18]), fields);
    const serialized = serCompositeExprMaybe(logic);
    const restored = deserCompositeExpr(ensureKnownCompositeExpr(serialized));
    expect(queryToJsonLogic(queryFromJsonLogic(restored as any, fields), fields)).toEqual(logic);
  });
  it("does not silently drop unsupported or malformed JsonLogic", () => {
    expect(() =>
      queryFromJsonLogic(
        { and: [{ "==": [{ var: "age" }, 18] }, { arbitrary: [1] }] } as any,
        fields,
      ),
    ).toThrow();
  });
  it("rejects incomplete values, invalid fields, and unsupported operators", () => {
    for (const q of [
      query("age", "=", undefined),
      query("missing", "=", 1),
      query("name", "arbitrary", "x"),
      query("age", "between", [0]),
      query("age", "between", [0, 1, 2]),
    ]) {
      expect(isQueryComplete(q, fields)).toBe(false);
      expect(() => queryToJsonLogic(q, fields)).toThrow("incomplete query");
    }
  });
  it("starts empty editors with native rules and stable persisted IDs", () => {
    const q = getEmptyQuery(fields, true);
    expect(q.rules[0]).toMatchObject({
      field: "age",
      operator: "=",
      value: "",
    });
    expect(JSON.parse(JSON.stringify(q))).toEqual(q);
    expect(isQueryComplete(q, fields)).toBe(false);
  });
});
describe("native SQL filters", () => {
  const source = { source: "postgres" } as GenericDataSource;
  const sql = (q: RuleGroupType) =>
    buildSqlStringForFilterTemplateArg(
      source,
      JSON.stringify({ tree: q, fields }),
    );
  it("preserves numbers, booleans, numeric text and escaped quotes", () => {
    expect(sql(query("age", "=", 0))).toBe('("age" = 0)');
    expect(sql(query("enabled", "=", false))).toBe('("enabled" = FALSE)');
    expect(sql(query("name", "=", "001"))).toBe("(\"name\" = '001')");
    expect(sql(query("name", "=", "O'Reilly"))).toBe(
      "(\"name\" = 'O''Reilly')",
    );
  });
  it("preserves dynamic expressions for the parameter binding step", () => {
    const template = JSON.stringify({
      tree: query("age", ">=", "BINDING"),
      fields,
    }).replace('"BINDING"', "{{ ($ctx.age) }}");
    expect(buildSqlStringForFilterTemplateArg(source, template)).toBe(
      '("age" >= {{ ($ctx.age) }})',
    );
  });
  it("emits ranges and null checks and rejects invalid filters", () => {
    expect(sql(query("age", "between", [0, 18]))).toBe(
      '("age" between 0 and 18)',
    );
    expect(sql(query("name", "null", undefined))).toBe('("name" is null)');
    expect(() => sql(query("age", "=", undefined))).toThrow(
      "incomplete filter",
    );
    expect(sql({ combinator: "and", rules: [] })).toBeUndefined();
  });
});
