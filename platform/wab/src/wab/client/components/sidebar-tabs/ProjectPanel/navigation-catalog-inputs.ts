import type { ModelFieldStore, ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { AnyArena } from "@/wab/shared/Arenas";
import { arrayEq, switchType } from "@/wab/shared/common";
import { Arena, PageArena, ComponentArena, ObjInst, Site } from "@/wab/shared/model/classes";
import { naturalSort } from "@/wab/shared/sort";
import * as React from "react";

interface NavigationArenaFields {
  readonly key: string;
  readonly name: string;
  readonly pathName: string | undefined;
  readonly componentId: string | undefined;
}
export type NavigationArenaInput = NavigationArenaFields & (
  { readonly type: "custom"; readonly arena: Arena } |
  { readonly type: "page"; readonly arena: PageArena } |
  { readonly type: "component"; readonly arena: ComponentArena }
);
function captureArena(arena: AnyArena): NavigationArenaInput {
  return Object.freeze(switchType(arena)
    .when(Arena, (value) => ({ type: "custom" as const, arena: value, key: `${value.name}-${value.uid}`, name: value.name, pathName: undefined, componentId: undefined }))
    .when(PageArena, (value) => ({ type: "page" as const, arena: value, key: value.component.uuid, name: value.component.name, pathName: value.component.pageMeta?.path, componentId: value.component.uuid }))
    .when(ComponentArena, (value) => ({ type: "component" as const, arena: value, key: value.component.uuid, name: value.component.name, pathName: undefined, componentId: value.component.uuid }))
    .result());
}

interface NavigationCatalogSnapshot {
  readonly mixed: readonly NavigationArenaInput[];
  readonly pages: readonly NavigationArenaInput[];
  readonly components: readonly NavigationArenaInput[];
  readonly fields: readonly unknown[];
}
const empty: NavigationCatalogSnapshot = Object.freeze({ mixed: Object.freeze([]), pages: Object.freeze([]), components: Object.freeze([]), fields: Object.freeze([]) });

/** Navigation's roster, folders, labels and page search paths. Canvas contents
 * and geometry do not invalidate this directory. */
export class NavigationCatalogInputs {
  private readonly models: ModelSnapshots;
  private readonly site: Site;
  private readonly lifetime: AbortSignal;
  private current = empty;
  private readonly listeners = new Set<() => void>();
  private readonly fields = new Map<ModelFieldStore<unknown>, () => void>();
  private connected = false;
  private closed = false;
  constructor(private readonly studio: StudioCtx, private readonly contentEditorMode: boolean) {
    this.models = studio.modelSnapshots;
    this.site = studio.site;
    this.lifetime = studio.arenaState.lifetime();
    this.getSnapshot();
  }
  private disconnect = () => {
    this.connected = false;
    this.lifetime.removeEventListener("abort", this.close);
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
  getSnapshot = (): NavigationCatalogSnapshot => {
    if (this.closed || this.lifetime.aborted || this.models !== this.studio.modelSnapshots) { this.current = empty; return this.current; }
    const used = new Set<ModelFieldStore<unknown>>();
    const field = (value: ObjInst, ...keys: string[]) => keys.forEach((key) => used.add(this.models.declaredField(value, key)));
    field(this.site, "arenas", "pageArenas", "componentArenas");
    this.site.arenas.forEach((arena) => field(arena, "name"));
    [...this.site.pageArenas, ...this.site.componentArenas].forEach((arena) => {
      field(arena, "component");
      const component = arena.component;
      field(component, "uuid", "name", "editableByContentEditor", "subComps", "superComp", "pageMeta");
      if (component.pageMeta) { field(component.pageMeta, "path"); }
    });
    const values = [...used].map((store) => store.getState());
    if (!arrayEq(this.current.fields, values)) {
      const canEdit = (component: ComponentArena["component"]) => !this.contentEditorMode || component.editableByContentEditor;
      const components: ComponentArena[] = [];
      const addComponentArena = (arena: ComponentArena) => {
        components.push(arena);
        arena.component.subComps.forEach((component) => {
          const child = this.site.componentArenas.find((candidate) => candidate.component === component);
          if (child) { addComponentArena(child); }
        });
      };
      naturalSort(this.site.componentArenas, (arena) => arena.component.name).forEach((arena) => {
        if (!arena.component.superComp && canEdit(arena.component)) { addComponentArena(arena); }
      });
      this.current = Object.freeze({
        mixed: Object.freeze((this.contentEditorMode ? [] : naturalSort(this.site.arenas, (arena) => arena.name)).map(captureArena)),
        pages: Object.freeze(naturalSort(this.site.pageArenas, (arena) => arena.component.name).filter((arena) => canEdit(arena.component)).map(captureArena)),
        components: Object.freeze(components.map(captureArena)),
        fields: Object.freeze(values),
      });
    }
    if (this.connected) {
      for (const store of used) { if (!this.fields.has(store)) { this.fields.set(store, store.subscribe(this.sync)); } }
      for (const [store, stop] of this.fields) { if (!used.has(store)) { stop(); this.fields.delete(store); } }
    }
    return this.current;
  };
  subscribe = (listener: () => void) => {
    if (this.closed || this.lifetime.aborted) { return () => undefined; }
    this.listeners.add(listener);
    if (!this.connected) { this.connected = true; this.lifetime.addEventListener("abort", this.close, { once: true }); this.sync(); }
    return () => { this.listeners.delete(listener); if (!this.listeners.size) { this.disconnect(); } };
  };
}

export function useNavigationCatalogInputs(studio: StudioCtx, contentEditorMode: boolean) {
  const source = React.useMemo(() => new NavigationCatalogInputs(studio, contentEditorMode), [studio, studio.modelSnapshots, studio.site, contentEditorMode]);
  return React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
}
