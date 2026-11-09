import { useVariantModelWorld } from "@/wab/client/components/variants/variant-model-world";
import { $$$ } from "@/wab/shared/TplQuery";
import { isTypographyNode } from "@/wab/shared/SlotUtils";
import { getEffectiveVariantSetting } from "@/wab/shared/effective-variant-setting";
import { tplMatchThemeStyle } from "@/wab/shared/core/styles";
import { isGlobalVariant } from "@/wab/shared/Variants";
import { walkDependencyTree } from "@/wab/shared/core/project-deps";
import { siteFinalColorTokens, siteFinalStyleTokensAllDeps } from "@/wab/shared/core/site-style-tokens";
import type { FinalToken } from "@/wab/shared/core/tokens";
import { extractAllAssetRefs } from "@/wab/shared/core/image-assets";
import { useCanvasComponentInputs, type CanvasViewFieldRecipe } from "@/wab/client/components/canvas/canvas-view-inputs";
import { collectPropExpressionFields } from "@/wab/client/components/sidebar-tabs/ComponentProps/prop-expression-inputs";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { useStyleTokenRefs } from "@/wab/client/studio-ctx/style-token-ref-inputs";
import { extractAllReferencedTokenIds } from "@/wab/commons/StyleToken";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import type { VariantSettingSource } from "@/wab/shared/defined-indicator";
import { getOwnerSite, getTplType, isTplNamable, isTplTag, isTplComponent, isTplSlot, isTplVariantable } from "@/wab/shared/core/tpls";
import { isCodeComponent } from "@/wab/shared/core/components";
import { isKnownImageAssetRef, type Component, type Mixin, type Expr, type RichText, type ObjInst, type RuleSet, type Site, type StyleToken, type TplNode, type Variant, type VariantSetting } from "@/wab/shared/model/classes";
import * as React from "react";

/** The source popover reads captions, expression summaries and its own rules.
 * It never subscribes to a document-wide model revision. */
