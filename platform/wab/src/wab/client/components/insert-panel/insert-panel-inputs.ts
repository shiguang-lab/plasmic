import { ModelFieldInputs } from "@/wab/client/stores/model-field-inputs";
import { TplExpsProvider } from "@/wab/client/components/style-controls/StyleComponent";
import { contractSnapshot } from "@/wab/client/components/canvas/canvas-registrations";
import { useComponentLibraryCatalog } from "@/wab/client/components/sidebar/library-inputs";
import { collectComponentParamFields } from "@/wab/client/components/sidebar-tabs/ComponentProps/component-param-inputs";
import { collectPropExpressionFields } from "@/wab/client/components/sidebar-tabs/ComponentProps/prop-expression-inputs";
import { useVariantModelWorld } from "@/wab/client/components/variants/variant-model-world";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import type { ModelFieldStore } from "@/wab/client/studio-ctx/model-snapshots";
import { arrayEq } from "@/wab/shared/common";
import { SlotSelection } from "@/wab/shared/core/slots";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { Component, ObjInst, ProjectDependency, Site, TplNode, isKnownTplComponent, isKnownTplTag, isKnownTplSlot } from "@/wab/shared/model/classes";
import { isEqual } from "lodash";
import * as React from "react";

/** Bound to one mounted panel lifetime. Imported handles intentionally follow
 * the panel's frozen drag catalog; local libraries reuse their native catalog. */
export function useInsertPanelCatalogInputs(studio: StudioCtx, dependencies: readonly ProjectDependency[]) {
  const library = useComponentLibraryCatalog(studio, () => Object.freeze(studio.site.components.map((component) => Object.freeze({ component, name: component.name, type: component.type }))));
  const world = useVariantModelWorld(studio, studio);
  const source = React.useMemo(() => createInsertPanelCatalogInputsSource(world, studio, dependencies), [world, studio, dependencies]);
  const supplement = React.useSyncExternalStore(source.subscribe, source.read, source.read);
  return React.useMemo(() => [library, supplement] as const, [library, supplement]);
}

/** Insertion placement examines only the selected target, its slot contract and
 * ancestor path. Style rules are collected for the parent flex-layout decision. */
export function useInsertPanelTargetInputs(studio: StudioCtx, view: ViewCtx | undefined) {
  const world = useVariantModelWorld(studio, studio);
  const source = React.useMemo(() => createInsertPanelTargetInputsSource(view, world, studio), [world, studio, view]);
  return React.useSyncExternalStore(source.subscribe, source.read, source.read);
}

function createInsertPanelCatalogInputsSource(world: ReturnType<typeof useVariantModelWorld>, studio: ReturnType<typeof useVariantModelWorld>['studio'], dependencies: Parameters<typeof useInsertPanelCatalogInputs>[1]) {
    let metadata: unknown;
    const inputs = new ModelFieldInputs({ ...world, isCurrent: () => world.studio === studio && world.isCurrent() }, (field, watch) => {
      const registrations: unknown[] = [];
      watch(studio.projectDependencyManager.dependencyStateStore);
      const component = (owner: Component) => {
        field(owner, "name", "type", "superComp", "subComps", "hiddenFromContentEditor", "templateInfo", "plumeInfo", "codeComponentMeta");
        if (owner.templateInfo) { field(owner.templateInfo, "projectId", "componentId"); }
        if (owner.plumeInfo) { field(owner.plumeInfo, "type"); }
        if (owner.codeComponentMeta) { field(owner.codeComponentMeta, "section", "thumbnailUrl", "isHostLess", "isContext", "isAttachment", "displayName", "importPath"); }
        const meta = studio.getCodeComponentMeta(owner); registrations.push(owner.uid, meta?.thumbnailUrl, meta?.hideFromContentCreators);
      };
      const catalog = (site: Site) => {
        field(site, "components", "imageAssets", "customFunctions", "hostLessPackageInfo"); site.components.forEach(component);
        site.imageAssets.forEach((asset) => field(asset, "name", "dataUri", "type"));
        site.customFunctions.forEach((func) => field(func, "isQuery", "displayName", "importName", "namespace"));
      };
      field(world.site, "defaultComponents"); catalog(world.site);
      const plumeSite = studio.projectDependencyManager.dependencyStateStore.getState().plumeSite;
      if (plumeSite) { catalog(plumeSite); }
      dependencies.forEach((dependency) => { field(dependency, "name", "projectId", "pkgId", "site"); catalog(dependency.site); });
      const app = studio.appCtx.appConfig;
      const nextMetadata = contractSnapshot([registrations, app.insertableTemplates, app.hostLessComponents, app.installables, app.plexus, studio.appCtx.selfInfo?.email, app.showHiddenHostLessComponents, DEVFLAGS.insertPanelContent, DEVFLAGS.hostLessComponents, DEVFLAGS.insertableTemplates, DEVFLAGS.showHiddenHostLessComponents]);
      if (!isEqual(metadata, nextMetadata)) { metadata = nextMetadata; }
      return [metadata];
    });
    let stopApp: (() => void) | undefined, stopRegistry: (() => void) | undefined;
    let subscribers = 0;
    const subscribe = (listener: () => void) => {
      if (!inputs.isCurrent()) { return () => undefined; }
      if (!subscribers++) {
        // External metadata can mutate in place while the panel is unmounted.
        inputs.invalidate();
        stopApp = studio.appCtx.subscribeUiEnvironmentInputs(inputs.refresh);
        stopRegistry = studio.subscribeCodeRegistrations(inputs.refresh);
        world.lifetime.addEventListener("abort", disconnect, { once: true });
      }
      const stop = inputs.subscribe(listener);
      return () => { stop(); if (!--subscribers) { disconnect(); } };
    };
    const disconnect = () => {
      stopApp?.(); stopRegistry?.(); stopApp = stopRegistry = undefined;
      world.lifetime.removeEventListener("abort", disconnect);
    };
    return { read: inputs.read, subscribe };
  }

