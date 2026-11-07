import { filtersToAirtableFormula } from "@/wab/server/data-sources/airtable-fetcher";
import type { Filters } from "@/wab/shared/data-sources-meta/data-sources";
import { describe, expect, it } from "vitest";
const filters = (field: string, operator: string, value: any, datatype = "text"): Filters => ({tree: {combinator: "and", rules: [{field, operator, value}]}, fields: [{name: field, label: field, datatype, ...(datatype === "select" ? {valueEditorType: "select"} : {})}]});
describe("native Airtable filter export", () => {
  it("exports comparisons, ranges, NOT and zero", () => {
    expect(filtersToAirtableFormula(filters("age", "=", 0, "number"))).toBe('AND({age}=0)');
    expect(filtersToAirtableFormula(filters("age", "between", [0, 18], "number"))).toBe('AND(AND({age}<=18,{age}>=0))');
    expect(filtersToAirtableFormula(filters("status", "notIn", ["closed"], "select"))).toBe('AND(NOT(OR({status}="closed")))');
  });
  it("exports native membership arrays separately from text containment", () => {
    expect(filtersToAirtableFormula(filters("status", "in", ["open", "closed"], "select"))).toBe('AND(OR({status}="open",{status}="closed"))');
    expect(filtersToAirtableFormula(filters("name", "contains", "Ada"))).toBe('AND(SEARCH(LOWER("Ada"),LOWER({name}))!="")');
  });
  it("wraps date operands and emits no formula for no conditions", () => {
    expect(filtersToAirtableFormula(filters("created", ">=", "2026-01-01", "date"))).toBe('AND({created}>=DATETIME_PARSE("2026-01-01"))');
    expect(filtersToAirtableFormula({tree: {combinator: "and", rules: []}, fields: []})).toBeUndefined();
  });
});
