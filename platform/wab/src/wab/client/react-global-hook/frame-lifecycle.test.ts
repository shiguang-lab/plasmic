const hook = vi.hoisted(() => {
  const value = {
    renderers: new Map<number, unknown>(),
    inject: () => 1,
    onCommitFiberRoot: () => {},
    onCommitFiberUnmount: () => {},
  };
  vi.stubGlobal("__REACT_DEVTOOLS_GLOBAL_HOOK__", value);
  return value;
});

import { buildValTree, TEST_GLOBAL_VARIANT } from "@/wab/__testonly__/tpls";
import { globalHookCtx } from "@/wab/client/react-global-hook/globalHook";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { mkTplComponent, mkTplTagX } from "@/wab/shared/core/tpls";
import { runInAction } from "mobx";

afterEach(() => {
  [...globalHookCtx.frames.values()].forEach((frame) => frame.dispose());
  hook.renderers.clear();
});

it("releases the closed frame's tree, context and renderer while preserving the other frame", () => {
  const prototype = {};
  const otherPrototype = {};
  hook.renderers.set(1, Object.create(prototype));
  const otherRenderer = Object.create(otherPrototype);
  hook.renderers.set(2, otherRenderer);
  const frame = globalHookCtx.createFrameState({ uid: 1, objectPrototype: prototype });
  const other = globalHookCtx.createFrameState({ uid: 2, objectPrototype: otherPrototype });
  const component = mkComponent({ name: "Frame", type: ComponentType.Plain, tplTree: mkTplTagX("div", {}, []) });
  const root = buildValTree(mkTplComponent(component, TEST_GLOBAL_VARIANT));
  frame.renderState.registerVal(root);
  other.renderState.registerVal(root);
  runInAction(() => {
    frame.valRoot.set(root);
    frame.contextData.set("node", { value: 0 });
    other.contextData.set("node", { value: false });
  });
  expect(frame.renderState.fullKey2val(root.fullKey)).toBeTruthy();
  const dispose = vi.spyOn(frame.renderState, "dispose");
  frame.dispose();
  frame.dispose();
  expect(dispose).toHaveBeenCalledTimes(1);
  expect(globalHookCtx.frames.has(1)).toBe(false);
  expect(frame.valRoot.get()).toBeNull();
  expect(frame.contextData.size).toBe(0);
  expect(frame.renderState.fullKey2val(root.fullKey)).toBeUndefined();
  expect(hook.renderers.has(1)).toBe(false);
  expect(globalHookCtx.frames.get(2)).toBe(other);
  expect(hook.renderers.get(2)).toBe(otherRenderer);
  expect(other.contextData.get("node")).toEqual({ value: false });
  expect(other.renderState.fullKey2val(root.fullKey)).toBeTruthy();
});

it("does not remove a replacement frame with the same uid when the old owner disposes", () => {
  const old = globalHookCtx.createFrameState({ uid: 10, objectPrototype: {} });
  const replacement = globalHookCtx.createFrameState({ uid: 10, objectPrototype: {} });
  old.dispose();
  expect(globalHookCtx.frames.get(10)).toBe(replacement);
});

it("keeps the frame registry bounded through repeated creation and disposal", () => {
  for (let uid = 100; uid < 120; uid++) {
    const frame = globalHookCtx.createFrameState({ uid, objectPrototype: {} });
    expect(globalHookCtx.frames.size).toBe(1);
    frame.dispose();
    expect(globalHookCtx.frames.size).toBe(0);
  }
});
