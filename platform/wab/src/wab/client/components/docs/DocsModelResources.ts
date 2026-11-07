import { projectDocsComponent, projectDocsSlotText, type DocsComponentModel } from "@/wab/client/components/docs/docs-model-projections";
import { makeCodePreviewSource } from "@/wab/client/components/docs/code-preview-source";
import { depsForComponent } from "@/wab/client/components/docs/serialize-docs-preview";
import { makeAssetClassName } from "@/wab/shared/codegen/image-assets";
import { getHostLessPkgIdentity } from "@/wab/client/components/studio/studio-bundles";
import { usedHostLessPkgs } from "@/wab/shared/cached-selectors";
import { componentToDeepReferenced } from "@/wab/shared/cached-selectors";
import { getPlumeDocsPlugin, type PlumeDocsExample } from "@/wab/shared/plume/plume-registry";
import type { ModelCommit } from "@/wab/client/studio-ctx/StudioCtx";
import { shallow } from "zustand/shallow";
import type { DocsPortalCtx } from "@/wab/client/components/docs/DocsPortalCtx";
import type { ModelRef, ModelFieldStore } from "@/wab/client/studio-ctx/model-snapshots";
import { ComponentType } from "@/wab/shared/core/components";
import { ImageAssetType } from "@/wab/shared/core/image-asset-type";
import type { Component, ImageAsset, Site, TplSlot } from "@/wab/shared/model/classes";
import { isEqual } from "lodash";
import { useStore } from "zustand";
import { useCallback } from "react";
import { createStore, type StoreApi } from "zustand/vanilla";

export interface DocsComponentRow {
  readonly ref: ModelRef<Component>;
  readonly uuid: string;
  readonly name: string;
}
export interface DocsIconModel {
  readonly ref: ModelRef<ImageAsset>;
  readonly uuid: string;
  readonly name: string;
  readonly dataUri: string | null | undefined;
  readonly className: string;
}
export interface DocsIconRow {
  readonly ref: ModelRef<ImageAsset>;
  readonly uuid: string;
  readonly name: string;
  readonly dataUri: string;
}
export interface DocsPackages {
  readonly packages: readonly string[];
  readonly identities: readonly string[];
}
export interface DocsExampleSource {
  readonly codegen: string;
  readonly loader: string;
}
interface IconResource {
  readonly store: StoreApi<DocsIconModel>;
  readonly icon: ImageAsset;
  readonly sync: () => void;
  readonly stops: (() => void)[];
}
interface ComponentResource {
  readonly component: Component;
  readonly store: StoreApi<DocsComponentModel>;
  dependencies: Set<Component>;
}
interface SlotTextResource {
  readonly component: Component;
  readonly slot: TplSlot;
  readonly store: StoreApi<string | undefined>;
  dependencies: Set<Component>;
}
interface ExampleResource {
  readonly component: Component;
  readonly example: PlumeDocsExample;
  readonly store: StoreApi<DocsExampleSource>;
  dependencies: Set<Component>;
}
export interface DocsDirectory {
  readonly components: readonly DocsComponentRow[];
  readonly icons: readonly DocsIconRow[];
}

function shareRows<T extends object>(previous: readonly T[], next: readonly T[], key: (row: T) => number | string): readonly T[] {
  const previousByUid = new Map(previous.map((row) => [key(row), row]));
  const shared = next.map((row) => {
    const before = previousByUid.get(key(row));
    const identity = (value: T) => "ref" in value ? value.ref : "param" in value ? value.param : undefined;
    return before && identity(before) === identity(row) && isEqual(before, row) ? before : Object.freeze(row);
  });
  return previous.length === shared.length && shared.every((row, index) => row === previous[index]) ? previous : Object.freeze(shared);
}

/** Demand-owned Docs projections. Field subscriptions are declared explicitly;
 * they never discover dependencies by intercepting model reads. */
export class DocsModelResources {
  private directory: StoreApi<DocsDirectory> | undefined;
  private packages: StoreApi<DocsPackages> | undefined;
  private readonly components = new Map<ModelRef<Component>, ComponentResource>();
  private readonly icons = new Map<ModelRef<ImageAsset>, IconResource>();
  private readonly slotTexts = new Map<ModelRef<TplSlot>, SlotTextResource>();
  private readonly examples = new Map<ModelRef<Component>, Map<PlumeDocsExample, ExampleResource>>();
  private directoryStops: (() => void)[] = [];
  private directoryRowStops: (() => void)[] = [];
  private stopModel: (() => void) | undefined;
  private subscribers = 0;
  private disposed = false;
  readonly siteStore: ModelFieldStore<ModelRef<Site>>;
  private readonly siteState: StoreApi<ModelRef<Site>>;