export function indicatorFields(field: Parameters<CanvasViewFieldRecipe>[0], sources: readonly VariantSettingSource[], setting?: VariantSetting, tpl?: TplNode) {
  const seen = new Set<ObjInst>();
  const variants = (items: readonly Variant[]) => items.forEach((variant) => {
    if (seen.has(variant)) { return; } seen.add(variant);
    field(variant, "uuid", "mediaQuery", "forTpl", "name", "selectors", "codeComponentName", "codeComponentVariantKeys", "parent");
    if (variant.parent) { field(variant.parent, "param", "type", "variants"); field(variant.parent.param, "variable"); field(variant.parent.param.variable, "name"); }
  });
  const rules = (rs: RuleSet) => {
    if (seen.has(rs)) { return; } seen.add(rs); field(rs, "values", "mixins", "animations");
    rs.mixins.forEach((mixin) => { field(mixin, "name", "rs", "variantedRs"); rules(mixin.rs); mixin.variantedRs.forEach((entry) => { field(entry, "variants", "rs"); variants(entry.variants); rules(entry.rs); }); });
    rs.animations?.forEach((animation) => { field(animation, "sequence"); field(animation.sequence, "name"); });
  };
  const themeMixin = (mixin: Mixin) => {
    if (seen.has(mixin)) { return; } seen.add(mixin);
    field(mixin, "rs", "variantedRs"); rules(mixin.rs);
    mixin.variantedRs.forEach((entry) => { field(entry, "variants", "rs"); variants(entry.variants); rules(entry.rs); });
  };
  const parentIconTheme = (parent: TplNode, active: readonly Variant[]) => {
    if (!isTplTag(parent)) { return; }
    const effective = getEffectiveVariantSetting(parent, [...active]);
    const type = getTplType(parent, effective);
    if (!["freeContainer", "horizStack", "vertStack", "grid", "contentLayout"].includes(type)) { return; }
    const component = $$$(parent).tryGetOwningComponent();
    if (!component) { return; } // The original frame-root helper has no theme owner.
    const rankedComponents = new Set<Component>();
    const componentRanks = (owner: Component) => {
      if (rankedComponents.has(owner)) { return; } rankedComponents.add(owner);
      field(owner, "variants", "variantGroups", "superComp"); variants(owner.variants);
      owner.variantGroups.forEach((group) => { field(group, "variants"); variants(group.variants); });
      if (owner.superComp) { componentRanks(owner.superComp); }
    };
    componentRanks(component); variants(active);
    const site = getOwnerSite(component);
    field(site, "activeTheme");
    if (active.some(isGlobalVariant)) {
      field(site, "globalVariantGroups", "activeScreenVariantGroup", "projectDependencies");
      const groups = [...site.globalVariantGroups, ...(site.activeScreenVariantGroup ? [site.activeScreenVariantGroup] : [])];
      site.projectDependencies.forEach((dependency) => { field(dependency, "site"); field(dependency.site, "globalVariantGroups"); groups.push(...dependency.site.globalVariantGroups); });
      groups.forEach((group) => { field(group, "variants", "param"); field(group.param, "variable"); field(group.param.variable, "name"); variants(group.variants); });
    }
    const theme = site.activeTheme;
    if (!theme) { return; }
    field(theme, "styles");
    if (isTypographyNode(parent)) { field(theme, "defaultStyle"); themeMixin(theme.defaultStyle); }
    theme.styles.forEach((style) => {
      field(style, "selector");
      if (tplMatchThemeStyle(style, parent, effective.variantSettings)) { field(style, "style"); themeMixin(style.style); }
    });

  };
  const expr = (value: Expr | RichText | null | undefined) => {
    collectPropExpressionFields(value, field);
    if (isKnownImageAssetRef(value)) { field(value.asset, "dataUri"); }
  };
  const vs = (value: VariantSetting) => {
    field(value, "variants", "rs", "dataCond", "text", "attrs", "args"); variants(value.variants); rules(value.rs);
    expr(value.dataCond); expr(value.text); Object.values(value.attrs).forEach(expr);
    value.args.forEach((arg) => { field(arg, "param", "expr"); field(arg.param, "variable"); field(arg.param.variable, "name"); expr(arg.expr); });
  };
  const node = (value: TplNode) => {
    if (seen.has(value)) { return; } seen.add(value); field(value, "parent");
    if (isTplNamable(value)) { field(value, "name"); }
    if (isTplTag(value)) { field(value, "tag", "type"); }
    if (isTplSlot(value)) { field(value, "param"); field(value.param, "variable"); field(value.param.variable, "name"); }
    if (isTplComponent(value)) {
      field(value, "component"); field(value.component, "name", "type", "tplTree", "codeComponentMeta");
      if (isCodeComponent(value.component)) { field(value.component.codeComponentMeta, "displayName"); }
    }
    if (isTplVariantable(value)) { field(value, "vsettings"); value.vsettings.forEach(vs); }
    if (value.parent) { node(value.parent); }
  };
  if (setting) { vs(setting); }
  if (tpl) { node(tpl); }
  sources.forEach((source) => {
    if ("combo" in source) { variants(source.combo); }
    if (source.type === "theme" || source.type === "themeTag") {
      field(source.theme, "defaultStyle", "styles"); field(source.theme.defaultStyle, "name");
      source.theme.styles.forEach((style) => { field(style, "selector", "style"); field(style.style, "name"); });
    } else if (source.type === "mixin") { field(source.mixin, "name"); }
    else if (source.type === "arg") {
      field(source.component, "params", "variantGroups"); field(source.value, "param", "expr");
      field(source.value.param, "variable"); field(source.value.param.variable, "name"); expr(source.value.expr);
      source.component.variantGroups.forEach((group) => { field(group, "param", "variants"); variants(group.variants); });
    } else if (source.type === "attr") { expr(source.value); }
    else if (source.type === "slot" || source.type === "parentTplStyle") {
      node(source.parentTpl); variants(source.activeVariants); parentIconTheme(source.parentTpl, source.activeVariants);
      if (source.tplComponent) { node(source.tplComponent); }
      if (source.type === "slot") { field(source.param, "variable"); field(source.param.variable, "name"); }
    }
  });
}

/** getStylePropValue first dereferences ordinary token heads, then resolves
 * background color heads by first color UUID, and remaining CSS by last UUID.
 * Follow embedded references as well as pure aliases without changing any of
 * those lookup policies. Only the base VSH is used by the indicator renderer. */
