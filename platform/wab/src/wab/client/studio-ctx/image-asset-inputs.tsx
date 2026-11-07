import type { ModelFieldStore, ModelRef } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { arrayEq, assert } from "@/wab/shared/common";
import { walkDependencyInputs } from "@/wab/shared/core/project-deps";
import { findLast } from "lodash";
import { collectDependencyResources, allImageAssets, isEditable } from "@/wab/shared/core/sites";
import type { ImageAsset, ObjInst } from "@/wab/shared/model/classes";
import * as React from "react";

export interface ImageAssetRow {
  readonly ref: ModelRef<ImageAsset>;
  readonly uuid: string;
  readonly name: string;
  readonly type: string;
  readonly dataUri: ImageAsset["dataUri"];
}
export interface SelectedImageAsset extends Pick<ImageAssetRow, "ref" | "uuid" | "name" | "dataUri"> {
  readonly editable: boolean;
}
const noAssets: readonly ImageAssetRow[] = Object.freeze([]);
type Declare = (model: ObjInst, ...keys: string[]) => void;

/** Demanded UI input only; subscriptions begin at React commit. */
class ImageInputs<Value> {
  readonly models;
  readonly site;
  private readonly lifetime;
  private current: Value;
  private published: Value;
  private dirty = true;
  private connected = false;
  private terminalChanged = false;
  private readonly listeners = new Set<() => void>();
  private readonly fields = new Map<ModelFieldStore<unknown>, { prepared: () => void; published: () => void }>();
  constructor(private readonly studio: StudioCtx, initial: Value,
    private readonly capture: (declare: Declare, previous: Value) => Value,
    private readonly terminal?: (previous: Value) => Value) {
    this.models = studio.modelSnapshots; this.site = studio.site;
    this.lifetime = studio.arenaState.lifetime(); this.current = initial;
    this.getSnapshot(); this.published = this.current;
  }
  private isClosed() { return this.lifetime.aborted || this.studio.modelSnapshots !== this.models; }
  private invalidate = () => { this.dirty = true; };
  getSnapshot = (): Value => {
    if (this.isClosed()) { this.installTerminal(); return this.current; }
    if (!this.dirty) { return this.current; }
    const used = new Set<ModelFieldStore<unknown>>();
    const next = this.capture((model, ...keys) => {
      keys.forEach((key) => used.add(this.models.declaredField(model, key)));
    }, this.current);
    if (this.connected) {
      for (const field of used) {
        if (!this.fields.has(field)) {
          this.fields.set(field, { prepared: this.models.subscribePreparedField(field, this.invalidate), published: field.subscribe(this.sync) });
        }
      }
      for (const [field, stops] of this.fields) {
        if (!used.has(field)) { stops.prepared(); stops.published(); this.fields.delete(field); }
      }
    }
    this.current = next; this.dirty = false;
    return this.current;
  };
  private sync = () => {
    this.dirty = true;
    this.getSnapshot();
    if (this.current !== this.published) { this.published = this.current; this.listeners.forEach((listener) => listener()); }
  };
  private disconnect = () => {
    this.connected = false;
    this.lifetime.removeEventListener("abort", this.close);
    for (const stops of this.fields.values()) { stops.prepared(); stops.published(); }
    this.fields.clear();
  };
  private installTerminal() {
    const next = this.terminal ? this.terminal(this.current) : this.current;
    this.terminalChanged ||= next !== this.current;
    this.current = next;
  }
  private close = () => {
    this.installTerminal();
    this.disconnect();
    if (this.terminalChanged) { this.listeners.forEach((listener) => listener()); }
    this.terminalChanged = false;
    this.listeners.clear();
  };
  subscribe = (listener: () => void): (() => void) => {
    if (this.isClosed()) { return () => undefined; }
    this.listeners.add(listener);
    if (!this.connected) {
      this.connected = true;
      this.lifetime.addEventListener("abort", this.close, { once: true });
      this.sync();
    }
    let stopped = false;
    return () => {
      if (stopped) { return; } stopped = true;
      this.listeners.delete(listener);
      if (!this.listeners.size) { this.disconnect(); }
    };
  };
  resolve(ref: ModelRef<ImageAsset>): ImageAsset {
    assert(!this.isClosed(), "Cannot resolve an image asset from a closed model owner");
    return this.models.resolve(ref);
  }
}

export function createSelectedImageAssetInputs(studio: StudioCtx, asset: ImageAsset) {
  const models = studio.modelSnapshots, site = studio.site;
  return new ImageInputs<SelectedImageAsset | undefined>(studio, undefined, (declare, previous) => {
    declare(asset, "uuid", "name", "dataUri"); declare(site, "imageAssets");
    const next = { ref: models.ref(asset), uuid: asset.uuid, name: asset.name, dataUri: asset.dataUri, editable: isEditable(site, asset) };
    return previous && previous.ref === next.ref && previous.uuid === next.uuid && previous.name === next.name && previous.dataUri === next.dataUri && previous.editable === next.editable ? previous : Object.freeze(next);
  }, (previous) => previous?.editable ? Object.freeze({ ...previous, editable: false }) : previous);
}

