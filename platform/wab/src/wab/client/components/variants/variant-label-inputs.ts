import { isTplCodeComponent } from "@/wab/shared/core/tpls";
import { Selector, styleOrCodeComponentVariantToSelectors } from "@/wab/client/components/sidebar/RuleSetControls";
import { isPrivateStyleVariant, isStyleOrCodeComponentVariant, makeVariantName, toVariantKey } from "@/wab/shared/Variants";
import { useVariantModelWorld } from "@/wab/client/components/variants/variant-model-world";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ModelFieldInputs } from "@/wab/client/stores/model-field-inputs";
import { isCodeComponentVariant } from "@/wab/shared/Variants";
import { Component, TplNode, TplTag, Variant, VariantGroup, isKnownGlobalVariantSplitContent, isKnownTplComponent, isKnownTplTag, isKnownVariant, isKnownCustomCode } from "@/wab/shared/model/classes";
import * as React from "react";

export interface VariantLabelEntry {
  readonly variant: Variant;
  readonly name: string;
  readonly selectors: Selector[];
  readonly key: string;
  readonly isPrivate: boolean;
  readonly isStyle: boolean;
  readonly rootIsCode: boolean;
}
interface VariantLabelSnapshot { readonly entries: readonly VariantLabelEntry[]; }

export interface VariantLabelScope {
  readonly component?: Component;
  readonly group?: VariantGroup;
  readonly superComp?: Component;
  readonly focusedTag?: TplTag;
  readonly splitGroup?: boolean;
  readonly componentVariants?: boolean;
  readonly node?: TplNode;
}
/** A variant name/selector renderer's explicit contract. Code selectors query
 * local registration metadata; split names query only split group assignments. */
export function useVariantLabelInputs(studio: StudioCtx, variant: Variant | readonly Variant[], scope: VariantLabelScope = {}) {
  const identity = isKnownVariant(variant) ? variant : scope.node ?? scope.group ?? scope.component ?? variant[0] ?? studio;
  const world = useVariantModelWorld(studio, identity);
  const scopeComponent = scope.component;
  const scopeSuperComp = scope.superComp;
  const scopeFocusedTag = scope.focusedTag;
  const scopeSplitGroup = scope.splitGroup;
  const scopeComponentVariants = scope.componentVariants;
  const scopeNode = scope.node;
  const scopeGroup = scope.group;
  const source = React.useMemo(() => createVariantLabelInputsSource(world, studio, variant, scopeComponent, scopeSuperComp, scopeFocusedTag, scopeSplitGroup, scopeComponentVariants, scopeNode, scopeGroup), [studio, world, variant, scopeComponent, scopeSuperComp, scopeFocusedTag, scopeSplitGroup, scopeComponentVariants, scopeNode, scopeGroup]);
  return React.useSyncExternalStore(source.subscribe, source.read, source.read);
}

