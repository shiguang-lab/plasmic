import { isCodeComponentSlot, isPlainTextTplSlot } from "@/wab/shared/SlotUtils";
import { collectPropExpressionFields } from "@/wab/client/components/sidebar-tabs/ComponentProps/prop-expression-inputs";
import type { ModelFieldStore, ModelSnapshots, ModelRef } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { captureDefinedIndicator } from "@/wab/client/studio-ctx/style-inputs";
import { flattenComponent } from "@/wab/shared/cached-selectors";
import { tryGetVariantSetting, isBaseVariant } from "@/wab/shared/Variants";
import { arrayEq, assert, ensure } from "@/wab/shared/common";
import { isCodeComponent, isPageComponent } from "@/wab/shared/core/components";
import { allMixins, isTplAttachedToSite } from "@/wab/shared/core/sites";
import { isTplVariantable, isTplTextBlock, isComponentRoot, isTplComponent, isTplSlot, isTplTag, isTplImage } from "@/wab/shared/core/tpls";
import { computeDefinedIndicator } from "@/wab/shared/defined-indicator";
import { $$$ } from "@/wab/shared/TplQuery";
import { isContentLayoutTpl, isPositionSet } from "@/wab/shared/layoututils";
import { getComponentDefaultSize, getPageFrameSizeType, isTplAutoSizable, isTplResizable } from "@/wab/shared/sizingutils";
import { ArenaFrame, Component, Mixin, ObjInst, Site, StyleExpr, TplNode, Variant, VariantGroup, ensureKnownTplTag, isKnownImageAssetRef, isKnownCustomCode, isKnownObjectPath, isKnownRenderExpr, isKnownVariantsRef } from "@/wab/shared/model/classes";
import * as React from "react";

export interface StylePanelLayoutMetadata {
  readonly parent: ModelRef<TplNode> | undefined;
  readonly parentIsCodeComponent: boolean;
  readonly focusedComponentIsPage: boolean;
  readonly isRoot: boolean;
  readonly parentIsContentLayout: boolean;
  readonly isContentLayout: boolean;
  readonly canResizeWidth: boolean;
  readonly canResizeHeight: boolean;
  readonly canAutoSizeWidth: boolean;
  readonly canAutoSizeHeight: boolean;
  readonly imageDataUri: string | null | undefined;
  readonly isImage: boolean;
  readonly showPositioning: boolean;
  readonly isBaseTarget: boolean;
}

type TargetInput = { kind: "columns" | "mixins" | "button" | "frame" | "layout" | "visibility" | "text" | "attributes" | "style-tab" | "multi-selection"; view: ViewCtx; tpl: TplNode; attr?: string; frame?: ArenaFrame; param?: import("@/wab/shared/model/classes").Param; slot?: import("@/wab/shared/model/classes").TplSlot } | { kind: "selectors"; expr: StyleExpr };
const empty: readonly unknown[] = Object.freeze([]);

/** Non-CSS inputs of responsive columns, applied mixins, and style-expression
 * arguments. Target selection keeps the original visibility/empty-combo policy.
 * Structural dependencies are reduced to the actual target/result snapshot. */
