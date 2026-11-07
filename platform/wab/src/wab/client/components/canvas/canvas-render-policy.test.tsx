import { CanvasFrameLoad } from "@/wab/client/components/canvas/canvas-frame-load";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { StudioArenaState } from "@/wab/client/studio-ctx/studio-arena-state";
import { StudioRenderPolicy } from "@/wab/client/studio-ctx/studio-render-policy";
import type { StudioCtx, ModelCommit } from "@/wab/client/studio-ctx/StudioCtx";
import { TplMgr } from "@/wab/shared/TplMgr";
import { mkVar } from "@/wab/shared/core/lang";
import type { ModelChange } from "@/wab/shared/core/observable-model";
import { mkTplComponent } from "@/wab/shared/core/tpls";
import { ProjectDependency, Variant, type ObjInst } from "@/wab/shared/model/classes";
import type { ChangeSummary } from "@/wab/shared/model/model-change-util";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { CanvasFrameInfoOwner } from "@/wab/client/components/canvas/canvas-frame-info";
import { CanvasFrameHash } from "@/wab/client/components/canvas/canvas-frame-hash-observer";
import { useCanvasRenderPolicy } from "@/wab/client/components/canvas/canvas-render-policy";
import type { SubDeps } from "@/wab/client/components/canvas/subdeps";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { ensure } from "@/wab/shared/common";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("updates iframe scalar consumers and the committed native URL across real model and mode changes", async () => {
  const site = createSite();
  const component = mkComponent({ name: "Owner", type: ComponentType.Plain, tplTree: mkTplTagX("div") });
  site.components.push(component);
  const frame = mkArenaFrame({ site, component, name: "Target", width: 100, height: 100 });
  const target = mkMixedArena("Target", [frame]); site.arenas.push(mkMixedArena("Empty"), target);
  const { studioCtx: studio } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Empty" });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  studio.arenaState.activate(target, performance.now());
  const view = ensure(studio.tryGetViewCtxForFrame(frame), "Actual inactive ViewCtx");
  const sub = mock<SubDeps>(); Object.defineProperty(sub, "React", { value: React });
  const write = vi.fn<(hash: string) => void>();
  const source = new CanvasFrameHash(studio, frame, studio.arenaState.lifetime(), write);
  const initialHash = source.getHash();
  const interactiveRenders = vi.fn<() => void>();
  function Probe() {
    interactiveRenders();
    const interactive = useCanvasRenderPolicy(sub, view, "interactive");
    return <output>{String(interactive)}</output>;
  }
  const mounted = render(<Probe />);
  try {
    expect(write).not.toHaveBeenCalled();
    const count = interactiveRenders.mock.calls.length;
    act(() => { studio.isDocs = true; });
    expect(interactiveRenders).toHaveBeenCalledTimes(count);
    expect(write).not.toHaveBeenCalled();
    act(() => { studio.isInteractiveMode = true; });
    expect(mounted.container.textContent).toBe("true");
    expect(new URLSearchParams(source.getHash()).get("interactive")).toBe("true");
    expect(write).toHaveBeenLastCalledWith(source.getHash());
    await studio.changeUnsafe(() => { component.name = "Second"; });
    expect(new URLSearchParams(source.getHash()).get("componentName")).toBe("Second");
    expect(write).toHaveBeenLastCalledWith(source.getHash());
    act(() => { studio.isInteractiveMode = false; });
    expect(new URLSearchParams(source.getHash()).get("interactive")).toBe("false");
    const beforeCommand = write.mock.calls.length;
    await act(async () => { await studio.changeUnsafe(() => { component.name = "Third"; studio.isInteractiveMode = true; }); });
    expect(new URLSearchParams(source.getHash()).get("componentName")).toBe("Third");
    expect(new URLSearchParams(source.getHash()).get("interactive")).toBe("true");
    expect(write).toHaveBeenCalledTimes(beforeCommand + 1);
    expect(source.getHash()).not.toBe(initialHash);
    expect(write).toHaveBeenLastCalledWith(source.getHash());
    const calls = write.mock.calls.length;
    source.dispose(); source.dispose();
    act(() => { studio.isInteractiveMode = false; });
    await studio.changeUnsafe(() => { component.name = "Released"; });
    expect(write).toHaveBeenCalledTimes(calls);
  } finally { source.dispose(); mounted.unmount(); studio.dispose(); }
});

