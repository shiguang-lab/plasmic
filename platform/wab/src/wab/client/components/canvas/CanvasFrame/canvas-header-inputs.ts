import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { canvasFactory } from "@/wab/client/components/canvas/canvas-factories";
import type { ModelFieldStore, ModelRef, ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { getDisplayVariants, isCodeComponentVariant } from "@/wab/shared/Variants";
import { isPageComponent } from "@/wab/shared/core/components";
import { arrayEq } from "@/wab/shared/common";
import { isTplComponent } from "@/wab/shared/core/tpls";
import { ArenaFrame, Component, ObjInst, Site, TplTag, Variant, VariantGroup, Expr, isKnownCustomCode, isKnownCompositeExpr, isKnownTemplatedString } from "@/wab/shared/model/classes";
import * as React from "react";

const empty = Object.freeze([]);
interface CanvasHeaderSnapshot {
  readonly frameName: string;
  readonly component: Component;
  readonly pageComponent: boolean;
  readonly displayVariants: readonly ReturnType<typeof getDisplayVariants>[number][];
}
interface CanvasHeaderScope {
  readonly models: ModelSnapshots;
  readonly site: Site;
  readonly lifetime: AbortSignal;
  readonly member: ModelRef<ArenaFrame> | undefined;
}
function captureScope(studio: StudioCtx, frame: ArenaFrame): CanvasHeaderScope {
  const models = studio.modelSnapshots;
  return {
    models, site: studio.site, lifetime: studio.arenaState.lifetime(),
    member: studio.arenaState.frameMembershipStore.getState().find((ref) => ref.uid === frame.uid && models.resolve(ref) === frame),
  };
}

/** Frame title and the model metadata used by display variants.
 * Selection, viewport and frame width retain their existing native owners. */
export class CanvasHeaderInputs {
  private readonly models;
  private readonly site;
  private readonly lifetime;
  private current: CanvasHeaderSnapshot | undefined;
  private values: readonly unknown[] = empty;
  private readonly fields = new Map<ModelFieldStore<unknown>, () => void>();
  private readonly listeners = new Set<() => void>();
  private connected = false;
  private readonly member;

  constructor(private readonly studio: StudioCtx, private readonly frame: ArenaFrame, private readonly focusedTag?: TplTag, private readonly isPageArena?: boolean, scope = captureScope(studio, frame)) {
    this.models = scope.models;
    this.site = scope.site;
    this.lifetime = scope.lifetime;
    this.member = scope.member;
    this.getSnapshot();
  }
  private disconnect = () => {
    this.connected = false;
    this.lifetime.removeEventListener("abort", this.close);
    this.fields.forEach((stop) => stop()); this.fields.clear();
  };
  private close = () => {
    this.disconnect();
  };
  private sync = () => {
    const previous = this.current; this.getSnapshot();
    if (previous !== this.current) { this.listeners.forEach((listener) => listener()); }
  };
  getSnapshot = (): CanvasHeaderSnapshot | undefined => {
    if (!this.member || this.lifetime.aborted || !this.studio.arenaState.isCurrentLifetime(this.lifetime) || this.models !== this.studio.modelSnapshots) {
      this.disconnect(); return this.current;
    }
    // Model fields publish before React unmounts the header. A removed frame
    // can still refer to variants that no longer belong to its component.
    if (!this.studio.arenaState.frameMembershipStore.getState().includes(this.member)) {
      return this.current;
    }
    const used = new Set<ModelFieldStore<unknown>>();
    const field = (model: ObjInst, ...keys: string[]) => keys.forEach((key) => used.add(this.models.declaredField(model, key)));
    field(this.frame, "name", "container", "targetVariants", "targetGlobalVariants", "pinnedVariants", "pinnedGlobalVariants");
    field(this.frame.container, "component");
    const variants = new Set<Variant>(), groups = new Set<VariantGroup>(), components = new Set<Component>();
    const variant = (value: Variant) => {
      if (variants.has(value)) { return; } variants.add(value);
      field(value, "uuid", "name", "parent", "selectors", "forTpl", "mediaQuery", "codeComponentName", "codeComponentVariantKeys");
      if (value.parent) { group(value.parent); }
    };
    const group = (value: VariantGroup) => {
      if (groups.has(value)) { return; } groups.add(value);
      field(value, "variants", "type", "multi"); value.variants.forEach(variant);
    };
    const component = (value: Component) => {
      if (components.has(value)) { return; } components.add(value);
      field(value, "name", "type", "variants", "variantGroups", "superComp");
      value.variants.forEach(variant); value.variantGroups.forEach(group);
      if (value.superComp) { component(value.superComp); }
    };
    component(this.frame.container.component);
    const sites = new Set<Site>();
    const globals = (site: Site) => {
      if (sites.has(site)) { return; } sites.add(site);
      field(site, "globalVariantGroups", "projectDependencies"); site.globalVariantGroups.forEach(group);
      site.projectDependencies.forEach((dependency) => { field(dependency, "site"); globals(dependency.site); });
    };
    globals(this.site);
    field(this.site, "activeScreenVariantGroup", "componentArenas", "pageArenas");
    if (this.site.activeScreenVariantGroup) { group(this.site.activeScreenVariantGroup); }
    [...this.site.componentArenas, ...this.site.pageArenas].forEach((arena) => field(arena, "component"));
    const expression = (expr: Expr) => {
      if (isKnownCustomCode(expr)) { field(expr, "code"); }
      else if (isKnownTemplatedString(expr)) { field(expr, "text"); }
      else if (isKnownCompositeExpr(expr)) { field(expr, "hostLiteral", "substitutions"); Object.values(expr.substitutions).forEach(expression); }
    };
    const tag = this.focusedTag;
    if (tag) {
      field(tag, "name", "tag", "type", "parent");
      if (tag.tag === "input") {
        field(tag, "vsettings"); tag.vsettings.forEach((setting) => {
          field(setting, "variants", "attrs"); setting.variants.forEach(variant);
          if (setting.attrs.type) { expression(setting.attrs.type); }
        });
      }
    }
    const displayed = getDisplayVariants({ site: this.site, frame: this.frame, focusedTag: tag, isPageArena: this.isPageArena });
    const codeVariants = new Set<Variant>(displayed.map((entry) => entry.variant).filter(isCodeComponentVariant));
    if (codeVariants.size) {
      field(this.site, "components");
      this.site.components.forEach((owner) => {
        field(owner, "variants");
        const matched = owner.variants.filter((value) => codeVariants.has(value));
        if (!matched.length) { return; }
        field(owner, "tplTree"); const root = owner.tplTree; field(root, "parent");
        if (isTplComponent(root)) {
          field(root, "component"); field(root.component, "type", "codeComponentMeta");
          const meta = root.component.codeComponentMeta;
          if (meta) {
            field(meta, "variants");
            matched.filter(isCodeComponentVariant).forEach((value) => value.codeComponentVariantKeys.forEach((key) => {
              const info = meta.variants[key]; if (info) { field(info, "displayName"); }
            }));
          }
        }
      });
    }
    const values = [...used].map((store) => store.getState());
    if (!arrayEq(this.values, values)) {
      this.values = Object.freeze(values);
      const owner = this.frame.container.component;
      this.current = Object.freeze({
        frameName: this.studio.tplMgr().describeArenaFrame(this.frame),
        component: owner,
        pageComponent: isPageComponent(owner),
        displayVariants: Object.freeze(displayed),
      });
    }
    if (this.connected) {
      for (const store of used) { if (!this.fields.has(store)) { this.fields.set(store, store.subscribe(this.sync)); } }
      for (const [store, stop] of this.fields) { if (!used.has(store)) { stop(); this.fields.delete(store); } }
    }
    return this.current;
  };
  subscribe = (listener: () => void) => {
    if (!this.member || this.lifetime.aborted || !this.studio.arenaState.isCurrentLifetime(this.lifetime) || this.models !== this.studio.modelSnapshots) { return () => undefined; }
    this.listeners.add(listener);
    if (!this.connected) { this.connected = true; this.lifetime.addEventListener("abort", this.close, { once: true }); this.sync(); }
    return () => { this.listeners.delete(listener); if (!this.listeners.size) { this.disconnect(); } };
  };
}

// Like the frame-width source, a retired header retains its last presentation
// across final renders and remounts without attaching to a replacement owner.
const headerSource = canvasFactory((studio: StudioCtx, frame: ArenaFrame, focusedTag?: TplTag, isPageArena?: boolean) =>
  new CanvasHeaderInputs(studio, frame, focusedTag, isPageArena),
);

export function useCanvasHeaderInputs(studio: StudioCtx, frame: ArenaFrame, focusedTag?: TplTag, isPageArena?: boolean) {
  const source = React.useMemo(() => headerSource(studio, frame, focusedTag, isPageArena), [studio, frame, focusedTag, isPageArena]);
  return React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
}
