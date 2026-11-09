import { InlineAddInputs } from "@/wab/client/components/canvas/HoverBox/inline-add-inputs";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { mkTplTagX, TplTagType } from "@/wab/shared/core/tpls";
import { createSite } from "@/wab/shared/core/sites";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { mock } from "vitest-mock-extended";

it("publishes parent/text and empty-container eligibility inputs without observing labels", () => {
  const child = mkTplTagX("div"), root = mkTplTagX("div", {}, [child]);
  const component = mkComponent({ name: "Content", type: ComponentType.Plain, tplTree: root });
  const site = createSite(); site.components.push(component);
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  const models = new ModelSnapshots(), signal = new AbortController();
  const studio = mock<StudioCtx>(); Object.defineProperty(studio, "modelSnapshots", { value: models });
  const view = mock<ViewCtx>(); Object.defineProperty(view, "studioCtx", { value: studio }); view.currentComponent.mockReturnValue(component);
  const source = new InlineAddInputs({ view, models, signal: signal.signal }, child);
  const publish = vi.fn(), stop = source.subscribe(publish); publish.mockClear();
  const commit = (command: () => void) => models.sync(recorder.withRecording(command).changes);
  try {
    const initial = source.getSnapshot();
    commit(() => { child.name = "Only a label"; });
    expect(source.getSnapshot()).toBe(initial); expect(publish).not.toHaveBeenCalled();
    commit(() => { child.children = [mkTplTagX("span")]; });
    expect(publish).toHaveBeenCalledOnce(); publish.mockClear();
    commit(() => { root.type = TplTagType.Text; });
    expect(publish).toHaveBeenCalledOnce(); publish.mockClear();
    signal.abort(); expect(source.getSnapshot().alive).toBe(false);
    publish.mockClear(); commit(() => { child.children = []; }); expect(publish).not.toHaveBeenCalled();
  } finally { stop(); signal.abort(); models.dispose(); recorder.dispose(); }
});
