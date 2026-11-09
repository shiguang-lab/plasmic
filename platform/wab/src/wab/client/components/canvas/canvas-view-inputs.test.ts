import { renderHook } from "@testing-library/react";
import * as React from "react";
import { StudioArenaState } from "@/wab/client/studio-ctx/studio-arena-state";
import { CanvasViewInputs, useCanvasComponentInputs, type CanvasViewFieldRecipe } from "@/wab/client/components/canvas/canvas-view-inputs";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { createSite } from "@/wab/shared/core/sites";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { mock } from "vitest-mock-extended";

it("rebinds demanded child fields and keeps retired canvas recipes out of a replacement world", () => {
  const first = mkTplTagX("span"), second = mkTplTagX("span"), root = mkTplTagX("div", {}, [first]);
  const site = createSite(); site.components.push(mkComponent({ name: "Inputs", type: ComponentType.Plain, tplTree: root }));
  const models = new ModelSnapshots(), next = new ModelSnapshots(), signal = new AbortController();
  const studio = mock<StudioCtx>();
  Object.defineProperty(studio, "modelSnapshots", { value: models, writable: true });
  const recipe = vi.fn((field: Parameters<ConstructorParameters<typeof CanvasViewInputs>[1]>[0]) => {
    field(root, "children"); root.children.forEach((child) => field(child, "name"));
  });
  const source = new CanvasViewInputs({ studio, models, signal: signal.signal }, recipe);
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  const publish = vi.fn(), stop = source.subscribe(publish); publish.mockClear();
  try {
    models.sync(recorder.withRecording(() => { first.name = "First"; }).changes);
    expect(publish).toHaveBeenCalledOnce(); publish.mockClear();
    models.sync(recorder.withRecording(() => { root.children = [second]; }).changes);
    expect(publish).toHaveBeenCalledOnce(); publish.mockClear();
    models.sync(recorder.withRecording(() => { first.name = "Detached"; }).changes);
    expect(publish).not.toHaveBeenCalled();
    models.sync(recorder.withRecording(() => { second.name = "Second"; }).changes);
    expect(publish).toHaveBeenCalledOnce();
    Object.defineProperty(studio, "modelSnapshots", { value: next, writable: true }); recipe.mockClear();
    expect(source.getSnapshot().alive).toBe(false); expect(recipe).not.toHaveBeenCalled();
    Object.defineProperty(studio, "modelSnapshots", { value: models, writable: true });
    expect(source.getSnapshot().alive).toBe(false); expect(recipe).not.toHaveBeenCalled();
    signal.abort(); expect(source.getSnapshot().alive).toBe(false);
  } finally { stop(); signal.abort(); models.dispose(); next.dispose(); recorder.dispose(); }
});

it("keeps the original component prop scope when its recipe changes after world replacement", () => {
  const site = createSite(), root = mkTplTagX("div");
  const component = mkComponent({ name: "Owner", type: ComponentType.Plain, tplTree: root }); site.components.push(component);
  const models = new ModelSnapshots(), next = new ModelSnapshots(), studio = mock<StudioCtx>();
  const arenaState = new StudioArenaState({ site, modelSnapshots: models });
  Object.defineProperties(studio, { modelSnapshots: { value: models, writable: true }, arenaState: { value: arenaState } });
  const hook = renderHook(({ keyName, owner }) => {
    const recipe = React.useCallback<CanvasViewFieldRecipe>((field) => field(component, keyName), [keyName]);
    return useCanvasComponentInputs(owner, component, recipe);
  }, { initialProps: { keyName: "name", owner: studio } });
  try {
    expect(hook.result.current.alive).toBe(true);
    const replacementStudio = mock<StudioCtx>();
    Object.defineProperty(replacementStudio, "modelSnapshots", { value: next });
    const demand = vi.spyOn(next, "declaredField");
    hook.rerender({ keyName: "type", owner: replacementStudio });
    expect(hook.result.current.alive).toBe(false); expect(demand).not.toHaveBeenCalled();
    hook.rerender({ keyName: "name", owner: studio });
    expect(hook.result.current.alive).toBe(true);
    Object.defineProperty(studio, "modelSnapshots", { value: next, writable: true });
    hook.rerender({ keyName: "type", owner: studio });
    expect(hook.result.current.alive).toBe(false); expect(demand).not.toHaveBeenCalled();
  } finally { hook.unmount(); arenaState.dispose(); models.dispose(); next.dispose(); }
});
