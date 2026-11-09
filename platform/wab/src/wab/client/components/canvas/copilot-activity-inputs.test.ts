import { CopilotActivityInputs } from "@/wab/client/components/canvas/copilot-activity-inputs";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { mock } from "vitest-mock-extended";

function fixture() {
  const site = createSite();
  const first = mkComponent({ name: "First", type: ComponentType.Plain, tplTree: mkTplTagX("div") });
  const second = mkComponent({ name: "Second", type: ComponentType.Plain, tplTree: mkTplTagX("span") });
  site.components.push(first, second);
  const frame = mkArenaFrame({ site, component: first, name: "Frame", width: 100, height: 100 });
  site.arenas.push(mkMixedArena("Canvas", [frame]));
  const models = new ModelSnapshots();
  const lifetime = new AbortController();
  const studio = mock<StudioCtx>();
  Object.defineProperties(studio, { modelSnapshots: { value: models }, arenaState: { value: { lifetime: () => lifetime.signal } } });
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  const source = new CopilotActivityInputs(studio, [frame]);
  return { source, first, second, frame, lifetime,
    commit(command: () => void) { models.sync(recorder.withRecording(command).changes); },
    dispose() { lifetime.abort(); models.dispose(); recorder.dispose(); },
  };
}

it("tracks activity scope replacements, ignores unrelated fields and detaches old components", () => {
  const f = fixture();
  const listener = vi.fn();
  const stop = f.source.subscribe(listener);
  listener.mockClear();
  try {
    const initial = f.source.getSnapshot();
    f.commit(() => { f.second.name = "Renamed"; });
    expect(f.source.getSnapshot()).toBe(initial);
    expect(listener).not.toHaveBeenCalled();
    f.commit(() => { f.first.tplTree = mkTplTagX("section"); });
    expect(listener).toHaveBeenCalledOnce();
    listener.mockClear();
    f.commit(() => { f.frame.container.component = f.second; });
    expect(listener).toHaveBeenCalledOnce();
    listener.mockClear();
    f.commit(() => { f.first.tplTree = mkTplTagX("main"); });
    expect(listener).not.toHaveBeenCalled();
    f.commit(() => { f.second.tplTree = mkTplTagX("article"); });
    expect(listener).toHaveBeenCalledOnce();
    listener.mockClear();
    stop();
    f.commit(() => { f.second.tplTree = mkTplTagX("aside"); });
    expect(listener).not.toHaveBeenCalled();
  } finally { stop(); f.dispose(); }
});

it("releases scope subscriptions when the model lifetime closes", () => {
  const f = fixture();
  const listener = vi.fn();
  const stop = f.source.subscribe(listener);
  listener.mockClear();
  try {
    f.lifetime.abort();
    expect(listener).toHaveBeenCalledOnce();
    expect(f.source.getSnapshot()).toEqual([]);
    listener.mockClear();
    f.commit(() => { f.first.tplTree = mkTplTagX("section"); });
    expect(listener).not.toHaveBeenCalled();
  } finally { stop(); f.dispose(); }
});
