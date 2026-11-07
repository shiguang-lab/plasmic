import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { DefaultStylesPanel } from "@/wab/client/components/sidebar/ThemesControls";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { ModelCommit } from "@/wab/client/studio-ctx/StudioCtx";
import type { ModelChange } from "@/wab/shared/core/observable-model";
import type { ChangeSummary } from "@/wab/shared/model/model-change-util";
import { cloneTheme } from "@/wab/shared/core/styles";
import { createSite } from "@/wab/shared/core/sites";
import {
  HostLessPackageInfo,
  ProjectDependency,
  type ObjInst,
  type Site,
} from "@/wab/shared/model/classes";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import React from "react";

const panel = vi.hoisted(() => ({
  props: undefined as any,
  renders: 0,
}));

vi.mock(
  "@/wab/client/plasmic/plasmic_kit_left_pane/PlasmicLeftThemesPanel",
  () => ({
    default: (props: any) => {
      panel.props = props;
      panel.renders++;
      return <div data-testid="themes-panel" />;
    },
  }),
);

afterEach(() => {
  cleanup();
  panel.props = undefined;
  panel.renders = 0;
});

function hostLessInfo(name: string) {
  return new HostLessPackageInfo({
    name,
    npmPkg: [],
    cssImport: [],
    deps: [],
    registerCalls: [],
    minimumReactVersion: null,
  });
}

function dependency(site: Site, name: string, suffix: string) {
  return new ProjectDependency({
    uuid: `dep-${suffix}`,
    pkgId: `pkg-${suffix}`,
    projectId: `project-${suffix}`,
    version: "1.0.0",
    name,
    site,
  });
}

async function fixture() {
  const site = createSite();
  const own = site.themes[0];
  const second = cloneTheme(own);
  site.themes.push(second);

  const imported = cloneTheme(own);
  const importedAlt = cloneTheme(own);
  const importedSite = createSite({
    themes: [imported, importedAlt],
    activeTheme: imported,
  });
  const importedDep = dependency(importedSite, "Imported library", "imported");
  site.projectDependencies.push(importedDep);

  const hostless = cloneTheme(own);
  const hostlessSite = createSite({
    themes: [hostless],
    activeTheme: hostless,
    hostLessPackageInfo: hostLessInfo("Hostless library"),
  });
  const hostlessDep = dependency(hostlessSite, "Hostless library", "hostless");
  site.projectDependencies.push(hostlessDep);

  const native = fakeStudioCtx({ site });
  // Dependency sites are bundled under other project ids in Studio; mark them
  // external so the recorder agrees that imported themes have foreign owners.
  native.appCtx.bundler.bundle(importedSite, "imported-project", "1.0.0");
  native.appCtx.bundler.bundle(hostlessSite, "hostless-project", "1.0.0");
  await waitFor(() => expect(native.studioCtx.initialRouteReady).toBe(true));
  return {
    ...native,
    site,
    own,
    second,
    imported,
    importedAlt,
    importedSite,
    importedDep,
    hostless,
    hostlessSite,
    hostlessDep,
  };
}

