import { $$$ } from "@/wab/shared/TplQuery";
import { arrayEq, withoutNils } from "@/wab/shared/common";
import { getCanvasOverlayTargets } from "@/wab/shared/core/canvas-overlays";
import { isCodeComponent } from "@/wab/shared/core/components";
import { isSlotSelection } from "@/wab/shared/core/slots";
import { isValComponent } from "@/wab/shared/core/val-nodes";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import type { ModelFieldStore, ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { ModelFieldInputs, type DeclareModelFields } from "@/wab/client/stores/model-field-inputs";
import { flattenTpls } from "@/wab/shared/core/tpls";
import { type Component, type TplNode, type Expr, type Site, isKnownTplComponent, isKnownTplTag, isKnownTplSlot, isKnownCustomCode, isKnownObjectPath, isKnownFunctionExpr, isKnownEventHandler, isKnownTemplatedString, isKnownCompositeExpr, isKnownRenderExpr } from "@/wab/shared/model/classes";
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
  private readonly inputs: ModelFieldInputs;
  constructor(private readonly scope: Scope) {
    const { view, models, site, signal } = scope;
    const inputScope = { models, lifetime: signal, isCurrent: () => models === view.studioCtx.modelSnapshots && site === view.studioCtx.site };
    const collectNodes = (nodes: Iterable<TplNode>, field: DeclareModelFields, watch: (store: ModelFieldStore<unknown>) => void) => {
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
          watch(view.canvasCtx.registrations.component(tpl.component.name));
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
    };
    let components: readonly Component[] = [];
    const tree = new ModelFieldInputs(inputScope, (field, watch) => {
      const nodes = new Set(components.flatMap((component) => {
        field(component, "tplTree"); return flattenTpls(component.tplTree);
      }));
      collectNodes(nodes, field, watch);
    });
    const treeStore: ModelFieldStore<readonly unknown[]> = {
      getState: tree.read, getInitialState: tree.read,
      subscribe: (listener) => {
        let previous = tree.read();
        return tree.subscribe(() => { const next = tree.read(), before = previous; previous = next; listener(next, before); });
      },
    };
    this.inputs = new ModelFieldInputs(inputScope, (field, watch) => {
      watch(view.selectionStore); watch(view.variantStore); watch(view.csEvaluator.renderStatusStore);
      const nextComponents = [...new Set([...view.componentStackFrames().map((frame) => frame.component), view.currentComponent()])];
      if (!arrayEq(components, nextComponents)) { components = nextComponents; tree.invalidate(); }
      watch(treeStore);
      // Selection/render changes only recollect the active ancestor path.
      // Component-wide event routing inputs retain their independent snapshot.
      const ancestors = new Set<TplNode>();
      view.focusedTplAncestorsThroughComponents().forEach(({ node }) => {
        if (isSlotSelection(node)) { field(node.slotParam, "variable"); field(node.slotParam.variable, "name"); }
        ancestors.add(isSlotSelection(node) ? node.getTpl() : node);
      });
      collectNodes(ancestors, field, watch);
    });
  }
  getSnapshot = (): Snapshot => {
    if (!this.inputs.isCurrent()) { return inactive; }
    const fields = this.inputs.read();
    if (!this.current.alive || this.current.fields !== fields) { this.current = Object.freeze({ alive: true, fields }); }
    return this.current;
  };
  subscribe = (listener: () => void) => this.inputs.subscribe(listener);
}

export function useCanvasOverlayToolbarInputs(view: ViewCtx) {
  const scope = React.useMemo(() => ({ view, models: view.studioCtx.modelSnapshots, site: view.studioCtx.site, signal: view.disposeSignal }), [view]);
  const source = React.useMemo(() => new CanvasOverlayToolbarInputs(scope), [scope]);
  return React.useSyncExternalStore(source.subscribe, source.getRenderSnapshot, source.getRenderSnapshot);
}
