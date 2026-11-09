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

it("persists every created row so subsequent queries observe the bulk write", () => {
  const fetcher = new FakeFetcher({ id } as FakeDataSource);
  expect(fetcher.createMany({ resource: "products", variables: [
    { id: 901, name: "First audit row", price: 8 },
    { id: 902, name: "Second audit row", price: 9 },
  ] })).toBe(2);
  expect(fetcher.getList({ resource: "products" }).data).toEqual(expect.arrayContaining([
    { id: 901, name: "First audit row", price: 8 },
    { id: 902, name: "Second audit row", price: 9 },
  ]));
});

it("updates only the row matching the required primary key", () => {
  const fetcher = new FakeFetcher({ id } as FakeDataSource);
  expect(fetcher.updateById({ resource: "products", keys: { id: 2 }, variables: { name: "Updated eggs" } })).toBe(1);
  expect(fetcher.getList({ resource: "products" }).data).toEqual([
    { id: 1, name: "Milk", price: 2 },
    { id: 2, name: "Updated eggs", price: 0.5 },
    { id: 3, name: "Chicken", price: 7 },
  ]);
  expect(() => fetcher.updateById({ resource: "products", keys: {}, variables: { name: "Missing key" } })).toThrow("Missing the following primary keys: id");
});
