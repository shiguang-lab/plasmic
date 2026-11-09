import type { NativeStyleProvider } from "@/wab/client/studio-ctx/style-inputs";
import type { TplNode } from "@/wab/shared/model/classes";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import type { ModelFieldStore, ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { arrayEq } from "@/wab/shared/common";
import type { Selectable } from "@/wab/shared/core/selection";
import { isSlotSelection } from "@/wab/shared/core/slots";
import { isTplNamable } from "@/wab/shared/core/tpls";
import { type Expr, type ObjInst, isKnownTplTag, isKnownTplComponent, isKnownTplSlot, isKnownCustomCode, isKnownCompositeExpr, isKnownTemplatedString } from "@/wab/shared/model/classes";
import * as React from "react";

interface Scope { readonly view: ViewCtx; readonly models: ModelSnapshots; readonly signal: AbortSignal; }
interface Snapshot { readonly alive: boolean; readonly fields: readonly unknown[]; }
const inactive: Snapshot = Object.freeze({ alive: false, fields: Object.freeze([]) });

/** Labels/classification metadata for one Val parent; CSS is owned by StyleCells. */
export class ParentStackItemInputs {
  private current = inactive;
  private readonly fields = new Map<ModelFieldStore<unknown>, () => void>();
  private readonly listeners = new Set<() => void>();
  private connected = false;
  constructor(private readonly scope: Scope, private readonly selectable: Selectable, private readonly isUserRoot: boolean) { this.getSnapshot(); }
  private closed() { return this.scope.signal.aborted || this.scope.models !== this.scope.view.studioCtx.modelSnapshots; }
  private disconnect = () => { this.connected = false; this.scope.signal.removeEventListener("abort", this.close); this.fields.forEach((stop) => stop()); this.fields.clear(); };
  private close = () => { this.current = inactive; this.disconnect(); this.listeners.forEach((listener) => listener()); };
  private sync = () => { const previous = this.current; this.getSnapshot(); if (previous !== this.current) { this.listeners.forEach((listener) => listener()); } };
  getSnapshot = (): Snapshot => {
    if (this.closed()) { this.current = inactive; this.disconnect(); return this.current; }
    const { view, models } = this.scope;
    const used = new Set<ModelFieldStore<unknown>>();
    const field = (model: ObjInst, ...keys: string[]) => keys.forEach((key) => used.add(models.declaredField(model, key)));
    const expression = (expr: Expr) => {
      if (isKnownCustomCode(expr)) { field(expr, "code"); }
      else if (isKnownTemplatedString(expr)) { field(expr, "text"); }
      else if (isKnownCompositeExpr(expr)) { field(expr, "hostLiteral", "substitutions"); Object.values(expr.substitutions).forEach(expression); }
    };
    const slot = isSlotSelection(this.selectable) ? this.selectable : undefined;
    const tpl = slot ? slot.getTpl() : this.selectable.tpl;
    if (slot) { field(slot.slotParam, "variable"); field(slot.slotParam.variable, "name"); }
    if (tpl) {
      field(tpl, "parent");
      if (isTplNamable(tpl)) { field(tpl, "name"); }
      if (isKnownTplComponent(tpl)) {
        field(tpl, "component"); field(tpl.component, "name", "type", "codeComponentMeta");
        if (tpl.component.codeComponentMeta) { field(tpl.component.codeComponentMeta, "displayName"); }
        if (slot) { used.add(view.canvasCtx.registrations.component(tpl.component.name)); }
      } else if (isKnownTplSlot(tpl)) {
        field(tpl, "param"); field(tpl.param, "variable"); field(tpl.param.variable, "name");
      } else if (isKnownTplTag(tpl)) {
        field(tpl, "tag", "type");
        if (tpl.tag === "input") {
          field(tpl, "vsettings"); tpl.vsettings.forEach((setting) => {
            field(setting, "variants", "attrs"); setting.variants.forEach((variant) => field(variant, "name"));
            if (setting.attrs.type) { expression(setting.attrs.type); }
          });
        }
      }
    }
    if (this.isUserRoot) {
      const frame = view.arenaFrame(); field(frame, "viewMode", "name", "container");
      field(frame.container, "component"); field(frame.container.component, "name");
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

export function useParentStackItemInputs(view: ViewCtx, selectable: Selectable, isUserRoot: boolean) {
  const scope = React.useMemo(() => ({ view, models: view.studioCtx.modelSnapshots, signal: view.disposeSignal }), [view]);
  const source = React.useMemo(() => new ParentStackItemInputs(scope, selectable, isUserRoot), [scope, selectable, isUserRoot]);
  return React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot).alive;
}


/** Use the existing finite style owner directly, avoiding the legacy StyleTarget module cycle. */
export function parentStackStyleProvider(view: ViewCtx, tpl: TplNode): NativeStyleProvider {
  const inputs = view.styleInputs, site = view.site, component = view.currentComponent();
  const manager = view.variantTplMgr(true);
  const contextKey = view.componentStackFrames().map((frame) => frame.tplComponent.uid).join(".") + ":" + (view.selectionStore.getState().context?.valFullKey ?? "");
  return { getNativeStyleSource: () => ({ kind: "tpl", inputs, source: {
    kind: "tpl", tpl, site, component, contextKey,
    readContext: () => {
      const activeVariantCombo = manager.getEffectiveVariantComboForNode(tpl);
      return { activeVariantCombo, targetVariantCombo: manager.getTargetVariantComboForNode(tpl),
        targetIndicatorCombo: manager.getTargetIndicatorComboForNode(tpl),
        effectiveVariantSetting: manager.effectiveVariantSetting(tpl, activeVariantCombo) };
    },
  } }) };
}