  constructor(private readonly docs: DocsPortalCtx) {
    const studio = docs.studioCtx;
    this.siteState = this.createState(() => studio.modelSnapshots.ref(studio.site));
    this.siteStore = this.siteState;
  }

  /** Render can allocate a projection, but only committed subscriptions connect
   * it to Studio. A discarded render therefore has no external owner. */
  private createState<T>(read: () => T): StoreApi<T> {
    const state = createStore(read);
    return { ...state, subscribe: (listener) => {
      const stop = state.subscribe(listener);
      try {
        const release = this.retain();
        return () => { stop(); release(); };
      } catch (error) {
        stop();
        throw error;
      }
    } };
  }

  retain() {
    if (this.disposed) { return () => undefined; }
    this.subscribers++;
    let released = false;
    const release = () => {
      if (released || this.disposed) { return; }
      released = true;
      if (--this.subscribers === 0) { this.disconnect(); }
    };
    try {
      if (!this.stopModel) {
        this.stopModel = this.docs.studioCtx.subscribeModelChanges((event) => this.syncModel(event));
      }
      // Read again after subscribing, including changes between render and commit.
      const site = this.docs.studioCtx.site;
      if (this.siteState.getState() !== this.snapshots.ref(site)) {
        this.syncModel({ type: "site-replaced", site });
      }
      this.bindResources();
      this.syncComponentResources(() => true);
      this.syncPackages();
      return release;
    } catch (error) {
      release();
      throw error;
    }
  }

  private bindResources() {
    if (this.directory && !this.directoryStops.length) { this.bindDirectory(); }
    for (const resource of this.icons.values()) {
      if (!resource.stops.length) {
        for (const field of ["uuid", "name", "dataUri"] as const) {
          resource.stops.push(this.snapshots.field(resource.icon, field).subscribe(resource.sync));
        }
      }
      resource.sync();
    }
    this.publishDirectory();
  }

  private disconnect() {
    this.stopModel?.();
    this.stopModel = undefined;
    this.directoryStops.splice(0).forEach((stop) => stop());
    this.directoryRowStops.splice(0).forEach((stop) => stop());
    for (const resource of this.icons.values()) { resource.stops.splice(0).forEach((stop) => stop()); }
  }

  get snapshots() { return this.docs.studioCtx.modelSnapshots; }

  private dependencies(component: Component) {
    return new Set([component, ...(component.superComp ? [component.superComp] : []), ...componentToDeepReferenced(component, true), ...depsForComponent(this.docs.studioCtx.site, component)]);
  }

  getComponentStore(ref: ModelRef<Component>): ModelFieldStore<DocsComponentModel> {
    let resource = this.components.get(ref);
    if (!resource) {
      const component = this.snapshots.resolve(ref);
      resource = { component, store: this.createState(() => projectDocsComponent(this.docs, component)), dependencies: this.dependencies(component) };
      this.components.set(ref, resource);
    }
    return resource.store;
  }

  getSlotTextStore(componentRef: ModelRef<Component>, slotRef: ModelRef<TplSlot>): ModelFieldStore<string | undefined> {
    let resource = this.slotTexts.get(slotRef);
    if (!resource) {
      const component = this.snapshots.resolve(componentRef);
      const slot = this.snapshots.resolve(slotRef);
      resource = { component, slot, dependencies: this.dependencies(component), store: this.createState(() => projectDocsSlotText(this.docs, slot)) };
      this.slotTexts.set(slotRef, resource);
    }
    return resource.store;
  }

  getIconModelStore(ref: ModelRef<ImageAsset>): ModelFieldStore<DocsIconModel> {
    let resource = this.icons.get(ref);
    if (!resource) {
      const icon = this.snapshots.resolve(ref);
      const read = () => Object.freeze({ ref, uuid: icon.uuid, name: icon.name, dataUri: icon.dataUri, className: makeAssetClassName(icon) });
      const state = this.createState(read);
      const sync = () => {
        const next = read();
        state.setState((previous) => shallow(previous, next) ? previous : next, true);
      };
      resource = { icon, store: state, sync, stops: [] };
      this.icons.set(ref, resource);
    }
    return resource.store;
  }

