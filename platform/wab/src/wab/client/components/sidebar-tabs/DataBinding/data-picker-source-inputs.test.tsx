import { mkDataToken } from "@/wab/commons/DataToken";
import { StudioArenaState } from "@/wab/client/studio-ctx/studio-arena-state";
import { useDataPickerSourceInputs } from "@/wab/client/components/sidebar-tabs/DataBinding/data-picker-source-inputs";
import { getSourceUiId } from "@/wab/client/components/sidebar-tabs/DataBinding/DataPickerUtil";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ComponentType } from "@/wab/shared/core/components";
import { mkParam } from "@/wab/shared/core/lang";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { ensureKnownTplTag } from "@/wab/shared/model/classes";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { typeFactory } from "@/wab/shared/model/model-util";
import { act, renderHook } from "@testing-library/react";

it("refreshes visible prop source links while unrelated document fields stay quiet and retired inputs release", () => {
  const site = createSite(), manager = new TplMgr({ site });
  const component = manager.addComponent({ type: ComponentType.Plain, name: "Source owner" });
  const param = mkParam({ name: "original", type: typeFactory.text(), paramType: "prop" }); component.params.push(param);
  const models = new ModelSnapshots(), recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  const arena = new StudioArenaState({ site, modelSnapshots: models });
  // A picker bound to a component owns that captured world. It does not need
  // the live Studio catalog's model-replacement subscription protocol.
  const studio = { site, modelSnapshots: models, arenaState: arena } as unknown as StudioCtx;
  const path = ["$props", "original"];
  const selectLink = () => ({ link: getSourceUiId(path, site, component) });
  const hook = renderHook(() => useDataPickerSourceInputs(studio, component, [path], selectLink));
  try {
    expect(hook.result.current?.link).toBeTruthy(); const before = hook.result.current;
    act(() => models.sync(recorder.withRecording(() => { ensureKnownTplTag(component.tplTree).name = "Unrelated canvas name"; }).changes));
    expect(hook.result.current).toBe(before);
    act(() => models.sync(recorder.withRecording(() => { param.variable.name = "renamed"; }).changes));
    expect(hook.result.current?.link).toBeUndefined(); const retired = hook.result.current;
    act(() => arena.reset());
    act(() => models.sync(recorder.withRecording(() => { param.variable.name = "original"; }).changes));
    expect(hook.result.current).toBe(retired);
  } finally { hook.unmount(); recorder.dispose(); arena.dispose(); models.dispose(); }
});

it("follows completed Studio world replacements only for an unbound live catalog", () => {
  const context = { site: createSite(), modelSnapshots: new ModelSnapshots() };
  context.site.dataTokens.push(mkDataToken({ name: "First", value: "1" }));
  const arena = new StudioArenaState(context);
  const listeners = new Set<Parameters<StudioCtx["subscribeModelChanges"]>[0]>();
  const studio = { get site() { return context.site; }, get modelSnapshots() { return context.modelSnapshots; }, arenaState: arena,
    subscribeModelChanges: (listener: Parameters<StudioCtx["subscribeModelChanges"]>[0]) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
  } as unknown as StudioCtx;
  const selectNames = () => Object.freeze(context.site.dataTokens.map((token) => token.name));
  const hook = renderHook(() => useDataPickerSourceInputs(studio, undefined, [["$dataTokens"]], selectNames));
  const departedModels = context.modelSnapshots;
  try {
    expect(hook.result.current).toEqual(["First"]);
    const next = createSite(); next.dataTokens.push(mkDataToken({ name: "Second", value: "2" }));
    act(() => {
      arena.reset(); context.site = next; context.modelSnapshots = new ModelSnapshots(); arena.attachSite();
      listeners.forEach((listener) => listener({ type: "site-replaced", site: next }));
    });
    expect(hook.result.current).toEqual(["Second"]);
    expect(listeners.size).toBe(1);
    hook.unmount(); expect(listeners.size).toBe(0);
  } finally { hook.unmount(); arena.dispose(); departedModels.dispose(); context.modelSnapshots.dispose(); }
});

it("retains the last committed display across a retired owner's rerender without evaluating its new selector", () => {
  const site = createSite(), manager = new TplMgr({ site });
  const component = manager.addComponent({ type: ComponentType.Plain, name: "Captured owner" });
  const param = mkParam({ name: "original", type: typeFactory.text(), paramType: "prop" }); component.params.push(param);
  const models = new ModelSnapshots(), recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  const arena = new StudioArenaState({ site, modelSnapshots: models });
  const studio = { site, modelSnapshots: models, arenaState: arena } as unknown as StudioCtx;
  const read = vi.fn();
  const hook = renderHook(({ suffix }) => useDataPickerSourceInputs(studio, component, [["$props"]], () => { read(); return `${param.variable.name}:${suffix}`; }), { initialProps: { suffix: "first" } });
  try {
    expect(hook.result.current).toBe("original:first");
    act(() => arena.reset());
    act(() => models.sync(recorder.withRecording(() => { param.variable.name = "departed"; }).changes));
    read.mockClear();
    hook.rerender({ suffix: "second" });
    expect(read).not.toHaveBeenCalled();
    expect(hook.result.current).toBe("original:first");
  } finally { hook.unmount(); recorder.dispose(); arena.dispose(); models.dispose(); }
});
