import { ComponentType } from "@/wab/shared/core/components";
import { createInspectorTitleInputs } from "@/wab/client/components/studio/inspector-title-inputs";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplComponentX } from "@/wab/shared/core/tpls";
import { instUtil } from "@/wab/shared/model/InstUtil";

it("tracks a referenced component's label and skips selected-component style edits", () => {
  const site = createSite(), mgr = new TplMgr({ site });
  const target = mgr.addComponent({ type: ComponentType.Plain, name: "Card" });
  const tpl = mkTplComponentX({ component: target, baseVariant: target.variants[0] });
  const owner = mgr.addComponent({ type: ComponentType.Plain, name: "Page" });
  owner.tplTree = tpl;
  const models = new ModelSnapshots(), lifetime = new AbortController();
  const studio = { modelSnapshots: models, arenaState: { lifetime: () => lifetime.signal } } as unknown as StudioCtx;
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  const source = createInspectorTitleInputs(studio, tpl, owner), notify = vi.fn();
  const stop = source.subscribe(notify);
  const commit = (command: () => void) => models.sync(recorder.withRecording(command).changes);
  notify.mockClear();
  try {
    expect(source.getSnapshot()).toBe("Card");
    commit(() => { target.name = "Renamed card"; });
    expect(source.getSnapshot()).toBe("Renamed card"); expect(notify).toHaveBeenCalledTimes(1);
    notify.mockClear();
    commit(() => { tpl.vsettings[0].rs.values.color = "red"; });
    expect(notify).not.toHaveBeenCalled();
    commit(() => { tpl.name = "Instance label"; });
    expect(source.getSnapshot()).toBe("Instance label");
    notify.mockClear();
    commit(() => { target.name = "Now unused"; });
    expect(notify).not.toHaveBeenCalled();
    lifetime.abort(); expect(source.getSnapshot()).toBeUndefined();
  } finally { stop(); recorder.dispose(); models.dispose(); }
});