export class TargetedStylePanelInputs {
  private readonly models: ModelSnapshots;
  private readonly site: Site;
  private readonly lifetime: AbortSignal;
  private readonly context: ReturnType<ViewCtx["selectionStore"]["getState"]>["context"];
  private retired = false;
  private current = empty;
  private layout: StylePanelLayoutMetadata | undefined;
  private renderInputs: Readonly<{ active: boolean; fields: readonly unknown[]; isCurrent: () => boolean; layout: StylePanelLayoutMetadata | undefined }> | undefined;
  private published = empty;
  private dirty = true;
  private connected = false;
  private readonly fields = new Map<ModelFieldStore<unknown>, { prepare: () => void; stop: () => void }>();
  private registration: ModelFieldStore<unknown> | undefined;
  private stopRegistration: (() => void) | undefined;
  private readonly listeners = new Set<() => void>();
  private stops: (() => void)[] = [];
  constructor(private readonly studio: StudioCtx, private readonly input: TargetInput) {
    this.models = studio.modelSnapshots; this.site = studio.site;
    this.context = input.kind === "style-tab" || input.kind === "multi-selection" ? input.view.selectionStore.getState().context : null;
    this.lifetime = input.kind === "selectors" ? studio.arenaState.lifetime() : input.view.disposeSignal;
    if (this.isActive() && input.kind !== "selectors") { assert(isTplAttachedToSite(this.site, input.tpl), "Style panel template belongs to another model world"); }
  }
  isActive = () => {
    if ((this.input.kind === "style-tab" || this.input.kind === "multi-selection") && this.context !== this.input.view.selectionStore.getState().context) { this.retired = true; }
    return !this.retired && !this.lifetime.aborted && this.models === this.studio.modelSnapshots && this.site === this.studio.site;
  };
  private disconnect = () => {
    this.connected = false; this.lifetime.removeEventListener("abort", this.close);
    this.fields.forEach(({ prepare, stop }) => { prepare(); stop(); }); this.fields.clear();
    this.stops.splice(0).forEach((stop) => stop()); this.stopRegistration?.(); this.stopRegistration = undefined;
  };
  private close = () => { this.current = empty; this.disconnect(); this.publishSnapshot(); this.listeners.clear(); };
  private invalidate = () => { this.dirty = true; };
  private publishSnapshot = () => { if (this.current !== this.published) { this.published = this.current; this.listeners.forEach((listener) => listener()); } };
  private publish = () => { this.getSnapshot(); this.publishSnapshot(); };
  private syncContext = () => { this.dirty = true; this.publish(); };
  getRenderInputs = () => {
    const fields = this.getSnapshot(), active = this.isActive();
    if (!this.renderInputs || this.renderInputs.fields !== fields || this.renderInputs.active !== active) {
      this.renderInputs = Object.freeze({ fields, active, isCurrent: this.isActive, layout: this.layout });
    }
    return this.renderInputs;
  };
  getSnapshot = (): readonly unknown[] => {
    if (!this.isActive()) { return empty; }
    if (this.connected && !this.dirty) { return this.current; }
    const used = new Set<ModelFieldStore<unknown>>(), values: unknown[] = [];
    const field = (model: ObjInst, ...keys: string[]) => keys.forEach((key) => used.add(this.models.declaredField(model, key)));
    const expose = (model: ObjInst, ...keys: string[]) => keys.forEach((key) => { const store = this.models.declaredField(model, key); used.add(store); values.push(store.getState()); });
    const input = this.input;
    if (input.kind === "selectors") {
      expose(input.expr, "uuid", "styles");
      input.expr.styles.forEach((selector) => expose(selector, "selector", "rs"));
    } else {
      const variants = new Set<Variant>(), groups = new Set<VariantGroup>(), components = new Set<Component>(), mixins = new Set<Mixin>();
      const frame = input.kind === "frame" ? ensure(input.frame, "Frame inputs require their original frame") : undefined;
      const tpl = frame ? frame.container.component.tplTree : input.tpl;
      const variant = (value: Variant) => {
        if (variants.has(value)) { return; } variants.add(value);
        field(value, "uuid", "name", "parent", "selectors", "forTpl", "mediaQuery", "codeComponentName", "codeComponentVariantKeys");
        if (value.parent) { group(value.parent); }
      };
      const group = (value: VariantGroup) => {
        if (groups.has(value)) { return; } groups.add(value);
        field(value, "variants", "type", "multi", "param");
        field(value.param, "variable"); field(value.param.variable, "name"); value.variants.forEach(variant);
      };
      const mixin = (value: Mixin) => {
        if (mixins.has(value)) { return; } mixins.add(value);
        field(value, "rs", "variantedRs"); field(value.rs, "values", "mixins"); value.rs.mixins.forEach(mixin);
        value.variantedRs.forEach((setting) => { field(setting, "variants", "rs"); setting.variants.forEach(variant); field(setting.rs, "values", "mixins"); setting.rs.mixins.forEach(mixin); });
      };
      const node = (value: TplNode) => {
        field(value, "parent", "vsettings");
        if (isTplTag(value)) { field(value, "children"); if (frame || input.kind === "layout") { field(value, "tag", "type"); } }
        if (isTplSlot(value)) { field(value, "defaultContents", "param"); }
        if (isTplComponent(value)) { field(value, "component"); if ((input.kind === "layout" || input.kind === "style-tab" || input.kind === "multi-selection")) { component(value.component); } }
        value.vsettings.forEach((setting) => {
          field(setting, "variants", "rs", "args", "attrs", "text", "dataCond", "dataRep");
          setting.variants.forEach(variant); field(setting.rs, "values", "mixins", "animations");
          setting.rs.mixins.forEach(mixin);
          if (input.kind === "layout") {
            Object.values(setting.attrs).forEach((expr) => { if (isKnownImageAssetRef(expr)) { field(expr, "asset"); field(expr.asset, "dataUri"); } });
          }
          const condition = setting.dataCond;
          if (condition && isKnownCustomCode(condition)) { field(condition, "code"); }
          else if (condition && isKnownObjectPath(condition)) { field(condition, "path"); }
          setting.args.forEach((arg) => {
            field(arg, "param", "expr");
            if (isKnownRenderExpr(arg.expr)) { field(arg.expr, "tpl"); }
            if ((frame || input.kind === "layout") && isKnownVariantsRef(arg.expr)) { field(arg.expr, "variants"); arg.expr.variants.forEach(variant); }
          });
        });
      };
      const component = (value: Component) => {
        if (components.has(value)) { return; } components.add(value);
        field(value, "tplTree", "variants", "variantGroups", "superComp");
        if (input.kind === "layout" || input.kind === "text") { field(value, "type", "pageMeta"); }
        value.variants.forEach(variant); value.variantGroups.forEach(group);
        if (value.superComp) { component(value.superComp); }
        flattenComponent(value).forEach(node);
        if (frame && isTplComponent(value.tplTree)) { component(value.tplTree.component); }
      };
      input.view.componentStackFrames().forEach((stackFrame) => component(stackFrame.component));
      component(input.view.currentComponent());
      // Includes ancestors from slot/component editing contexts.
      if (frame) { component(frame.container.component); }
      let ancestor: TplNode | null | undefined = tpl;
      while (ancestor) { node(ancestor); ancestor = ancestor.parent; }
      field(this.site, "globalVariantGroups", "activeScreenVariantGroup", "projectDependencies");
      this.site.globalVariantGroups.forEach(group);
      if (this.site.activeScreenVariantGroup) { group(this.site.activeScreenVariantGroup); }
      this.site.projectDependencies.forEach((dependency) => { field(dependency, "site"); field(dependency.site, "globalVariantGroups"); dependency.site.globalVariantGroups.forEach(group); });
      const vtm = input.view.variantTplMgr(), target = frame ? vtm.getRootVariantCombo() : vtm.getTargetVariantComboForNode(tpl), active = frame ? target : [...vtm.getActivatedVariantsForNode(tpl)];
      values.push(target.map((value) => value.uid).join("."), active.map((value) => value.uid).join("."));
      if (frame) {
        expose(frame, "container", "viewMode", "bgColor", "width", "height"); expose(frame.container, "component"); expose(frame.container.component, "type");
        field(this.site, "activeTheme");
        const theme = this.site.activeTheme;
        if (theme) { field(theme, "defaultStyle", "styles"); mixin(theme.defaultStyle); theme.styles.forEach((style) => { field(style, "selector", "style"); mixin(style.style); }); }
        const size = getComponentDefaultSize(frame.container.component, vtm.getRootVariantCombo());
        values.push(size.width);
      } else if (input.kind === "layout") {
        const parent = $$$(tpl).layoutParent({ throughSlot: true }).maybeOneTpl();
        values.push(parent ? this.models.ref(parent) : undefined, tpl.parent ? this.models.ref(tpl.parent) : undefined,
          isTplComponent(tpl.parent) && isCodeComponent(tpl.parent.component), !!input.view.currentComponent().pageMeta,
          isComponentRoot(tpl), !!parent && isContentLayoutTpl(parent), isContentLayoutTpl(tpl, { deep: true }));
        if (isTplTag(tpl)) { values.push(tpl.tag, tpl.type); }
        const resizable = isTplResizable(tpl, vtm), src = vtm.effectiveTargetVariantSetting(tpl).attrs.src;
        const layout: StylePanelLayoutMetadata = Object.freeze({
          parent: parent ? this.models.ref(parent) : undefined,
          parentIsCodeComponent: !!(isTplComponent(tpl.parent) && isCodeComponent(tpl.parent.component)),
          focusedComponentIsPage: !!input.view.currentComponent().pageMeta,
          isRoot: isComponentRoot(tpl), parentIsContentLayout: !!parent && isContentLayoutTpl(parent),
          isContentLayout: isContentLayoutTpl(tpl, { deep: true }),
          canResizeWidth: resizable.width, canResizeHeight: resizable.height,
          canAutoSizeWidth: isTplAutoSizable(tpl, vtm, "width"), canAutoSizeHeight: isTplAutoSizable(tpl, vtm, "height"),
          imageDataUri: isKnownImageAssetRef(src) ? src.asset.dataUri : undefined,
          isImage: isTplImage(tpl), showPositioning: !!tpl.parent || isPositionSet(tpl, input.view),
          isBaseTarget: isBaseVariant(target),
        });
        if (!this.layout || !arrayEq(Object.values(this.layout), Object.values(layout))) { this.layout = layout; }
        values.push(...Object.values(layout));
        const pageFrame = input.view.arenaFrame();
        field(pageFrame, "container", "targetVariants", "targetGlobalVariants"); field(pageFrame.container, "component");
        if (isPageComponent(pageFrame.container.component)) { component(pageFrame.container.component); values.push(getPageFrameSizeType(pageFrame)); }
      } else if (input.kind === "style-tab" || input.kind === "multi-selection") {
        const describeComponent = (owner: Component) => {
          expose(owner, "tplTree", "name", "type", "pageMeta", "codeComponentMeta", "variants");
          if (owner.codeComponentMeta) { collectPropExpressionFields(owner.codeComponentMeta, expose); }
          owner.variants.forEach((value) => expose(value, "selectors", "forTpl", "name"));
        };
        describeComponent(input.view.currentComponent());
        const describe = (value: TplNode) => {
          expose(value, "parent", "vsettings");
          if (input.kind === "multi-selection") { expose(value, "locked"); }
          if (isTplTag(value)) { expose(value, "name", "tag", "type"); }
          if (isTplSlot(value)) { expose(value, "param", "defaultContents"); expose(value.param, "variable", "about"); expose(value.param.variable, "name"); }
          if (isTplComponent(value)) { expose(value, "name", "component"); describeComponent(value.component); }
          if (isTplVariantable(value)) { value.vsettings.forEach((setting) => {
            expose(setting, "variants", "attrs", "args"); expose(setting.rs, "mixins", "animations");
            setting.args.forEach((arg) => { expose(arg, "param", "expr"); if (isKnownRenderExpr(arg.expr)) { expose(arg.expr, "tpl"); } });
          }); }
        };
        let current: TplNode | null | undefined = tpl;
        const visited = new Set<TplNode>();
        while (current && !visited.has(current)) { visited.add(current); describe(current); current = current.parent; }
        current = tpl;
        let codeOwner: Component | undefined;
        while (isTplComponent(current) && !visited.has(current.component.tplTree)) {
          if (isCodeComponent(current.component)) { codeOwner = current.component; }
          visited.add(current.component.tplTree); current = current.component.tplTree; describe(current);
        }
        if (input.kind === "multi-selection") {
          tpl.vsettings.forEach((setting) => { expose(setting, "text", "attrs"); collectPropExpressionFields(setting.text, expose); Object.values(setting.attrs).forEach((expr) => collectPropExpressionFields(expr, expose)); });
        }
        if (input.param) { expose(input.param, "about", "variable"); expose(input.param.variable, "name"); }
        const registration = codeOwner ? input.view.canvasCtx.registrations.component(codeOwner.name) : undefined;
        if (registration !== this.registration) { this.stopRegistration?.(); this.stopRegistration = undefined; this.registration = registration; }
        values.push(registration?.getState()?.contract);
      } else if (input.kind === "attributes") {
        if (isTplTag(tpl)) { expose(tpl, "tag", "type"); }
        expose(tpl, "parent"); if (isTplTag(tpl.parent)) { expose(tpl.parent, "type", "tag"); }
        tpl.vsettings.forEach((setting) => { expose(setting, "attrs"); expose(setting.rs, "values"); Object.values(setting.attrs).forEach((expr) => collectPropExpressionFields(expr, expose)); });
        const attrEffective = vtm.effectiveVariantSetting(tpl, active);
        Object.keys(attrEffective.attrs).forEach((attr) => values.push(JSON.stringify(captureDefinedIndicator(this.models,
          computeDefinedIndicator(this.site, input.view.currentComponent(), attrEffective.getAttrSource(attr), vtm.getTargetIndicatorComboForNode(tpl))))));
        const owner = isTplComponent(tpl) ? tpl.component : input.view.currentComponent();
        expose(owner, "params", "type", "name"); owner.params.forEach((param) => {
          expose(param, "variable", "origin", "type", "defaultExpr"); expose(param.variable, "name"); collectPropExpressionFields(param.type, expose); collectPropExpressionFields(param.defaultExpr, expose);
        });
        if (input.slot) {
          expose(input.slot, "param", "parent"); expose(input.slot.param, "variable"); expose(input.slot.param.variable, "name");
        }
        const registration = isTplComponent(tpl) && isCodeComponent(tpl.component) ? input.view.canvasCtx.registrations.component(tpl.component.name) : undefined;
        if (registration !== this.registration) { this.stopRegistration?.(); this.stopRegistration = undefined; this.registration = registration; }
        values.push(registration?.getState()?.contract);
      } else if (input.kind === "text") {
        const textTpl = isTplTextBlock(tpl) ? tpl : isPlainTextTplSlot(tpl) && !isCodeComponentSlot(tpl) ? ensureKnownTplTag(tpl.defaultContents[0]) : undefined;
        values.push(textTpl ? this.models.ref(textTpl) : undefined);
        const metadata = (value: TplNode) => {
          expose(value, "parent");
          if (isTplTag(value)) { expose(value, "type", "tag"); }
          if (isTplComponent(value)) { expose(value, "component"); expose(value.component, "type"); }
          if (isTplSlot(value)) { expose(value, "defaultContents", "param"); expose(value.param, "variable"); expose(value.param.variable, "name"); }
        };
        metadata(tpl); if (tpl.parent) { metadata(tpl.parent); }
        if (textTpl) {
          metadata(textTpl); if (textTpl.parent) { metadata(textTpl.parent); }
          textTpl.vsettings.forEach((setting) => { expose(setting, "text"); collectPropExpressionFields(setting.text, expose); });
          const textEffective = vtm.effectiveVariantSetting(textTpl);
          values.push(JSON.stringify(captureDefinedIndicator(this.models, computeDefinedIndicator(this.site, input.view.currentComponent(), textEffective.getTextSource(input.view), vtm.getTargetVariantComboForNode(textTpl)))));
        }
        expose(this.site, "flags", "dataTokens"); this.site.dataTokens.forEach((token) => expose(token, "name", "uuid"));
        this.site.projectDependencies.forEach((dependency) => {
          expose(dependency, "name", "projectId", "site"); expose(dependency.site, "dataTokens"); dependency.site.dataTokens.forEach((token) => expose(token, "name", "uuid"));
        });
      } else if (input.kind === "visibility") {
        const visibilityCombo = vtm.getTargetVariantComboForNode(tpl, { forVisibility: true });
        const effective = vtm.effectiveVariantSetting(tpl, active);
        values.push(visibilityCombo.map((value) => value.uid).join("."), effective.getVisibility(),
          JSON.stringify(captureDefinedIndicator(this.models, computeDefinedIndicator(this.site, input.view.currentComponent(), effective.getVisibilitySource(), vtm.getTargetIndicatorComboForNode(tpl, { forVisibility: true })))));
        tpl.vsettings.forEach((setting) => { expose(setting, "dataCond"); collectPropExpressionFields(setting.dataCond, expose); });
        field(this.site, "flags"); values.push(this.models.field(this.site, "flags").getState());
        if (isTplComponent(tpl)) { expose(tpl, "component"); expose(tpl.component, "name", "type", "codeComponentMeta"); }
        const registration = isTplComponent(tpl) && isCodeComponent(tpl.component) ? input.view.canvasCtx.registrations.component(tpl.component.name) : undefined;
        if (registration !== this.registration) { this.stopRegistration?.(); this.stopRegistration = undefined; this.registration = registration; }
        values.push(registration?.getState()?.contract);
      } else if (input.kind === "columns") {
        assert(isTplTag(input.tpl), "Responsive columns must be a tag");
        expose(input.tpl, "children");
        input.tpl.vsettings.forEach((setting) => field(setting, "columnsConfig"));
        const effective = input.view.effectiveCurrentVariantSetting(input.tpl), config = effective.columnsConfig;
        values.push(config ? this.models.ref(config) : undefined);
        if (config) { expose(config, "colsSizes", "breakUpRows"); }
        // Every active source contributes its config summary to the indicator.
        input.tpl.vsettings.forEach((setting) => { if (setting.columnsConfig) { field(setting.columnsConfig, "colsSizes", "breakUpRows"); } });
        values.push(JSON.stringify(captureDefinedIndicator(this.models, computeDefinedIndicator(this.site, input.view.currentComponent(), effective.getColumnsConfigSource(), vtm.getTargetIndicatorComboForNode(input.tpl)))));
      } else if (input.kind === "mixins") {
        field(this.site, "mixins"); this.site.projectDependencies.forEach((dependency) => field(dependency.site, "mixins"));
        allMixins(this.site, { includeDeps: "direct" }).forEach((value) => { values.push(this.models.ref(value)); expose(value, "uuid", "name"); });
        const effective = vtm.effectiveVariantSetting(input.tpl, active), targetSetting = tryGetVariantSetting(input.tpl, target);
        values.push(effective.rs.mixins.map((value) => value.uid).join("."), targetSetting?.rs.mixins.map((value) => value.uid).join("."));
      } else {
        assert(isTplComponent(input.tpl), "Style expressions require a component instance");
        const owner = input.tpl.component; expose(owner, "type", "codeComponentMeta", "params");
        owner.params.forEach((param) => { expose(param, "variable", "type"); expose(param.variable, "name"); });
        const param = owner.params.find((value) => value.variable.name === input.attr);
        const arg = param ? vtm.getArg(input.tpl, param.variable) : undefined;
        values.push(arg?.expr ? this.models.ref(arg.expr) : undefined, isCodeComponent(owner) ? owner._meta?.classNameProp : undefined);
      }
    }
    if (!arrayEq(this.current, values)) { this.current = Object.freeze(values); }
    if (this.connected) {
      for (const store of used) { if (!this.fields.has(store)) { this.fields.set(store, { prepare: this.models.subscribePreparedField(store, this.invalidate), stop: store.subscribe(this.publish) }); } }
      for (const [store, binding] of this.fields) { if (!used.has(store)) { binding.prepare(); binding.stop(); this.fields.delete(store); } }
    }
    if (this.connected && this.registration && !this.stopRegistration) { this.stopRegistration = this.registration.subscribe(this.syncContext); }
    this.dirty = false; return this.current;
  };
  subscribe = (listener: () => void) => {
    if (!this.isActive()) { return () => undefined; }
    this.listeners.add(listener);
    if (!this.connected) {
      this.connected = true; this.dirty = true; this.lifetime.addEventListener("abort", this.close, { once: true });
      if (this.input.kind !== "selectors") { this.stops.push(this.input.view.variantStore.subscribe(this.syncContext), this.input.view.selectionStore.subscribe(this.syncContext)); }
      this.publish();
    }
    return () => { this.listeners.delete(listener); if (!this.listeners.size) { this.disconnect(); } };
  };
}