it("installs final policy and full-content output before actual Studio model field subscribers", async () => {
  const site = createSite();
  const component = mkComponent({ name: "Owner", type: ComponentType.Plain, tplTree: mkTplTagX("div") });
  site.components.push(component);
  const frame = mkArenaFrame({ site, component, name: "Target", width: 100, height: 100 });
  const empty = mkMixedArena("Empty"), target = mkMixedArena("Target", [frame]); site.arenas.push(empty, target);
  const { studioCtx: studio } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Empty" });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  studio.arenaState.activate(target, performance.now());
  const view = ensure(studio.tryGetViewCtxForFrame(frame), "Real inactive view");
  const frameInfo = new CanvasFrameInfoOwner(view);
  vi.mocked(view.canvasCtx.prepareFrameInfo).mockImplementation(() => frameInfo.prepare());
  vi.mocked(view.canvasCtx.frameInfo).mockReturnValue(frameInfo.store);
  const observations: boolean[] = [];
  const off = studio.modelSnapshots.field(component, "type").subscribe(() => {
    observations.push(frameInfo.store.getState().fullPageHeight);
    expect(studio.renderPolicy.store.getState().interactive).toBe(false);
    expect(frameInfo.store.getState().isHeightAutoDerived).toBe(true);
  });
  try {
    studio.setFullPageHeightOverride(true);
    studio.isInteractiveMode = true;
    expect(frameInfo.store.getState().fullPageHeight).toBe(false);
    await studio.changeUnsafe(() => { component.type = ComponentType.Page; frame.viewMode = "stretch"; studio.isInteractiveMode = false; });
    expect(observations).toEqual([true]);
    expect(frameInfo.store.getState().fullPageHeight).toBe(true);
  } finally { off(); frameInfo.dispose(); studio.dispose(); }
});

function hashFixture() {
  const site = createSite(), manager = new TplMgr({ site });
  const component = manager.addComponent({ name: "Owner", type: ComponentType.Plain });
  const frame = mkArenaFrame({ site, component, name: "Hash", width: 100, height: 100 });
  let world = { site, models: new ModelSnapshots() };
  const arena = new StudioArenaState({ get site() { return world.site; }, get modelSnapshots() { return world.models; } });
  const policy = new StudioRenderPolicy({ isLive: () => false, isDragging: () => false });
  const listeners = new Set<(event: ModelCommit) => void>();
  const studio = mock<StudioCtx>();
  Object.defineProperties(studio, {
    site: { get: () => world.site }, modelSnapshots: { get: () => world.models },
    arenaState: { value: arena }, renderPolicy: { value: policy },
  });
  studio.subscribeModelChanges.mockImplementation((listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; });
  const resources: CanvasFrameHash[] = [];
  const makeHash = (write: (hash: string) => void, target = frame) => {
    const hash = new CanvasFrameHash(studio, target, arena.lifetime(), write); resources.push(hash); return hash;
  };
  const commit = (...fields: [ObjInst, string][]) => {
    const changes: ModelChange[] = fields.map(([inst, field]) => ({ type: "update", oldValue: undefined, newValue: Reflect.get(inst, field), changeNode: { inst, field } }));
    world.models.sync(changes);
    const summary = mock<ChangeSummary>();
    summary.changes = changes;
    listeners.forEach((listener) => listener({ type: "commit", summary }));
  };
  const replaceWorld = (nextSite: ReturnType<typeof createSite>) => {
    arena.reset();
    const previous = world.models;
    world = { site: nextSite, models: new ModelSnapshots() };
    arena.attachSite();
    listeners.forEach((listener) => listener({ type: "site-replaced", site: nextSite }));
    previous.dispose();
  };
  return { site, manager, component, frame, studio, arena, policy, listeners, makeHash, commit, replaceWorld,
    get models() { return world.models; },
    dispose: () => { resources.forEach((resource) => resource.dispose()); arena.dispose(); policy.dispose(); world.models.dispose(); },
  };
}

const variantsOfHash = (source: CanvasFrameHash) => JSON.parse(ensure(new URLSearchParams(source.getHash()).get("globalVariants"), "Global variants hash"));

