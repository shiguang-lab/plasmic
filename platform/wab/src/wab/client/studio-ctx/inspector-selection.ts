import type { CanvasComponentPart } from "@/wab/client/components/canvas/canvas-component-parts";
import type { ComponentCtx } from "@/wab/client/studio-ctx/component-ctx";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import type { Selectable } from "@/wab/shared/core/selection";
import type { ComponentEvalContext } from "@/wab/shared/core/val-nodes";
import type {
  Param,
  TplComponent,
  TplNode,
  TplTag,
} from "@/wab/shared/model/classes";
import { computed, IComputedValue, observable } from "mobx";

/** A committed editor focus and its reads, independent of immediate canvas focus. */
export class InspectorSelection {
  readonly componentCtx: ComponentCtx | null;
  readonly tpl: TplNode | null;
  readonly tplCount: number;
  readonly slotTpl: TplNode | null;
  readonly selectable: Selectable | null | undefined;
  readonly cloneKey: string | undefined;
  readonly componentPart: CanvasComponentPart | undefined;
  private paused = observable.box(false);
  private evaluations = new Map<
    TplTag | TplComponent,
    Map<Param | undefined, IComputedValue<ComponentEvalContext>>
  >();
  private environments = new Map<
    TplNode,
    Map<string, IComputedValue<ReturnType<ViewCtx["getCanvasEnvForTpl"]>>>
  >();
  private domValue = this.pausedRead(() => {
    this.viewCtx.canvasDomVersion;
    return this.selectable
      ? this.viewCtx.selectionDom(this.selectable, this.cloneKey)
      : null;
  });

  constructor(
    readonly viewCtx: ViewCtx,
    readonly generation: number,
  ) {
    this.componentCtx = viewCtx.currentComponentCtx();
    this.tpl = viewCtx.focusedTpl();
    this.tplCount = viewCtx.focusedTpls().length;
    this.slotTpl = viewCtx.focusedTpl(true);
    this.selectable = viewCtx.focusedSelectable();
    this.cloneKey = viewCtx.focusedCloneKey();
    this.componentPart = viewCtx.focusedComponentPart;
  }

  pause() {
    this.paused.set(true);
  }
  resume() {
    this.paused.set(false);
  }

  /** Pausing keeps the last result and unsubscribes it from changing canvas data. */
  private pausedRead<T>(read: () => T): IComputedValue<T> {
    let initialized = false;
    let value: T;
    return computed(() => {
      if (!this.paused.get() || !initialized) {
        value = read();
        initialized = true;
      }
      return value;
    });
  }

  get dom() {
    return this.domValue.get();
  }

  getComponentEvalContext(tpl: TplTag | TplComponent, param?: Param) {
    let entries = this.evaluations.get(tpl);
    if (!entries) {
      entries = new Map();
      this.evaluations.set(tpl, entries);
    }
    let value = entries.get(param);
    if (!value) {
      value = this.pausedRead(() => {
        this.viewCtx.canvasDomVersion;
        return this.viewCtx.getComponentEvalContext(tpl, param, {
          anchorCloneKey: this.cloneKey,
          ignoreFocusedCloneKey: true,
        });
      });
      entries.set(param, value);
    }
    return value.get();
  }

  getCanvasEnvForTpl(
    tpl: TplNode,
    options?: { forDataRepCollection?: boolean; keep$StateRef?: boolean },
  ) {
    let entries = this.environments.get(tpl);
    if (!entries) {
      entries = new Map();
      this.environments.set(tpl, entries);
    }
    const key = `${!!options?.forDataRepCollection}:${!!options?.keep$StateRef}`;
    let value = entries.get(key);
    if (!value) {
      value = this.pausedRead(() => {
        this.viewCtx.canvasDomVersion;
        return this.viewCtx.getCanvasEnvForTpl(tpl, {
          ...options,
          anchorCloneKey: this.cloneKey,
          ignoreFocusedCloneKey: true,
        });
      });
      entries.set(key, value);
    }
    return value.get();
  }
}

/** Standalone data editors are not owned by a selected element. */
export function canEditInspectorSelection(
  studioCtx: StudioCtx,
  selection: InspectorSelection | undefined,
) {
  return (
    !selection ||
    (!studioCtx.isSelectionPending &&
      studioCtx.inspectorSelection === selection &&
      studioCtx.focusedViewCtx() === selection.viewCtx &&
      !selection.viewCtx.isDisposed &&
      selection.viewCtx.currentComponentCtx() === selection.componentCtx &&
      selection.viewCtx.focusedTpl() === selection.tpl &&
      selection.viewCtx.focusedCloneKey() === selection.cloneKey)
  );
}