function useTargetedStylePanelSource(studio: StudioCtx, input: TargetInput) {
  const kind = input.kind;
  const view = input.kind === "selectors" ? undefined : input.view;
  const tpl = input.kind === "selectors" ? undefined : input.tpl;
  const expr = input.kind === "selectors" ? input.expr : undefined;
  const attr = input.kind === "button" ? input.attr : undefined;
  const frame = input.kind === "frame" ? input.frame : undefined;
  const param = input.kind === "selectors" ? undefined : input.param;
  const slot = input.kind === "selectors" ? undefined : input.slot;
  const source = React.useMemo(() => new TargetedStylePanelInputs(studio, kind === "selectors"
    ? { kind, expr: ensure(expr, "Style expression target") }
    : { kind, view: ensure(view, "Style panel view"), tpl: ensure(tpl, "Style panel template"), attr, frame, slot, param }), [studio, view, tpl, expr, attr, frame, slot, param, kind]);
  return source;
}

export function useTargetedStylePanelInputs(studio: StudioCtx, input: TargetInput) {
  const source = useTargetedStylePanelSource(studio, input);
  return React.useSyncExternalStore(source.subscribe, source.getRenderInputs, source.getRenderInputs);
}

/** A domain projection runs at the external-store boundary. Its result contains
 * the actual immutable display values; model identities remain command targets. */
class TargetedStylePanelValue<T> {
  private inputs: ReturnType<TargetedStylePanelInputs["getRenderInputs"]> | undefined;
  private value: Readonly<{ active: boolean; value: T | undefined }> | undefined;
  constructor(private readonly source: TargetedStylePanelInputs, private readonly select: () => T) {}
  subscribe = (listener: () => void) => this.source.subscribe(listener);
  read = () => {
    const inputs = this.source.getRenderInputs();
    if (inputs !== this.inputs) {
      this.inputs = inputs;
      this.value = Object.freeze({ active: inputs.active, value: inputs.active ? this.select() : undefined });
    }
    return ensure(this.value, "A style projection must capture its initial input");
  };
}

export function useTargetedStylePanelValue<T>(studio: StudioCtx, input: TargetInput, select: () => T) {
  const source = useTargetedStylePanelSource(studio, input);
  const projection = React.useMemo(() => new TargetedStylePanelValue(source, select), [source, select]);
  return React.useSyncExternalStore(projection.subscribe, projection.read, projection.read);
}
