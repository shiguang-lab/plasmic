const hook = vi.hoisted(() => {
  const renderers = new Map<number, unknown>();
  let nextId = 0;
  const value = { supportsFiber: true, renderers,
    inject: (renderer: unknown) => { const id = ++nextId; renderers.set(id, renderer); return id; },
    onCommitFiberRoot: (_renderer: number, _root: unknown) => undefined,
    onCommitFiberUnmount: (_renderer: number, _fiber: unknown) => undefined,
  };
  vi.stubGlobal("__REACT_DEVTOOLS_GLOBAL_HOOK__", value);
  return value;
});

import { globalHookCtx } from "@/wab/client/react-global-hook/globalHook";
import { traverseTree } from "@/wab/client/react-global-hook/traverseFiber";
import type { Fiber } from "@/wab/client/react-global-hook/fiber";
import { TplMgr } from "@/wab/shared/TplMgr";
import { classNameProp, frameUidProp, valKeyProp, valOwnerProp } from "@/wab/shared/canvas-constants";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplComponent } from "@/wab/shared/core/tpls";
import { act } from "@testing-library/react";
import React from "react";
import { createRoot } from "react-dom/client";

it("processes real React 19 committed Fiber variants while the cached ValComponent identity stays stable", async () => {
  const site = createSite(), manager = new TplMgr({ site });
  const component = manager.addComponent({ name: "Card", type: ComponentType.Plain });
  const group = manager.createVariantGroup({ component, name: "Mode" });
  const first = manager.createVariant(component, group, "First"), second = manager.createVariant(component, group, "Second");
  const tpl = mkTplComponent(component, component.variants[0]);
  const child = manager.addComponent({ name: "Inner", type: ComponentType.Plain });
  const childTpl = mkTplComponent(child, child.variants[0]);
  const container = document.body.appendChild(document.createElement("div")); container.id = "plasmic-app";
  const root = createRoot(container);
  const frame = globalHookCtx.createFrameState({ uid: 610, objectPrototype: Object.prototype });
  globalHookCtx.uuidToTplNode.set(tpl.uuid, new WeakRef(tpl));
  globalHookCtx.uuidToTplNode.set(childTpl.uuid, new WeakRef(childTpl));
  function Inner(props: { mode: string[] }) { return <span>{props.mode.join(",")}</span>; }
  // A registered wrapper can forward the frame marker while its nested child
  // supplies its own val key. Only the outer committed value is the root.
  function Card(props: { mode: string[] }) { return <Inner {...{ mode: props.mode, [classNameProp]: "Inner", [valKeyProp]: `${tpl.uuid}.${childTpl.uuid}`, [valOwnerProp]: tpl.uuid, [frameUidProp]: 610 }} />; }
  const element = (mode: string[]) => <Card {...{ mode, [classNameProp]: "Card", [valKeyProp]: tpl.uuid, [frameUidProp]: 610 }} />;
  // The test setup loads ReactDOM before this file installs its DevTools hook.
  // Feed the real renderer's committed Fiber roots to the production callback;
  // the Fiber tree, alternate updates and unmounts all come from React 19.
  const commit = async (next: React.ReactNode) => {
    const removed: Fiber[] = [];
    if (next == null) {
      traverseTree(ensure(Reflect.get(root, "_internalRoot"), "ReactDOM must expose its real Fiber root").current,
        (fiber) => removed.push(fiber), () => undefined, false);
    }
    await act(async () => root.render(next));
    removed.forEach((fiber) => hook.onCommitFiberUnmount(1, fiber));
    hook.onCommitFiberRoot(1, ensure(Reflect.get(root, "_internalRoot"), "ReactDOM must expose its real Fiber root"));
  };
  const rootInputs = frame.variantInputs.getStore(`${tpl.uuid}[0]`);
  const childInputs = frame.variantInputs.getStore(`${tpl.uuid}[0].${childTpl.uuid}[0]`);
  const published: unknown[] = [];
  frame.valRootStore.subscribe((value) => { if (value) { published.push([value.tpl, rootInputs.getState()?.flags, childInputs.getState()?.owners.map((owner) => owner.tplUid)]); } });
  try {
    await commit(element(["first"]));
    const value = ensure(frame.valRootStore.getState(), "The real hook must install the frame root");
    expect(published).toEqual([[tpl, { [first.uid]: true, [second.uid]: false }, [childTpl.uid, tpl.uid]]]);
    const variants = frame.variantInputs.getStore(value.fullKey), changed = vi.fn(), rootChanged = vi.fn();
    variants.subscribe(changed); frame.valRootStore.subscribe(rootChanged);
    expect(variants.getState()?.flags).toEqual({ [first.uid]: true, [second.uid]: false });
    await commit(element(["second"]));
    expect(frame.valRootStore.getState()).toBe(value);
    expect(rootChanged).not.toHaveBeenCalled();
    expect(variants.getState()?.flags).toEqual({ [first.uid]: false, [second.uid]: true });
    expect(changed).toHaveBeenCalledTimes(1);
    await commit(element(["second"]));
    expect(changed).toHaveBeenCalledTimes(1);
    await commit(null);
    expect(variants.getState()).toBeUndefined();
    expect(changed).toHaveBeenCalledTimes(2);
  } finally {
    await act(async () => root.unmount()); frame.dispose(); container.remove();
    globalHookCtx.uuidToTplNode.delete(tpl.uuid);
    globalHookCtx.uuidToTplNode.delete(childTpl.uuid);
    hook.renderers.clear();
  }
});
