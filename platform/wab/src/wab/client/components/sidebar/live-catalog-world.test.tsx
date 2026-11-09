import { useComponentLibraryCatalog, useDirectProjectLibraries } from "@/wab/client/components/sidebar/library-inputs";
import { useContextSettingsModelInputs } from "@/wab/client/components/sidebar/context-settings-inputs";
import { useMixinCatalog, useMixinUsage } from "@/wab/client/components/sidebar/mixin-panel-inputs";
import { StudioArenaState } from "@/wab/client/studio-ctx/studio-arena-state";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { createProjectDependenciesStore, setDependency } from "@/wab/client/studio-ctx/project-dependencies-state";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { TplMgr } from "@/wab/shared/TplMgr";
import { mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { ProjectDependency, isKnownProjectDependency } from "@/wab/shared/model/classes";
import type { GlobalContextMeta } from "@plasmicapp/host";
import { act, renderHook } from "@testing-library/react";

it("rebinds live catalogs through the actual model replacement protocol while old mixin usages remain retired", () => {
  const makeSite = (label: string) => {
    const site = createSite(), manager = new TplMgr({site});
    manager.addComponent({name: label, type: ComponentType.Plain});
    const mixin = manager.addMixin(`${label} style`);
    const component = mkCodeComponent(`${label} context`, {name: `${label} context`, props: {}, importPath: "", __isContext: true} as GlobalContextMeta<any>, {});
    manager.attachComponent(component);
    const dependency = new ProjectDependency({uuid: label, name: `${label} library`, pkgId: label, projectId: label, version: "1.0.0", site: createSite()});
    site.projectDependencies.push(dependency);
    return {site, mixin, dependency};
  };
  const first = makeSite("First"), next = makeSite("Second");
  const context = {site: first.site, modelSnapshots: new ModelSnapshots()};
  const departedModels = context.modelSnapshots, arena = new StudioArenaState(context);
  const dependencyStateStore = createProjectDependenciesStore();
  setDependency({dependencyStateStore}, first.dependency.pkgId, {model: first.dependency});
  setDependency({dependencyStateStore}, next.dependency.pkgId, {model: next.dependency});
  const listeners = new Set<Parameters<StudioCtx["subscribeModelChanges"]>[0]>();
  const studio = {get site() {return context.site;}, get modelSnapshots() {return context.modelSnapshots;}, arenaState: arena,
    subscribeModelChanges: (listener: Parameters<StudioCtx["subscribeModelChanges"]>[0]) => {listeners.add(listener); return () => {listeners.delete(listener);};},
    projectDependencyManager: {dependencyStateStore, getDependencies: vi.fn(), getNiceDepName: (dependency: ProjectDependency) => dependency.name},
  } as unknown as StudioCtx;
  const hook = renderHook(() => ({
    components: useComponentLibraryCatalog(studio, () => studio.site.components.map(component => component.name)),
    libraries: useDirectProjectLibraries(studio), contexts: useContextSettingsModelInputs(studio),
    mixins: useMixinCatalog(studio), usage: useMixinUsage(studio, first.mixin),
  }));
  try {
    expect(hook.result.current.components).toContain("First");
    expect(hook.result.current.libraries.map(row => row.name)).toEqual(["First library"]);
    expect(hook.result.current.contexts.map(row => row.displayName)).toEqual(["First context"]);
    expect(hook.result.current.mixins?.local.map(row => row.name)).toEqual(["First style"]);
    expect(hook.result.current.usage?.name).toBe("First style");
    act(() => {arena.reset(); context.site = next.site; context.modelSnapshots = new ModelSnapshots(); arena.attachSite(); listeners.forEach(listener => listener({type: "site-replaced", site: next.site}));});
    expect(hook.result.current.components).toContain("Second");
    expect(hook.result.current.components).not.toContain("First");
    expect(hook.result.current.libraries.map(row => row.name)).toEqual(["Second library"]);
    expect(hook.result.current.contexts.map(row => row.displayName)).toEqual(["Second context"]);
    expect(hook.result.current.mixins?.local.map(row => row.name)).toEqual(["Second style"]);
    expect(hook.result.current.usage).toBeUndefined();
    const recorder = new ChangeRecorder({inst: next.site, _instUtil: instUtil, isExternalRef: isKnownProjectDependency});
    try {act(() => context.modelSnapshots.sync(recorder.withRecording(() => {next.mixin.name = "Renamed current style";}).changes));} finally {recorder.dispose();}
    expect(hook.result.current.mixins?.local.map(row => row.name)).toEqual(["Renamed current style"]);
    hook.unmount(); expect(listeners.size).toBe(0);
  } finally {hook.unmount(); arena.dispose(); departedModels.dispose(); context.modelSnapshots.dispose();}
});