function createVariantLabelInputsSource(world: ReturnType<typeof useVariantModelWorld>, studio: ReturnType<typeof useVariantModelWorld>['studio'], variant: Parameters<typeof useVariantLabelInputs>[1], scopeComponent: VariantLabelScope["component"], scopeSuperComp: VariantLabelScope["superComp"], scopeFocusedTag: VariantLabelScope["focusedTag"], scopeSplitGroup: VariantLabelScope["splitGroup"], scopeComponentVariants: VariantLabelScope["componentVariants"], scopeNode: VariantLabelScope["node"], scopeGroup: VariantLabelScope["group"]) {
    const { site } = world;
    const inputs = new ModelFieldInputs({ models: world.models, lifetime: world.lifetime,
      isCurrent: () => world.studio === studio && world.isCurrent() }, (field) => {
      const variants: readonly Variant[] = isKnownVariant(variant) ? [variant] : scopeGroup ? scopeGroup.variants : scopeComponentVariants && scopeComponent ? scopeComponent.variants : variant;
      if (scopeGroup) { field(scopeGroup, "variants", "param"); field(scopeGroup.param, "variable"); field(scopeGroup.param.variable, "name"); }
      variants.forEach((value) => {
        field(value, "name", "parent", "selectors", "forTpl", "codeComponentName", "codeComponentVariantKeys");
        if (value.parent) { field(value.parent, "param"); field(value.parent.param, "variable"); field(value.parent.param.variable, "name"); }
      });
      const root = (component: Component) => {
        field(component, "name", "tplTree"); const tpl = component.tplTree; field(tpl, "parent");
        if (isKnownTplTag(tpl)) { field(tpl, "tag"); }
        if (isKnownTplComponent(tpl)) {
          field(tpl, "component"); field(tpl.component, "type", "name", "codeComponentMeta");
          if (tpl.component.codeComponentMeta) {
            field(tpl.component.codeComponentMeta, "variants", "displayName");
            variants.forEach((value) => value.codeComponentVariantKeys?.forEach((key) => {
              const meta = tpl.component.codeComponentMeta?.variants[key];
              if (meta) { field(meta, "displayName", "cssSelector"); }
            }));
          }
        }
      };
      if (scopeComponent) { root(scopeComponent); if (scopeComponentVariants) { field(scopeComponent, "variants"); } }
      let superComp = scopeSuperComp;
      const seen = new Set<Component>();
      while (superComp && !seen.has(superComp)) {
        seen.add(superComp); field(superComp, "name", "type", "codeComponentMeta", "superComp");
        if (superComp.codeComponentMeta) { field(superComp.codeComponentMeta, "displayName"); }
        superComp = superComp.superComp ?? undefined;
      }
      if (scopeFocusedTag) {
        field(scopeFocusedTag, "name", "tag", "type");
        if (scopeFocusedTag.tag === "input") {
          field(scopeFocusedTag, "vsettings"); scopeFocusedTag.vsettings.forEach((setting) => {
            field(setting, "variants", "attrs"); setting.variants.forEach((value) => field(value, "name"));
            if (isKnownCustomCode(setting.attrs.type)) { field(setting.attrs.type, "code"); }
          });
        }
      }
      if (variants.some(isCodeComponentVariant)) {
        field(site, "components"); site.components.forEach((component) => {
          field(component, "variants"); if (component.variants.some((value) => variants.includes(value))) { root(component); }
        });
      }
      if (scopeNode) {
        let node: TplNode | null | undefined = scopeNode;
        const ancestors = new Set<TplNode>();
        while (node && !ancestors.has(node)) {
          ancestors.add(node); field(node, "parent", "vsettings");
          node.vsettings.forEach((setting) => { field(setting, "variants"); setting.variants.forEach((value) => field(value, "name")); });
          node = node.parent;
        }
      }
      if (scopeSplitGroup) {
        field(site, "splits"); site.splits.forEach((split) => {
          field(split, "slices"); split.slices.forEach((slice) => {
            field(slice, "contents"); slice.contents.forEach((content) => { if (isKnownGlobalVariantSplitContent(content)) { field(content, "group"); } });
          });
        });
      }
    });
    let currentFields: readonly unknown[] | undefined;
    let current: VariantLabelSnapshot = Object.freeze({ entries: Object.freeze([]) });
    const read = () => {
      if (!inputs.isCurrent()) { return current; }
      const next = inputs.read();
      if (currentFields !== next) {
        currentFields = next;
      const variants: readonly Variant[] = isKnownVariant(variant) ? [variant] : scopeGroup ? scopeGroup.variants : scopeComponentVariants && scopeComponent ? scopeComponent.variants : variant;
        current = Object.freeze({entries: Object.freeze(variants.map(value => Object.freeze({
          variant: value,
          name: makeVariantName({variant: value, superComp: scopeSuperComp, focusedTag: scopeFocusedTag, site, useGroupNameForSplits: scopeSplitGroup}),
          selectors: isStyleOrCodeComponentVariant(value) ? styleOrCodeComponentVariantToSelectors(value, site) : [],
          key: isStyleOrCodeComponentVariant(value) ? toVariantKey(value) : value.uuid,
          isPrivate: isPrivateStyleVariant(value),
          isStyle: isStyleOrCodeComponentVariant(value),
          rootIsCode: isTplCodeComponent(scopeComponent?.tplTree),
        })))});
      }
      return current;
    };
    return { read, subscribe: inputs.subscribe };
}
