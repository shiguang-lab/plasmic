import { useInsertActionComponent } from "@/wab/client/components/studio/add-drawer/insert-action-inputs";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ComponentType } from "@/wab/shared/core/components";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { act, cleanup, renderHook } from "@testing-library/react";

afterEach(cleanup);

it("tracks component classification and retires its subscription and retained command", () => {
  const site = createSite();
  const component = new TplMgr({ site }).addComponent({ type: ComponentType.Plain, name: "Insert target" });
  const models = new ModelSnapshots();
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  const lifetime = new AbortController();
  const type = models.field(component, "type");
  const subscribe = type.subscribe.bind(type);
  const release = vi.fn();
  vi.spyOn(type, "subscribe").mockImplementation((listener) => {
    const stop = subscribe(listener);
    return () => { release(); stop(); };
  });
  const studio = { modelSnapshots: models, arenaState: { lifetime: () => lifetime.signal } } as unknown as StudioCtx;
  let renders = 0;
  const hook = renderHook(() => { renders++; return useInsertActionComponent(studio, component); });
  const retained = hook.result.current.isCurrent;
  try {
    expect(hook.result.current.alive).toBe(true);
    const before = renders;
    act(() => models.sync(recorder.withRecording(() => { component.type = ComponentType.Frame; }).changes));
    expect(renders).toBeGreaterThan(before);
    act(() => lifetime.abort());
    expect(hook.result.current.alive).toBe(false);
    expect(retained()).toBe(false);
    expect(release).toHaveBeenCalledOnce();
    const retiredRenders = renders;
    act(() => models.sync(recorder.withRecording(() => { component.type = ComponentType.Plain; }).changes));
    expect(renders).toBe(retiredRenders);
  } finally {
    hook.unmount(); recorder.dispose(); models.dispose();
  }
});
