import { createSite } from "@/wab/shared/core/sites";
import type { ProjectDependencyData } from "@/wab/client/ProjectDependencyManager";
import {
  createProjectDependenciesStore,
  getDependencyMap,
  removeDependency,
  setDependency,
  setPlumeSite,
} from "@/wab/client/studio-ctx/project-dependencies-state";
function owner() {
  return { dependencyStateStore: createProjectDependenciesStore() };
}

function dep(pkgId: string, name: string): ProjectDependencyData {
  return { model: { pkgId, name } as any, latestPkgVersionMeta: undefined };
}

it("tracks and removes dependencies with immutable snapshots", () => {
  const o = owner();

  setDependency(o, "pkg-1", dep("pkg-1", "One"));
  expect(getDependencyMap(o)["pkg-1"]?.model.name).toBe("One");

  setDependency(o, "pkg-2", dep("pkg-2", "Two"));
  expect(Object.keys(getDependencyMap(o))).toEqual(["pkg-1", "pkg-2"]);

  removeDependency(o, "pkg-1");
  expect(Object.keys(getDependencyMap(o))).toEqual(["pkg-2"]);
});

it("ignores removing an unknown dependency", () => {
  const o = owner();
  const before = o.dependencyStateStore.getState();
  removeDependency(o, "missing");
  expect(o.dependencyStateStore.getState()).toBe(before);
});

it("stores the loaded Plume site", () => {
  const o = owner();
  const site = createSite();
  setPlumeSite(o, site);
  expect(o.dependencyStateStore.getState().plumeSite).toBe(site);
});

it("skips identical package and Plume writes", () => {
  const o = owner(), data = dep("pkg", "Library"), site = createSite();
  setDependency(o, "pkg", data); setPlumeSite(o, site);
  const before = o.dependencyStateStore.getState(), notify = vi.fn();
  const stop = o.dependencyStateStore.subscribe(notify);
  setDependency(o, "pkg", data); setPlumeSite(o, site);
  expect(o.dependencyStateStore.getState()).toBe(before);
  expect(notify).not.toHaveBeenCalled();
  stop();
});