/** Original allImageAssets order, including its direct dependency policy and
 * duplicate UUID behavior. Command lookup keeps the first matching row. */
export function createImageAssetListInputs(studio: StudioCtx, includeDeps?: "direct") {
  const models = studio.modelSnapshots, site = studio.site;
  const rows = new Map<ImageAsset, ImageAssetRow>();
  return new ImageInputs<readonly ImageAssetRow[]>(studio, noAssets, (declare, previous) => {
    declare(site, "imageAssets");
    if (includeDeps) {
      declare(site, "projectDependencies");
      site.projectDependencies.forEach((dependency) => { declare(dependency, "site"); declare(dependency.site, "imageAssets"); });
    }
    const assets = allImageAssets(site, { includeDeps });
    const used = new Set(assets);
    for (const asset of rows.keys()) { if (!used.has(asset)) { rows.delete(asset); } }
    const next = assets.map((asset) => {
      declare(asset, "uuid", "name", "type", "dataUri");
      const before = rows.get(asset);
      if (before && before.uuid === asset.uuid && before.name === asset.name && before.type === asset.type && before.dataUri === asset.dataUri) { return before; }
      const row = Object.freeze({ ref: models.ref(asset), uuid: asset.uuid, name: asset.name, type: asset.type, dataUri: asset.dataUri });
      rows.set(asset, row); return row;
    });
    return arrayEq(previous, next) ? previous : Object.freeze(next);
  }, () => noAssets);
}

export type ImageAssetValue = Readonly<Pick<ImageAssetRow, "uuid" | "dataUri">>;
const noAssetValues: readonly ImageAssetValue[] = Object.freeze([]);

/** Only values for requested CSS asset IDs; original all-dependency ordering
 * and dictionary last-UUID lookup, with no catalog/model dictionary mirror. */
export function createImageAssetDictionaryInputs(studio: StudioCtx, ids: readonly string[]) {
  const models = studio.modelSnapshots, site = studio.site, requested = [...new Set(ids)];
  return new ImageInputs<readonly ImageAssetValue[]>(studio, noAssetValues, (declare, previous) => {
    if (!requested.length) { return noAssetValues; }
    const read = <T extends ObjInst, K extends Exclude<keyof T, "uid"> & string>(model: T, key: K) => {
      declare(model, key); return models.field(model, key).getState();
    };
    const local = read(site, "imageAssets").map((ref) => models.resolve(ref));
    const nested = (dependency: import("@/wab/shared/model/classes").ProjectDependency) => models.resolve(read(dependency, "site"));
    const dependencies = walkDependencyInputs(read(site, "projectDependencies").map((ref) => models.resolve(ref)), "all",
      (dependency) => read(nested(dependency), "projectDependencies").map((ref) => models.resolve(ref)), (dependency) => read(dependency, "projectId"));
    const assets = collectDependencyResources(local, dependencies, (dependency) => read(nested(dependency), "imageAssets").map((ref) => models.resolve(ref)))
      .map((asset) => ({ asset, uuid: read(asset, "uuid") }));
    const next = requested.flatMap((uuid) => {
      const selected = findLast(assets, (candidate) => candidate.uuid === uuid);
      if (!selected) { return []; }
      const dataUri = read(selected.asset, "dataUri"), before = previous.find((row) => row.uuid === uuid);
      return [before && before.dataUri === dataUri ? before : Object.freeze({ uuid, dataUri })];
    });
    return arrayEq(previous, next) ? previous : Object.freeze(next);
  }, () => noAssetValues);
}

/** Retained selected values stay bound to the world in which the actual prop
 * identity arrived; they never enroll an old asset in new Models. */
export function useSelectedImageAsset(studio: StudioCtx, asset: ImageAsset | undefined) {
  const source = React.useMemo(() => asset ? createSelectedImageAssetInputs(studio, asset) : undefined, [studio, asset]);
  const subscribe = React.useCallback((listener: () => void) => source ? source.subscribe(listener) : () => undefined, [source]);
  const read = React.useCallback(() => source?.getSnapshot(), [source]);
  return React.useSyncExternalStore(subscribe, read, read);
}

export function useImageAssetList(studio: StudioCtx, includeDeps?: "direct") {
  const subscribeOwner = React.useCallback((listener: () => void) => studio.subscribeModelChanges((event) => { if (event.type === "site-replaced") { listener(); } }), [studio]);
  const readOwner = React.useCallback(() => studio.modelSnapshots, [studio]);
  const models = React.useSyncExternalStore(subscribeOwner, readOwner, readOwner);
  const source = React.useMemo(() => createImageAssetListInputs(studio, includeDeps), [studio, models, includeDeps]);
  const rows = React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
  return { rows, resolve: (ref: ModelRef<ImageAsset>) => source.resolve(ref) };
}
