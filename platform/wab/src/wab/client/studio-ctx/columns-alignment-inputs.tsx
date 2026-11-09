import { useVariantModelWorld } from "@/wab/client/components/variants/variant-model-world";
import { useViewSelection } from "@/wab/client/studio-ctx/selection-state";
import { useViewVariants } from "@/wab/client/studio-ctx/variant-state";
import type { TplExpsProvider } from "@/wab/client/components/style-controls/StyleComponent";
import type { TplProjectionHandle } from "@/wab/client/studio-ctx/style-inputs";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { RSH } from "@/wab/shared/RuleSetHelpers";
import { assert } from "@/wab/shared/common";
import type { TplColumnsTag } from "@/wab/shared/core/tpls";
import type { TplNode } from "@/wab/shared/model/classes";
import * as React from "react";

interface AlignmentSnapshot {
  readonly alignItems: string;
  readonly justifyContent: string;
}
interface ColumnInput { handle: TplProjectionHandle; stop?: () => void; }
const empty: AlignmentSnapshot = Object.freeze({ alignItems: "", justifyContent: "" });
const keys = ["align-items", "justify-content"] as const;

/** Consensus of the original per-column rule sets. Native CSS inputs own the
 * field subscriptions; this source adds only the changing child roster. */
export class ColumnsAlignmentInputs {
  private readonly models;
  private readonly children;
  private readonly columns = new Map<TplNode, ColumnInput>();
  private readonly listeners = new Set<() => void>();
  private stopChildren: (() => void) | undefined;
  private current = empty;
  private connected = false;

  constructor(private readonly view: ViewCtx, tpl: TplColumnsTag, private readonly provider: (node: TplNode) => TplExpsProvider) {
    this.models = view.studioCtx.modelSnapshots;
    this.children = this.models.field(tpl, "children");
    this.refresh();
  }
  private isClosed() { return this.view.disposeSignal.aborted || this.models !== this.view.studioCtx.modelSnapshots; }
  private disconnect = () => {
    this.connected = false;
    this.stopChildren?.(); this.stopChildren = undefined;
    this.view.disposeSignal.removeEventListener("abort", this.disconnect);
    for (const column of this.columns.values()) { column.stop?.(); column.stop = undefined; }
  };
  private connectColumn(column: ColumnInput) {
    if (!this.connected || column.stop) { return; }
    const release = column.handle.retain();
    const stop = column.handle.projection.store.subscribe(this.refresh);
    column.stop = () => { stop(); release(); };
  }
  private refresh = () => {
    if (this.isClosed()) { this.disconnect(); return; }
    const nodes = this.children.getState().map((ref) => this.models.resolve(ref));
    for (const [node, input] of this.columns) {
      if (!nodes.includes(node)) { input.stop?.(); this.columns.delete(node); }
    }
    for (const node of nodes) {
      let input = this.columns.get(node);
      if (!input || input.handle.projection.isDisposed) {
        const native = this.provider(node).getNativeStyleSource();
        assert(native.kind === "tpl", "Columns use template style inputs");
        input = { handle: native.inputs.get(native.source, keys) };
        this.columns.set(node, input);
      }
      this.connectColumn(input);
    }
    const expressions = nodes.map((node) => RSH(this.view.effectiveCurrentVariantSetting(node).rs, node));
    const consensus = (key: string) => {
      const first = expressions[0]?.get(key) ?? "";
      return expressions.every((expression) => expression.get(key) === first) ? first : "";
    };
    const alignItems = consensus("align-items"), justifyContent = consensus("justify-content");
    if (this.current.alignItems !== alignItems || this.current.justifyContent !== justifyContent) {
      this.current = Object.freeze({ alignItems, justifyContent });
      this.listeners.forEach((listener) => listener());
    }
  };
  getSnapshot = () => this.current;
  subscribe = (listener: () => void) => {
    if (this.isClosed()) { return () => undefined; }
    this.listeners.add(listener);
    if (!this.connected) {
      this.connected = true;
      this.view.disposeSignal.addEventListener("abort", this.disconnect, { once: true });
      this.stopChildren = this.children.subscribe(this.refresh);
      this.refresh();
    }
    return () => { this.listeners.delete(listener); if (!this.listeners.size) { this.disconnect(); } };
  };
}

export function useColumnsAlignment(view: ViewCtx, tpl: TplColumnsTag, provider: (node: TplNode) => TplExpsProvider) {
  const world = useVariantModelWorld(view.studioCtx, tpl, view);
  const context = useViewSelection(view, (state) => state.context);
  const frames = useViewVariants(view, (state) => state.frames);
  const source = React.useMemo(() => !world.isCurrent(view) || view.styleInputs.isDisposed
    ? undefined : new ColumnsAlignmentInputs(view, tpl, provider), [view, tpl, provider, world, context, frames]);
  const [retained, setRetained] = React.useState({ view, tpl, snapshot: empty });
  const fallback = retained.view === view && retained.tpl === tpl ? retained.snapshot : empty;
  const subscribe = React.useCallback((listener: () => void) => source ? source.subscribe(listener) : () => undefined, [source]);
  const read = React.useCallback(() => source ? source.getSnapshot() : fallback, [source, fallback]);
  const snapshot = React.useSyncExternalStore(subscribe, read, read);
  if (retained.view !== view || retained.tpl !== tpl || retained.snapshot !== snapshot) { setRetained({ view, tpl, snapshot }); }
  return snapshot;
}