  getExampleStore(ref: ModelRef<Component>, example: PlumeDocsExample): ModelFieldStore<DocsExampleSource> {
    let entries = this.examples.get(ref);
    if (!entries) { entries = new Map(); this.examples.set(ref, entries); }
    let resource = entries.get(example);
    if (!resource) {
      const component = this.snapshots.resolve(ref);
      resource = { component, example, store: this.createState(() => this.projectExample(component, example)), dependencies: this.dependencies(component) };
      entries.set(example, resource);
    }
    return resource.store;
  }

  private projectExample(component: Component, example: PlumeDocsExample): DocsExampleSource {
    return Object.freeze({ codegen: makeCodePreviewSource(this.docs.studioCtx.site, component, example, false), loader: makeCodePreviewSource(this.docs.studioCtx.site, component, example, true) });
  }

  private syncModel(event: ModelCommit) {
    const studio = this.docs.studioCtx;
    if (event.type === "site-replaced") {
      const component = this.docs.tryGetFocusedComponent();
      const icon = this.docs.tryGetFocusedIcon();
      this.components.clear();
      this.examples.clear();
      for (const resource of this.icons.values()) { resource.stops.splice(0).forEach((stop) => stop()); }
      this.icons.clear();
      this.slotTexts.clear();
      if (component) {
        const current = event.site.components.find((candidate) => candidate.uuid === component.uuid);
        if (current) { this.docs.setFocusedComponent(current); } else { this.docs.resetFocus(); }
      } else if (icon) {
        const current = event.site.imageAssets.find((candidate) => candidate.uuid === icon.uuid);
        if (current) { this.docs.setFocusedIcon(current); } else { this.docs.resetFocus(); }
      }
      if (this.directory) { this.bindDirectory(); }
      this.syncPackages();
      this.siteState.setState(studio.modelSnapshots.ref(event.site), true);
      return;
    }
    const { summary } = event;
    if (!summary.changes.length) { return; }
    if (summary.changes.some(({ path, changeNode }) => (path ?? [changeNode]).some(({ field }) => ["projectDependencies", "hostLessPackageInfo"].includes(field)))) { this.syncPackages(); }
    // Plume property types and example dependencies can enumerate the project
    // component directory, including newly added matching Plume definitions.
    const rosterChanged = summary.changes.some(({ changeNode: { inst, field } }) =>
      (inst === studio.site && field === "components") || ["plumeInfo", "superComp", "subComps"].includes(field));
    const affected = (resource: ComponentResource | ExampleResource | SlotTextResource) =>
      [...resource.dependencies].some((component) => summary.updatedComponents.has(component) || summary.deepUpdatedComponents.has(component)) ||
      (rosterChanged && !!getPlumeDocsPlugin(resource.component));
    this.syncComponentResources(affected);
  }

  private syncComponentResources(affected: (resource: ComponentResource | ExampleResource | SlotTextResource) => boolean) {
    for (const resource of this.components.values()) {
      if (!affected(resource)) { continue; }
      const next = projectDocsComponent(this.docs, resource.component);
      resource.dependencies = this.dependencies(resource.component);
      resource.store.setState((previous) => {
        const shared = Object.freeze({ ...next,
          variantGroups: shareRows(previous.variantGroups, next.variantGroups, (group) => group.ref.uid),
          slots: shareRows(previous.slots, next.slots, (slot) => slot.ref.uid),
          linkedProps: shareRows(previous.linkedProps, next.linkedProps, (prop) => prop.param.uid),
          elements: shareRows(previous.elements, next.elements, (element) => element.ref.uid),
          examples: shareRows(previous.examples, next.examples, (example) => example.title),
          baseProps: shareRows(previous.baseProps, next.baseProps, (prop) => prop.name),
          customProps: shareRows(previous.customProps, next.customProps, (prop) => prop.name),
        });
        return shallow(previous, shared) ? previous : shared;
      }, true);
    }
    for (const resource of this.slotTexts.values()) {
      if (!affected(resource)) { continue; }
      const next = projectDocsSlotText(this.docs, resource.slot);
      resource.dependencies = this.dependencies(resource.component);
      resource.store.setState(next, true);
    }
    for (const entries of this.examples.values()) {
      for (const resource of entries.values()) {
        if (!affected(resource)) { continue; }
        const next = this.projectExample(resource.component, resource.example);
        resource.dependencies = this.dependencies(resource.component);
        resource.store.setState((previous) => shallow(previous, next) ? previous : next, true);
      }
    }
  }

  getPackagesStore(): ModelFieldStore<DocsPackages> {
    return this.packages ??= this.createState(() => this.projectPackages());
  }