it("uses the direct global roster, active parent/variable fields and final same-commit names without no-op writes", () => {
  const f = hashFixture();
  const theme = f.manager.createGlobalVariantGroup("theme"), dark = f.manager.createGlobalVariant(theme, "Dark"), inactive = f.manager.createGlobalVariant(theme, "Unused");
  const library = createSite(), imported = new TplMgr({ site: library });
  const density = imported.createGlobalVariantGroup("density"), compact = imported.createGlobalVariant(density, "Compact");
  const transitive = createSite(), hidden = new TplMgr({ site: transitive });
  const hiddenGroup = hidden.createGlobalVariantGroup("hidden"); hidden.createGlobalVariant(hiddenGroup, "Ignored");
  library.projectDependencies.push(new ProjectDependency({ name: "Transitive", uuid: "transitive", projectId: "transitive", pkgId: "transitive", version: "1", site: transitive }));
  f.site.projectDependencies.push(new ProjectDependency({ name: "Direct", uuid: "direct", projectId: "direct", pkgId: "direct", version: "1", site: library }));
  f.frame.pinnedGlobalVariants[dark.uuid] = true; f.frame.pinnedGlobalVariants[inactive.uuid] = false;
  f.frame.targetGlobalVariants.push(compact, dark);
  const write = vi.fn<(hash: string) => void>(), source = f.makeHash(write);
  try {
    expect(variantsOfHash(source)).toEqual({ theme: "dark", density: "compact" });
    expect(write).not.toHaveBeenCalled();
    inactive.name = "Unrelated"; f.commit([inactive, "name"]);
    hiddenGroup.param.variable.name = "unrelated"; f.commit([hiddenGroup.param.variable, "name"]);
    f.frame.width = 200; f.commit([f.frame, "width"]);
    expect(write).not.toHaveBeenCalled();
    const publicFields = vi.fn(); const stopField = f.models.field(dark, "name").subscribe(publicFields);
    try {
      f.models.deferPublication(() => {
        dark.name = "Midnight"; theme.param.variable.name = "palette";
        f.commit([dark, "name"], [theme.param.variable, "name"]);
        expect(publicFields).not.toHaveBeenCalled();
        expect(variantsOfHash(source)).toEqual({ palette: "midnight", density: "compact" });
        expect(write).toHaveBeenCalledOnce();
      });
      expect(publicFields).toHaveBeenCalledOnce();
    } finally { stopField(); }
    f.commit([dark, "name"], [theme.param.variable, "name"]);
    f.policy.docs = true; f.policy.prepareInputs(); f.policy.publishCommit();
    expect(write).toHaveBeenCalledOnce();
    const parent = f.manager.createGlobalVariantGroup("tone");
    dark.parent = parent; f.commit([dark, "parent"]);
    expect(variantsOfHash(source)).toEqual({ tone: "midnight", density: "compact" });
    const oldVariable = parent.param.variable;
    parent.param.variable = mkVar("colors"); f.commit([parent.param, "variable"]);
    expect(variantsOfHash(source)).toEqual({ colors: "midnight", density: "compact" });
    const count = write.mock.calls.length;
    oldVariable.name = "Detached"; theme.param.variable.name = "Detached";
    f.commit([oldVariable, "name"], [theme.param.variable, "name"]);
    expect(write).toHaveBeenCalledTimes(count);
  } finally { f.dispose(); }
});

it("rebinds replaced container/components and imported UUID rosters with the original order and collision rules", () => {
  const f = hashFixture();
  const local = f.manager.createGlobalVariantGroup("theme"), first = f.manager.createGlobalVariant(local, "First"), second = f.manager.createGlobalVariant(local, "Second");
  const library = createSite(), imported = new TplMgr({ site: library });
  const importedGroup = imported.createGlobalVariantGroup("theme"), importedVariant = imported.createGlobalVariant(importedGroup, "Imported");
  const dependency = new ProjectDependency({ name: "Direct", uuid: "direct", projectId: "direct", pkgId: "direct", version: "1", site: library });
  f.site.projectDependencies.push(dependency);
  f.frame.pinnedGlobalVariants[first.uuid] = true; f.frame.targetGlobalVariants.push(second, first, importedVariant);
  const write = vi.fn<(hash: string) => void>(), source = f.makeHash(write);
  try {
    // Pinned first, targets afterwards, object identities deduplicated, last
    // active group name wins Object.fromEntries exactly as the initial URL.
    expect(variantsOfHash(source)).toEqual({ theme: "imported" });
    const nextComponent = f.manager.addComponent({ name: "Replacement", type: ComponentType.Plain });
    f.frame.container = mkTplComponent(nextComponent, nextComponent.variants[0]); f.commit([f.frame, "container"]);
    expect(new URLSearchParams(source.getHash()).get("componentName")).toBe("Replacement");
    const thirdComponent = f.manager.addComponent({ name: "Third", type: ComponentType.Plain });
    const oldComponent = nextComponent;
    f.frame.container.component = thirdComponent; f.commit([f.frame.container, "component"]);
    expect(new URLSearchParams(source.getHash()).get("componentName")).toBe("Third");
    const count = write.mock.calls.length;
    oldComponent.name = "Detached"; f.commit([oldComponent, "name"]);
    expect(write).toHaveBeenCalledTimes(count);
    f.frame.targetGlobalVariants = [];
    f.frame.pinnedGlobalVariants = { [importedVariant.uuid]: true };
    f.commit([f.frame, "targetGlobalVariants"], [f.frame, "pinnedGlobalVariants"]);
    expect(variantsOfHash(source)).toEqual({ theme: "imported" });
    const replacementSite = createSite(), replacement = new TplMgr({ site: replacementSite });
    const replacementGroup = replacement.createGlobalVariantGroup("theme");
    const replacementVariant = new Variant({ uuid: importedVariant.uuid, name: "Replacement", parent: replacementGroup,
      selectors: undefined, codeComponentName: undefined, codeComponentVariantKeys: undefined, mediaQuery: undefined, description: undefined, forTpl: undefined }); replacementGroup.variants.push(replacementVariant);
    dependency.site = replacementSite; f.commit([dependency, "site"]);
    expect(variantsOfHash(source)).toEqual({ theme: "replacement" });
    const afterReplacement = write.mock.calls.length;
    importedVariant.name = "Old"; f.commit([importedVariant, "name"]);
    importedGroup.variants = []; f.commit([importedGroup, "variants"]);
    expect(write).toHaveBeenCalledTimes(afterReplacement);
    f.frame.pinnedGlobalVariants = {}; f.site.projectDependencies = [];
    f.commit([f.frame, "pinnedGlobalVariants"], [f.site, "projectDependencies"]);
    expect(variantsOfHash(source)).toEqual({});
  } finally { f.dispose(); }
});

