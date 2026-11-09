import { ComponentType } from "@/wab/shared/core/components";
import { ModelFieldSelector, type ModelFieldRead } from "@/wab/client/stores/model-field-selector";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { shallow } from "zustand/shallow";

it("installs one selected output per commit, rebinds references and releases inactive fields", () => {
  const site = createSite(), mgr = new TplMgr({ site }), first = mgr.addComponent({ type: ComponentType.Plain, name: "First" }), second = mgr.addComponent({ type: ComponentType.Plain, name: "Second" });
  const models = new ModelSnapshots(), lifetime = new AbortController();
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  const studio = { modelSnapshots: models, arenaState: { lifetime: () => lifetime.signal } } as unknown as StudioCtx;
  const select = vi.fn((read: ModelFieldRead) => {
    const component = models.resolve(read(site, "components")[0]);
    return Object.freeze({ name: read(component, "name"), type: read(component, "type") });
  });
  const source = new ModelFieldSelector(studio, select, shallow), notify = vi.fn();
  const stop = source.subscribe(notify);
  select.mockClear(); notify.mockClear();
  const commit = (command: () => void) => models.sync(recorder.withRecording(command).changes);
  try {
    commit(() => { first.name = "Final"; first.type = "page"; });
    expect(source.getSnapshot()).toEqual({ name: "Final", type: "page" });
    expect(select).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledTimes(1);
    select.mockClear(); notify.mockClear();
    commit(() => { second.name = "Unrelated"; });
    expect(select).not.toHaveBeenCalled();
    commit(() => { site.components.reverse(); });
    expect(source.getSnapshot()?.name).toBe("Unrelated");
    select.mockClear(); notify.mockClear();
    commit(() => { first.name = "Former target"; });
    expect(select).not.toHaveBeenCalled();
    stop();
    commit(() => { second.name = "While disconnected"; });
    const reconnect = source.subscribe(notify);
    expect(source.getSnapshot()?.name).toBe("While disconnected");
    lifetime.abort();
    expect(source.getSnapshot()).toBeUndefined();
    select.mockClear(); notify.mockClear();
    commit(() => { second.name = "After retirement"; });
    expect(select).not.toHaveBeenCalled(); expect(notify).not.toHaveBeenCalled();
    reconnect();
  } finally { stop(); models.dispose(); recorder.dispose(); }
});
