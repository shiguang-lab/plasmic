import { InspectorSelection } from "@/wab/client/studio-ctx/inspector-selection";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkTplTagX } from "@/wab/shared/core/tpls";

it("shares explicit Inspector reads and freezes runtime data while focus is pending", () => {
  const tpl = mkTplTagX("div");
  const props = { nested: { value: 0 } };
  let revision = 0;
  const evaluate = vi.fn(() => ({ componentPropValues: props, ccContextData: { revision }, invalidArgs: [] }));
  const environment = vi.fn(() => ({ revision }));
  const vc = {
    currentComponentCtx: () => null,
    focusedTpl: () => tpl,
    focusedTpls: () => [tpl],
    focusedSelectable: () => null,
    focusedCloneKey: () => "captured-clone",
    getComponentEvalContext: evaluate,
    getCanvasEnvForTpl: environment,
    maybeTpl2ValsInContext: () => [],
  } as unknown as ViewCtx;
  const selection = new InspectorSelection(vc, 1);
  const evaluation = selection.componentEvalStore(tpl);
  const env = selection.canvasEnvStore(tpl);
  const observed = vi.fn();
  const stopEvaluation = evaluation.subscribe(observed);
  const stopEnvironment = env.subscribe(observed);
  try {
    expect(selection.componentEvalStore(tpl)).toBe(evaluation);
    expect(selection.canvasEnvStore(tpl)).toBe(env);
    expect(evaluate).toHaveBeenCalledTimes(2);
    expect(evaluate).toHaveBeenLastCalledWith(tpl, undefined, { anchorCloneKey: "captured-clone", ignoreFocusedCloneKey: true });
    expect(environment).toHaveBeenCalledTimes(2);
    expect(observed).toHaveBeenCalledOnce();
    observed.mockClear();
    const first = evaluation.getState();
    props.nested.value = 1;
    revision = 1;
    // Runtime mutation cannot mutate an already published UI read.
    expect(first.componentPropValues.nested.value).toBe(0);
    selection.syncCanvas();
    expect(observed).toHaveBeenCalledTimes(2);
    expect(evaluation.getState().componentPropValues.nested.value).toBe(1);
    selection.pause();
    revision = 2;
    props.nested.value = 2;
    selection.syncCanvas();
    expect(observed).toHaveBeenCalledTimes(2);
    expect(evaluate).toHaveBeenCalledTimes(3);
    expect(env.getState()).toEqual({ revision: 1 });
    selection.resume();
    expect(env.getState()).toEqual({ revision: 2 });
    expect(evaluation.getState().componentPropValues.nested.value).toBe(2);
    expect(Object.isFrozen(evaluation.getState().componentPropValues.nested)).toBe(true);
    selection.dispose();
    observed.mockClear();
    revision = 3;
    selection.syncCanvas();
    expect(observed).not.toHaveBeenCalled();
  } finally {
    stopEvaluation(); stopEnvironment(); selection.dispose();
  }
});

it("invalidates only the provider whose context data changed", () => {
  const firstTpl = mkTplTagX("div");
  const secondTpl = mkTplTagX("div");
  let context = { revision: 0 };
  const evaluate = vi.fn(() => ({ componentPropValues: {}, ccContextData: context, invalidArgs: [] }));
  const vc = {
    currentComponentCtx: () => null,
    focusedTpl: () => firstTpl,
    focusedTpls: () => [firstTpl],
    focusedSelectable: () => null,
    focusedCloneKey: () => "clone",
    getComponentEvalContext: evaluate,
    maybeTpl2ValsInContext: (tpl: unknown) => [{ key: tpl === firstTpl ? "first" : "second" }],
  } as unknown as ViewCtx;
  const selection = new InspectorSelection(vc, 1);
  const first = selection.componentEvalStore(firstTpl);
  const second = selection.componentEvalStore(secondTpl);
  const secondSnapshot = second.getState();
  evaluate.mockClear();
  context = { revision: 1 };
  selection.syncContextData("first");
  expect(evaluate).not.toHaveBeenCalled();
  expect(first.getState().ccContextData).toEqual({ revision: 1 });
  expect(evaluate).toHaveBeenCalledExactlyOnceWith(firstTpl, undefined, { anchorCloneKey: "clone", ignoreFocusedCloneKey: true });
  expect(second.getState()).toBe(secondSnapshot);
  const committed = first.getState();
  selection.syncContextData("first");
  expect(first.getState()).toBe(committed);
  selection.dispose();
});

