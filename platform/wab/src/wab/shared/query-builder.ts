import { assert } from "@/wab/shared/common";
import {
  isKnownCustomCode,
  isKnownObjectPath,
  isKnownTemplatedString,
} from "@/wab/shared/model/classes";
import type { QueryBuilderConfig } from "@plasmicapp/host";
import {
  defaultOperators,
  defaultRuleProcessorJsonLogic,
  formatQuery,
  isRuleGroup,
  prepareRuleGroup,
  toFlatOptionArray,
  toFullOptionList,
  type Field,
  type RuleGroupType,
  type RuleType,
} from "@react-querybuilder/core";
import { parseJsonLogic } from "@react-querybuilder/core/parseJsonLogic";
import type { RulesLogic } from "json-logic-js";

const QUERY_OPERATORS = [
  ...defaultOperators,
  { name: "regex", label: "matches regex" },
];
const comparisonOperators = [
  "=",
  "!=",
  "<",
  "<=",
  ">",
  ">=",
  "null",
  "notNull",
];

export function getFieldOperators(field: Field) {
  if (field.operators) {
    return toFlatOptionArray(toFullOptionList(field.operators));
  }
  const type = String(field.datatype ?? field.inputType ?? "");
  const names =
    type === "boolean"
      ? ["=", "!=", "null", "notNull"]
      : field.valueEditorType === "select" ||
          field.valueEditorType === "multiselect"
        ? ["=", "!=", "in", "notIn", "null", "notNull"]
        : ["number", "date", "time", "datetime"].includes(type ?? "")
          ? [...comparisonOperators, "between", "notBetween"]
          : [...comparisonOperators, "contains", "doesNotContain"];
  return QUERY_OPERATORS.filter((operator) => names.includes(operator.name));
}

/** Schema fields become native editor fields; the query tree itself is never converted. */
export function dataSourceQueryFields(
  fields: Record<
    string,
    {
      type: string;
      label?: string;
      options?: (string | { value: string; label: string })[];
    }
  >,
): Field[] {
  return Object.entries(fields)
    .filter(([, field]) => !["json", "unknown"].includes(field.type))
    .map(([name, field]) => {
      const datatype =
        field.type === "string"
          ? "text"
          : field.type === "enum"
            ? "select"
            : field.type;
      return {
        name,
        label: field.label ?? name,
        datatype,
        inputType:
          datatype === "number"
            ? "number"
            : datatype === "datetime"
              ? "datetime-local"
              : ["date", "time"].includes(datatype)
                ? datatype
                : "text",
        valueEditorType:
          datatype === "boolean"
            ? "checkbox"
            : datatype === "select"
              ? "select"
              : "text",
        ...(field.options
          ? {
              values: field.options.map((option) =>
                typeof option === "string"
                  ? { name: option, label: option }
                  : { name: option.value, label: option.label },
              ),
            }
          : {}),
      };
    });
}

export function isQueryComplete(
  query: RuleGroupType,
  fields: Field[],
): boolean {
  return (
    ["and", "or"].includes(query.combinator) &&
    query.rules.length > 0 &&
    query.rules.every((rule) => {
      if (isRuleGroup(rule)) {
        return isQueryComplete(rule, fields);
      }
      const field = fields.find((item) => item.name === rule.field);
      if (
        !field ||
        !getFieldOperators(field).some((op) => op.name === rule.operator)
      ) {
        return false;
      }
      if (["null", "notNull"].includes(rule.operator)) {
        return true;
      }
      if (
        rule.value === undefined ||
        rule.value === null ||
        rule.value === ""
      ) {
        return false;
      }
      return (
        !["between", "notBetween", "in", "notIn"].includes(rule.operator) ||
        (Array.isArray(rule.value) &&
          (["between", "notBetween"].includes(rule.operator)
            ? rule.value.length === 2
            : rule.value.length > 0) &&
          rule.value.every((v) => v !== undefined && v !== null && v !== ""))
      );
    })
  );
}

