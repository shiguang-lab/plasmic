import { CloneVariantInputs } from "@/wab/client/components/canvas/HoverBox/clone-variant-inputs";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { RootComponentVariantFrame } from "@/wab/shared/component-frame";
import { mkBaseVariant, mkVariant } from "@/wab/shared/Variants";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { createSite } from "@/wab/shared/core/sites";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { mock } from "vitest-mock-extended";

it("changes clone tint classification for native target variant names and closes its original world", () => {
  const base = mkBaseVariant(), selected = mkVariant({ name: "Active" });
  const root = mkTplTagX("div");
  const component = mkComponent({ name: "Clones", type: ComponentType.Plain, tplTree: root, variants: [base, selected] });
  const site = createSite(); site.components.push(component);
  const frame = mkArenaFrame({ site, component, name: "Clones", width: 100, height: 100 });
  frame.targetVariants = [selected]; site.arenas.push(mkMixedArena("Canvas", [frame]));
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  const models = new ModelSnapshots(), next = new ModelSnapshots(), signal = new AbortController();
  const studio = mock<StudioCtx>(); Object.defineProperty(studio, "modelSnapshots", { value: models, writable: true });
  const view = mock<ViewCtx>(); Object.defineProperty(view, "studioCtx", { value: studio });
  const manager = mock<ReturnType<ViewCtx["variantTplMgr"]>>();
  manager.getContainingFrame.mockReturnValue(new RootComponentVariantFrame(frame)); view.variantTplMgr.mockReturnValue(manager);
  const source = new CloneVariantInputs({ view, models, signal: signal.signal }, root);
  const publish = vi.fn(), stop = source.subscribe(publish); publish.mockClear();
  try {
    expect(source.getSnapshot().targeting).toBe(true);
    models.sync(recorder.withRecording(() => { selected.name = "base"; }).changes);
    expect(source.getSnapshot().targeting).toBe(false); expect(publish).toHaveBeenCalledOnce(); publish.mockClear();
    models.sync(recorder.withRecording(() => { selected.name = "Active again"; }).changes);
    expect(source.getSnapshot().targeting).toBe(true); expect(publish).toHaveBeenCalledOnce();
    Object.defineProperty(studio, "modelSnapshots", { value: next, writable: true });
    const demand = vi.spyOn(next, "field");
    expect(source.getSnapshot().alive).toBe(false); expect(demand).not.toHaveBeenCalled();
  } finally { stop(); signal.abort(); models.dispose(); next.dispose(); recorder.dispose(); }
});
