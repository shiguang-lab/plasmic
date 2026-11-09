import { ParentStackItemInputs } from "@/wab/client/components/canvas/HoverBox/parent-stack-inputs";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena, FrameViewMode } from "@/wab/shared/Arenas";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { ValTag } from "@/wab/shared/core/val-nodes";
import { createSite } from "@/wab/shared/core/sites";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { mock } from "vitest-mock-extended";

it("keeps parent labels and root frame classification live without observing unrelated child names", () => {
  const child = mkTplTagX("span"), root = mkTplTagX("div", {}, [child]);
  const component = mkComponent({ name: "Parent", type: ComponentType.Plain, tplTree: root });
  const site = createSite(); site.components.push(component);
  const frame = mkArenaFrame({ site, component, name: "Frame", width: 100, height: 100 });
  site.arenas.push(mkMixedArena("Canvas", [frame]));
  const models = new ModelSnapshots(), signal = new AbortController();
  const studio = mock<StudioCtx>(); Object.defineProperty(studio, "modelSnapshots", { value: models });
  const view = mock<ViewCtx>(); Object.defineProperty(view, "studioCtx", { value: studio }); view.arenaFrame.mockReturnValue(frame);
  const val = new ValTag({ tpl: root, children: [], className: "", key: "parent", fullKey: "parent", frameUid: frame.uid, fibers: [], parent: undefined, valOwner: undefined, slotInfo: undefined });
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  const source = new ParentStackItemInputs({ view, models, signal: signal.signal }, val, true);
  const publish = vi.fn(), stop = source.subscribe(publish); publish.mockClear();
  try {
    const before = source.getSnapshot();
    models.sync(recorder.withRecording(() => { child.name = "Unrelated"; }).changes);
    expect(source.getSnapshot()).toBe(before); expect(publish).not.toHaveBeenCalled();
    models.sync(recorder.withRecording(() => { root.name = "Renamed parent"; }).changes);
    expect(publish).toHaveBeenCalledOnce(); publish.mockClear();
    models.sync(recorder.withRecording(() => { frame.viewMode = FrameViewMode.Centered; }).changes);
    expect(publish).toHaveBeenCalledOnce(); publish.mockClear();
    signal.abort();
    expect(source.getSnapshot().alive).toBe(false);
    expect(publish).toHaveBeenCalledOnce(); publish.mockClear();
    models.sync(recorder.withRecording(() => { root.name = "After closing"; }).changes);
    expect(publish).not.toHaveBeenCalled();
  } finally { stop(); signal.abort(); models.dispose(); recorder.dispose(); }
});
