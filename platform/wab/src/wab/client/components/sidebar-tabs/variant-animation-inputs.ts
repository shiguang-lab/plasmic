import { tryGetPrivateStyleVariant } from "@/wab/shared/Variants";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import type { ModelFieldStore } from "@/wab/client/studio-ctx/model-snapshots";
import type { NativeStyleProvider } from "@/wab/client/studio-ctx/style-inputs";
import { useViewSelection } from "@/wab/client/studio-ctx/selection-state";
import { arrayEq, assert, ensure } from "@/wab/shared/common";
import { allAnimationSequences } from "@/wab/shared/core/sites";
import type { Animation, TplTag, Variant } from "@/wab/shared/model/classes";
import * as React from "react";

export interface VariantAnimationDisplay {
  readonly target: Animation;
  readonly duration: string;
  readonly sequence: Readonly<{ name: string }>;
}

/** The existing animation inheritance recipe and exact sequence catalog fields
 * publish immutable labels alongside their original editing targets. */
export function useVariantAnimationInputs(view: ViewCtx, tpl: TplTag, variants: readonly Variant[]) {
  const context = useViewSelection(view, (state) => state.context);
  const [stableVariants, setStableVariants] = React.useState(() => variants.slice());
  if (!arrayEq(stableVariants, variants)) { setStableVariants(variants.slice()); }
  const provider = React.useMemo<NativeStyleProvider>(() => {
    const vtm = view.variantTplMgr(true), combo = [...stableVariants];
    return { getNativeStyleSource: () => ({ kind: "tpl", inputs: view.styleInputs, source: {
      kind: "tpl", tpl, site: view.site, component: view.currentComponent(),
      contextKey: view.componentStackFrames().map((frame) => frame.tplComponent.uid).join(".") + ":" + (context?.valFullKey ?? "") + ":animations:" + combo.map((variant) => variant.uid).join("."),
      readContext: () => ({ activeVariantCombo: combo, targetVariantCombo: combo, targetIndicatorCombo: combo, effectiveVariantSetting: vtm.effectiveVariantSetting(tpl, combo) }),
    } }) };
  }, [view, tpl, context, stableVariants]);
  const source = React.useMemo(() => createAnimationInputs(view, tpl, stableVariants, provider), [view, tpl, stableVariants, provider]);
  return React.useSyncExternalStore(source.subscribe, source.read, source.read);
}

function createAnimationInputs(view: ViewCtx, tpl: TplTag, variants: readonly Variant[], provider: NativeStyleProvider) {
  const studio = view.studioCtx, models = studio.modelSnapshots, site = studio.site, lifetime = studio.arenaState.lifetime();
  const native = provider.getNativeStyleSource();
  assert(native.kind === "tpl", "Animation inputs require their template's native style owner");
  const marker = native.inputs.getIndicators(native.source, ["animation"]);
  let fieldsSnapshot: readonly unknown[] | undefined;
  let snapshot: Readonly<{
    animations: Animation[];
    display: readonly VariantAnimationDisplay[];
    definedIndicator: ReturnType<ReturnType<ViewCtx["variantTplMgr"]>["getAnimationInfoForVariantCombo"]>["definedIndicator"];
    allSequences: ReturnType<typeof allAnimationSequences>;
    selectors: readonly string[];
  }> | undefined;
  const fields = new Map<ModelFieldStore<unknown>, () => void>(), listeners = new Set<() => void>();
  let releaseMarker: (() => void) | undefined, stopMarker: (() => void) | undefined;
  const current = () => !lifetime.aborted && !view.disposeSignal.aborted && studio.modelSnapshots === models && !native.inputs.isDisposed;
  const read = () => {
    if (!current()) { return ensure(snapshot, "Animation inputs must capture an active owner before retirement"); }
    const used = new Set<ModelFieldStore<unknown>>();
    const { animations, definedIndicator } = view.variantTplMgr().getAnimationInfoForVariantCombo(tpl, [...variants]);
    variants.forEach((variant) => used.add(models.field(variant, "selectors")));
    animations.forEach((animation) => { used.add(models.field(animation, "duration")); used.add(models.field(animation, "sequence")); used.add(models.field(animation.sequence, "name")); });
    const dependencies = models.field(site, "projectDependencies"); used.add(dependencies); used.add(models.field(site, "animationSequences"));
    dependencies.getState().forEach((ref) => {
      const dependency = models.resolve(ref), owner = models.field(dependency, "site"); used.add(owner);
      used.add(models.field(models.resolve(owner.getState()), "animationSequences"));
    });
    const next: unknown[] = [marker.store.getState(), ...[...used].map((field) => field.getState())];
    if (!fieldsSnapshot || !arrayEq(fieldsSnapshot, next)) {
      fieldsSnapshot = Object.freeze(next);
      snapshot = Object.freeze({ animations: [...animations], definedIndicator,
        display: Object.freeze(animations.map((target) => Object.freeze({ target, duration: target.duration, sequence: Object.freeze({ name: target.sequence.name }) }))),
        allSequences: allAnimationSequences(site, { includeDeps: "direct" }),
        selectors: Object.freeze([...(tryGetPrivateStyleVariant([...variants])?.selectors ?? [])]),
      });
    }
    if (listeners.size) {
      used.forEach((field) => { if (!fields.has(field)) { fields.set(field, field.subscribe(sync)); } });
      for (const [field, stop] of fields) { if (!used.has(field)) { stop(); fields.delete(field); } }
    }
    return ensure(snapshot, "Animation inputs must capture their initial display");
  };
  const disconnect = () => {
    stopMarker?.(); stopMarker = undefined; releaseMarker?.(); releaseMarker = undefined;
    fields.forEach((stop) => stop()); fields.clear(); lifetime.removeEventListener("abort", disconnect); view.disposeSignal.removeEventListener("abort", disconnect);
  };
  const sync = () => { const before = snapshot; read(); if (before !== snapshot) { listeners.forEach((listener) => listener()); } };
  const subscribe = (listener: () => void) => {
    if (!current()) { return () => undefined; }
    listeners.add(listener); lifetime.addEventListener("abort", disconnect, { once: true }); view.disposeSignal.addEventListener("abort", disconnect, { once: true });
    releaseMarker ??= marker.retain(); stopMarker ??= marker.store.subscribe(sync); read();
    return () => { listeners.delete(listener); if (!listeners.size) { disconnect(); } };
  };
  return { read, subscribe };
}