export function indicatorReferenceFields(field: Parameters<CanvasViewFieldRecipe>[0], site: Site, inputs: readonly string[]): readonly string[] {
  const references = new Set<string>(), assetIds = new Set<string>();
  const assetRefs = (value: string) => extractAllAssetRefs(value).forEach((id) => assetIds.add(id));
  inputs.forEach(assetRefs);
  if (inputs.some((value) => extractAllReferencedTokenIds(value).length > 0)) {
    field(site, "styleTokens", "projectDependencies", "styleTokenOverrides");
    const dependencies = walkDependencyTree(site, "all");
    dependencies.forEach((dependency) => { field(dependency, "site", "projectId"); field(dependency.site, "projectDependencies", "styleTokens"); });
    const owners = [site, ...dependencies.map((dependency) => dependency.site)];
    owners.forEach((owner) => owner.styleTokens.forEach((token) => field(token, "uuid", "type", "isRegistered")));
    // OverrideableToken chooses the first override whose referenced UUID matches.
    site.styleTokenOverrides.forEach((override) => { field(override, "token"); field(override.token, "uuid"); });
    const all = siteFinalStyleTokensAllDeps(site), colors = siteFinalColorTokens(site, { includeDeps: "all" });
    const first = new Map<string, FinalToken<StyleToken>>(), last = new Map<string, FinalToken<StyleToken>>(), colorFirst = new Map<string, FinalToken<StyleToken>>();
    all.forEach((token) => { if (!first.has(token.uuid)) { first.set(token.uuid, token); } last.set(token.uuid, token); });
    colors.forEach((token) => { if (!colorFirst.has(token.uuid)) { colorFirst.set(token.uuid, token); } });
    const seen = new Set<FinalToken<StyleToken>>(), vsh = new VariantedStylesHelper();
    const visit = (token: FinalToken<StyleToken> | undefined) => {
      if (!token || seen.has(token)) { return; } seen.add(token);
      const override = token.override;
      if (override) { field(override, "value"); }
      if (override?.value == null) { field(token.base, "value"); }
      scan(vsh.getActiveTokenValue(token));
    };
    const scan = (value: string) => {
      assetRefs(value);
      extractAllReferencedTokenIds(value).forEach((id) => {
        references.add(`var(--token-${id})`);
        visit(first.get(id)); visit(last.get(id)); visit(colorFirst.get(id));
      });
    };
    inputs.forEach(scan);
  }
  if (assetIds.size) {
    field(site, "imageAssets");
    const found = new Set<string>();
    site.imageAssets.forEach((asset) => {
      field(asset, "uuid");
      if (assetIds.has(asset.uuid) && !found.has(asset.uuid)) { found.add(asset.uuid); field(asset, "dataUri"); }
    });
  }
  return [...references];
}

function sourceIdentity(source: VariantSettingSource | undefined, site: Site): ObjInst {
  if (!source) { return site; }
  if (source.type === "theme" || source.type === "themeTag") { return source.theme; }
  if (source.type === "mixin") { return source.mixin; }
  if (source.type === "arg" || source.type === "attr") { return source.value; }
  if (source.type === "parentTplStyle" || source.type === "slot") { return source.parentTpl; }
  return source.combo[0] ?? site;
}

export function useIndicatorInputs(studio: StudioCtx, owner: ObjInst, sources: readonly VariantSettingSource[], setting?: VariantSetting, tpl?: TplNode) {
  const world = useVariantModelWorld(studio, owner);
  const site = world.site;
  const identity = setting ?? sourceIdentity(sources[0], site);
  const recipe = React.useCallback<CanvasViewFieldRecipe>((field) => {
    if (!world.isCurrent()) { return; }
    field(site, "flags", "themes", "components", "projectDependencies", "imageAssets");
    indicatorFields(field, sources, setting, tpl);
    const values = sources.flatMap((source) => typeof source.value === "string" ? [source.value] : []);
    indicatorReferenceFields(field, site, values);
  }, [world, site, sources, setting, tpl]);
  const snapshot = useCanvasComponentInputs(studio, identity, recipe);
  const helper = React.useMemo(() => new VariantedStylesHelper(), []);
  const alive = world.alive && snapshot.alive;
  const values = sources.flatMap((source) => typeof source.value === "string" ? [source.value] : []);
  const references = alive ? indicatorReferenceFields(() => undefined, site, values) : [];
  useStyleTokenRefs(studio, alive ? references : [], helper, "all", (state) => state.rows);
  useStyleTokenRefs(studio, alive ? references : [], helper, "dictionary", (state) => state.rows);

  return alive;
}
