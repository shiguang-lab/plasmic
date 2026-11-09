import {
  createOutlineStateStore,
  patchOutlineState,
} from "@/wab/client/components/sidebar-tabs/outline-state";
import type { Matcher } from "@/wab/client/components/view-common";
import type { OutlineNodeKey } from "@/wab/client/components/sidebar-tabs/OutlineCtx";

/**
 * The six `observable` containers in `OutlineCtx` became one store; every write
 * bumps `version` so consumers can subscribe to a single signal.
 */

function matcher(): Matcher {
  return { matches: () => false } as unknown as Matcher;
}

it("bumps version on every write", () => {
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