it("releases a cancelled load and old model lifetime before later mode/model notifications without resubscribing", () => {
  const f = hashFixture(), oldWrite = vi.fn<(hash: string) => void>();
  const source = f.makeHash(oldWrite), lifetime = f.arena.lifetime();
  const load = new CanvasFrameLoad(lifetime, () => f.arena.isCurrentLifetime(lifetime));
  load.own(() => source.dispose()); load.cancel(); load.cancel();
  expect(f.listeners.size).toBe(0);
  const subscribe = vi.spyOn(f.models, "subscribePreparedField"); subscribe.mockClear();
  const nextWrite = vi.fn<(hash: string) => void>(), current = f.makeHash(nextWrite);
  try {
    load.cancel();
    f.component.name = "Current"; f.commit([f.component, "name"]);
    expect(nextWrite).toHaveBeenCalledOnce(); expect(oldWrite).not.toHaveBeenCalled();
    expect(new URLSearchParams(current.getHash()).get("componentName")).toBe("Current");
    const nextSite = createSite(), nextComponent = new TplMgr({ site: nextSite }).addComponent({ name: "Next", type: ComponentType.Plain });
    const nextFrame = mkArenaFrame({ site: nextSite, component: nextComponent, name: "Next", width: 100, height: 100 });
    f.replaceWorld(nextSite);
    expect(f.listeners.size).toBe(0);
    expect(() => current.getHash()).toThrow("disposed frame hash");
    const beforeLate = subscribe.mock.calls.length;
    f.policy.interactive = true; f.policy.prepareInputs(); f.policy.publishCommit();
    expect(subscribe).toHaveBeenCalledTimes(beforeLate);
    expect(nextWrite).toHaveBeenCalledOnce(); expect(oldWrite).not.toHaveBeenCalled();
    expect(() => new CanvasFrameHash(f.studio, f.frame, lifetime, oldWrite)).toThrow("expired model owner");
    const latestWrite = vi.fn<(hash: string) => void>(), latest = f.makeHash(latestWrite, nextFrame);
    expect(new URLSearchParams(latest.getHash()).get("componentName")).toBe("Next");
    expect(new URLSearchParams(latest.getHash()).get("interactive")).toBe("true");
    nextComponent.name = "Latest"; f.commit([nextComponent, "name"]);
    expect(latestWrite).toHaveBeenCalledOnce();
    latest.dispose(); latest.dispose(); expect(f.listeners.size).toBe(0);
  } finally { subscribe.mockRestore(); f.dispose(); }
});


it("keeps invalid active pins visible and does not retain a failed source", () => {
  const f = hashFixture(), write = vi.fn<(hash: string) => void>();
  f.frame.pinnedGlobalVariants.missing = true;
  try {
    expect(() => f.makeHash(write)).toThrow("Globat variant with uuid missing not found.");
    expect(f.listeners.size).toBe(0);
    expect(f.studio.subscribeModelChanges).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  } finally { f.dispose(); }
});
