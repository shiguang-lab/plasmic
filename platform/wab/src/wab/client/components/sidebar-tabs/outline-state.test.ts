import {
  createOutlineStateStore,
  patchOutlineState,
} from "@/wab/client/components/sidebar-tabs/outline-state";
import type { Matcher } from "@/wab/client/components/view-common";
import type { OutlineNodeKey } from "@/wab/client/components/sidebar-tabs/OutlineCtx";

function matcher(): Matcher {
  return { matches: () => false } as unknown as Matcher;
}

it("bumps version on changed inputs", () => {
  const store = createOutlineStateStore(matcher());
  expect(store.getState().version).toBe(0);

  patchOutlineState(store, { query: "button" });
  expect(store.getState().version).toBe(1);
  expect(store.getState().query).toBe("button");

  patchOutlineState(store, { visible: new Set(["a"]) });
  expect(store.getState().version).toBe(2);
});

it("keeps expansion maps immutable across writes", () => {
  const store = createOutlineStateStore(matcher());
  const key = "node-1" as OutlineNodeKey;
  const before = store.getState().expanded;

  patchOutlineState(store, { expanded: new Map([[key, true]]) });

  expect(before.size).toBe(0);
  expect(store.getState().expanded.get(key)).toBe(true);
});

it("does not publish or change the version for unchanged inputs", () => {
  const store = createOutlineStateStore(matcher());
  const notify = vi.fn();
  const stop = store.subscribe(notify);
  const before = store.getState();
  patchOutlineState(store, { query: before.query, expanded: before.expanded });
  expect(store.getState()).toBe(before);
  expect(notify).not.toHaveBeenCalled();
  stop();
});
