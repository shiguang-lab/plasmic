import { getNodeSummary } from "@/wab/client/components/sidebar-tabs/OutlineCtx";
import { getMultiSelectionFieldState, getMultiSelectionProviders, multiSelectionFields, type MultiSelectionEditAccess, type MultiSelectionProp } from "@/wab/client/components/sidebar-tabs/multi-selection";
import type { TplExpsProvider } from "@/wab/client/components/style-controls/StyleComponent";
import type { TplProjectionHandle } from "@/wab/client/studio-ctx/style-inputs";
import { TargetedStylePanelInputs } from "@/wab/client/studio-ctx/targeted-style-panel-inputs";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { arrayEq, assert } from "@/wab/shared/common";
import { getTplTextBlockContent } from "@/wab/shared/core/tpls";
import { standardCorners } from "@/wab/shared/geom";
import { isKnownTplSlot } from "@/wab/shared/model/classes";
import { shallow } from "zustand/shallow";

const properties = Object.keys(multiSelectionFields) as MultiSelectionProp[];
const keys = [...properties.filter((prop) => prop !== "border-radius"), ...standardCorners.map((corner) => `border-${corner}-radius`), "display", "flex-direction"];
interface Field extends ReturnType<typeof getMultiSelectionFieldState> { readonly prop: MultiSelectionProp; }
interface Snapshot { readonly active: boolean; readonly fields: readonly Field[]; readonly names: readonly string[]; }
const empty: Snapshot = Object.freeze({ active: false, fields: Object.freeze([]), names: Object.freeze([]) });

/** The real multi-selection consensus, including CSS, locks, labels and runtime
 * styleability. Each selected node leases the existing native CSS projection. */
export class MultiSelectionInputs {
  readonly providers: TplExpsProvider[];
  private readonly models;
  private readonly owner;
  private readonly context;
  private readonly metadata: TargetedStylePanelInputs[];
  private readonly handles: TplProjectionHandle[];
  private readonly listeners = new Set<() => void>();
  private stops: (() => void)[] = [];
  private current = empty;
  private connected = false;
  constructor(private readonly view: ViewCtx, private readonly access: MultiSelectionEditAccess, scope: { models: ViewCtx["studioCtx"]["modelSnapshots"]; styles: ViewCtx["styleInputs"] }) {
    this.models = scope.models; this.owner = scope.styles; this.context = view.selectionStore.getState().context;
    this.providers = this.closed() ? [] : getMultiSelectionProviders(view);
    this.metadata = this.providers.map((provider) => new TargetedStylePanelInputs(view.studioCtx, { kind: "multi-selection", view, tpl: provider.tpl }));
    this.handles = this.providers.map((provider) => {
      const native = provider.getNativeStyleSource(); assert(native.kind === "tpl", "Multi-selection uses template style inputs");
      return native.inputs.get(native.source, keys);
    });
  }
  private closed = () => this.view.disposeSignal.aborted || this.owner.isDisposed || this.models !== this.view.studioCtx.modelSnapshots || this.context !== this.view.selectionStore.getState().context;
  private disconnect = () => { this.connected = false; this.stops.splice(0).forEach((stop) => stop()); this.view.disposeSignal.removeEventListener("abort", this.publish); };
  getSnapshot = (): Snapshot => {
    if (this.closed()) { this.current = empty; this.disconnect(); return this.current; }
    this.metadata.forEach((source) => source.getSnapshot());
    const fields = properties.map((prop) => ({ prop, ...getMultiSelectionFieldState(this.view, this.providers, prop, this.access) }));
    const names = this.providers.map((provider) => {
      const tpl = provider.tpl;
      return (!isKnownTplSlot(tpl) && tpl.name) || getTplTextBlockContent(tpl, this.view) || getNodeSummary(tpl, provider.effectiveVs().rsh());
    });
    if (!this.current.active || !arrayEq(this.current.fields, fields, shallow) || !arrayEq(this.current.names, names)) {
      this.current = Object.freeze({ active: true, fields: Object.freeze(fields), names: Object.freeze(names) });
    }
    return this.current;
  };
  private publish = () => { const before = this.current; this.getSnapshot(); if (before !== this.current) { this.listeners.forEach((listener) => listener()); } };
  subscribe = (listener: () => void) => {
    if (this.closed()) { return () => undefined; } this.listeners.add(listener);
    if (!this.connected) {
      this.connected = true; this.view.disposeSignal.addEventListener("abort", this.publish, { once: true });
      for (const handle of this.handles) { this.stops.push(handle.retain(), handle.projection.store.subscribe(this.publish)); }
      this.metadata.forEach((source) => this.stops.push(source.subscribe(this.publish)));
      this.stops.push(this.view.frameState.valRootStore.subscribe(this.publish), this.view.csEvaluator.renderStatusStore.subscribe(this.publish), this.view.subscribeToCanvasChanges(this.publish));
      this.publish();
    }
    return () => { this.listeners.delete(listener); if (!this.listeners.size) { this.disconnect(); } };
  };
}