it("defers hidden runtime data capture until a read or resubscription and retains frozen snapshots", () => {
  const tpl = mkTplTagX("div");
  let visits = 0, revision = 0;
  const rows = Array.from({ length: 1000 }, (_, index) => ({ get value() { visits++; return index + revision; } }));
  const view = {
    currentComponentCtx: () => null, focusedTpl: () => tpl, focusedTpls: () => [tpl],
    focusedSelectable: () => null, focusedCloneKey: () => undefined,
    getCanvasEnvForTpl: () => ({ rows }), maybeTpl2ValsInContext: () => [],
  } as unknown as ViewCtx;
  const owner = new InspectorSelection(view, 1);
  const store = owner.canvasEnvStore(tpl);
  const stop = store.subscribe(() => undefined);
  const before = store.getState();
  stop(); visits = 0; revision = 1;
  owner.syncCanvas(); owner.syncCanvas();
  expect(visits).toBe(0);
  expect(before?.rows[0].value).toBe(0);
  const after = store.getState();
  expect(visits).toBe(1000);
  expect(after?.rows[0].value).toBe(1);
  expect(store.getState()).toBe(after);
  expect(visits).toBe(1000);
  revision = 2; visits = 0; owner.syncCanvas();
  const stopAgain = store.subscribe(() => undefined);
  expect(visits).toBe(1000);
  expect(store.getState()?.rows[0].value).toBe(2);
  expect(Object.isFrozen(store.getState()?.rows)).toBe(true);
  stopAgain(); owner.dispose(); visits = 0;
  owner.syncCanvas(); store.getState();
  expect(visits).toBe(0);
});

it("publishes real ValComponent writes after render and detaches runtime inputs at owner closure", async () => {
  const { ValComponent } = await import("@/wab/shared/core/val-nodes");
  const { mkTplComponentX } = await import("@/wab/shared/core/tpls");
  const { mkComponent, ComponentType } = await import("@/wab/shared/core/components");
  const component = mkComponent({name: "Runtime", type: ComponentType.Plain, tplTree: mkTplTagX("div")});
  const tpl = mkTplComponentX({component, baseVariant: component.variants[0]});
  const value = new ValComponent({tpl, valOwner: null, key: "runtime", fullKey: "runtime", frameUid: 1, fibers: [], parent: undefined, className: "", slotInfo: undefined, slotArgs: new Map(), slotCanvasEnvs: new Map()});
  value.codeComponentProps = {title: "Before"};
  const vc = {
    currentComponentCtx: () => null, focusedTpl: () => tpl, focusedTpls: () => [tpl], focusedSelectable: () => value,
    focusedCloneKey: () => "runtime", maybeTpl2ValsInContext: () => [value],
    getComponentEvalContext: () => ({componentPropValues: value.codeComponentProps ?? {}, ccContextData: undefined, invalidArgs: value.invalidArgs ?? []}),
  } as unknown as ViewCtx;
  const selection = new InspectorSelection(vc, 1), store = selection.componentEvalStore(tpl), changed = vi.fn();
  const stop = store.subscribe(changed);
  try {
    const before = store.getState();
    value.codeComponentProps = {title: "After"};
    expect(changed).toHaveBeenCalledOnce(); expect(store.getState().componentPropValues.title).toBe("After");
    expect(before.componentPropValues.title).toBe("Before");
    changed.mockClear(); const unchanged = value.codeComponentProps; value.codeComponentProps = unchanged; expect(changed).not.toHaveBeenCalled();
    selection.pause(); value.codeComponentProps = {title: "Pending"}; expect(changed).not.toHaveBeenCalled();
    expect(store.getState().componentPropValues.title).toBe("After");
    selection.resume(); expect(store.getState().componentPropValues.title).toBe("Pending");
    changed.mockClear();
    selection.dispose(); value.codeComponentProps = {title: "Retired"}; expect(changed).not.toHaveBeenCalled();
  } finally {stop(); selection.dispose();}
});
