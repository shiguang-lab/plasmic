import { CanvasViewInputs } from "@/wab/client/components/canvas/canvas-view-inputs";
import { canvasVariantChromeFields } from "@/wab/client/components/canvas/canvas-variant-chrome-inputs";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ComponentType } from "@/wab/shared/core/components";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { mkGlobalVariantSplit, SplitStatus, SplitType, isVariantUsedInSplits } from "@/wab/shared/core/splits";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { mock } from "vitest-mock-extended";

it("updates drawer group names, membership and split grouping without unrelated page contents", () => {
  const site = createSite(), manager = new TplMgr({ site });
  const component = manager.addComponent({ name: "Root", type: ComponentType.Plain });
  const unrelated = manager.addComponent({ name: "Other", type: ComponentType.Plain });
  const group = manager.createGlobalVariantGroup("Theme"), dark = manager.createGlobalVariant(group, "Dark");
  const models = new ModelSnapshots(), signal = new AbortController(), studio = mock<StudioCtx>();
  Object.defineProperty(studio, "modelSnapshots", { value: models });
  const source = new CanvasViewInputs({ studio, models, signal: signal.signal }, (field) => canvasVariantChromeFields(site, component, component.tplTree, field, true));
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  const changed = vi.fn(), stop = source.subscribe(changed); changed.mockClear();
  const edit = (fn: () => void) => models.sync(recorder.withRecording(fn).changes);
  try {
    edit(() => { unrelated.name = "Other title"; }); expect(changed).not.toHaveBeenCalled();
    edit(() => { group.param.variable.name = "Appearance"; }); expect(changed).toHaveBeenCalledOnce(); changed.mockClear();
    edit(() => { manager.createGlobalVariant(group, "Light"); }); expect(changed).toHaveBeenCalledOnce(); changed.mockClear();
    edit(() => { site.splits.push(mkGlobalVariantSplit({ group, variant: dark, type: SplitType.Experiment, status: SplitStatus.Running })); });
    expect(changed).toHaveBeenCalledOnce(); expect(isVariantUsedInSplits(site, dark)).toBe(true); changed.mockClear();
    edit(() => { site.splits = []; }); expect(changed).toHaveBeenCalledOnce(); expect(isVariantUsedInSplits(site, dark)).toBe(false);
    signal.abort(); expect(source.getSnapshot().alive).toBe(false);
  } finally { stop(); signal.abort(); models.dispose(); recorder.dispose(); }
});
