import { VariantComboFrameInputs, useVariantComboFrameInputs } from "@/wab/client/components/studio/arenas/variant-combo-frame-inputs";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { act, renderHook } from "@testing-library/react";
import { instUtil } from "@/wab/shared/model/InstUtil";

it("tracks the first combo frame, prunes removed dimensions and retires its command world", () => {
  const site = createSite();
  new TplMgr({ site }).addComponent({ type: ComponentType.Plain, name: "Combo" });
  const arena = ensure(site.componentArenas[0], "Component arena");
  const row = ensure(arena.matrix.rows[0], "Base row");
  const cell = ensure(row.cols[0], "Base cell");
  const frame = cell.frame;
  const models = new ModelSnapshots();
  const lifetime = new AbortController();
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  const studio = { site, modelSnapshots: models, arenaState: { lifetime: () => lifetime.signal } } as unknown as StudioCtx;
  const source = new VariantComboFrameInputs(studio, arena);
  const notify = vi.fn();
  const stop = source.subscribe(notify);
  try {
    expect(source.getSnapshot()).toEqual({ alive: true, component: arena.component, frame, width: frame.width });
    models.sync(recorder.withRecording(() => { frame.width += 100; }).changes);
    expect(source.getSnapshot().width).toBe(frame.width);
    expect(notify).toHaveBeenCalledOnce();
    models.sync(recorder.withRecording(() => { row.cols = []; }).changes);
    expect(source.getSnapshot().frame).toBeUndefined();
    notify.mockClear();
    models.sync(recorder.withRecording(() => { frame.width += 100; }).changes);
    expect(notify).not.toHaveBeenCalled();
    models.sync(recorder.withRecording(() => { row.cols = [cell]; }).changes);
    expect(source.getSnapshot().frame).toBe(frame);
    const retained = source.isCurrent;
    lifetime.abort();
    expect(retained()).toBe(false);
    expect(source.getSnapshot().alive).toBe(false);
    notify.mockClear();
    models.sync(recorder.withRecording(() => { frame.width += 100; }).changes);
    expect(notify).not.toHaveBeenCalled();
  } finally { stop(); recorder.dispose(); models.dispose(); }
});


it("keeps a retained arena in its original world and binds a replacement arena separately", () => {
  const site = createSite();
  new TplMgr({ site }).addComponent({ type: ComponentType.Plain, name: "Old" });
  const arena = ensure(site.componentArenas[0], "Old component arena");
  const nextSite = createSite();
  new TplMgr({ site: nextSite }).addComponent({ type: ComponentType.Plain, name: "Next" });
  const nextArena = ensure(nextSite.componentArenas[0], "New component arena");
  const models = new ModelSnapshots(), nextModels = new ModelSnapshots();
  let lifetime = new AbortController();
  const owner = { site, modelSnapshots: models, arenaState: { lifetime: () => lifetime.signal } };
  const studio = owner as unknown as StudioCtx;
  const hook = renderHook(({ currentArena }) => useVariantComboFrameInputs(studio, currentArena), { initialProps: { currentArena: arena } });
  const retained = hook.result.current.isCurrent;
  try {
    act(() => { lifetime.abort(); owner.site = nextSite; owner.modelSnapshots = nextModels; lifetime = new AbortController(); });
    hook.rerender({ currentArena: arena });
    expect(hook.result.current.alive).toBe(false);
    expect(retained()).toBe(false);
    expect(hook.result.current.site).toBe(site);
    hook.rerender({ currentArena: nextArena });
    expect(hook.result.current.alive).toBe(true);
    expect(hook.result.current.site).toBe(nextSite);
    expect(hook.result.current.component).toBe(nextArena.component);
  } finally { hook.unmount(); models.dispose(); nextModels.dispose(); }
});
