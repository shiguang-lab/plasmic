import { createStore } from "zustand/vanilla";
import { CanvasRenderOwner } from "@/wab/client/components/canvas/canvas-cache";
import { CanvasSessionState } from "@/wab/client/components/canvas/canvas-session-state";
import { ViewSelection } from "@/wab/client/studio-ctx/view-selection";
import { ViewVariantState } from "@/wab/client/studio-ctx/view-variant-state";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { mkArenaFrame } from "@/wab/shared/Arenas";
import { BaseCliSvrEvaluator, DevCliSvrEvaluator } from "@/wab/client/cseval";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { clone, mkTplComponent, mkTplTagX } from "@/wab/shared/core/tpls";
import { ValComponent } from "@/wab/shared/core/val-nodes";
import { CodeComponentMeta } from "@/wab/shared/model/classes";
import { autorun, observable, runInAction } from "mobx";

function makeVal(name: string, isContext = true) {
  const component = mkComponent({
    name,
    type: isContext ? ComponentType.Code : ComponentType.Plain,
    tplTree: mkTplTagX("div"),
    codeComponentMeta: isContext
      ? ({ isContext: true, importPath: "test" } as CodeComponentMeta)
      : null,
  });
  const settingsTpl = mkTplComponent(component, component.variants[0]);
  const val = new ValComponent({
    tpl: clone(settingsTpl, true),
    key: name,
    fullKey: name,
    frameUid: 1,
    valOwner: undefined,
    parent: undefined,
    fibers: [],
    className: "",
    slotInfo: undefined,
    slotArgs: new Map(),
    slotCanvasEnvs: new Map(),
  });
  return { val, settingsTpl };
}

it("resolves rendered provider clones through the global wrapper chain only", () => {
  const outer = makeVal("OtherGlobalContext");
  const hello = makeVal("HelloGlobalContext");
  const selected = makeVal("SelectedComponent", false);
  const nested = makeVal("NestedContext");
  outer.val.contents = [hello.val];
  hello.val.contents = [selected.val];
  selected.val.contents = [nested.val];
  const resolve = (name: string) =>
    BaseCliSvrEvaluator.prototype.getGlobalContextTpl.call(
      { valRoot: outer.val },
      name,
    );
  expect(resolve("HelloGlobalContext")).toBe(hello.val.tpl);
  expect(resolve("HelloGlobalContext")).not.toBe(hello.settingsTpl);
  expect(resolve("OtherGlobalContext")).toBe(outer.val.tpl);
  expect(resolve("SelectedComponent")).toBeUndefined();
  expect(resolve("NestedContext")).toBeUndefined();
  expect(resolve("MissingContext")).toBeUndefined();
});

it("tracks providers that finish rendering after the editor opens", () => {
  const outer = makeVal("OtherGlobalContext");
  const hello = makeVal("HelloGlobalContext");
  const root = observable.box<ValComponent | undefined>(undefined);
  const evaluator = {
    get valRoot() {
      return root.get();
    },
  };
  let tpl;
  const dispose = autorun(() => {
    tpl = BaseCliSvrEvaluator.prototype.getGlobalContextTpl.call(
      evaluator,
      "HelloGlobalContext",
    );
  });
  expect(tpl).toBeUndefined();
  runInAction(() => root.set(outer.val));
  expect(tpl).toBeUndefined();
  runInAction(() => (outer.val.contents = [hello.val]));
  expect(tpl).toBe(hello.val.tpl);
  runInAction(() => root.set(undefined));
  expect(tpl).toBeUndefined();
  dispose();
});

it("uses the frame's native root store and publishes render status without a copied root", async () => {
  vi.useFakeTimers();
  const { globalHookCtx } = await import("@/wab/client/react-global-hook/globalHook");
  const { createSite } = await import("@/wab/shared/core/sites");
  const frame = globalHookCtx.createFrameState({ uid: 908, objectPrototype: {} });
  const flush = vi.fn();
  const site = createSite();
  const root = makeVal("Root", false).val;
  const arena = mkArenaFrame({ site, component: root.tpl.component, width: 800, height: 600, name: "Root" });
  const models = new ModelSnapshots();
  const selection = new ViewSelection(() => models);
  const variants = new ViewVariantState(() => models, () => arena, () => site, () => false, () => false);
  const session = new CanvasSessionState();
  const owner = new CanvasRenderOwner(session);
  const viewCtx = {
    site, isDisposed: false, flushRerenderQueue: flush, frameState: frame,
    studioCtx: { siteInfo: { id: "cseval-project" }, draggingObjectStore: createStore<boolean>(() => false), modelSnapshots: models, hasPendingModelChanges: () => false, subscribeModelChanges: () => () => undefined },
    selectionStore: selection.store, variantStore: variants.store, canvasRenderOwner: owner,
    arenaFrame: () => arena, componentArgsContainer: () => arena.container,
    focusedSelectable: () => true,
  } as unknown as import("@/wab/client/studio-ctx/view-ctx").ViewCtx;
  const evaluator = new DevCliSvrEvaluator({ viewCtx, frameState: frame });
  expect(evaluator.valRootStore).toBe(frame.valRootStore);
  frame.valRootStore.setState(root, true);
  expect(evaluator.valRoot).toBe(root);
  const firstRender = vi.fn();
  const stop = evaluator.renderStatusStore.subscribe((next, previous) => {
    if (next.isFirstRenderComplete !== previous.isFirstRenderComplete) {
      firstRender(next.isFirstRenderComplete);
    }
  });
  evaluator.rootNode = "rendered";
  await evaluator.evalAsync(); evaluator.runPostEvalTasks();
  await evaluator.evalAsync(); evaluator.runPostEvalTasks();
  expect(evaluator.renderCount).toBe(2);
  expect(evaluator.isFirstRenderComplete).toBe(true);
  expect(firstRender).toHaveBeenCalledExactlyOnceWith(true);
  await vi.runAllTimersAsync();
  const count = flush.mock.calls.length;
  evaluator.dispose();
  frame.valRootStore.setState(null, true);
  await vi.runAllTimersAsync();
  expect(flush).toHaveBeenCalledTimes(count);
  stop(); owner.dispose(); session.dispose(); selection.dispose(); variants.dispose(); models.dispose(); frame.dispose(); vi.useRealTimers();
});
