import { CanvasViewInputs } from "@/wab/client/components/canvas/canvas-view-inputs";
import { customBehaviorRecipe } from "@/wab/client/components/sidebar-tabs/custom-behavior-inputs";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { TplMgr } from "@/wab/shared/TplMgr";
import { mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { ComponentType } from "@/wab/shared/core/components";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { ensureKnownTplTag } from "@/wab/shared/model/classes";

it("tracks attachment captions/catalog membership without unrelated canvas style, and releases old fields", () => {
  const site = createSite(), manager = new TplMgr({site});
  const owner = manager.addComponent({name: "Owner", type: ComponentType.Plain});
  const attachment = mkCodeComponent("Behavior", {name: "Behavior", importPath: "test", props: {}}, {});
  site.components.push(attachment);
  const tpl = ensureKnownTplTag(owner.tplTree), models = new ModelSnapshots(), lifetime = new AbortController();
  const studio = {site, modelSnapshots: models} as unknown as StudioCtx;
  const view = {studioCtx: studio} as unknown as ViewCtx;
  const recorder = new ChangeRecorder({inst: site, _instUtil: instUtil});
  const input = new CanvasViewInputs({studio, models, signal: lifetime.signal}, customBehaviorRecipe(view, tpl));
  const changed = vi.fn(), stop = input.subscribe(changed); changed.mockClear();
  try {
    const before = input.getSnapshot();
    models.sync(recorder.withRecording(() => {tpl.vsettings[0].rs.values.opacity = "0.5";}).changes);
    expect(input.getSnapshot()).toBe(before); expect(changed).not.toHaveBeenCalled();
    models.sync(recorder.withRecording(() => {attachment.codeComponentMeta.displayName = "Updated behavior"; attachment.codeComponentMeta.isAttachment = true;}).changes);
    expect(changed).toHaveBeenCalledOnce();
    lifetime.abort(); changed.mockClear();
    models.sync(recorder.withRecording(() => {attachment.name = "After close";}).changes);
    expect(input.getSnapshot().alive).toBe(false); expect(changed).not.toHaveBeenCalled();
  } finally {stop(); recorder.dispose(); models.dispose();}
});