/** The sole JsonLogic exporter, including Studio's registered regex operation. */
export function queryToJsonLogic(
  query: RuleGroupType,
  fields: Field[],
): RulesLogic {
  assert(isQueryComplete(query, fields), "Cannot export an incomplete query");
  return formatQuery(query, {
    format: "jsonlogic",
    fields,
    ruleProcessor: (rule, options) =>
      rule.operator === "regex"
        ? { regex: [{ var: rule.field }, rule.value] }
        : defaultRuleProcessorJsonLogic(rule, {
            ...options,
            parseNumbers: options?.fieldData?.datatype === "number",
          }),
  }) as RulesLogic;
}

/** Public parser extensions preserve dynamic Studio expressions as native rule values. */
export function queryFromJsonLogic(
  logic: RulesLogic,
  fields: Field[],
): RuleGroupType {
  const comparisons: Record<string, string> = {
    "==": "=",
    "===": "=",
    "!=": "!=",
    "!==": "!=",
    "<": "<",
    "<=": "<=",
    ">": ">",
    ">=": ">=",
  };
  const isExpression = (value: any) =>
    isKnownCustomCode(value) ||
    isKnownObjectPath(value) ||
    isKnownTemplatedString(value);
  const isField = (value: any): value is { var: string } =>
    value !== null &&
    typeof value === "object" &&
    typeof value.var === "string";
  const operations = [...Object.keys(comparisons), "in", "regex"];
  // The native parser drops unsupported operands. Reject them instead of saving a partial filter.
  const validate = (node: any) => {
    assert(
      node && typeof node === "object" && Object.keys(node).length === 1,
      "Invalid query JsonLogic",
    );
    const [operation, operands] = Object.entries(node)[0];
    if (operation === "and" || operation === "or") {
      assert(Array.isArray(operands), "Invalid query group");
      operands.forEach(validate);
    } else if (operation === "!" || operation === "!!") {
      validate(operands);
    } else {
      assert(
        operations.includes(operation),
        `Unsupported query operation: ${operation}`,
      );
    }
  };
  validate(logic);
  const jsonLogicOperations = Object.fromEntries(
    operations.map((operation) => [
      operation,
      (operands: any[]): RuleType | RuleGroupType | false => {
        assert(Array.isArray(operands), "Invalid query operands");
        const [left, right, upper] = operands;
        if (operation === "in" && isField(right) && isExpression(left)) {
          return { field: right.var, operator: "contains", value: left };
        }
        if (
          operation === "in" &&
          isField(left) &&
          Array.isArray(right) &&
          right.some(isExpression)
        ) {
          return { field: left.var, operator: "in", value: right };
        }
        if (operation === "regex" && isField(left)) {
          return { field: left.var, operator: "regex", value: right };
        }
        if (
          operation === "<=" &&
          operands.length === 3 &&
          isField(right) &&
          (isExpression(left) || isExpression(upper))
        ) {
          return {
            field: right.var,
            operator: "between",
            value: [left, upper],
          };
        }
        if (
          comparisons[operation] &&
          operands.length === 2 &&
          isField(left) &&
          isExpression(right)
        ) {
          return {
            field: left.var,
            operator: comparisons[operation],
            value: right,
          };
        }
        const parsed = parseJsonLogic({ [operation]: operands } as RulesLogic, {
          fields,
          listsAsArrays: true,
        });
        assert(
          parsed.rules.length > 0,
          `Unsupported query operands for ${operation}`,
        );
        return parsed.rules[0];
      },
    ]),
  );
  return prepareRuleGroup(
    parseJsonLogic(logic, { fields, listsAsArrays: true, jsonLogicOperations }),
  );
}

export function getEmptyQuery(
  fields: Field[],
  appendFirstField = false,
): RuleGroupType {
  const field = appendFirstField ? fields[0] : undefined;
  const first = field ? (getFieldOperators(field)[0]?.name ?? "=") : "=";
  return prepareRuleGroup({
    combinator: "and",
    rules: [
      {
        field: field?.name ?? "",
        operator: field?.defaultOperator ?? first,
        value: field?.defaultValue ?? "",
      },
    ],
  });
}

export function createQueryBuilderConfig(
  config: QueryBuilderConfig,
  disabled = false,
) {
  return {
    ...config,
    disabled,
    fields: config.fields.map((field) => ({
      ...field,
      operators: getFieldOperators(field),
    })),
    combinators: config.combinators ?? [
      { name: "and", label: "all" },
      { name: "or", label: "any" },
    ],
    showNotToggle: config.showNotToggle ?? true,
  };
}