it("preserves theme options and canonical activation through imported, hostless and owner replacement changes", async () => {
  const f = await fixture();
  const listeners = new Set<(event: ModelCommit) => void>();
  const subscribe = f.studioCtx.subscribeModelChanges.bind(f.studioCtx);
  vi.spyOn(f.studioCtx, "subscribeModelChanges").mockImplementation(
    (listener) => {
      const stop = subscribe(listener);
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        stop();
      };
    },
  );
  const baselineListeners = listeners.size;
  const view = render(
    <StudioCtxContext.Provider value={f.studioCtx}>
      <DefaultStylesPanel />
    </StudioCtxContext.Provider>,
  );
  const selector = () => panel.props.themeSelector.props;
  const options = () => selector().options;
  const change = async (fn: () => void) => {
    await act(async () => {
      await f.studioCtx.changeUnsafe(fn);
    });
  };
  // ProjectDependency sites are weak references excluded from the recorder.
  // Commit those fields through the same explicit ModelSnapshots lifecycle.
  const commit = async (inst: ObjInst, field: string, mutate: () => void) => {
    mutate();
    const changes: ModelChange[] = [
      {
        type: "update",
        oldValue: undefined,
        newValue: Reflect.get(inst, field),
        changeNode: { inst, field },
      },
    ];
    f.studioCtx.modelSnapshots.sync(changes);
    f.studioCtx.projectDependencyManager.syncDirectDeps();
    await act(async () => {
      listeners.forEach((listener) => {
        listener({ type: "commit", summary: { changes } as ChangeSummary });
      });
    });
  };

  try {
    expect(listeners.size).toBe(baselineListeners + 1);
    expect(options()).toEqual([
      { value: f.own.defaultStyle.uuid, label: "This project's theme" },
      { value: f.second.defaultStyle.uuid, label: "This project's theme" },
      {
        value: f.imported.defaultStyle.uuid,
        label: "Theme from Imported library",
      },
    ]);
    expect(selector().value).toBe(f.own.defaultStyle.uuid);
    expect(panel.props.notOwnedBySite).toBe(false);
    expect(panel.props.noThemePicker).toBe(false);

    const settled = panel.props;
    const settledRenders = panel.renders;
    await change(() => {
      f.site.flags.unrelated = "value";
    });
    expect(panel.props).toBe(settled);
    expect(panel.renders).toBe(settledRenders);

    await commit(f.importedDep, "name", () => {
      f.importedDep.name = "Renamed library";
    });
    expect(options()[2].label).toBe("Theme from Renamed library");

    await commit(f.importedSite, "activeTheme", () => {
      f.importedSite.activeTheme = f.importedAlt;
    });
    expect(options().map((option) => option.value)).toContain(
      f.importedAlt.defaultStyle.uuid,
    );
    expect(options().map((option) => option.value)).not.toContain(
      f.imported.defaultStyle.uuid,
    );
    expect(options()[2].label).toBe("Theme from Renamed library");

    const selectableHostlessSite = createSite({
      themes: [f.hostless],
      activeTheme: f.hostless,
    });
    const selectableHostlessDep = dependency(
      selectableHostlessSite,
      "Hostless library",
      "hostless-selectable",
    );
    f.appCtx.bundler.bundle(
      selectableHostlessDep,
      "hostless-selectable-project",
      "1.0.0",
    );
    await change(() => {
      f.site.projectDependencies.splice(1, 1, selectableHostlessDep);
    });
    expect(options().map((option) => option.value)).toContain(
      f.hostless.defaultStyle.uuid,
    );

    const hiddenHostlessSite = createSite({
      themes: [f.hostless],
      activeTheme: f.hostless,
      hostLessPackageInfo: hostLessInfo("Hostless library"),
    });
    const hiddenHostlessDep = dependency(
      hiddenHostlessSite,
      "Hostless library",
      "hostless-hidden",
    );
    f.appCtx.bundler.bundle(
      hiddenHostlessDep,
      "hostless-hidden-project",
      "1.0.0",
    );
    await change(() => {
      f.site.projectDependencies.splice(1, 1, hiddenHostlessDep);
    });
    expect(options().map((option) => option.value)).not.toContain(
      f.hostless.defaultStyle.uuid,
    );
    expect(options()[2].label).toBe("Theme from Renamed library");

    await change(() => {
      f.site.activeTheme = f.importedAlt;
    });
    expect(selector().value).toBe(f.importedAlt.defaultStyle.uuid);
    expect(panel.props.notOwnedBySite).toBe(true);

    await change(() => {
      f.site.activeTheme = f.own;
    });
    await act(async () => {
      await selector().onChange(f.importedAlt.defaultStyle.uuid);
    });
    expect(f.site.activeTheme).toBe(f.importedAlt);
    expect(selector().value).toBe(f.importedAlt.defaultStyle.uuid);
    expect(panel.props.notOwnedBySite).toBe(true);

    const addedOwn = cloneTheme(f.own);
    await change(() => {
      f.site.themes.push(addedOwn);
    });
    expect(options()).toEqual([
      { value: f.own.defaultStyle.uuid, label: "This project's theme" },
      { value: f.second.defaultStyle.uuid, label: "This project's theme" },
      { value: addedOwn.defaultStyle.uuid, label: "This project's theme" },
      {
        value: f.importedAlt.defaultStyle.uuid,
        label: "Theme from Renamed library",
      },
    ]);
    expect(panel.props.notOwnedBySite).toBe(true);
    await change(() => {
      f.site.themes.splice(f.site.themes.indexOf(addedOwn), 1);
    });
    expect(options().map((option) => option.value)).not.toContain(
      addedOwn.defaultStyle.uuid,
    );
    expect(panel.props.notOwnedBySite).toBe(true);

    await change(() => {
      f.site.activeTheme = f.own;
    });
    expect(panel.props.notOwnedBySite).toBe(false);

    const nextOwn = cloneTheme(f.own);
    const nextImported = cloneTheme(f.imported);
    const nextImportedSite = createSite({
      themes: [nextImported],
      activeTheme: nextImported,
    });
    const nextImportedDep = dependency(
      nextImportedSite,
      "Next library",
      "next",
    );
    f.appCtx.bundler.bundle(
      nextImportedDep,
      "next-imported-project",
      "1.0.0",
    );
    const nextSite = createSite({
      themes: [nextOwn],
      activeTheme: nextOwn,
      projectDependencies: [nextImportedDep],
    });
    const oldModels = f.studioCtx.modelSnapshots;
    await act(async () => {
      oldModels.dispose();
      f.studioCtx.modelSnapshots = new ModelSnapshots();
      f.studioCtx.dbCtx().setSite(nextSite, undefined, undefined);
      f.studioCtx.projectDependencyManager.syncDirectDeps();
      listeners.forEach((listener) => {
        listener({ type: "site-replaced", site: nextSite });
      });
    });
    expect(options()).toEqual([
      { value: nextOwn.defaultStyle.uuid, label: "This project's theme" },
      {
        value: nextImported.defaultStyle.uuid,
        label: "Theme from Next library",
      },
    ]);
    expect(selector().value).toBe(nextOwn.defaultStyle.uuid);
    expect(panel.props.notOwnedBySite).toBe(false);

    await act(async () => {
      await selector().onChange(nextImported.defaultStyle.uuid);
    });
    expect(nextSite.activeTheme).toBe(nextImported);
    expect(selector().value).toBe(nextImported.defaultStyle.uuid);
    expect(panel.props.notOwnedBySite).toBe(true);

    view.unmount();
    expect(listeners.size).toBe(baselineListeners);
  } finally {
    view.unmount();
    f.studioCtx.dispose();
  }
});
