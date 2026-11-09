import { TplExpsProvider } from "@/wab/client/components/style-controls/StyleComponent";
import { $$$ } from "@/wab/shared/TplQuery";
import { getAncestorTplSlot, getSingleTextBlockFromArg, getSingleTplComponentFromArg, getSlotParams } from "@/wab/shared/SlotUtils";
import { getComponentPropTypes } from "@/wab/shared/component-props";
import { getComponentDisplayName } from "@/wab/shared/core/components";
import { smartHumanize } from "@/wab/shared/strs";
import type { Param, TplSlot } from "@/wab/shared/model/classes";
import type { ModelFieldStore, ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { getSlotArgs } from "@/wab/shared/SlotUtils";
import { arrayEq, assert } from "@/wab/shared/common";
import { isCodeComponent } from "@/wab/shared/core/components";
import { isTplAttachedToSite } from "@/wab/shared/core/sites";
import { isTplComponent, isTplTag } from "@/wab/shared/core/tpls";
import { ObjInst, TplComponent, TplNode, isKnownRenderExpr } from "@/wab/shared/model/classes";
import * as React from "react";

export interface MergedSlotRow {
  readonly param: Param;
  readonly key: string;
  readonly label: string;
  readonly propType: ReturnType<typeof getComponentPropTypes>[string] | undefined;
  readonly text: Readonly<{ provider: TplExpsProvider; ancestorSlot: TplSlot | undefined }> | undefined;
  readonly component: Readonly<{ provider: TplExpsProvider; tpl: TplComponent; name: string }> | undefined;
}
interface MergedSlotSnapshot {
  readonly active: boolean;
  readonly fields: readonly unknown[];
  readonly rows: readonly MergedSlotRow[];
}
const empty: MergedSlotSnapshot = Object.freeze({ active: false, fields: Object.freeze([]), rows: Object.freeze([]) });
/** Merged-slot roster and exact one-child argument shape, plus its own registration contract. */
export class MergedSlotInputs {
  private readonly models: ModelSnapshots;
  private readonly lifetime: AbortSignal;
  private current = empty;
  private published = empty;
  private dirty = true;
  private connected = false;
  private readonly fields = new Map<ModelFieldStore<unknown>, { prepare: () => void; stop: () => void }>();
  private registration: ModelFieldStore<unknown> | undefined;
  private stopRegistration: (() => void) | undefined;
  private stopVariants: (() => void) | undefined;
  private readonly listeners = new Set<() => void>();
  constructor(private readonly view: ViewCtx, private readonly tpl: TplComponent) {
    this.models = view.studioCtx.modelSnapshots; this.lifetime = view.disposeSignal;
    if (this.isActive()) { assert(isTplAttachedToSite(view.site, tpl), "Merged slot instance belongs to another model world"); }
  }
  isActive = () => !this.lifetime.aborted && this.models === this.view.studioCtx.modelSnapshots;
  private disconnect = () => { this.connected = false; this.lifetime.removeEventListener("abort", this.close); this.fields.forEach(({ prepare, stop }) => { prepare(); stop(); }); this.fields.clear(); this.stopRegistration?.(); this.stopRegistration = undefined; this.stopVariants?.(); this.stopVariants = undefined; };
  private close = () => { this.current = empty; this.disconnect(); this.publishSnapshot(); this.listeners.clear(); };
  private invalidate = () => { this.dirty = true; };
  private publishSnapshot = () => { if (this.current !== this.published) { this.published = this.current; this.listeners.forEach((listener) => listener()); } };
  private publish = () => { this.getSnapshot(); this.publishSnapshot(); };
  private syncRegistration = () => { this.dirty = true; this.publish(); };
  getSnapshot = (): MergedSlotSnapshot => {
    if (!this.isActive()) { return empty; }
    if (this.connected && !this.dirty) { return this.current; }
    const used = new Set<ModelFieldStore<unknown>>();
    const field = (model: ObjInst, ...keys: string[]) => keys.forEach((key) => used.add(this.models.declaredField(model, key)));
    field(this.tpl, "component", "vsettings");
    const component = this.tpl.component;
    field(component, "params", "name", "type", "plumeInfo", "codeComponentMeta");
    if (component.plumeInfo) { field(component.plumeInfo, "type"); }
    component.params.forEach((param) => { field(param, "mergeWithParent", "type", "variable"); field(param.variable, "name"); });
    this.tpl.vsettings.forEach((setting) => { field(setting, "variants", "args"); setting.variants.forEach((variant) => field(variant, "name")); });
    const ancestry = (node: TplNode) => {
      let current: TplNode | null | undefined = node;
      while (current) { field(current, "parent"); if (isTplComponent(current)) { break; } current = current.parent; }
    };
    getSlotArgs(this.tpl).forEach((arg) => {
      field(arg, "param", "expr");
      if (!isKnownRenderExpr(arg.expr)) { return; }
      field(arg.expr, "tpl");
      arg.expr.tpl.forEach((node) => {
        if (isTplTag(node)) { field(node, "type"); }
        ancestry(node);
        if (isTplComponent(node)) {
          field(node, "component"); field(node.component, "name", "type", "codeComponentMeta");
          if (node.component.codeComponentMeta) { field(node.component.codeComponentMeta, "displayName"); }
        }
      });
    });
    const nextRegistration = isCodeComponent(component) ? this.view.canvasCtx.registrations.component(component.name) : undefined;
    if (nextRegistration !== this.registration) { this.stopRegistration?.(); this.stopRegistration = undefined; this.registration = nextRegistration; }
    const values = [...used].map((store) => store.getState());
    const variants = this.view.variantStore.getState();
    values.push(nextRegistration?.getState()?.contract, variants.frames, variants.global);
    if (!this.current.active || !arrayEq(this.current.fields, values)) {
      const propTypes = getComponentPropTypes(this.view, component);
      const rows = getSlotParams(component).filter((param) => param.mergeWithParent).map((param): MergedSlotRow => {
        const arg = $$$(this.tpl).getSlotArg(param.variable.name);
        const text = getSingleTextBlockFromArg(arg);
        const child = getSingleTplComponentFromArg(arg);
        return Object.freeze({
          param, key: `${this.tpl.uuid}-${param.uuid}`, label: String(smartHumanize(param.variable.name)),
          propType: propTypes[param.variable.name],
          text: text ? Object.freeze({ provider: new TplExpsProvider(this.view, text), ancestorSlot: getAncestorTplSlot(text, false) }) : undefined,
          component: child ? Object.freeze({ tpl: child, provider: new TplExpsProvider(this.view, child), name: getComponentDisplayName(child.component) }) : undefined,
        });
      });
      this.current = Object.freeze({ active: true, fields: Object.freeze(values), rows: Object.freeze(rows) });
    }
    if (this.connected) {
      for (const store of used) { if (!this.fields.has(store)) { this.fields.set(store, { prepare: this.models.subscribePreparedField(store, this.invalidate), stop: store.subscribe(this.publish) }); } }
      for (const [store, binding] of this.fields) { if (!used.has(store)) { binding.prepare(); binding.stop(); this.fields.delete(store); } }
      if (this.registration && !this.stopRegistration) { this.stopRegistration = this.registration.subscribe(this.syncRegistration); }
    }
    this.dirty = false; return this.current;
  };
  subscribe = (listener: () => void) => {
    if (!this.isActive()) { return () => undefined; } this.listeners.add(listener);
    if (!this.connected) { this.connected = true; this.dirty = true; this.lifetime.addEventListener("abort", this.close, { once: true }); this.stopVariants = this.view.variantStore.subscribe(this.syncRegistration); this.publish(); }
    return () => { this.listeners.delete(listener); if (!this.listeners.size) { this.disconnect(); } };
  };
}

export function useMergedSlotInputs(view: ViewCtx, tpl: TplComponent) {
  const source = React.useMemo(() => new MergedSlotInputs(view, tpl), [view, tpl]);
  return React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
}
