import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import type { ModelFieldStore, ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { arrayEq } from "@/wab/shared/common";
import type { RuleSet, ObjInst } from "@/wab/shared/model/classes";
import { isBaseVariant } from "@/wab/shared/Variants";
import { isTplVariantable } from "@/wab/shared/core/tpls";
import type { TplNode } from "@/wab/shared/model/classes";
import type { Selectable } from "@/wab/shared/core/selection";
import type { VariantTplMgr } from "@/wab/shared/VariantTplMgr";
import type { NativeStyleProvider } from "@/wab/client/studio-ctx/style-inputs";
import { makeSelectableFullKey } from "@/wab/shared/core/selection";
import * as React from "react";

interface Scope { readonly view: ViewCtx; readonly models: ModelSnapshots; readonly signal: AbortSignal; }
interface Snapshot { readonly alive: boolean; readonly targeting: boolean; readonly fields: readonly unknown[]; }
const inactive: Snapshot = Object.freeze({ alive: false, targeting: false, fields: Object.freeze([]) });

/** Hover has its own owner frames, independent of the current editing stack. */
export class HoverVariantInputs {
  private current = inactive;
  private connected = false;
  private readonly fields = new Map<ModelFieldStore<unknown>, () => void>();
  private readonly listeners = new Set<() => void>();
  constructor(private readonly scope: Scope, private readonly tpl: TplNode | undefined, private readonly manager: VariantTplMgr) { this.getSnapshot(); }
  private closed() { return this.scope.signal.aborted || this.scope.models !== this.scope.view.studioCtx.modelSnapshots; }
  private disconnect = () => { this.connected = false; this.scope.signal.removeEventListener("abort", this.close); this.fields.forEach((stop) => stop()); this.fields.clear(); };
  private close = () => { this.current = inactive; this.disconnect(); this.listeners.forEach((listener) => listener()); };
  private sync = () => { const before = this.current; this.getSnapshot(); if (before !== this.current) { this.listeners.forEach((listener) => listener()); } };
  getSnapshot = (): Snapshot => {
    if (this.closed()) { this.current = inactive; this.disconnect(); return this.current; }
    const { models } = this.scope;
    const used = new Set<ModelFieldStore<unknown>>();
    const field = (model: ObjInst, ...keys: string[]) => keys.forEach((key) => used.add(models.declaredField(model, key)));
    // Label uses rsh(), icon uses rshWithTheme(); themed StyleCells alone cannot
    // publish a raw label change masked by a theme or parent style value.
    const visited = new Set<RuleSet>();
    const ruleSet = (rs: RuleSet) => {
      if (visited.has(rs)) { return; }
      visited.add(rs); field(rs, "values", "mixins");
      rs.mixins.forEach((mixin) => {
        field(mixin, "rs", "variantedRs"); ruleSet(mixin.rs);
        mixin.variantedRs.forEach((setting) => { field(setting, "variants", "rs"); ruleSet(setting.rs); });
      });
    };
    let targeting = false;
    if (this.tpl && isTplVariantable(this.tpl)) {
      for (let ancestor: TplNode | null | undefined = this.tpl; ancestor; ancestor = ancestor.parent) { used.add(models.field(ancestor, "parent")); }
      field(this.tpl, "vsettings");
      this.tpl.vsettings.forEach((setting) => { field(setting, "variants", "rs"); ruleSet(setting.rs); });
      const frame = this.manager.getContainingFrame(this.tpl);
      if (frame) {
        field(frame.component, "variants", "tplTree");
        frame.component.variants.forEach((variant) => used.add(models.field(variant, "name")));
        const targets = frame.getTargetVariants();
        targets.forEach((variant) => used.add(models.field(variant, "name")));
        targeting = targets.some((variant) => !isBaseVariant(variant));
      }
    }
    const values = [...used].map((store) => store.getState());
    if (!this.current.alive || this.current.targeting !== targeting || !arrayEq(this.current.fields, values)) { this.current = Object.freeze({ alive: true, targeting, fields: Object.freeze(values) }); }
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

export function useHoverVariantInputs(view: ViewCtx, selectable: Selectable, variants: unknown, renderCount: number) {
  const scope = React.useMemo(() => ({ view, models: view.studioCtx.modelSnapshots, signal: view.disposeSignal }), [view]);
  const alive = !scope.signal.aborted && scope.models === view.studioCtx.modelSnapshots;
  const manager = React.useMemo(() => alive ? view.hoverVariantTplMgr(selectable) : undefined, [scope, alive, view, selectable, variants, renderCount]);
  const source = React.useMemo(() => manager ? new HoverVariantInputs(scope, selectable.tpl, manager) : undefined, [scope, selectable, manager]);
  const snapshot = React.useSyncExternalStore(source?.subscribe ?? emptySubscribe, source?.getSnapshot ?? inactiveSnapshot, source?.getSnapshot ?? inactiveSnapshot);
  const provider = React.useMemo<NativeStyleProvider | undefined>(() => {
    const tpl = selectable.tpl;
    if (!manager || !snapshot.alive || !tpl || !isTplVariantable(tpl)) { return undefined; }
    const frame = manager.getContainingFrame(tpl);
    if (!frame) { return undefined; }
    const site = view.site, inputs = view.styleInputs;
    return { getNativeStyleSource: () => ({ kind: "tpl", inputs, source: {
      kind: "tpl", tpl, site, component: frame.component,
      contextKey: "hover:" + makeSelectableFullKey(selectable),
      readContext: () => {
        const activeVariantCombo = manager.getEffectiveVariantComboForNode(tpl);
        return { activeVariantCombo, targetVariantCombo: manager.getTargetVariantComboForNode(tpl),
          targetIndicatorCombo: manager.getTargetIndicatorComboForNode(tpl),
          effectiveVariantSetting: manager.effectiveVariantSetting(tpl, activeVariantCombo) };
      },
    } }) };
  }, [view, selectable, manager, snapshot.alive]);
  return { ...snapshot, manager, provider };
}
const emptySubscribe = () => () => undefined;
const inactiveSnapshot = () => inactive;
