import { InspectorSelection } from "@/wab/client/studio-ctx/inspector-selection";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { autorun, observable, runInAction } from "mobx";

it("shares inspector reads and freezes canvas dependencies until selection commits", () => {
  const tpl = mkTplTagX("div");
  const revision = observable.box(0);
  const evaluate = vi.fn(() => ({ revision: revision.get() }));
  const environment = vi.fn(() => ({ revision: revision.get() }));
  const vc = {
    currentComponentCtx: () => null,
    focusedTpl: () => tpl,
    focusedTpls: () => [tpl],
    focusedSelectable: () => null,
    focusedCloneKey: () => "captured-clone",
    get canvasDomVersion() {
      return revision.get();
    },
    getComponentEvalContext: evaluate,
    getCanvasEnvForTpl: environment,
  } as unknown as ViewCtx;
  const selection = new InspectorSelection(vc, 1);
  const observed = vi.fn();
  const stop = autorun(() => {
    observed(
      selection.getComponentEvalContext(tpl),
      selection.getCanvasEnvForTpl(tpl),
    );
    // Several property rows consume the same context during one render.
    selection.getComponentEvalContext(tpl);
    selection.getCanvasEnvForTpl(tpl);
  });
  try {
    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(environment).toHaveBeenCalledTimes(1);
    expect(evaluate).toHaveBeenCalledWith(tpl, undefined, {
      anchorCloneKey: "captured-clone",
      ignoreFocusedCloneKey: true,
    });
    runInAction(() => revision.set(1));
    expect(observed).toHaveBeenCalledTimes(2);
    runInAction(() => selection.pause());
    runInAction(() => revision.set(2));
    expect(observed).toHaveBeenCalledTimes(2);
    expect(evaluate).toHaveBeenCalledTimes(2);
    expect(selection.getCanvasEnvForTpl(tpl)).toEqual({ revision: 1 });
    runInAction(() => selection.resume());
    expect(observed).toHaveBeenLastCalledWith({ revision: 2 }, { revision: 2 });
  } finally {
    stop();
  }
});