  private projectPackages(): DocsPackages {
    const site = this.docs.studioCtx.site;
    const packages = usedHostLessPkgs(site);
    return Object.freeze({ packages: Object.freeze(packages.slice()), identities: Object.freeze(packages.map((pkg) => getHostLessPkgIdentity(pkg, site))) });
  }

  private syncPackages() {
    if (!this.packages) { return; }
    const next = this.projectPackages();
    this.packages.setState((previous) => isEqual(previous.identities, next.identities) ? previous : next, true);
  }

  getDirectoryStore(): ModelFieldStore<DocsDirectory> {
    if (!this.directory) {
      this.directory = this.createState<DocsDirectory>(() => ({ components: [], icons: [] }));
      this.publishDirectory();
    }
    return this.directory;
  }

  private bindDirectory() {
    this.directoryStops.splice(0).forEach((stop) => stop());
    const site = this.docs.studioCtx.site;
    const components = this.snapshots.field(site, "components");
    const icons = this.snapshots.field(site, "imageAssets");
    this.directoryStops.push(components.subscribe(() => this.bindDirectoryRows()), icons.subscribe(() => this.bindDirectoryRows()));
    this.bindDirectoryRows();
  }

  private bindDirectoryRows() {
    this.directoryRowStops.splice(0).forEach((stop) => stop());
    const site = this.docs.studioCtx.site;
    const components = this.snapshots.field(site, "components");
    const icons = this.snapshots.field(site, "imageAssets");
    for (const ref of components.getState()) {
      const component = this.snapshots.resolve(ref);
      for (const key of ["uuid", "name", "type", "superComp"] as const) {
        this.directoryRowStops.push(this.snapshots.field(component, key).subscribe(() => this.publishDirectory()));
      }
    }
    for (const ref of icons.getState()) {
      const icon = this.snapshots.resolve(ref);
      for (const key of ["uuid", "name", "type", "dataUri"] as const) {
        this.directoryRowStops.push(this.snapshots.field(icon, key).subscribe(() => this.publishDirectory()));
      }
    }
    this.publishDirectory();
  }

  private publishDirectory() {
    if (!this.directory) { return; }
    const studio = this.docs.studioCtx;
    const snapshots = this.snapshots;
    const components = snapshots.field(studio.site, "components").getState().flatMap((ref): DocsComponentRow[] => {
      const component = snapshots.resolve(ref);
      const type = snapshots.field(component, "type").getState();
      const superComp = snapshots.field(component, "superComp").getState();
      return type === ComponentType.Frame || type === ComponentType.Code || superComp ? [] : [{ ref, uuid: snapshots.field(component, "uuid").getState(), name: snapshots.field(component, "name").getState() }];
    });
    const icons = snapshots.field(studio.site, "imageAssets").getState().flatMap((ref): DocsIconRow[] => {
      const icon = snapshots.resolve(ref);
      const type = snapshots.field(icon, "type").getState();
      const dataUri = snapshots.field(icon, "dataUri").getState();
      return type === ImageAssetType.Icon && dataUri ? [{ ref, uuid: snapshots.field(icon, "uuid").getState(), name: snapshots.field(icon, "name").getState(), dataUri }] : [];
    });
    this.directory?.setState((previous) => {
      const nextComponents = shareRows(previous.components, components, (row) => row.ref.uid);
      const nextIcons = shareRows(previous.icons, icons, (row) => row.ref.uid);
      return nextComponents === previous.components && nextIcons === previous.icons ? previous : Object.freeze({ components: nextComponents, icons: nextIcons });
    }, true);
  }

  dispose() {
    this.disposed = true;
    this.disconnect();
    this.components.clear();
    this.examples.clear();
    this.icons.clear();
    this.slotTexts.clear();
  }
}

export function useDocsFocusedComponentRef(docs: DocsPortalCtx) {
  const owner = useStore(docs.models.siteStore);
  const select = useCallback((state: ReturnType<DocsPortalCtx["store"]["getState"]>) => state.focusedComponent ? docs.models.snapshots.ref(state.focusedComponent) : undefined, [docs, owner]);
  return useStore(docs.store, select);
}
export function useDocsFocusedIconRef(docs: DocsPortalCtx) {
  const owner = useStore(docs.models.siteStore);
  const select = useCallback((state: ReturnType<DocsPortalCtx["store"]["getState"]>) => state.focusedIcon ? docs.models.snapshots.ref(state.focusedIcon) : undefined, [docs, owner]);
  return useStore(docs.store, select);
}
