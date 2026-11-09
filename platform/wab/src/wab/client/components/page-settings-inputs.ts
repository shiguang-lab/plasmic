import { clone } from "@/wab/shared/core/exprs";
import { Expr, isKnownExpr } from "@/wab/shared/model/classes";
import { instUtil } from "@/wab/shared/model/InstUtil";
import type { ModelFieldStore, ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { PageComponent } from "@/wab/shared/core/components";
import { arrayEq } from "@/wab/shared/common";
import { ObjInst, Site, isKnownCustomCode, isKnownObjectPath, isKnownTemplatedString, isKnownImageAssetRef } from "@/wab/shared/model/classes";
import * as React from "react";

const empty: readonly unknown[] = Object.freeze([]);
/** Page metadata and the restricted expressions accepted by its text/image
 * editors. Canvas evaluation is subscribed separately through inspector inputs. */
export class PageSettingsInputs {
  private readonly models: ModelSnapshots;
  private readonly site: Site;
  private readonly lifetime: AbortSignal;
  private current = empty;
  private projectedFields: readonly unknown[] | undefined;
  private projected: ReturnType<PageSettingsInputs["project"]> | undefined;
  private readonly fields = new Map<ModelFieldStore<unknown>, () => void>();
  private readonly listeners = new Set<() => void>();
  private connected = false;
  private closed = false;
  constructor(private readonly studio: StudioCtx, private readonly page: PageComponent) {
    this.models = studio.modelSnapshots; this.site = studio.site;
    this.lifetime = studio.arenaState.lifetime(); this.getSnapshot();
  }
  private disconnect = () => {
    this.connected = false; this.lifetime.removeEventListener("abort", this.close);
    this.fields.forEach((stop) => stop()); this.fields.clear();
  };
  private close = () => {
    if (this.closed) { return; }
    this.closed = true; this.current = empty; this.disconnect();
    this.listeners.forEach((listener) => listener()); this.listeners.clear();
  };
  private sync = () => {
    const before = this.current; this.getSnapshot();
    if (before !== this.current) { this.listeners.forEach((listener) => listener()); }
  };
  getSnapshot = (): readonly unknown[] => {
    if (this.closed || this.lifetime.aborted || this.models !== this.studio.modelSnapshots) { this.current = empty; return this.current; }
    const used = new Set<ModelFieldStore<unknown>>();
    const field = (value: ObjInst, ...keys: string[]) => keys.forEach((key) => used.add(this.models.declaredField(value, key)));
    field(this.page, "pageMeta", "name", "tplTree", "serverQueries");
    field(this.site, "flags");
    this.page.serverQueries.forEach((query) => field(query, "name"));
    const seen = new Set<object>();
    const expression = (value: unknown) => {
      if (!value || typeof value !== "object" || seen.has(value)) { return; }
      seen.add(value);
      if (!instUtil.isObjInst(value)) { return; }
      if (isKnownTemplatedString(value)) {
        field(value, "text"); value.text.forEach(expression);
      } else if (isKnownObjectPath(value)) {
        field(value, "path", "fallback"); expression(value.fallback);
      } else if (isKnownCustomCode(value)) {
        field(value, "code", "fallback"); expression(value.fallback);
      } else if (isKnownImageAssetRef(value)) {
        field(value, "asset"); field(value.asset, "name", "dataUri", "type");
      }
    };
    const meta = this.page.pageMeta;
    field(meta, "path", "title", "description", "canonical", "openGraphImage");
    [meta.title, meta.description, meta.canonical, meta.openGraphImage].forEach(expression);
    const values = [...used].map((store) => store.getState());
    if (!arrayEq(this.current, values)) { this.current = Object.freeze(values); }
    if (this.connected) {
      for (const store of used) { if (!this.fields.has(store)) { this.fields.set(store, store.subscribe(this.sync)); } }
      for (const [store, stop] of this.fields) { if (!used.has(store)) { stop(); this.fields.delete(store); } }
    }
    return this.current;
  };
  private project() {
    const meta = this.page.pageMeta;
    const capture = <T extends string | Expr | null | undefined>(value: T): T => typeof value === "object" && value !== null ? clone(value) : value;
    return {
      meta: {path: meta.path, title: capture(meta.title), description: capture(meta.description), canonical: capture(meta.canonical), openGraphImage: capture(meta.openGraphImage)},
      name: this.page.name,
      root: this.page.tplTree,
      queryNames: this.page.serverQueries.map(query => query.name),
      projectFlags: this.studio.projectFlags(),
    };
  }
  getPageSnapshot = () => {
    const fields = this.getSnapshot();
    if (!this.projected || (fields !== empty && fields !== this.projectedFields)) {
      this.projectedFields = fields;
      this.projected = this.project();
    }
    return this.projected;
  };
  subscribe = (listener: () => void) => {
    if (this.closed || this.lifetime.aborted) { return () => undefined; }
    this.listeners.add(listener);
    if (!this.connected) { this.connected = true; this.lifetime.addEventListener("abort", this.close, { once: true }); this.sync(); }
    return () => { this.listeners.delete(listener); if (!this.listeners.size) { this.disconnect(); } };
  };
}
export function usePageSettingsModelInputs(studio: StudioCtx, page: PageComponent) {
  const source = React.useMemo(() => new PageSettingsInputs(studio, page), [studio, page]);
  return React.useSyncExternalStore(source.subscribe, source.getPageSnapshot, source.getPageSnapshot);
}
