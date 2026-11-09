import { ReferenceInputs } from "@/wab/client/components/sidebar/find-reference-inputs";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { instUtil } from "@/wab/shared/model/InstUtil";

it("publishes immutable reference labels from committed fields and retires their owner", () => {
  const site = createSite();
  const component = new TplMgr({ site }).addComponent({ name: "Initial", type: ComponentType.Plain });
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  const models = new ModelSnapshots();
  const lifetime = new AbortController();
  const world = { site, models, lifetime: lifetime.signal, isCurrent: () => !lifetime.signal.aborted };
  const source = new ReferenceInputs(world, { components: [component], frames: [] }, false);
  const first = source.getSnapshot();
  const notify = vi.fn();
  const stop = source.subscribe(notify);
  try {
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(ensure(first[0], "Reference"))).toBe(true);
    expect(first[0].displayName).toBe("Initial");
    const rename = recorder.withRecording(() => { component.name = "Committed"; });
    expect(source.getSnapshot()).toBe(first);
    models.sync(rename.changes);
    const next = source.getSnapshot();
    expect(next[0].displayName).toBe("Committed");
    expect(next[0].target).toBe(component);
    expect(first[0].displayName).toBe("Initial");
    expect(notify).toHaveBeenCalledOnce();
    expect(source.getSnapshot()).toBe(next);
    lifetime.abort();
    expect(source.getSnapshot()).toEqual([]);
    expect(notify).toHaveBeenCalledTimes(2);
  } finally { stop(); recorder.dispose(); models.dispose(); }
});
