import { $$$ } from "@/wab/shared/TplQuery";
import { withoutNils } from "@/wab/shared/common";
import { getCanvasOverlayTargets } from "@/wab/shared/core/canvas-overlays";
import { isCodeComponent } from "@/wab/shared/core/components";
import { isSlotSelection } from "@/wab/shared/core/slots";
import { isValComponent } from "@/wab/shared/core/val-nodes";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import type { ModelFieldStore, ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { arrayEq } from "@/wab/shared/common";
import { flattenTpls } from "@/wab/shared/core/tpls";
import { type Expr, type ObjInst, type Site, isKnownTplComponent, isKnownTplTag, isKnownTplSlot, isKnownCustomCode, isKnownObjectPath, isKnownFunctionExpr, isKnownEventHandler, isKnownTemplatedString, isKnownCompositeExpr, isKnownRenderExpr } from "@/wab/shared/model/classes";
import * as React from "react";

interface Scope { readonly view: ViewCtx; readonly models: ModelSnapshots; readonly site: Site; readonly signal: AbortSignal; }
interface Snapshot { readonly alive: boolean; readonly fields: readonly unknown[]; }
const inactive: Snapshot = Object.freeze({ alive: false, fields: Object.freeze([]) });

/** Values rendered by the toolbar; Tpl/Val nodes remain inside the domain query. */
function captureCanvasOverlayToolbar(viewCtx: ViewCtx) {
  const hasSingleSelection = viewCtx.focusedTpls().filter(Boolean).length === 1;
  const hasDomSelection = viewCtx.focusedDomElts().some((elt) => !!elt?.length);
  const editableOwners = new Set(
    viewCtx.componentStackFrames().map((frame) => frame.component),
  );
  const path = viewCtx
    .focusedTplAncestorsThroughComponents()
    .filter(({ node }) => {
      const owner = $$$(
        isSlotSelection(node) ? node.getTpl() : node,
      ).tryGetOwningComponent();
      return owner !== undefined && editableOwners.has(owner);
    });
  const selected = path[0]?.node;
  const ancestors = withoutNils(
    path.map(({ node }) =>
      isSlotSelection(node) ? (node.tpl ?? node.val?.tpl) : node,
    ),
  );
  const targets = getCanvasOverlayTargets(
    viewCtx.currentComponent(),
    ancestors,
    {
      selectedSlot: isSlotSelection(selected)
        ? selected.slotParam.variable.name
        : undefined,
      getMeta: (tpl) =>
        isCodeComponent(tpl.component)
          ? viewCtx.getCodeComponentMeta(tpl.component)
          : undefined,
      getSetting: (tpl) => viewCtx.effectiveCurrentVariantSetting(tpl),
      getProp: (tpl, prop) =>
        viewCtx
          .maybeTpl2ValsInContext(tpl, { allowAnyContext: true })
          .filter(isValComponent)[0]?.codeComponentProps?.[prop],
    },
  );
  const overlays = targets.flatMap((tpl) =>
    viewCtx
      .maybeTpl2ValsInContext(tpl, { allowAnyContext: true })
      .filter(isValComponent)
      .map((val) => Object.freeze({
        label: tpl.name || tpl.component.name.replace("plasmic-antd6-", ""),
        fullKey: val.fullKey,
        instance: val.codeComponentProps?.__canvas?.instance ?? val.fullKey,
      })),
  );
  return Object.freeze({ hasSingleSelection, hasDomSelection, overlays: Object.freeze(overlays) });
}

/** The fields read by canvas-overlays' static event routing analysis and labels.
 * Evaluated code-component props follow the existing per-view render status. */
export class CanvasOverlayToolbarInputs {
  private current = inactive;
  private renderFields: Snapshot | undefined;
  private renderValues: ReturnType<typeof captureCanvasOverlayToolbar> | undefined;
  getRenderSnapshot = () => {
    const fields = this.getSnapshot();
    if (fields !== this.renderFields) {
      this.renderFields = fields;
      this.renderValues = fields.alive ? captureCanvasOverlayToolbar(this.scope.view) : undefined;
    }
    return this.renderValues;
  };
  private readonly fields = new Map<ModelFieldStore<unknown>, () => void>();
  private readonly listeners = new Set<() => void>();
  private connected = false;
  constructor(private readonly scope: Scope) { this.getSnapshot(); }
  private closed() { const { view, models, site, signal } = this.scope; return signal.aborted || models !== view.studioCtx.modelSnapshots || site !== view.studioCtx.site; }
  private disconnect = () => {
    this.connected = false; this.scope.signal.removeEventListener("abort", this.close);
    this.fields.forEach((stop) => stop()); this.fields.clear();
  };
  private close = () => { this.current = inactive; this.disconnect(); this.listeners.forEach((listener) => listener()); };
  private sync = () => { const previous = this.current; this.getSnapshot(); if (previous !== this.current) { this.listeners.forEach((listener) => listener()); } };
  getSnapshot = (): Snapshot => {
    if (this.closed()) { this.current = inactive; this.disconnect(); return this.current; }
    const { view, models } = this.scope;
    const used = new Set<ModelFieldStore<unknown>>([view.selectionStore, view.variantStore, view.csEvaluator.renderStatusStore]);
    const field = (model: ObjInst, ...keys: string[]) => keys.forEach((key) => used.add(models.declaredField(model, key)));
    const expressions = new Set<Expr>();
    const expression = (expr: Expr) => {
      if (expressions.has(expr)) { return; } expressions.add(expr);
      if (isKnownCustomCode(expr)) { field(expr, "code"); }
      else if (isKnownObjectPath(expr)) { field(expr, "path"); }
      else if (isKnownTemplatedString(expr)) { field(expr, "text"); }
      else if (isKnownCompositeExpr(expr)) { field(expr, "hostLiteral", "substitutions"); Object.values(expr.substitutions).forEach(expression); }
      else if (isKnownFunctionExpr(expr)) { field(expr, "argNames", "bodyExpr"); expression(expr.bodyExpr); }
      else if (isKnownEventHandler(expr)) {
        field(expr, "interactions"); expr.interactions.forEach((interaction) => {
          field(interaction, "conditionalMode", "condExpr", "actionName", "args");
          if (interaction.condExpr) { expression(interaction.condExpr); }
          interaction.args.forEach((arg) => { field(arg, "name", "expr"); expression(arg.expr); });
        });
      } else if (isKnownRenderExpr(expr)) { field(expr, "tpl"); }
    };
    const components = new Set(view.componentStackFrames().map((frame) => frame.component));
    components.add(view.currentComponent());
    const nodes = new Set([...components].flatMap((component) => {
      field(component, "tplTree"); return flattenTpls(component.tplTree);
    }));
    view.focusedTplAncestorsThroughComponents().forEach(({ node }) => {
      if (isSlotSelection(node)) { field(node.slotParam, "variable"); field(node.slotParam.variable, "name"); }
      nodes.add(isSlotSelection(node) ? node.getTpl() : node);
    });
    for (const tpl of nodes) {
      field(tpl, "parent", "vsettings");
      if (isKnownTplTag(tpl)) { field(tpl, "children"); }
      else if (isKnownTplSlot(tpl)) {
        field(tpl, "defaultContents", "param"); field(tpl.param, "variable"); field(tpl.param.variable, "name");
      } else if (isKnownTplComponent(tpl)) {
        field(tpl, "component"); field(tpl.component, "type", "params");
        tpl.component.params.forEach((param) => { field(param, "type"); });
        if (isCodeComponent(tpl.component)) {
          field(tpl, "name"); field(tpl.component, "name");
          used.add(view.canvasCtx.registrations.component(tpl.component.name));
        }
      }
      tpl.vsettings.forEach((setting) => {
        field(setting, "variants", "args", "attrs");
        setting.variants.forEach((variant) => field(variant, "uuid", "name", "parent", "selectors", "forTpl", "codeComponentName", "codeComponentVariantKeys"));
        Object.values(setting.attrs).forEach(expression);
        setting.args.forEach((arg) => {
          field(arg, "param", "expr"); field(arg.param, "variable"); field(arg.param.variable, "name"); expression(arg.expr);
        });
      });
    }
    const values = [...used].map((store) => store.getState());
    if (!this.current.alive || !arrayEq(this.current.fields, values)) { this.current = Object.freeze({ alive: true, fields: Object.freeze(values) }); }
    if (this.connected) {
      for (const store of used) { if (!this.fields.has(store)) { this.fields.set(store, store.subscribe(this.sync)); } }
      for (const [store, stop] of this.fields) { if (!used.has(store)) { stop(); this.fields.delete(store); } }
    }
    return this.current;
  };
  subscribe = (listener: () => void) => {
    if (this.closed()) { return () => undefined; }
    this.listeners.add(listener);
    if (!this.connected) { this.connected = true; this.scope.signal.addEventListener("abort", this.close, { once: true }); this.sync(); }
    return () => { this.listeners.delete(listener); if (!this.listeners.size) { this.disconnect(); } };
  };
}

export function useCanvasOverlayToolbarInputs(view: ViewCtx) {
  const scope = React.useMemo(() => ({ view, models: view.studioCtx.modelSnapshots, site: view.studioCtx.site, signal: view.disposeSignal }), [view]);
  const source = React.useMemo(() => new CanvasOverlayToolbarInputs(scope), [scope]);
  return React.useSyncExternalStore(source.subscribe, source.getRenderSnapshot, source.getRenderSnapshot);
}
