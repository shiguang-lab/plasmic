import { FakeFetcher } from "@/wab/server/data-sources/fake-fetcher";
import { dropFakeDatabase, type FakeDataSource } from "@/wab/shared/data-sources-meta/fake-meta";
import type { Filters } from "@/wab/shared/data-sources-meta/data-sources";
import { afterEach, expect, it } from "vitest";
const id = "native-querybuilder-tests";
afterEach(() => dropFakeDatabase(id));
const filter = (field: string, operator: string, value: any, datatype: string): Filters => ({tree: {combinator: "and", rules: [{field, operator, value}]}, fields: [{name: field, label: field, datatype, ...(datatype === "select" ? {valueEditorType: "select"} : {})}]});
it("evaluates native ranges and membership instead of a stored second logic model", () => {
  const fetcher = new FakeFetcher({id} as FakeDataSource);
  expect(fetcher.getList({resource: "athletes", filters: filter("age", "between", [32,35], "number")}).data.map((row) => row.id)).toEqual([3,4]);
  expect(fetcher.getList({resource: "athletes", filters: filter("sport", "in", ["Tennis"], "select")}).data.map((row) => row.id)).toEqual([1,3]);
  expect(fetcher.getList({resource: "athletes", filters: filter("sport", "notIn", ["Tennis"], "select")}).data.map((row) => row.id)).toEqual([2,4]);
});
it("keeps case-insensitive containment and accepts empty filters", () => {
  const fetcher = new FakeFetcher({id} as FakeDataSource);
  expect(fetcher.getList({resource: "athletes", filters: filter("firstName", "contains", "SER", "text")}).data.map((row) => row.id)).toEqual([3]);
  expect(fetcher.getList({resource: "athletes", filters: {tree: {combinator: "and", rules: []}, fields: []}}).data).toHaveLength(4);
});
