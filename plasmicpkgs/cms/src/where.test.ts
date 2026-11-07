import type { RulesLogic } from "json-logic-js";
import { describe, expect, it } from "vitest";
import { CmsFieldMeta, CmsMetaType } from "./schema";
import { cmsTableToQueryBuilderConfig, rulesLogicToCmsWhere } from "./where";

describe("cmsTableToQueryBuilderConfig", () => {
  it("provides native fields for every supported schema type", () => {
    const config = cmsTableToQueryBuilderConfig({ identifier: "blog", name: "Blog", schema: { fields: [
      { identifier: "title", type: CmsMetaType.TEXT },
      { identifier: "words", type: CmsMetaType.NUMBER },
      { identifier: "show", label: "Shown?", type: CmsMetaType.BOOLEAN },
      { identifier: "kind", type: CmsMetaType.ENUM, options: ["news", "guide"] },
      { identifier: "published", type: CmsMetaType.DATE_TIME },
      { identifier: "content", type: CmsMetaType.RICH_TEXT },
    ] as CmsFieldMeta[] } });
    expect(config.fields.map((field) => field.name)).toEqual(["_id", "title", "words", "show", "kind", "published"]);
    expect(config.fields.find((field) => field.name === "words")).toMatchObject({ datatype: "number", inputType: "number" });
    expect(config.fields.find((field) => field.name === "show")).toMatchObject({ datatype: "boolean", label: "Shown?", valueEditorType: "checkbox" });
    expect(config.fields.find((field) => field.name === "kind")).toMatchObject({ valueEditorType: "select", values: [{ name: "news", label: "news" }, { name: "guide", label: "guide" }] });
    expect(config.fields.find((field) => field.name === "published")).toMatchObject({ inputType: "datetime-local" });
    expect(config.fields.find((field) => field.name === "title")?.operators).toEqual(["=", "!=", "regex"].map((name) => ({ name, label: name })));
  });
  it("keeps the system ID field when the schema is empty", () => {
    const config = cmsTableToQueryBuilderConfig({ identifier: "foo", name: "Foo", schema: { fields: [] } });
    expect(config.fields).toEqual([{ name: "_id", label: "System ID", datatype: "text", inputType: "text", valueEditorType: "text", operators: ["=", "!="].map((name) => ({ name, label: name })) }]);
  });
});

describe("rulesLogicToCmsWhere", () => {
  it("converts complex JsonLogic query to CMS where clause", () => {
    const rulesLogic: RulesLogic = {
      and: [
        { "==": [{ var: "type" }, "announcement"] },
        { ">": [{ var: "wordCount" }, 100] },
        { "==": [{ var: "show" }, true] },
        {
          or: [
            { ">=": [{ var: "publishedAt" }, "2024-01-01"] },
            // @ts-expect-error regex is a custom operator
            { regex: [{ var: "title" }, "^Important"] },
          ],
        },
        { "!=": [{ var: "_id" }, "excluded-id"] },
        { in: [{ var: "type" }, ["announcement", "marketing"]] },
        { "!": { "<": [{ var: "wordCount" }, 50] } },
        { "<=": [{ var: "wordCount" }, 5000] },
      ],
    };
    expect(rulesLogicToCmsWhere(rulesLogic)).toEqual({
      $and: [
        { type: "announcement" },
        { wordCount: { $gt: 100 } },
        { show: true },
        {
          $or: [
            { publishedAt: { $ge: "2024-01-01" } },
            { title: { $regex: "^Important" } },
          ],
        },
        { $not: { _id: "excluded-id" } },
        { type: { $in: ["announcement", "marketing"] } },
        { $not: { wordCount: { $lt: 50 } } },
        { wordCount: { $le: 5000 } },
      ],
    });
  });
});
