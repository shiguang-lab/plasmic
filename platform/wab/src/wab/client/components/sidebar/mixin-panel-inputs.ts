import { captureVariantModelWorld, useCurrentModelWorld } from "@/wab/client/components/variants/variant-model-world";
import { extractMixinUsages } from "@/wab/shared/core/styles";
import { isHostLessPackage } from "@/wab/shared/core/sites";
import type { ModelFieldStore, ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { arrayEq, assert } from "@/wab/shared/common";
import { flattenComponent } from "@/wab/shared/cached-selectors";
import { isTplTag, isTplSlot, isTplComponent } from "@/wab/shared/core/tpls";
import { Mixin, ObjInst, Site, Theme, isKnownRenderExpr } from "@/wab/shared/model/classes";
import { walkDependencyTree } from "@/wab/shared/core/project-deps";
import { isTagListContainer, type TagName } from "@/wab/shared/html";
import * as React from "react";

interface MixinPreviewData {
  readonly text: string;
  readonly elementValues: Readonly<Record<string, string>>;
  readonly baseValues: Readonly<Record<string, string>>;
  readonly listValues: Readonly<Record<string, string>>;
  readonly wrapperValues: Readonly<Record<string, string>>;
}
const emptyPreview: MixinPreviewData = Object.freeze({text: "", elementValues: {}, baseValues: {}, listValues: {}, wrapperValues: {}});

const empty: readonly unknown[] = Object.freeze([]);
let nextKey = 0;
interface MixinScope { readonly models: ModelSnapshots; readonly site: Site; readonly lifetime: AbortSignal; }
const scopes = new WeakMap<StudioCtx, WeakMap<Mixin, MixinScope>>();
function modelScope(studio: StudioCtx, mixin: Mixin): MixinScope {
  let values = scopes.get(studio);
  const prior = values?.get(mixin); if (prior) { return prior; }
  const scope = { models: studio.modelSnapshots, site: studio.site, lifetime: studio.arenaState.lifetime() };
  if (!scope.lifetime.aborted) {
    const sites = [scope.site, ...walkDependencyTree(scope.site, "all").map((dependency) => dependency.site)];
    assert(sites.some((site) => site.mixins.includes(mixin) || site.themes.some((theme) => theme.defaultStyle === mixin || theme.styles.some((style) => style.style === mixin))), "Mixin command belongs to another model world");
  }
  if (!values) { values = new WeakMap(); scopes.set(studio, values); } values.set(mixin, scope); return scope;
}
/** Directory labels and, only while open, the exact mixin-reference graph. */
export class MixinPanelInputs {
  readonly key = ++nextKey;
  private readonly models: ModelSnapshots;
  private readonly site: Site;
  private readonly lifetime: AbortSignal;
  private current = empty;
  private catalogFields: readonly unknown[] | undefined;
  private catalogValue: ReturnType<MixinPanelInputs["projectCatalog"]> | undefined;
  private usageFields: readonly unknown[] | undefined;
  private usageValue: ReturnType<MixinPanelInputs["projectUsage"]> | undefined;
  private modelFields: readonly unknown[] | undefined;
  private modelValue: ReturnType<MixinPanelInputs["projectModel"]> | undefined;
  private published = empty;
  private dirty = true;
  private connected = false;
  private readonly fields = new Map<ModelFieldStore<unknown>, { prepare: () => void; stop: () => void }>();
  private readonly listeners = new Set<() => void>();
  constructor(private readonly studio: StudioCtx, private readonly input: { kind: "catalog" } | { kind: "usage"; mixin: Mixin | undefined } | { kind: "model"; mixin: Mixin; previewTag?: TagName }, world = captureVariantModelWorld(studio)) {
    const scope = input.kind !== "catalog" && input.mixin ? modelScope(studio, input.mixin) : world;
    this.models = scope.models; this.site = scope.site; this.lifetime = scope.lifetime;
  }
  isActive = () => !this.lifetime.aborted && this.models === this.studio.modelSnapshots && this.site === this.studio.site;
  private disconnect = () => { this.connected = false; this.lifetime.removeEventListener("abort", this.close); this.fields.forEach(({ prepare, stop }) => { prepare(); stop(); }); this.fields.clear(); };
  private close = () => { this.current = empty; this.disconnect(); this.publishSnapshot(); this.listeners.clear(); };
  private invalidate = () => { this.dirty = true; };
  private publishSnapshot = () => { if (this.current !== this.published) { this.published = this.current; this.listeners.forEach((listener) => listener()); } };
  private publish = () => { this.getSnapshot(); this.publishSnapshot(); };
  getSnapshot = (): readonly unknown[] => {
    if (!this.isActive()) { return empty; }
    if (this.connected && !this.dirty) { return this.current; }
    const used = new Set<ModelFieldStore<unknown>>();
    const field = (model: ObjInst, ...keys: string[]) => keys.forEach((key) => used.add(this.models.declaredField(model, key)));
    if (this.input.kind === "catalog") {
      field(this.site, "mixins", "projectDependencies");
      const sites = [this.site, ...this.site.projectDependencies.map((dependency) => {
        field(dependency, "uuid", "name", "projectId", "site"); field(dependency.site, "mixins", "hostLessPackageInfo"); return dependency.site;
      })];
      sites.forEach((site) => site.mixins.forEach((mixin) => field(mixin, "uuid", "name")));
    } else if (this.input.kind === "model") {
      const { mixin, previewTag: tag } = this.input;
      field(mixin, "name", "forTheme", "rs");
      if (tag !== undefined) {
        field(mixin, "preview"); field(mixin.rs, "values"); field(this.site, "activeTheme");
        const theme = this.site.activeTheme;
        if (theme) {
          field(theme, "defaultStyle", "styles"); field(theme.defaultStyle, "rs"); field(theme.defaultStyle.rs, "values");
          theme.styles.forEach((style) => field(style, "selector", "style"));
          const ownSelector = mixin.forTheme ? theme.styles.find((style) => style.style === mixin)?.selector : undefined;
          const inheritedTag = ownSelector?.includes(":") ? ownSelector.split(":")[0] : undefined;
          const tags = [inheritedTag, ...(isTagListContainer(tag) ? ["li"] : []), ...(tag === "li" ? ["ul"] : [])];
          tags.forEach((value) => {
            const style = value ? theme.styles.find((candidate) => candidate.selector === value)?.style : undefined;
            if (style) { field(style, "rs"); field(style.rs, "values"); }
          });
        }
      }
    } else if (this.input.mixin) {
      field(this.input.mixin, "name"); field(this.site, "components", "arenas");
      this.site.components.forEach((component) => {
        field(component, "type", "tplTree");
        flattenComponent(component).forEach((tpl) => {
          field(tpl, "vsettings");
          if (isTplTag(tpl)) { field(tpl, "children"); }
          if (isTplSlot(tpl)) { field(tpl, "defaultContents"); }
          tpl.vsettings.forEach((setting) => {
            field(setting, "rs"); field(setting.rs, "mixins");
            if (isTplComponent(tpl)) { field(setting, "args"); setting.args.forEach((arg) => { field(arg, "expr"); if (isKnownRenderExpr(arg.expr)) { field(arg.expr, "tpl"); } }); }
          });
        });
      });
      this.site.arenas.forEach((arena) => { field(arena, "children"); arena.children.forEach((frame) => { field(frame, "container"); field(frame.container, "component"); }); });
    }
    const values = [...used].map((store) => store.getState());
    if (!arrayEq(this.current, values)) { this.current = Object.freeze(values); }
    if (this.connected) {
      for (const store of used) { if (!this.fields.has(store)) { this.fields.set(store, { prepare: this.models.subscribePreparedField(store, this.invalidate), stop: store.subscribe(this.publish) }); } }
      for (const [store, binding] of this.fields) { if (!used.has(store)) { binding.prepare(); binding.stop(); this.fields.delete(store); } }
    }
    this.dirty = false; return this.current;
  };
  private projectCatalog() {
    const rows = (mixins: readonly Mixin[]) => Object.freeze(mixins.map(mixin => Object.freeze({mixin, key: mixin.uuid, name: mixin.name})));
    return Object.freeze({key: this.key, isActive: this.isActive,
      local: rows(this.site.mixins),
      dependencies: Object.freeze(this.site.projectDependencies.map(dependency => Object.freeze({dependency, name: this.studio.projectDependencyManager.getNiceDepName(dependency), hostless: isHostLessPackage(dependency.site), mixins: rows(dependency.site.mixins)}))),
    });
  }
  getCatalogSnapshot = () => {
    if (!this.isActive()) { return undefined; }
    const fields = this.getSnapshot();
    if (!this.catalogValue || fields !== this.catalogFields) { this.catalogFields = fields; this.catalogValue = this.projectCatalog(); }
    return this.catalogValue;
  };
  private projectUsage() {
    assert(this.input.kind === "usage", "Usage projection requires a usage input");
    return this.input.mixin ? Object.freeze({name: this.input.mixin.name, summary: extractMixinUsages(this.site, this.input.mixin)[1]}) : undefined;
  }
  getUsageSnapshot = () => {
    if (!this.isActive()) { return undefined; }
    const fields = this.getSnapshot();
    if (fields !== this.usageFields) { this.usageFields = fields; this.usageValue = this.projectUsage(); }
    return this.usageValue;
  };
  private projectModel() {
    assert(this.input.kind === "model", "Model projection requires a mixin");
    const {mixin, previewTag: tag} = this.input;
    const theme = this.site.activeTheme;
    const preview: MixinPreviewData = Object.freeze({
        text: tag ? mixin.preview || defaultPreviewText(tag) : "",
        elementValues: Object.freeze(tag ? computeElementValues(theme, mixin) : {}),
        baseValues: Object.freeze({...theme?.defaultStyle.rs.values}),
        listValues: Object.freeze({...tag && isTagListContainer(tag) ? themeTagStyleValues(theme, "li") : undefined}),
        wrapperValues: Object.freeze({...tag === "li" ? themeTagStyleValues(theme, "ul") : undefined}),
    });
    return Object.freeze({
      alive: true as const,
      name: mixin.name,
      forTheme: mixin.forTheme,
      rs: mixin.rs,
      isActive: this.isActive,
      preview,
    });
  }
  private readonly inactiveModel = Object.freeze({alive: false as const, isActive: this.isActive, preview: emptyPreview});
  getModelSnapshot = () => {
    if (!this.isActive()) return this.inactiveModel;
    const fields = this.getSnapshot();
    if (!this.modelValue || fields !== this.modelFields) {
      this.modelFields = fields;
      this.modelValue = this.projectModel();
    }
    return this.modelValue;
  };
  subscribe = (listener: () => void) => {
    if (!this.isActive()) { return () => undefined; } this.listeners.add(listener);
    if (!this.connected) { this.connected = true; this.dirty = true; this.lifetime.addEventListener("abort", this.close, { once: true }); this.publish(); }
    return () => { this.listeners.delete(listener); if (!this.listeners.size) { this.disconnect(); } };
  };
}

export function useMixinCatalog(studio: StudioCtx) {
  const world = useCurrentModelWorld(studio);
  const source = React.useMemo(() => new MixinPanelInputs(studio, { kind: "catalog" }, world), [studio, world]);
  return React.useSyncExternalStore(source.subscribe, source.getCatalogSnapshot, source.getCatalogSnapshot);
}
export function useMixinUsage(studio: StudioCtx, mixin: Mixin | undefined) {
  const world = useCurrentModelWorld(studio);
  const source = React.useMemo(() => new MixinPanelInputs(studio, { kind: "usage", mixin }, world), [studio, mixin, world]);
  return React.useSyncExternalStore(source.subscribe, source.getUsageSnapshot, source.getUsageSnapshot);
}


export function useMixinModelInputs(studio: StudioCtx, mixin: Mixin, previewTag?: TagName) {
  const source = React.useMemo(() => new MixinPanelInputs(studio, { kind: "model", mixin, previewTag }), [studio, mixin, previewTag]);
  return React.useSyncExternalStore(source.subscribe, source.getModelSnapshot, source.getModelSnapshot);
}

function defaultPreviewText(tag: TagName) {
  return /^h[1-6]$/.test(tag)
    ? "Heading"
    : "The quick brown fox jumps over the lazy dog.";
}

function themeTagStyleValues(
  theme: Theme | null | undefined,
  tag: TagName,
): Record<string, string> | undefined {
  return theme?.styles.find((s) => s.selector === tag)?.style.rs.values;
}

/**
 * Computes the CSS values `mixin` declares on the previewed element itself:
 * for a theme pseudo-class style (e.g. "a:hover"), the tag's own style ("a")
 * merged under it. The theme's base default style is not included here; it is
 * applied to the preview wrapper as inherited context instead.
 */
function computeElementValues(
  theme: Theme | null | undefined,
  mixin: Mixin,
): Record<string, string> {
  if (!mixin.forTheme || !theme) {
    return { ...mixin.rs.values };
  }
  if (mixin === theme.defaultStyle) {
    return {};
  }
  const selector = theme.styles.find((s) => s.style === mixin)?.selector;
  const tag = selector?.split(":")[0];
  const tagStyle =
    tag && tag !== selector
      ? theme.styles.find((s) => s.selector === tag)?.style
      : undefined;
  return {
    ...tagStyle?.rs.values,
    ...mixin.rs.values,
  };
}