function createInsertPanelTargetInputsSource(view: Parameters<typeof useInsertPanelTargetInputs>[1], world: ReturnType<typeof useVariantModelWorld>, studio: ReturnType<typeof useVariantModelWorld>['studio']) {
    let current: readonly unknown[] = Object.freeze([]);
    const fields = new Map<ModelFieldStore<unknown>, () => void>(), listeners = new Set<() => void>();
    let stopSelection: (() => void) | undefined, stopVariants: (() => void) | undefined;
    let retainedStyle: { key: string; stop: () => void } | undefined;
    const read = () => {
      if (!view || world.studio !== studio || !world.isCurrent(view)) { return current; }
      const used = new Set<ModelFieldStore<unknown>>();
      const field = (owner: ObjInst, ...keys: string[]) => keys.forEach((key) => used.add(world.models.declaredField(owner, key)));
      const selected = view.focusedTplOrSlotSelection();
      let tpl: TplNode | null | undefined = selected instanceof SlotSelection ? selected.tpl ?? selected.val?.tpl : selected;
      if (selected instanceof SlotSelection) { field(selected.slotParam, "type"); collectPropExpressionFields(selected.slotParam.type, field); }
      const parent = tpl?.parent;
      let styleHandle: ReturnType<ViewCtx["styleInputs"]["get"]> | undefined;
      if (parent) {
        const native = new TplExpsProvider(view, parent).getNativeStyleSource();
        if (native.kind === "tpl") { styleHandle = native.inputs.get(native.source, ["display", "flex-direction"]); used.add(styleHandle.projection.store); }
      }
      if (listeners.size && retainedStyle?.key !== styleHandle?.key) { retainedStyle?.stop(); retainedStyle = styleHandle ? { key: styleHandle.key, stop: styleHandle.retain() } : undefined; }
      const seen = new Set<TplNode>();
      while (tpl && !seen.has(tpl)) {
        seen.add(tpl); field(tpl, "parent", "vsettings"); collectPropExpressionFields(tpl.vsettings, field);
        if (isKnownTplTag(tpl)) { field(tpl, "tag", "type", "children"); }
        if (isKnownTplComponent(tpl)) { field(tpl, "component"); collectComponentParamFields(tpl.component, field); }
        if (isKnownTplSlot(tpl)) { field(tpl, "param"); collectPropExpressionFields(tpl.param.type, field); }
        tpl = tpl.parent;
      }
      const next = [...used].map((store) => store.getState()); next.push(view.selectionStore.getState().tpls, view.selectionStore.getState().targets, view.selectionStore.getState().context, view.variantStore.getState());
      if (!arrayEq(current, next)) { current = Object.freeze(next); }
      if (listeners.size) {
        used.forEach((store) => { if (!fields.has(store)) { fields.set(store, store.subscribe(sync)); } });
        for (const [store, stop] of fields) { if (!used.has(store)) { stop(); fields.delete(store); } }
      }
      return current;
    };
    const sync = () => { const previous = current; read(); if (previous !== current) { listeners.forEach((listener) => listener()); } };
    const disconnect = () => { retainedStyle?.stop(); retainedStyle = undefined; fields.forEach((stop) => stop()); fields.clear(); stopSelection?.(); stopVariants?.(); stopSelection = stopVariants = undefined; world.lifetime.removeEventListener("abort", disconnect); view?.disposeSignal.removeEventListener("abort", disconnect); };
    const subscribe = (listener: () => void) => {
      if (!view || world.studio !== studio || !world.isCurrent(view)) { return () => undefined; }
      listeners.add(listener); if (!stopSelection) { stopSelection = view.selectionStore.subscribe(sync); stopVariants = view.variantStore.subscribe(sync); }
      world.lifetime.addEventListener("abort", disconnect, { once: true }); view.disposeSignal.addEventListener("abort", disconnect, { once: true }); read();
      return () => { listeners.delete(listener); if (!listeners.size) { disconnect(); } };
    };
    return { read, subscribe };
  }
