import { ModelFieldInputs } from "@/wab/client/stores/model-field-inputs";
import { captureVariantModelWorld, useCurrentModelWorld } from "@/wab/client/components/variants/variant-model-world";
import { getComponentDisplayName, getFolderComponentDisplayName, getDefaultComponentKind, getSuperComponents, isCodeComponent, isReusableComponent } from "@/wab/shared/core/components";
import type { ModelRef } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ProjectDependencyData } from "@/wab/client/ProjectDependencyManager";
import { isHostLessPackage } from "@/wab/shared/core/sites";
import { isAdminTeamEmail } from "@/wab/shared/devflag-utils";
import { Component, ProjectDependency, Site } from "@/wab/shared/model/classes";
import { sortBy } from "lodash";
import * as React from "react";
import { useStore } from "zustand";

const empty: readonly unknown[] = Object.freeze([]);

/** Component folders and row labels, rather than component document contents.
 * A row keeps its captured model world while a live catalog follows its owner. */
export class ComponentLibraryInputs {
  private readonly inputs: ModelFieldInputs;
  private readonly site: Site;
  private current = empty;
  private rowFields: readonly unknown[] | undefined;
  private row: ReturnType<ComponentLibraryInputs["projectRow"]> | undefined;
  constructor(studio: StudioCtx, private readonly selected?: Component, world = captureVariantModelWorld(studio)) {
    this.site = world.site;
    this.inputs = new ModelFieldInputs(world, (field) => {
    const seen = new Set<Component>();
    const component = (value: Component) => {
      if (seen.has(value)) { return; } seen.add(value);
      field(value, "uuid", "name", "type", "superComp", "subComps", "codeComponentMeta");
      if (value.codeComponentMeta) { field(value.codeComponentMeta, "displayName", "importPath", "isHostLess", "isContext"); }
      if (!this.selected) { value.subComps.forEach(component); }
    };
    if (this.selected) {
      component(this.selected);
      const ancestors = new Set<Component>();
      let parent = this.selected.superComp;
      while (parent && !ancestors.has(parent)) { ancestors.add(parent); field(parent, "superComp"); parent = parent.superComp; }
      field(this.site, "defaultComponents", "pageWrapper");
    } else {
      field(this.site, "components", "projectDependencies");
      this.site.components.forEach(component);
      this.site.projectDependencies.forEach((dependency) => {
        field(dependency, "uuid", "name", "projectId", "site");
        field(dependency.site, "components", "hostLessPackageInfo");
        dependency.site.components.forEach(component);
      });
    }
    });
  }
  getSnapshot = () => {
    if (!this.inputs.isCurrent()) { return empty; }
    const values = this.inputs.read();
    if (this.current !== values) { this.current = Object.freeze(values); }
    return this.current;
  };
  private projectRow() {
    const component = this.selected;
    if (!component) { throw new Error("Component row requires its model"); }
    return {
      name: component.name,
      displayName: getComponentDisplayName(component),
      folderName: getFolderComponentDisplayName(component),
      superCount: getSuperComponents(component).length,
      defaultKind: getDefaultComponentKind(this.site, component),
      reusable: isReusableComponent(component),
      code: isCodeComponent(component),
    };
  }
  getRowSnapshot = () => {
    const fields = this.getSnapshot();
    if (!this.row || (fields !== empty && fields !== this.rowFields)) {
      this.rowFields = fields;
      this.row = this.projectRow();
    }
    return this.row;
  };
  subscribe = (listener: () => void) => this.inputs.subscribe(listener);
}

class ComponentCatalogValue<T> {
  private fields: readonly unknown[] | undefined;
  private value: T | undefined;
  constructor(private readonly source: ComponentLibraryInputs, private readonly select: () => T) {}
  read = () => {
    const fields = this.source.getSnapshot();
    if (fields === empty) { return undefined; }
    if (fields !== this.fields) { this.fields = fields; this.value = this.select(); }
    return this.value;
  };
}
export function useComponentLibraryCatalog<T>(studio: StudioCtx, select: () => T) {
  const world = useCurrentModelWorld(studio);
  const source = React.useMemo(() => new ComponentLibraryInputs(studio, undefined, world), [studio, world]);
  const value = React.useMemo(() => new ComponentCatalogValue(source, select), [source, select]);
  return React.useSyncExternalStore(source.subscribe, value.read, value.read);
}
export function useComponentLibraryRowInputs(studio: StudioCtx, component: Component) {
  const source = React.useMemo(() => new ComponentLibraryInputs(studio, component), [studio, component]);
  return React.useSyncExternalStore(source.subscribe, source.getRowSnapshot, source.getRowSnapshot);
}

