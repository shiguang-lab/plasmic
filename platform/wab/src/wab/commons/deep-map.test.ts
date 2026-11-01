import { DeepMap, deepMapMemoized } from "@/wab/commons/deep-map";

it("releases a deleted entry's argument while preserving siblings and entry invalidation", () => {
  const map = new DeepMap<string>();
  const deleted = { payload: "deleted canvas" };
  const active = {};
  map.entry([active]).set("active");
  const entry = map.entry([deleted]);
  entry.set("closed");
  entry.delete();
  expect(JSON.stringify(map)).not.toContain("deleted canvas");
  expect(() => entry.get()).toThrow("Concurrent modification");
  expect(map.entry([active]).get()).toBe("active");
  expect(map.entry([deleted]).exists()).toBe(false);
});

it("keeps memoization correct across nested calls that invalidate the last entry", () => {
  const cache = new Map();
  const calls: number[] = [];
  const memo = deepMapMemoized(cache, (n: number): number => {
    calls.push(n);
    return n ? memo(n - 1) + 1 : 0;
  }, { funcKey: "nested" });
  expect(memo(3)).toBe(3);
  expect(memo(3)).toBe(3);
  expect(calls).toEqual([3, 2, 1, 0]);
});
