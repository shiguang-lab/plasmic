import { ExpsProvider, TplExpsProvider } from "@/wab/client/components/style-controls/StyleComponent";
import { useStyleCells } from "@/wab/client/studio-ctx/style-inputs-react";
import type { NativeStyleProvider } from "@/wab/client/studio-ctx/style-inputs";
import { TargetedStylePanelInputs } from "@/wab/client/studio-ctx/targeted-style-panel-inputs";
import { getTplOwnerComponent } from "@/wab/shared/core/tpls";
import { isKnownTplTag } from "@/wab/shared/model/classes";
import { getContainerLayoutType } from "@/wab/shared/layoututils";
import * as React from "react";

const empty = Object.freeze({ active: true, fields: Object.freeze([]), layout: undefined });
const readers = new WeakMap<TplExpsProvider, TargetedStylePanelInputs>();
/** Real child CSS plus the original target-combo deep layout parent recipe. */
export function useStylePanelLayoutSnapshot(provider: ExpsProvider, keys: readonly string[], parentKeys: readonly string[] = []) {
  const cells = useStyleCells(provider, keys);
  const metadata = React.useMemo(() => {
    if (!(provider instanceof TplExpsProvider)) { return undefined; }
    let source = readers.get(provider);
    if (!source) { source = new TargetedStylePanelInputs(provider.studioCtx, { kind: "layout", view: provider.viewCtx, tpl: provider.tpl }); readers.set(provider, source); }
    return source;
  }, [provider]);
  const subscribe = React.useCallback((listener: () => void) => metadata ? metadata.subscribe(listener) : () => undefined, [metadata]);
  const read = React.useCallback(() => metadata?.getRenderInputs() ?? empty, [metadata]);
  const metadataSnapshot = React.useSyncExternalStore(subscribe, read, read);
  const native = provider.getNativeStyleSource();
  // Standalone rule-set controls retain their last display after owner closure;
  // template-bound controls retire with their original view/model context.
  const active = !metadata || (!native.inputs.isDisposed && metadataSnapshot.active);
  const parentRef = metadataSnapshot.layout?.parent;
  const parent = active && parentRef ? provider.studioCtx.modelSnapshots.resolve(parentRef) : undefined;
  const parentProvider = React.useMemo<NativeStyleProvider>(() => {
    if (!(provider instanceof TplExpsProvider) || !isKnownTplTag(parent)) { return provider; }
    const owner = provider.getNativeStyleSource();
    if (owner.kind !== "tpl") { return provider; }
    const vtm = provider.viewCtx.variantTplMgr(true);
    return { getNativeStyleSource: () => ({ kind: "tpl", inputs: owner.inputs, source: {
      ...owner.source, tpl: parent, component: getTplOwnerComponent(parent), contextKey: owner.source.contextKey + ":layout-parent:" + parent.uid,
      readContext: () => {
        const combo = vtm.getTargetIndicatorComboForNode(provider.tpl);
        return { activeVariantCombo: combo, targetVariantCombo: combo, targetIndicatorCombo: combo, effectiveVariantSetting: vtm.effectiveVariantSetting(parent, combo) };
      },
    } }) };
  }, [provider, parent]);
  const parentCells = useStyleCells(parentProvider, active && isKnownTplTag(parent) ? parentKeys : []);
  const isMixin = native.kind === "singleRs";
  const parentIsCodeComponent = metadataSnapshot.layout?.parentIsCodeComponent ?? false;
  const positionCell = cells.find((cell) => cell.key === "position");
  const position = (isMixin ? positionCell?.raw : positionCell?.value) ?? (parentIsCodeComponent ? "relative" : undefined);
  const isAuto = position === "relative";
  const display = parentCells.find((cell) => cell.key === "display")?.value;
  const direction = parentCells.find((cell) => cell.key === "flex-direction")?.value;
  const parentContainerType = display !== undefined && direction !== undefined ? getContainerLayoutType(display, direction)
    : (isMixin || parentIsCodeComponent) && isAuto ? "flex-row" as const : undefined;
  return { active, cells, parentCells, layout: metadataSnapshot.layout, position, isAuto, parentContainerType };
}

export function useStylePanelLayoutInputs(provider: ExpsProvider, keys: readonly string[], parentKeys: readonly string[] = []) {
  return useStylePanelLayoutSnapshot(provider, keys, parentKeys).active;
}
