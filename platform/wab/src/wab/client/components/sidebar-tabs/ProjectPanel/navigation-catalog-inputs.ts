import { ModelFieldInputs } from "@/wab/client/stores/model-field-inputs";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { AnyArena } from "@/wab/shared/Arenas";
import { switchType } from "@/wab/shared/common";
import { Arena, PageArena, ComponentArena, Site } from "@/wab/shared/model/classes";
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
  private readonly site: Site;
  private readonly inputs: ModelFieldInputs;
  private current = empty;
  constructor(studio: StudioCtx, private readonly contentEditorMode: boolean) {
    this.site = studio.site;
    const models = studio.modelSnapshots;
    this.inputs = new ModelFieldInputs({ models, lifetime: studio.arenaState.lifetime(), isCurrent: () => models === studio.modelSnapshots && this.site === studio.site }, (field) => {
    field(this.site, "arenas", "pageArenas", "componentArenas");
    this.site.arenas.forEach((arena) => field(arena, "name"));
    [...this.site.pageArenas, ...this.site.componentArenas].forEach((arena) => {
      field(arena, "component");
      const component = arena.component;
      field(component, "uuid", "name", "editableByContentEditor", "subComps", "superComp", "pageMeta");
      if (component.pageMeta) { field(component.pageMeta, "path"); }
    });
    });
  }
  getSnapshot = (): NavigationCatalogSnapshot => {
    if (!this.inputs.isCurrent()) { return empty; }
    const values = this.inputs.read();
    if (this.current.fields !== values) {
      const canEdit = (component: ComponentArena["component"]) => !this.contentEditorMode || component.editableByContentEditor;
      const components: ComponentArena[] = [];
      const arenasByComponent = new Map(this.site.componentArenas.map((arena) => [arena.component, arena]));
      const addComponentArena = (arena: ComponentArena) => {
        components.push(arena);
        arena.component.subComps.forEach((component) => {
          const child = arenasByComponent.get(component);
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
    return this.current;
  };
  subscribe = (listener: () => void) => this.inputs.subscribe(listener);
}

export function useNavigationCatalogInputs(studio: StudioCtx, contentEditorMode: boolean) {
  const source = React.useMemo(() => new NavigationCatalogInputs(studio, contentEditorMode), [studio, studio.modelSnapshots, studio.site, contentEditorMode]);
  return React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
}
