import { StudioOverlayState } from "@/wab/client/studio-ctx/studio-overlay-state";
import { StudioArenaState } from "@/wab/client/studio-ctx/studio-arena-state";
import { StudioSelection } from "@/wab/client/studio-ctx/studio-selection";
import { mkMixedArena } from "@/wab/shared/Arenas";
import { StudioCtx as ActualStudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { _testOnlyUtils } from "@/wab/client/components/canvas/canvas-rendering";
import { EffectiveVariantSetting } from "@/wab/shared/effective-variant-setting";
import { setTplVisibility, TplVisibility } from "@/wab/shared/visibility-utils";
import { CanvasContentEditor, CanvasContentEditorIndex } from "@/wab/client/studio-ctx/canvas-content-editor";
import { StudioRenderPolicy } from "@/wab/client/studio-ctx/studio-render-policy";
import { CanvasFrameInfoOwner } from "@/wab/client/components/canvas/canvas-frame-info";
import { createStore } from "zustand/vanilla";
import { ComponentCtx } from "@/wab/client/studio-ctx/component-ctx";
import { ValComponent } from "@/wab/shared/core/val-nodes";
import { clone } from "@/wab/shared/core/tpls";
import { mkTplComponent } from "@/wab/shared/core/tpls";
import { GlobalVariantFrame, RootComponentVariantFrame, TransientComponentVariantFrame } from "@/wab/shared/component-frame";
import { ViewSelection } from "@/wab/client/studio-ctx/view-selection";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { CodeComponentsRegistry, mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { ensure } from "@/wab/shared/common";
import { CanvasRenderOwner } from "@/wab/client/components/canvas/canvas-cache";
import { RenderingCtx, computeCanvasSessionKey, computeFullKey } from "@/wab/client/components/canvas/canvas-rendering";
import { CanvasSessionState } from "@/wab/client/components/canvas/canvas-session-state";
import { CanvasRegistrations } from "@/wab/client/components/canvas/canvas-registrations";
import { ViewVariantState } from "@/wab/client/studio-ctx/view-variant-state";
import { mkArenaFrame } from "@/wab/shared/Arenas";
import { globalHookCtx } from "@/wab/client/react-global-hook/globalHook";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { mkSlot } from "@/wab/shared/core/tpls";
import { mkParam } from "@/wab/shared/core/lang";
import { ensureKnownSlotParam } from "@/wab/shared/model/classes";
import { typeFactory } from "@/wab/shared/model/model-util";
import { Table } from "antd";
import { autorun, Reaction, observable, runInAction } from "mobx";
import React from "react";

function fixture() {
  const session = new CanvasSessionState(), snapshots = new ModelSnapshots();
  const selection = new ViewSelection(() => snapshots);
  const component = mkComponent({ name: "Owner", type: ComponentType.Plain, tplTree: mkTplTagX("div") });
  const site = createSite(), arenaFrame = mkArenaFrame({ site, component, width: 800, height: 600, name: "Owner" });
  const arena = mkMixedArena("Cache", [arenaFrame]); site.arenas.push(arena);
  const arenaState = new StudioArenaState({ site, modelSnapshots: snapshots }); arenaState.setCurrent(arena);
  const overlayState = new StudioOverlayState(), studioSelection = new StudioSelection(() => snapshots);
  const frameState = globalHookCtx.createFrameState({ uid: arenaFrame.uid, objectPrototype: Object.prototype });
  const variants = new ViewVariantState(() => snapshots, () => arenaFrame, () => site, () => false, () => !!frameState.valRootStore.getState());
  const owner = new CanvasRenderOwner(session);
  const registrations = new CanvasRegistrations();
  const commits = new Set<(event: { type: "commit" }) => void>();
  const draggingStore = createStore<boolean>(() => false);
  const renderPolicy = new StudioRenderPolicy({ isLive: () => false, isDragging: draggingStore.getState });
  renderPolicy.autoOpen = false; renderPolicy.prepareInputs(); renderPolicy.publishCommit();
  const autoOpenRequested = { set(value: boolean) {
    renderPolicy.deferPublication(() => {
      renderPolicy.autoOpen = value;
      const policy = renderPolicy.prepareInputs();
      if (frameInfoOwner) { renderPolicy.queuePublication(frameInfoOwner.prepare()); }
      renderPolicy.queuePublication(owner.prepareRenderPolicy(policy));
    });
  } };
  const studioCtx = {
    site, modelSnapshots: snapshots, renderPolicy, draggingObjectStore: draggingStore,
    arenaState, overlayState, selection: studioSelection, selectionStore: studioSelection.store,
    get isAutoOpenMode() { return renderPolicy.autoOpen; }, hasPendingModelChanges: () => false,
    subscribeModelChanges: (callback: (event: { type: "commit" }) => void) => {
      commits.add(callback); return () => { commits.delete(callback); };
    },
  };
  const initialRenderReadyStore = createStore<boolean>(() => false);
  const viewCtx = { studioCtx, canvasSessionState: session, canvasRenderOwner: owner,
    modelLifetime: arenaState.lifetime(), initialRenderReadyStore, _isDisposed: false,
    canvasCtx: { registrations, isUpdatingCcRegistry: () => registrations.loadingStore.getState(), frameInfo: () => getFrameInfo().store, prepareFrameInfo: () => getFrameInfo().prepare() },
    site, arenaFrame: () => arenaFrame, variants, variantStore: variants.store,
    selection, selectionStore: selection.store, frameState,
    component, currentComponent: () => component, valComponentStack: () => [], componentStackFrames: () => [],
    showDefaultSlotContents: () => false,
    _canvasExporting: false } as unknown as ViewCtx;
  Object.setPrototypeOf(viewCtx, ViewCtx.prototype);
  Object.setPrototypeOf(studioCtx, ActualStudioCtx.prototype);
  Object.defineProperty(studioCtx, "pendingArenaViewDisposals", { value: new Set() });
  const contentEditors = new CanvasContentEditorIndex(() => arenaState.viewRegistry.commandViews());
  Object.assign(studioCtx, {
    activeContentEditorStore: contentEditors.store,
    withContentEditorPublication: <Result>(command: () => Result): Result => contentEditors.deferPublication(command),
    publishContentEditorInputs: (publish: () => void) => contentEditors.queue(publish),
    getCurrentStudioViewportSnapshot: vi.fn(), restoreStudioViewportSnapshot: vi.fn(),
  });
  const contentEditor = new CanvasContentEditor(viewCtx);
  Object.assign(viewCtx, { contentEditor, scheduleSync: vi.fn(), awaitSync: vi.fn(async () => undefined),
    focusedTplAncestorsThroughComponents: () => [], setViewCtxHoverBySelectable: vi.fn(), setMeasureToolDomElt: vi.fn() });
  let frameInfoOwner: CanvasFrameInfoOwner | undefined;
  const getFrameInfo = () => frameInfoOwner ??= new CanvasFrameInfoOwner(viewCtx);
  arenaState.viewRegistry.register(viewCtx);
  const tick = observable.box(0);
  const redraw = () => runInAction(() => tick.set(tick.get() + 1));
  const env = { $ctx: {}, $props: {}, $queries: {}, $q: {} };
  const context = (valKey: string, renderSlotInstance?: string) => ({
    sub: { React }, viewCtx, site, valKey, renderSlotInstance,
    rootClassName: "", projectFlags: {}, env, wrappingEnv: env,
    activeVariants: new Set(), ownersStack: [], reactHookSpecs: [], triggerProps: {},
    overrides: {}, $stateSnapshot: {}, $ccVariants: {},
    stateSpecs: [], onRenderInvalidated: redraw,
  } as unknown as RenderingCtx);
  return { session, snapshots, owner, context, tick, commits, selection, component, viewCtx, renderPolicy, get frameInfo() { return getFrameInfo(); }, contentEditors, contentEditor, draggingState: studioCtx.draggingObjectStore, autoOpenRequested,
    dispose: () => { contentEditor.dispose(); overlayState.dispose(); arenaState.dispose(); studioSelection.dispose(); contentEditors.dispose(); owner.dispose(); frameInfoOwner?.dispose(); renderPolicy.dispose(); registrations.dispose(); session.dispose(); selection.dispose(); variants.dispose(); frameState.dispose(); snapshots.dispose(); } };
}

it("invalidates the changed instance and its cached ancestors while preserving sibling types/results", () => {
  const f = fixture();
  const root = mkTplTagX("div"), child = mkTplTagX("span"), other = mkTplTagX("span");
  const rootCtx = f.context("root"), childCtx = f.context("root.child"), otherCtx = f.context("root.other");
  const instance = computeCanvasSessionKey(childCtx);
  f.session.resolve(instance, "open", false);
  const childRender = vi.fn(() => React.createElement(Table.Column, { title: String(f.session.get(instance, "open")) }));
  const otherRender = vi.fn(() => React.createElement(Table.Column, { title: "unchanged" }));
  const rootRender = vi.fn(() => React.createElement(Table, {},
    f.owner.render(child, childCtx, childRender), f.owner.render(other, otherCtx, otherRender)));
  let output: React.ReactElement<{ children?: React.ReactNode }> | undefined;
  const stop = autorun(() => { f.tick.get(); output = f.owner.render(root, rootCtx, rootRender); });
  const before = output;
  const sibling = React.Children.toArray(output?.props.children)[1];
  f.session.set(instance, "open", true);
  expect(output).not.toBe(before);
  expect(output?.type).toBe(Table);
  const children = React.Children.toArray(output?.props.children);
  expect((children[0] as React.ReactElement).type).toBe(Table.Column);
  expect((children[0] as React.ReactElement<{ title: string }>).props.title).toBe("true");
  // Children.toArray assigns keys on copies; compare the retained raw result.
  expect(otherRender).toHaveBeenCalledTimes(1);
  expect((children[1] as React.ReactElement).type).toBe((sibling as React.ReactElement).type);
  expect(childRender).toHaveBeenCalledTimes(2);
  f.session.set(instance, "open", true);
  expect(childRender).toHaveBeenCalledTimes(2);
  stop(); f.dispose();
});

it("updates cached results for native model commits without observable model fields", () => {
  const f = fixture();
  const node = mkTplTagX("div"), ctx = f.context("node");
  const render = vi.fn(() => ({ tag: node.tag }));
  let result: { tag: string } | undefined;
  const stop = autorun(() => { f.tick.get(); result = f.owner.render(node, ctx, render); });
  const before = result;
  node.tag = "section";
  f.snapshots.sync([{ type: "update", oldValue: "div", newValue: "section", changeNode: { inst: node, field: "tag" } }]);
  expect(result).toBe(before);
  f.commits.forEach((listener) => listener({ type: "commit" }));
  expect(result).toEqual({ tag: "section" });
  expect(render).toHaveBeenCalledTimes(2);
  expect(f.commits.size).toBe(1);
  stop(); f.dispose();
  expect(f.commits.size).toBe(0);
});

it("isolates render-slot clones and releases owner subscriptions", () => {
  const f = fixture();
  const node = mkTplTagX("span");
  const a = f.context("row.tooltip", "a"), b = f.context("row.tooltip", "b");
  const keyA = computeCanvasSessionKey(a), keyB = computeCanvasSessionKey(b);
  f.session.resolve(keyA, "open", false); f.session.resolve(keyB, "open", false);
  const first = vi.fn(() => ({ open: f.session.get(keyA, "open") }));
  const second = vi.fn(() => ({ open: f.session.get(keyB, "open") }));
  const stop = autorun(() => {
    f.tick.get(); f.owner.render(node, a, first); f.owner.render(node, b, second);
  });
  f.session.set(keyA, "open", true);
  expect(first).toHaveBeenCalledTimes(2);
  expect(second).toHaveBeenCalledTimes(1);
  stop(); f.dispose();
  const count = f.tick.get();
  f.session.set(keyB, "open", true);
  expect(f.tick.get()).toBe(count);
});

it("invalidates only instances whose native component-context inputs change", () => {
  const f = fixture();
  const nested = mkComponent({ name: "Nested", type: ComponentType.Plain, tplTree: mkTplTagX("div") });
  const unrelated = mkComponent({ name: "Other", type: ComponentType.Plain, tplTree: mkTplTagX("div") });
  const rootTpl = mkTplComponent(f.component, f.component.variants[0]);
  const nestedTpl = mkTplComponent(nested, nested.variants[0]);
  const value = (tpl: typeof rootTpl, key: string, owner?: ValComponent) => new ValComponent({
    tpl, key, fullKey: key, frameUid: 1, valOwner: owner, parent: undefined,
    fibers: [], className: "", slotInfo: undefined, slotArgs: new Map(), slotCanvasEnvs: new Map(),
  });
  const rootVal = value(rootTpl, "root"), nestedVal = value(nestedTpl, "root.inner", rootVal);
  const rootFrame = new TransientComponentVariantFrame(rootTpl), nestedFrame = new TransientComponentVariantFrame(nestedTpl);
  Object.assign(f.viewCtx, {
    currentComponent: () => f.selection.context()?.component() ?? f.component,
    valComponentStack: () => f.selection.context() ? [rootVal, nestedVal] : [rootVal],
    componentStackFrames: () => f.selection.context() ? [rootFrame, nestedFrame] : [rootFrame],
  });
  f.viewCtx.frameState.valRootStore.setState(rootVal, true);
  const first = { ...f.context("root.first"), ownerComponent: f.component, ownerKey: rootVal.key };
  const second = { ...f.context("root.inner.tag"), ownerComponent: nested, ownerKey: nestedVal.key };
  const third = { ...f.context("root.other.tag"), ownerComponent: unrelated, ownerKey: "root.other" };
  const firstNode = mkTplTagX("div"), secondNode = mkTplTagX("span"), thirdNode = mkTplTagX("i");
  const a = vi.fn(() => f.viewCtx.currentComponent().name), b = vi.fn(() => f.viewCtx.currentComponent().name), other = vi.fn(() => "unchanged");
  const stop = autorun(() => {
    f.tick.get();
    f.owner.render(firstNode, first, a); f.owner.render(secondNode, second, b); f.owner.render(thirdNode, third, other);
  });
  f.selection.setContext(new ComponentCtx({ valComponent: nestedVal }));
  expect(a).toHaveBeenCalledTimes(2);
  expect(b).toHaveBeenCalledTimes(2);
  expect(other).toHaveBeenCalledTimes(1);
  f.selection.setContext(null);
  expect(a).toHaveBeenCalledTimes(3);
  expect(b).toHaveBeenCalledTimes(3);
  expect(other).toHaveBeenCalledTimes(1);
  stop(); f.dispose();
});

it("rebinds native model inputs when a runtime clone is replaced with the same uuid", () => {
  const f = fixture();
  const original = mkTplTagX("div"), replacement = clone(original, true);
  replacement.tag = "section";
  expect(replacement.uuid).toBe(original.uuid);
  expect(replacement.uid).not.toBe(original.uid);
  let node = original;
  const ctx = f.context("provider");
  const render = vi.fn(() => node.tag);
  const stop = autorun(() => { f.tick.get(); f.owner.render(node, ctx, render); });
  node = replacement;
  runInAction(() => f.tick.set(f.tick.get() + 1));
  replacement.tag = "article";
  f.snapshots.sync([{ type: "update", oldValue: "section", newValue: "article", changeNode: { inst: replacement, field: "tag" } }]);
  f.commits.forEach((listener) => listener({ type: "commit" }));
  expect(render).toHaveBeenCalledTimes(3);
  original.tag = "aside";
  f.snapshots.sync([{ type: "update", oldValue: "div", newValue: "aside", changeNode: { inst: original, field: "tag" } }]);
  f.commits.forEach((listener) => listener({ type: "commit" }));
  expect(render).toHaveBeenCalledTimes(3);
  stop(); f.dispose();
});

it("refreshes cached event handlers and wrapping context without changing the node identity", () => {
  const f = fixture(), node = mkTplTagX("button"), ctx = f.context("button");
  const first = vi.fn(), second = vi.fn();
  ctx.triggerProps = { button: { onClick: first, style: { color: "red" } } };
  ctx.wrappingEnv = { ...ctx.wrappingEnv, $ctx: { locale: "first" } };
  ctx.plasmicInvalidate = first;
  const render = vi.fn(() => ({
    ...ctx.triggerProps.button, locale: ctx.wrappingEnv.$ctx.locale, invalidate: ctx.plasmicInvalidate,
  }));
  let output: ReturnType<typeof render> | undefined;
  const stop = autorun(() => { f.tick.get(); output = f.owner.render(node, ctx, render); });
  const before = output;
  runInAction(() => f.tick.set(f.tick.get() + 1));
  expect(output).toBe(before);
  ctx.triggerProps.button.onClick = second;
  runInAction(() => f.tick.set(f.tick.get() + 1));
  expect(output?.onClick).toBe(second);
  expect(output?.locale).toBe("first");
  ctx.wrappingEnv.$ctx.locale = "second";
  runInAction(() => f.tick.set(f.tick.get() + 1));
  expect(output?.locale).toBe("second");
  ctx.plasmicInvalidate = second;
  runInAction(() => f.tick.set(f.tick.get() + 1));
  expect(output?.invalidate).toBe(second);
  expect(render).toHaveBeenCalledTimes(4);
  stop(); f.dispose();
});

it("uses the explicit state initialization hash and command identities as render inputs", () => {
  const f = fixture(), node = mkTplTagX("div"), ctx = f.context("state");
  const mutate = vi.fn();
  const spec = (hash: string) => ({ path: "value", type: "private" as const, variableType: "text" as const,
    initFuncHash: hash, initFunc: () => hash, onMutate: mutate });
  ctx.stateSpecs = [spec("first")];
  const render = vi.fn(() => ({ hash: ctx.stateSpecs[0].initFuncHash, mutate: ctx.stateSpecs[0].onMutate }));
  let output: ReturnType<typeof render> | undefined;
  const stop = autorun(() => { f.tick.get(); output = f.owner.render(node, ctx, render); });
  const before = output;
  ctx.stateSpecs = [spec("first")];
  runInAction(() => f.tick.set(f.tick.get() + 1));
  expect(output).toBe(before);
  ctx.stateSpecs = [spec("second")];
  runInAction(() => f.tick.set(f.tick.get() + 1));
  expect(output?.hash).toBe("second");
  const otherMutate = vi.fn(); ctx.stateSpecs[0].onMutate = otherMutate;
  runInAction(() => f.tick.set(f.tick.get() + 1));
  expect(output?.mutate).toBe(otherMutate);
  expect(render).toHaveBeenCalledTimes(3);
  stop(); f.dispose();
});

it("subscribes tag instances to their shared owning component contract and parent identity", () => {
  const f = fixture(), node = mkTplTagX("div"), other = mkTplTagX("span");
  const otherComponent = mkComponent({ name: "Other", type: ComponentType.Plain, tplTree: other });
  const ctx = { ...f.context("root.node"), ownerComponent: f.component };
  const otherCtx = { ...f.context("other.node"), ownerComponent: otherComponent };
  const render = vi.fn(() => ({ owner: ctx.ownerComponent.name, parent: node.parent?.uid }));
  const renderOther = vi.fn(() => otherCtx.ownerComponent.name);
  let output: ReturnType<typeof render> | undefined;
  const stop = autorun(() => {
    f.tick.get(); output = f.owner.render(node, ctx, render); f.owner.render(other, otherCtx, renderOther);
  });
  f.component.name = "Renamed";
  const parent = mkTplComponent(f.component, f.component.variants[0]);
  node.parent = parent;
  f.snapshots.sync([
    { type: "update", oldValue: "Owner", newValue: "Renamed", changeNode: { inst: f.component, field: "name" } },
    { type: "update", oldValue: undefined, newValue: parent, changeNode: { inst: node, field: "parent" } },
  ]);
  f.commits.forEach((listener) => listener({ type: "commit" }));
  expect(output).toEqual({ owner: "Renamed", parent: parent.uid });
  expect(render).toHaveBeenCalledTimes(2);
  expect(renderOther).toHaveBeenCalledTimes(1);
  const before = output;
  f.snapshots.sync([{ type: "update", oldValue: "Renamed", newValue: "Renamed", changeNode: { inst: f.component, field: "name" } }]);
  f.commits.forEach((listener) => listener({ type: "commit" }));
  expect(output).toBe(before);
  expect(render).toHaveBeenCalledTimes(2);
  stop(); f.dispose();
});

it("refreshes only the registered implementation's cached instance and preserves its element type", () => {
  const f = fixture();
  const first = () => null, second = () => null;
  const meta = { name: "Registered", importPath: "test", props: {} };
  const registrations = [{ component: first, meta }];
  vi.stubGlobal("__PlasmicComponentRegistry", registrations); vi.stubGlobal("__PlasmicContextRegistry", []);
  vi.stubGlobal("__PlasmicFunctionsRegistry", []); vi.stubGlobal("__PlasmicLibraryRegistry", []);
  try {
    const source = new CodeComponentsRegistry(globalThis, {});
    f.viewCtx.canvasCtx.registrations.install(source);
    const component = mkCodeComponent("Registered", meta, {});
    const tpl = mkTplComponent(component, component.variants[0]), other = mkTplTagX("span");
    const ctx = f.context("registered"), otherCtx = f.context("other");
    const render = vi.fn(() => React.createElement(ensure(f.viewCtx.canvasCtx.registrations.component("Registered").getState(), "Registration must be installed").runtime.impl));
    const renderOther = vi.fn(() => React.createElement("span"));
    let output: ReturnType<typeof render> | undefined;
    const stop = autorun(() => { f.tick.get(); output = f.owner.render(tpl, ctx, render); f.owner.render(other, otherCtx, renderOther); });
    expect(output?.type).toBe(first);
    registrations[0].component = second; source.clear(); f.viewCtx.canvasCtx.registrations.refresh();
    expect(output?.type).toBe(second);
    expect(render).toHaveBeenCalledTimes(2);
    expect(renderOther).toHaveBeenCalledTimes(1);
    source.clear(); f.viewCtx.canvasCtx.registrations.refresh();
    expect(render).toHaveBeenCalledTimes(2);
    stop();
  } finally { f.dispose(); vi.unstubAllGlobals(); }
});

it("invalidates slot ancestors before a synchronous native selector can read a cached parent", () => {
  const f = fixture(), frame = f.viewCtx.arenaFrame();
  f.viewCtx.variants.transaction(() => {
    f.viewCtx.variants.replaceFrames([new RootComponentVariantFrame(frame)]);
    f.viewCtx.variants.setGlobal(new GlobalVariantFrame(f.viewCtx.site, frame));
  });
  const value = new ValComponent({ tpl: frame.container, key: "root", fullKey: "root", frameUid: frame.uid,
    valOwner: undefined, parent: undefined, fibers: [], className: "", slotInfo: undefined, slotArgs: new Map(), slotCanvasEnvs: new Map() });
  f.viewCtx.frameState.renderState.registerVal(value); f.viewCtx.frameState.valRootStore.setState(value, true);
  f.selection.setContext(new ComponentCtx({ valComponent: value }));
  const inputs = f.owner.variantInputs(f.viewCtx);
  const root = mkTplTagX("div"), slot = mkSlot(ensureKnownSlotParam(mkParam({ name: "children", paramType: "slot", type: typeFactory.renderable() }))), other = mkTplTagX("span");
  const context = (key: string) => ({ ...f.context(key), ownerComponent: f.component, ownerKey: "root", forceValComponentKeysWithDefaultSlotContents: new Set<string>() });
  const rootCtx = context("root.tag"), slotCtx = context("root.tag.slot"), otherCtx = context("root.tag.other");
  const draw = () => runInAction(() => f.tick.set(f.tick.get() + 1));
  const observed: unknown[] = [];
  let output: unknown;
  // Install the UI subscriber first, before the Slot is retained in the cache.
  const stopSelector = inputs.slotStore("root").subscribe((force) => {
    slotCtx.forceValComponentKeysWithDefaultSlotContents = new Set(force ? ["root"] : []);
    draw(); observed.push(output);
  });
  const renderSlot = vi.fn(() => slotCtx.forceValComponentKeysWithDefaultSlotContents.has("root") ? "default" : "arg");
  const renderOther = vi.fn(() => "sibling");
  const renderRoot = vi.fn(() => [f.owner.render(slot, slotCtx, renderSlot), f.owner.render(other, otherCtx, renderOther)]);
  const stop = autorun(() => { f.tick.get(); output = f.owner.render(root, rootCtx, renderRoot); });
  expect(output).toEqual(["arg", "sibling"]);
  f.viewCtx.variants.setShowDefaultSlots(true);
  expect(observed).toEqual([["default", "sibling"]]);
  expect(output).toEqual(["default", "sibling"]);
  expect(renderRoot).toHaveBeenCalledTimes(2); expect(renderSlot).toHaveBeenCalledTimes(2);
  expect(renderOther).toHaveBeenCalledTimes(1);
  stopSelector(); stop(); f.dispose();
});

it("installs drag selection and clears selected cache paths before native UI publication while siblings stay cached", () => {
  const f = fixture();
  const child = mkTplTagX("span"), sibling = mkTplTagX("i"), root = mkTplTagX("div", {}, [child, sibling]);
  f.selection.setTpls([child]);
  f.autoOpenRequested.set(true);
  const rootCtx = f.context(root.uuid), childCtx = f.context(`${root.uuid}.${child.uuid}`), siblingCtx = f.context(`${root.uuid}.${sibling.uuid}`);
  const renderChild = vi.fn(() => f.owner.selectionInput(f.viewCtx, child, childCtx.valKey).getState().isSelected && f.viewCtx.studioCtx.isAutoOpenMode ? "open" : "closed");
  const renderSibling = vi.fn(() => "sibling");
  const renderRoot = vi.fn(() => [f.owner.render(child, childCtx, renderChild), f.owner.render(sibling, siblingCtx, renderSibling)]);
  let result: string[] | undefined;
  const snapshots: (string[] | undefined)[] = [];
  // Register synchronous UI first; correctness must not depend on subscription order.
  const stopUi = f.draggingState.subscribe(() => {
    runInAction(() => f.tick.set(f.tick.get() + 1));
    snapshots.push(result);
  });
  const stop = autorun(() => { f.tick.get(); result = f.owner.render(root, rootCtx, renderRoot); });
  expect(result).toEqual(["open", "sibling"]);
  const publish = f.owner.prepareDraggingObject(true);
  expect(f.draggingState.getState()).toBe(false);
  f.draggingState.setState(true, true);
  expect(snapshots).toEqual([["closed", "sibling"]]);
  publish();
  expect(result).toEqual(["closed", "sibling"]);
  expect(renderRoot).toHaveBeenCalledTimes(2);
  expect(renderChild).toHaveBeenCalledTimes(2);
  expect(renderSibling).toHaveBeenCalledTimes(1);
  f.owner.prepareDraggingObject(true)();
  expect(renderRoot).toHaveBeenCalledTimes(2);
  const restore = f.owner.prepareDraggingObject(false);
  f.draggingState.setState(false, true); restore();
  expect(result).toEqual(["open", "sibling"]);
  expect(renderChild).toHaveBeenCalledTimes(3);
  expect(renderSibling).toHaveBeenCalledTimes(1);
  runInAction(() => f.autoOpenRequested.set(false));
  expect(result).toEqual(["closed", "sibling"]);
  runInAction(() => f.autoOpenRequested.set(true));
  expect(result).toEqual(["open", "sibling"]);
  expect(renderSibling).toHaveBeenCalledTimes(1);
  stopUi(); stop(); f.dispose();
});

it("invalidates only node kinds consuming the changed policy scalar before input publication", () => {
  const f = fixture();
  const cc = mkCodeComponent("PolicyProbe", { name: "PolicyProbe", importPath: "policy-test", props: {} }, {});
  const child = mkTplComponent(cc, cc.variants[0]), sibling = mkTplTagX("img");
  const root = mkTplTagX("div", {}, [child, sibling]);
  const rootCtx = f.context(root.uuid), childCtx = f.context(`${root.uuid}.${child.uuid}`), siblingCtx = f.context(`${root.uuid}.${sibling.uuid}`);
  const childRender = vi.fn(() => React.createElement(Table.Column, { title: String(f.renderPolicy.store.getState().showSlotPlaceholder) }));
  const siblingRender = vi.fn(() => React.createElement(Table.Column, { title: "retained" }));
  const rootRender = vi.fn(() => React.createElement(Table, { children: [f.owner.render(child, childCtx, childRender), f.owner.render(sibling, siblingCtx, siblingRender)] }));
  let result: React.ReactElement | undefined;
  const stop = autorun(() => { f.tick.get(); result = f.owner.render(root, rootCtx, rootRender); });
  const before = result;
  const readReaction = new Reaction("Retained synchronous policy subscriber", () => undefined);
  const notify = vi.fn(() => {
    let rendered: ReturnType<typeof rootRender> | undefined;
    readReaction.track(() => { rendered = f.owner.render(root, rootCtx, rootRender); });
    const observed = ensure(rendered, "Synchronous policy render");
    expect(observed.type).toBe(Table);
    expect(React.Children.toArray(observed.props.children).map((element) => React.isValidElement(element) && element.type)).toEqual([Table.Column, Table.Column]);
    const first = React.Children.toArray(observed.props.children)[0];
    if (!React.isValidElement<{ title: string }>(first)) { throw new Error("Expected a retained Column element"); }
    expect(first.props.title).toBe("false");
    expect(siblingRender).toHaveBeenCalledTimes(1);
  });
  const off = f.renderPolicy.store.subscribe(notify);
  try {
    f.renderPolicy.toggleSlotPlaceholder();
    const policy = f.renderPolicy.prepareInputs();
    const publishFrame = f.frameInfo.prepare(), publishCache = f.owner.prepareRenderPolicy(policy);
    expect(childRender).toHaveBeenCalledTimes(1);
    f.renderPolicy.publishCommit();
    publishFrame(); publishCache();
    expect(notify).toHaveBeenCalledOnce();
    expect(result).not.toBe(before);
    expect(childRender).toHaveBeenCalledTimes(2);
    expect(siblingRender).toHaveBeenCalledTimes(1);
    off();
    const retained = result;
    f.renderPolicy.toggleContainerPlaceholder();
    const next = f.renderPolicy.prepareInputs();
    const publishUnchanged = f.owner.prepareRenderPolicy(next);
    f.renderPolicy.publishCommit(); publishUnchanged();
    expect(result).toBe(retained);
    expect(childRender).toHaveBeenCalledTimes(2);
    expect(siblingRender).toHaveBeenCalledTimes(1);
  } finally { readReaction.dispose(); off(); stop(); f.dispose(); }
});

it("updates interactive render inputs even when the frame output is unchanged", () => {
  const f = fixture(), node = mkTplTagX("button"), ctx = f.context("button");
  const draw = vi.fn(() => f.renderPolicy.store.getState().interactive);
  let output: boolean | undefined;
  const stop = autorun(() => { f.tick.get(); output = f.owner.render(node, ctx, draw); });
  const frameBefore = f.frameInfo.store.getState();
  const frameNotify = vi.fn(); const stopFrame = f.frameInfo.store.subscribe(frameNotify);
  const readReaction = new Reaction("Retained synchronous interactive subscriber", () => undefined);
  const stopPolicy = f.renderPolicy.store.subscribe(() => {
    let rendered: boolean | undefined;
    readReaction.track(() => { rendered = f.owner.render(node, ctx, draw); });
    expect(rendered).toBe(true);
    expect(f.frameInfo.store.getState()).toBe(frameBefore);
  });
  try {
    f.renderPolicy.interactive = true;
    const policy = f.renderPolicy.prepareInputs();
    const publishFrame = f.frameInfo.prepare(), publishCache = f.owner.prepareRenderPolicy(policy);
    f.renderPolicy.publishCommit(); publishFrame(); publishCache();
    expect(output).toBe(true);
    expect(draw).toHaveBeenCalledTimes(2);
    expect(frameNotify).not.toHaveBeenCalled();
  } finally { readReaction.dispose(); stopPolicy(); stopFrame(); stop(); f.dispose(); }
});



it("invalidates native expanded component keys and their retained ancestors before the first content-session notification", async () => {
  const f = fixture();
  const registration = mkCodeComponent("Expandable", { name: "Expandable", importPath: "test", props: {} }, {});
  const target = mkTplComponent(registration, f.viewCtx.site.globalVariant);
  const root = mkTplTagX("div"), sibling = mkTplTagX("span");
  const rootCtx = f.context("root"), targetCtx = f.context("root.target"), siblingCtx = f.context("root.sibling");
  const targetKey = computeFullKey(targetCtx);
  const targetRender = vi.fn(() => React.createElement(Table.Column, { title: String(f.contentEditor.isExpanded(targetKey)) }));
  const siblingRender = vi.fn(() => React.createElement(Table.Column, { title: "stable" }));
  const rootRender = vi.fn(() => React.createElement(Table, {}, f.owner.render(target, targetCtx, targetRender), f.owner.render(sibling, siblingCtx, siblingRender)));
  let output: React.ReactElement<{ children?: React.ReactNode }> | undefined;
  const stop = autorun(() => { f.tick.get(); output = f.owner.render(root, rootCtx, rootRender); });
  const before = output;
  const rawSibling = () => {
    const children = output?.props.children;
    if (!Array.isArray(children)) { throw new Error("Table raw child array"); }
    return children[1];
  };
  const beforeSibling = rawSibling();
  let resume: () => void = () => undefined;
  const blocked = new Promise<void>((resolve) => { resume = resolve; });
  vi.mocked(f.viewCtx.awaitSync).mockReturnValue(blocked);
  const targetHandle = { tpl: target, fullKey: targetKey, element: document.createElement("div") };
  const inspect = vi.fn(() => {
    expect(f.contentEditor.target).toBe(targetHandle);
    expect(f.contentEditors.store.getState()).toBe(f.contentEditor);
    expect(f.contentEditor.store.getState().target?.fullKey).toBe(targetKey);
    expect(output).not.toBe(before);
    expect(targetRender).toHaveBeenCalledTimes(2);
    expect(siblingRender).toHaveBeenCalledOnce();
    expect(rawSibling()).toBe(beforeSibling);
  });
  const off = f.contentEditor.store.subscribe(inspect);
  const entry = f.contentEditor.enter(targetHandle);
  try {
    expect(inspect).toHaveBeenCalledOnce();
    off();
    f.contentEditor.exit(false);
    expect(targetRender).toHaveBeenCalledTimes(3);
    expect(siblingRender).toHaveBeenCalledOnce();
  } finally { off(); resume(); await entry; stop(); f.dispose(); }
});


it("prepares export-sensitive native visibility and ancestor caches before the first frame reader while retaining visible siblings", () => {
  const f = fixture(), base = f.component.variants[0];
  const hidden = mkTplTagX("span", { baseVariant: base }), sibling = mkTplTagX("span", { baseVariant: base });
  const root = mkTplTagX("div", { baseVariant: base }, [hidden, sibling]);
  setTplVisibility(hidden, [base], TplVisibility.NotRendered);
  const rootCtx = f.context(root.uuid), hiddenCtx = f.context(`${root.uuid}.${hidden.uuid}`), siblingCtx = f.context(`${root.uuid}.${sibling.uuid}`);
  f.selection.setTpls([hidden]); f.autoOpenRequested.set(true);
  f.viewCtx.setCanvasExporting(true);
  const renderHidden = vi.fn(() => React.createElement(Table.Column, { title: String(_testOnlyUtils.determineAutoOpenState(hiddenCtx, hidden, new EffectiveVariantSetting(hidden, hidden.vsettings)).autoOpened) }));
  const renderSibling = vi.fn(() => React.createElement(Table.Column, { title: "unchanged" }));
  const renderRoot = () => React.createElement(Table, {}, f.owner.render(hidden, hiddenCtx, renderHidden), f.owner.render(sibling, siblingCtx, renderSibling));
  let output: React.ReactElement<{ children?: React.ReactNode }> | undefined;
  const stop = autorun(() => { f.tick.get(); output = f.owner.render(root, rootCtx, renderRoot); });
  const beforeSibling = ensure(output, "Initial table").props.children;
  expect(renderHidden).toHaveBeenCalledTimes(1);
  const probe = new Reaction("first-export-frame-reader", () => undefined);
  const inspect = vi.fn(() => probe.track(() => {
    const result = f.owner.render(root, rootCtx, renderRoot);
    const children = result.props.children;
    if (!Array.isArray(children) || !Array.isArray(beforeSibling)) { throw new Error("Unwrapped table child array"); }
    expect(React.isValidElement<{ title: string }>(children[0]) && children[0].props.title).toBe("true");
    expect(children[1]).toBe(beforeSibling[1]);
  }));
  const off = f.frameInfo.store.subscribe(inspect);
  try {
    f.viewCtx.setCanvasExporting(false);
    expect(inspect).toHaveBeenCalledOnce();
    expect(renderHidden.mock.calls.length).toBeGreaterThan(1); expect(renderSibling).toHaveBeenCalledTimes(1);
    const rendered = renderHidden.mock.calls.length;
    f.viewCtx.setCanvasExporting(false);
    expect(inspect).toHaveBeenCalledOnce(); expect(renderHidden).toHaveBeenCalledTimes(rendered);
  } finally { off(); probe.dispose(); stop(); f.dispose(); }
});