/** Config and account publications have their own native owner, separate from
 * document fields and per-project editing permissions. */
export function useLibraryAppInputs(studio: StudioCtx) {
  const source = React.useMemo(() => createLibraryAppInputsSource(studio), [studio]);
  return React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
}

export interface ProjectLibraryEntry {
  readonly dependency: ModelRef<ProjectDependency>;
  readonly name: string;
  readonly version: string;
  readonly pkgId: string;
  readonly projectId: string;
  readonly hostless: boolean;
}
export interface ProjectLibraryRow extends ProjectLibraryEntry { readonly data: ProjectDependencyData; }
interface ProjectLibrarySnapshot {
  readonly entries: readonly ProjectLibraryEntry[];
  readonly dependencies: readonly ModelRef<ProjectDependency>[];
  readonly fields: readonly unknown[];
}
const noProjects: ProjectLibrarySnapshot = Object.freeze({ entries: Object.freeze([]), dependencies: Object.freeze([]), fields: empty });
/** Imported versions, names and package kind: no traversal of imported designs. */
export class ProjectLibraryInputs {
  private readonly inputs: ModelFieldInputs;
  private readonly site: Site;
  private current = noProjects;
  private readonly models;
  constructor(studio: StudioCtx, world = captureVariantModelWorld(studio)) {
    this.models = world.models;
    this.site = world.site;
    this.inputs = new ModelFieldInputs(world, (field) => {
    field(this.site, "projectDependencies");
    this.site.projectDependencies.forEach((dependency) => {
      field(dependency, "pkgId", "name", "version", "projectId", "site");
      field(dependency.site, "hostLessPackageInfo");
    });
    });
  }
  getSnapshot = () => {
    if (!this.inputs.isCurrent()) { return noProjects; }
    const values = this.inputs.read();
    if (this.current.fields !== values) {
      this.current = Object.freeze({
        dependencies: Object.freeze(this.site.projectDependencies.map((dependency) => this.models.ref(dependency))),
        entries: Object.freeze(this.site.projectDependencies.map((dependency) => Object.freeze({ dependency: this.models.ref(dependency), name: dependency.name, version: dependency.version, pkgId: dependency.pkgId, projectId: dependency.projectId, hostless: isHostLessPackage(dependency.site) }))),
        fields: Object.freeze(values),
      });
    }
    return this.current;
  };
  subscribe = (listener: () => void) => this.inputs.subscribe(listener);
}

export function useDirectProjectLibraries(studio: StudioCtx): ProjectLibraryRow[] {
  const world = useCurrentModelWorld(studio);
  const source = React.useMemo(() => new ProjectLibraryInputs(studio, world), [studio, world]);
  const snapshot = React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
  const map = useStore(studio.projectDependencyManager.dependencyStateStore, (state) => state.dependencyMap);
  const missing = snapshot.entries.some((entry) => !map[entry.pkgId]);
  React.useEffect(() => { if (missing) { studio.projectDependencyManager.getDependencies(); } }, [studio, snapshot, map, missing]);
  return sortBy(snapshot.entries.flatMap((entry) => {
    const data = map[entry.pkgId];
    return data ? [{ ...entry, data }] : [];
  }), (entry) => entry.name);
}

function createLibraryAppInputsSource(studio: Parameters<typeof useLibraryAppInputs>[0]) {
    const capture = () => ({
      catalog: studio.appCtx.appConfig.hostLessComponents,
      email: studio.appCtx.selfInfo?.email,
      showHidden: studio.appCtx.appConfig.showHiddenHostLessComponents,
      isAdmin: isAdminTeamEmail(studio.appCtx.selfInfo?.email, studio.appCtx.appConfig),
    });
    let current = Object.freeze(capture());
    const getSnapshot = () => {
      const next = capture();
      if (next.catalog !== current.catalog || next.email !== current.email || next.isAdmin !== current.isAdmin || next.showHidden !== current.showHidden) { current = Object.freeze(next); }
      return current;
    };
    return { getSnapshot, subscribe: (listener: () => void) => studio.appCtx.subscribeUiEnvironmentInputs(listener) };
  }
