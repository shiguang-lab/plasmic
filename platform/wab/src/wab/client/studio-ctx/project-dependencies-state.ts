import { ModelFieldSelector } from "@/wab/client/stores/model-field-selector";
import { createStudioStore } from "@/wab/client/stores/store-kit";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ProjectDependencyData } from "@/wab/client/ProjectDependencyManager";
import type { Site } from "@/wab/shared/model/classes";
import { arrayEq } from "@/wab/shared/common";
import * as React from "react";
import { useStore } from "zustand";

/**
 * Direct dependencies of the project, plus the loaded Plume site.
 *
 * Owned by ProjectDependencyManager. Model membership and labels have their
 * own field subscriptions; asynchronous package metadata publishes here.
 */
export interface ProjectDependenciesSnapshot {
  readonly dependencyMap: Readonly<Record<string, ProjectDependencyData>>;
  readonly plumeSite: Site | undefined;
}

export function createProjectDependenciesStore() {
  return createStudioStore<ProjectDependenciesSnapshot>(
    () => ({ dependencyMap: Object.freeze({}), plumeSite: undefined }),
    { name: "studio-project-dependencies" },
  );
}

export type ProjectDependenciesStore = ReturnType<
  typeof createProjectDependenciesStore
>;

type Owner = { dependencyStateStore: ProjectDependenciesStore };

export function setDependency(
  owner: Owner,
  pkgId: string,
  data: ProjectDependencyData,
): void {
  const state = owner.dependencyStateStore.getState();
  if (state.dependencyMap[pkgId] === data) { return; }
  owner.dependencyStateStore.setState({
    dependencyMap: Object.freeze({ ...state.dependencyMap, [pkgId]: data }),
  });
}

export function removeDependency(owner: Owner, pkgId: string): void {
  const state = owner.dependencyStateStore.getState();
  if (!(pkgId in state.dependencyMap)) {
    return;
  }
  const next = { ...state.dependencyMap };
  delete next[pkgId];
  owner.dependencyStateStore.setState({ dependencyMap: Object.freeze(next) });
}

export function setPlumeSite(owner: Owner, site: Site | undefined): void {
  if (owner.dependencyStateStore.getState().plumeSite !== site) { owner.dependencyStateStore.setState({ plumeSite: site }); }
}

export function getDependencyMap(
  owner: Owner,
): Readonly<Record<string, ProjectDependencyData>> {
  return owner.dependencyStateStore.getState().dependencyMap;
}

/**
 * Direct project dependencies, subscribed for render.
 *
 * Bind the current owner's membership, package IDs and names directly.
 */
export function useProjectDependencies(
  studio: StudioCtx,
): ProjectDependencyData[] {
  const models = studio.modelSnapshots;
  const manager = studio.projectDependencyManager;
  const source = React.useMemo(() => new ModelFieldSelector(studio, (read) => {
    const values: unknown[] = [];
    for (const ref of read(studio.site, "projectDependencies")) {
      const dependency = models.resolve(ref);
      values.push(ref, read(dependency, "pkgId"), read(dependency, "name"));
    }
    return Object.freeze(values);
  }, arrayEq), [studio, models]);
  React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
  // Plume ownership does not affect the imported package directory.
  useStore(manager.dependencyStateStore, (state) => state.dependencyMap);
  return studio.projectDependencyManager.getDependencies();
}
