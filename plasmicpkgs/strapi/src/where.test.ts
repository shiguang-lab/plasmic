import type { RulesLogic } from "json-logic-js";
import { describe, expect, it } from "vitest";
import {
  rulesLogicToStrapiFilters,
  strapiFieldsToQueryBuilderConfig,
} from "./where";

describe("rulesLogicToStrapiFilters", () => {
  it("converts simple equality to Strapi filters", () => {
    const rulesLogic: RulesLogic = {
      "==": [{ var: "name" }, "John"],
    };
    expect(rulesLogicToStrapiFilters(rulesLogic)).toEqual({
      name: { $eq: "John" },
    });
  });

  it("converts not equal to Strapi filters", () => {
    const rulesLogic: RulesLogic = {
      "!=": [{ var: "status" }, "deleted"],
    };
    expect(rulesLogicToStrapiFilters(rulesLogic)).toEqual({
      status: { $ne: "deleted" },
    });
  });

  it("converts comparison operators to Strapi filters", () => {
    const rulesLogic: RulesLogic = {
      and: [
        { ">": [{ var: "age" }, 18] },
        { "<=": [{ var: "age" }, 65] },
        { "<": [{ var: "score" }, 100] },
        { ">=": [{ var: "score" }, 0] },
      ],
    };
    expect(rulesLogicToStrapiFilters(rulesLogic)).toEqual({
      $and: [
        { age: { $gt: 18 } },
        { age: { $lte: 65 } },
        { score: { $lt: 100 } },
        { score: { $gte: 0 } },
      ],
    });
  });

  it("converts in operator to Strapi filters", () => {
    expect(
      rulesLogicToStrapiFilters({ and: [{ in: ["Mairi", { var: "name" }] }] })
    ).toEqual({
      $and: [{ name: { $contains: "Mairi" } }],
    });
  });

  it("converts null and not null operators to Strapi filters", () => {
    expect(
      rulesLogicToStrapiFilters({ and: [{ "==": [{ var: "name" }, null] }] })
    ).toEqual({
      $and: [{ name: { $null: true } }],
    });
    expect(
      rulesLogicToStrapiFilters({ and: [{ "!=": [{ var: "name" }, null] }] })
    ).toEqual({
      $and: [{ name: { $notNull: true } }],
    });
  });

  it("converts complex JsonLogic query with and/or/not to Strapi filters", () => {
    const rulesLogic: RulesLogic = {
      and: [
        { "==": [{ var: "title" }, "Hello World"] },
        { ">": [{ var: "rating" }, 3] },
        {
          or: [
            { ">=": [{ var: "publishedAt" }, "2024-01-01"] },
            { "==": [{ var: "status" }, "draft"] },
          ],
        },
        { "!=": [{ var: "_id" }, "excluded-id"] },
        { "!": { "<": [{ var: "wordCount" }, 50] } },
      ],
    };
    expect(rulesLogicToStrapiFilters(rulesLogic)).toEqual({
      $and: [
        { title: { $eq: "Hello World" } },
        { rating: { $gt: 3 } },
        {
          $or: [
            { publishedAt: { $gte: "2024-01-01" } },
            { status: { $eq: "draft" } },
          ],
        },
        { _id: { $ne: "excluded-id" } },
        { $not: { wordCount: { $lt: 50 } } },
      ],
    });
  });

  it("returns undefined for null/undefined input", () => {
    expect(rulesLogicToStrapiFilters(null as any)).toBeUndefined();
    expect(rulesLogicToStrapiFilters(undefined)).toBeUndefined();
  });
});

describe("strapiFieldsToQueryBuilderConfig", () => {
  it("uses native fields inferred from sample values", () => {
    const config = strapiFieldsToQueryBuilderConfig(["name", "age", "enabled", "created", "missing", "nested"], { name: "Ada", age: 0, enabled: false, created: "2024-01-01T00:00:00Z", nested: {} });
    expect(config.fields.map(({name, datatype}) => [name, datatype])).toEqual([["name", "text"], ["age", "number"], ["enabled", "boolean"], ["created", "datetime"]]);
    expect(config.fields.find((field) => field.name === "created")?.inputType).toBe("datetime-local");
    expect(config.fields.find((field) => field.name === "age")?.operators).toEqual(["=", "!=", "<", "<=", ">", ">=", "null", "notNull"].map((name) => ({ name, label: name })));
  });
  it("returns an empty native field array for no fields", () => {
    expect(strapiFieldsToQueryBuilderConfig([])).toEqual({ fields: [] });
  });
  it("skips fields without usable sample values", () => {
    expect(strapiFieldsToQueryBuilderConfig(["name"]).fields).toEqual([]);
    expect(strapiFieldsToQueryBuilderConfig(["empty", "missing"], { empty: null }).fields).toEqual([]);
  });
});
