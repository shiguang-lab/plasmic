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
    expect(evaluate).toHaveBeenCalledExactlyOnceWith(tpl, undefined, { anchorCloneKey: "captured-clone", ignoreFocusedCloneKey: true });
    expect(environment).toHaveBeenCalledTimes(1);
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
    expect(evaluate).toHaveBeenCalledTimes(2);
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
  expect(evaluate).toHaveBeenCalledExactlyOnceWith(firstTpl, undefined, { anchorCloneKey: "clone", ignoreFocusedCloneKey: true });
  expect(first.getState().ccContextData).toEqual({ revision: 1 });
  expect(second.getState()).toBe(secondSnapshot);
  const committed = first.getState();
  selection.syncContextData("first");
  expect(first.getState()).toBe(committed);
  selection.dispose();
});
