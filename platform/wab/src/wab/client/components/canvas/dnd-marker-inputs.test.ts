import { ensureBaseVariantSetting } from "@/wab/shared/VariantTplMgr";
import { mkBaseVariant } from "@/wab/shared/Variants";
import { CanvasViewInputs } from "@/wab/client/components/canvas/canvas-view-inputs";
import { dndMarkerModelFields } from "@/wab/client/components/canvas/dnd-marker-inputs";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { mock } from "vitest-mock-extended";

it("publishes drop-target classification and stretch changes without subscribing unrelated nodes", () => {
  const base = mkBaseVariant();
  const target = mkTplTagX("div", { baseVariant: base }), sibling = mkTplTagX("div", { baseVariant: base });
  const root = mkTplTagX("div", { baseVariant: base }, [target, sibling]);
  const component = mkComponent({ name: "Drop", type: ComponentType.Plain, variants: [base], tplTree: root });
  [root, target, sibling].forEach((node) => ensureBaseVariantSetting(component, node));
  const site = createSite(); site.components.push(component);
  const frame = mkArenaFrame({ site, component, name: "Drop", width: 800, height: 600 });
  site.arenas.push(mkMixedArena("Drop", [frame]));
  const models = new ModelSnapshots(), next = new ModelSnapshots(), lifetime = new AbortController();
  const studio = mock<StudioCtx>(); Object.defineProperty(studio, "modelSnapshots", { value: models, writable: true });
  const source = new CanvasViewInputs({ studio, models, signal: lifetime.signal }, (field) => dndMarkerModelFields(field, frame, target));
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  const notify = vi.fn(), stop = source.subscribe(notify); notify.mockClear();
  try {
    models.sync(recorder.withRecording(() => { target.vsettings[0].rs.values.display = "flex"; }).changes);
    expect(notify).toHaveBeenCalledOnce(); notify.mockClear();
    models.sync(recorder.withRecording(() => { sibling.vsettings[0].rs.values.display = "grid"; }).changes);
    expect(notify).not.toHaveBeenCalled();
    models.sync(recorder.withRecording(() => {
      root.children = []; target.parent = null; sibling.parent = null;
      frame.container.component.tplTree = target;
    }).changes);
    expect(notify).toHaveBeenCalledOnce();
    Object.defineProperty(studio, "modelSnapshots", { value: next });
    const demand = vi.spyOn(next, "declaredField");
    expect(source.getSnapshot().alive).toBe(false); expect(demand).not.toHaveBeenCalled();
  } finally { stop(); lifetime.abort(); models.dispose(); next.dispose(); recorder.dispose(); }
});
