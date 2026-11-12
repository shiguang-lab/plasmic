import { ViewStyleInputs } from "@/wab/client/studio-ctx/style-inputs";
import { subscribeStudioArena } from "@/wab/client/studio-ctx/arena-state";
import { subscribeStudioSelection } from "@/wab/client/studio-ctx/selection-state";
import { subscribeStudioLiveMode } from "@/wab/client/studio-ctx/studio-mode-state";
import type { ModelFieldStore, ModelRef } from "@/wab/client/studio-ctx/model-snapshots";
import { createStore } from "zustand/vanilla";
import { ViewVariantState } from "@/wab/client/studio-ctx/view-variant-state";
import { ViewSelection } from "@/wab/client/studio-ctx/view-selection";
import { InspectorSelection } from "@/wab/client/studio-ctx/inspector-selection";
import type { ModelChange } from "@/wab/shared/core/observable-model";
import { CanvasRenderOwner } from "@/wab/client/components/canvas/canvas-cache";
import { CanvasContentEditor } from "@/wab/client/studio-ctx/canvas-content-editor";
import { CanvasSessionState } from "@/wab/client/components/canvas/canvas-session-state";
import {
  isRenderReady,
  setRenderReadyAttr,
} from "@/wab/client/studio-ctx/render-ready";
import { Adoptee, InsertionSpec } from "@/wab/client/Dnd";
import { RunFn } from "@/wab/client/components/canvas/CanvasText";
import { CanvasCtx } from "@/wab/client/components/canvas/canvas-ctx";
import "@/wab/client/components/canvas/slate";
import { ViewOps } from "@/wab/client/components/canvas/view-ops";
import {
  ClientPinManager,
  makeVariantEvalState,
} from "@/wab/client/components/variants/ClientPinManager";
import { DevCliSvrEvaluator } from "@/wab/client/cseval";
import { WithDbCtx } from "@/wab/client/db";
import { Fiber } from "@/wab/client/react-global-hook/fiber";
import {
  getMostRecentFiberVersion,
  globalHookCtx,
} from "@/wab/client/react-global-hook/globalHook";
import { FrameState } from "@/wab/client/react-global-hook/types";
import { requestIdleCallbackAsync } from "@/wab/client/requestidlecallback";
import {
  FreestyleState,
  PointerState,
  RightTabKey,
  StudioCtx,
} from "@/wab/client/studio-ctx/StudioCtx";
import { ViewportCtx } from "@/wab/client/studio-ctx/ViewportCtx";
import { subscribeViewport } from "@/wab/client/studio-ctx/viewport-state";
import { ComponentCtx } from "@/wab/client/studio-ctx/component-ctx";
import {
  createCanvasMirrorStore,
  setCanvasMirrorTarget,
} from "@/wab/client/studio-ctx/canvas-mirror-state";
import { createEditingTextStore } from "@/wab/client/studio-ctx/editing-text-state";
import {
  createDndInsertionStore,
  setDndTentativeInsertion,
} from "@/wab/client/studio-ctx/dnd-insertion-state";
import { subscribeToSelector } from "@/wab/client/stores/store-kit";
import {
  modelKeys,
} from "@/wab/shared/model-revisions";
import { createAdopteeHighlightStore } from "@/wab/client/studio-ctx/adoptee-highlight-state";
import { createAutoOpenStore } from "@/wab/client/studio-ctx/auto-open-state";
import { trackEvent } from "@/wab/client/tracking";
import { ViewStateSnapshot } from "@/wab/client/undo-log";
import { mkTokenRef } from "@/wab/commons/StyleToken";
import { drainQueue } from "@/wab/commons/asyncutil";
import { safeCallbackify } from "@/wab/commons/control";
import { getArenaFrames, isHeightAutoDerived } from "@/wab/shared/Arenas";
import { RSH } from "@/wab/shared/RuleSetHelpers";
import { getAncestorSlotArg } from "@/wab/shared/SlotUtils";
import { $$$ } from "@/wab/shared/TplQuery";
import { VariantTplMgr } from "@/wab/shared/VariantTplMgr";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { FastBundler } from "@/wab/shared/bundler";
import {
  getLinkedCodeProps,
} from "@/wab/shared/cached-selectors";
import {
  arrayEq,
  assert,
  ensure,
  ensureArray,
  ensureArrayOfInstances,
  ensureInstance,
  last,
  maybe,
  spawn,
  swallow,
  switchType,
  tuple,
  withoutNils,
} from "@/wab/shared/common";
import {
  ComponentVariantFrame,
  GlobalVariantFrame,
  RootComponentVariantFrame,
  TransientComponentVariantFrame,
} from "@/wab/shared/component-frame";
import {
  CodeComponent,
  isCodeComponent,
} from "@/wab/shared/core/components";
import { getRawCode } from "@/wab/shared/core/exprs";
import { metaSvc } from "@/wab/shared/core/metas";
import { SQ, Selectable, makeSelectableFullKey } from "@/wab/shared/core/selection";
import {
  makeTokenRefResolver,
  makeTokenValueResolver,
} from "@/wab/shared/core/site-style-tokens";
import { isTplAttachedToSite } from "@/wab/shared/core/sites";
import { SlotSelection, isSlotSelection } from "@/wab/shared/core/slots";
import { isFixedSlotRoot } from "@/wab/client/components/canvas/fixed-slot-root";
import {
  getStateVarName,
} from "@/wab/shared/core/states";
import { makeStyleExprClassName } from "@/wab/shared/core/styles";
import { toFinalToken } from "@/wab/shared/core/tokens";
import * as Tpls from "@/wab/shared/core/tpls";
import { RawTextLike } from "@/wab/shared/core/tpls";
import {
  ComponentEvalContext,
  ValComponent,
  ValNode,
  ValTag,
  ValTextTag,
  bestValForTpl,
} from "@/wab/shared/core/val-nodes";
import {
  asTpl,
  asVal,
  isValSelectable,
  tplFromSelectable,
} from "@/wab/shared/core/vals";
import { isDraggableSize } from "@/wab/shared/css-size";
import { CanvasEnv, tryEvalExpr } from "@/wab/shared/eval";
import { Pt, rectsIntersect } from "@/wab/shared/geom";
import { disposeCanvasFactories } from "@/wab/client/components/canvas/canvas-factories";
import {
  ArenaFrame,
  Component,
  DataToken,
  Param,
  RawText,
  RichText,
  State,
  StyleExpr,
  StyleTokenRef,
  TplComponent,
  TplNode,
  TplSlot,
  TplTag,
  Variant,
  VariantSetting,
  isKnownColorPropType,
  isKnownStyleExpr,
  isKnownTplComponent,
} from "@/wab/shared/model/classes";
import { isTplResizable } from "@/wab/shared/sizingutils";
import {
  $State,
  generateStateOnChangeProp,
  generateStateValueProp,
} from "@plasmicapp/react-web";
import asynclib from "async";
import $ from "jquery";
import L, { defer, head, isEqual, sortBy } from "lodash";
import { ok } from "neverthrow";
import { CSSProperties } from "react";
import type { Editor as SlateEditor } from "slate";

export class ViewMode {
  static live: ViewMode;
  static dev: ViewMode;
}
ViewMode.live = new ViewMode();
ViewMode.dev = new ViewMode();

interface ViewCtxSyncArgs {
  styles?: boolean;
  eval?: boolean;
  asap?: boolean;
}

interface ViewCtxArgs {
  studioCtx: StudioCtx;
  viewportCtx: ViewportCtx;
  canvasCtx: CanvasCtx;
  arenaFrame: ArenaFrame;
}

export interface EditingTextContext {
  val: ValTextTag;
  targetVs: VariantSetting;
  draftText: RawText | RawTextLike | undefined;
  // The run() function is used to run commands in the rich text editor from
  // outside.
  run: RunFn | undefined;
  editor: SlateEditor | undefined;
}

/**
 * Useful information to decide whether or not the arenaFrame should re-render.
 */
export interface SpotlightAndVariantsInfo {
  componentStackFrameLength: number;
  lastComponentFrame: ComponentVariantFrame;
  viewMode: string;
  pinnedVariants: { [key: string]: boolean };
  showDefaultSlotContents: boolean;
}

export interface CanvasObserverLease { dispose(): void; readonly isDisposed: boolean; }

export class ViewCtx extends WithDbCtx {
  readonly studioCtx: StudioCtx;
  readonly viewportCtx: ViewportCtx;

  csEvaluator: DevCliSvrEvaluator;

  get isFirstRenderComplete() {
    return this.csEvaluator.isFirstRenderComplete;
  }

  get renderCount() {
    return this.csEvaluator.renderCount;
  }

  private disposals: (() => void)[] = [];
  private readonly _initialRenderReady = createStore<boolean>(() => false);
  private readonly readySubscriptions = new Set<() => void>();
  readonly initialRenderReadyStore: ModelFieldStore<boolean> = {
    getState: () => this._initialRenderReady.getState(),
    getInitialState: () => false,
    subscribe: (listener) => {
      if (this.isDisposed) { return () => undefined; }
      const off = this._initialRenderReady.subscribe(listener);
      const stop = () => { off(); this.readySubscriptions.delete(stop); };
      this.readySubscriptions.add(stop);
      return stop;
    },
  };
  readonly modelLifetime: AbortSignal;
  readonly canvasMirrorStore = createCanvasMirrorStore();
  get initialRenderReady() {
    return this.initialRenderReadyStore.getState();
  }

  private _isDisposed = false;
  private readonly viewLifetimeController = new AbortController();
  readonly disposeSignal = this.viewLifetimeController.signal;
  private _editingTextResizeObserver: ResizeObserver | undefined;

  private _nextFocusedTpl: TplNode | undefined;
  nextFocusedTpl() {
    return this._nextFocusedTpl;
  }

  editingComponentPartText?: CanvasPartTextEditor;
  get focusedComponentPart() {
    const part = this.selection.part();
    if (!part || this.focusedTpl() !== part.tpl) {
      return undefined;
    }
    const element = this.focusedDomElt()?.toArray().flatMap((root) =>
      root.matches(part.selector) ? [root] : Array.from(root.querySelectorAll<HTMLElement>(part.selector)),
    ).find((elt) => elt.isConnected);
    return element ? { ...part, element } : undefined;
  }
  setFocusedComponentPart(part: CanvasComponentPart | undefined) {
    this.editingComponentPartText?.finish();
    this.selection.setPart(part);
    this.publishEditorFocus();
  }
  private _highlightParamsDispose: (() => void) | undefined;
  get highlightParams() {
    return this.selection.highlight();
  }
  setHighlightParams(val: { params: Param[]; tpl: TplComponent } | undefined) {
    this._highlightParamsDispose?.();

    this.selection.setHighlight(val);

    if (val) {
      const timer = setTimeout(() => {
        this._highlightParamsDispose = undefined;
        this.selection.setHighlight(undefined);
      }, 2000);
      this._highlightParamsDispose = () => {
        clearTimeout(timer);
        this._highlightParamsDispose = undefined;
      };
    }
  }

  readonly textDataRequestsStore = createStore<Readonly<{
    editing: boolean | null;
    creating: ModelRef<DataToken> | null;
  }>>(() => Object.freeze({ editing: null, creating: null }));
  readonly editingTextStore = createEditingTextStore();

  readonly selection = new ViewSelection(() => this.studioCtx.modelSnapshots);
  get selectionStore() { return this.selection.store; }

  private get _focusedDomElts() { return this.selection.doms(); }
  private set _focusedDomElts(doms: readonly (JQuery | null)[]) { this.selection.setDoms(doms); }
  $hoveredDomElt() { return this.selection.hoverDom(); }
  hoveredSelectable() { return this.selection.hover(); }
  private get _focusedCloneKeys() { return this.selection.current().cloneKeys; }
  private set _focusedCloneKeys(keys: readonly (string | undefined)[]) {
    this.selection.setCloneKeys(keys);
    this.publishEditorFocus();
  }
  /**
   * @deprecated Use {@link focusedCloneKeys} to handle multi-selection.
   */
  focusedCloneKey() {
    return head(this._focusedCloneKeys);
  }

  private standaloneInspectorReads?: InspectorSelection;
  getInspectorReadOwner() {
    const selection = this.studioCtx.inspectorSelection;
    return selection?.viewCtx === this ? selection : (this.standaloneInspectorReads ??= new InspectorSelection(this, 0));
  }
  syncInspectorModel(changes: readonly ModelChange[]) {
    this.standaloneInspectorReads?.syncModel(changes);
  }

  focusedCloneKeys() {
    return this._focusedCloneKeys;
  }

  $measureToolDomElt() { return this.selection.measure(); }
  setMeasureToolDomElt(target: JQuery | null | undefined | Pt) { this.selection.setMeasure(target); }

  private _arenaFrame: ArenaFrame;

  arenaFrame() {
    return this._arenaFrame;
  }

  arenaFrameRoot() {
    return this.arenaFrame().container.component.tplTree;
  }

  /**
   * Whether this artboard shows its full page height, so code components may
   * render content they would otherwise keep inside an internal scroll viewport.
   * Canvas-only: never applies to interactive mode or exported renderings.
   */
  isFullContentView() {
    return (
      this.studioCtx.fullPageHeight &&
      isHeightAutoDerived(this.arenaFrame()) &&
      !this.studioCtx.isInteractiveMode &&
      !this.canvasExporting
    );
  }

  getContextData(val: ValComponent) {
    if (!isCodeComponent(val.tpl.component)) {
      return null;
    }
    return this.frameState.contextData.getStore(val.key).getState() ?? null;
  }

  getContextDataByValKey(valKey: string) {
    return this.frameState.contextData.getStore(valKey).getState();
  }

  private readonly contextDataSetters = new Map<string, (value: unknown) => void>();
  createSetContextDataFn(valKey: string) {
    const existing = this.contextDataSetters.get(valKey);
    if (existing) {
      return existing;
    }
    const update = (value: unknown) => {
      if (this.isDisposed) {
        return;
      }
      const oldValue = this.frameState.contextData.getStore(valKey).getState();
      if (isEqual(oldValue, value)) {
        return;
      }
      this.frameState.contextData.set(valKey, value);
      const selection = this.studioCtx.inspectorSelection;
      if (selection?.viewCtx === this) {
        selection.syncContextData(valKey);
      }
      this.standaloneInspectorReads?.syncContextData(valKey);
    };
    this.contextDataSetters.set(valKey, update);
    return update;
  }

  pointerState() {
    return this.studioCtx.pointerState();
  }
  setPointerState(pointerState: PointerState) {
    return this.studioCtx.setPointerState(pointerState);
  }

  setFreestyleState(state: FreestyleState | undefined) {
    return this.studioCtx.setFreestyleState(state);
  }
  freestyleState() {
    return this.studioCtx.freestyleState();
  }

  // dnd state
  readonly dndInsertionStore = createDndInsertionStore();
  getDndTentativeInsertion() {
    return this.dndInsertionStore.getState().tentativeInsertion;
  }
  setDndTentativeInsertion(ins?: InsertionSpec) {
    setDndTentativeInsertion(this, ins);
  }

  refreshFetchedDataFromPlasmicQuery(invalidateKey?: string) {
    this.canvasCtx.refreshFetchedDataFromPlasmicQuery(invalidateKey);
  }

  // Plain field: nothing subscribes to the dragged node (no `observer` reads
  // it), so it does not need MobX reactivity. Kept as an observable box it would
  // only add an atom and a dependency edge for nothing.
  private _dndDraggedNode: ValTag | ValComponent | undefined = undefined;
  getDndDraggedNode() {
    this._dndDraggedNode;
  }
  setDndDraggedNode(node?: ValTag | ValComponent) {
    this._dndDraggedNode = node;
  }

  // focusedTpl: TplNode | null;
  // focusedObject: SlotSelection | ValNode | null | undefined;
  get _focusedTpls() { return this.selection.tpls(); }
  set _focusedTpls(tpls: readonly (TplNode | null)[]) {
    if (!arrayEq(this.selection.tpls(), tpls)) {
      this.selection.setTpls(tpls);
      this.enforcePastingAsSibling = false;
      this.publishEditorFocus();
    }
  }

  focusedTplAncestorsThroughComponents() {
      const node = (() => {
        const selectables = withoutNils(this.focusedSelectables());
        if (selectables.length === 1) {
          const selectable = selectables[0];
          if (isSlotSelection(selectable)) {
            return selectable;
          } else {
            return selectable.tpl;
          }
        }
        const tpls = withoutNils(this.focusedTpls());
        if (tpls.length === 1) {
          return tpls[0];
        }
        return null;
      })();
      // Running `ancestorsThroughComponentsWithSlotSelections` every time focusedTpl changes may
      // be expensive, can we do better?
      return node
        ? Tpls.ancestorsThroughComponentsWithSlotSelections(node, {
            includeTplComponentRoot: true,
          })
        : [];
  }

  readonly autoOpenStore = createAutoOpenStore();
  private _autoOpenTransitioning = false;

  private _canvasExporting = false;
  get canvasExporting() { return this._canvasExporting; }
  setCanvasExporting(value: boolean) {
    this.studioCtx.renderPolicy.deferPublication(() => (() => {
      this._canvasExporting = value;
      this.studioCtx.prepareRenderPolicyInputs();
    })());
  }
  readonly contentEditor = new CanvasContentEditor(this);

  readonly canvasSessionState = new CanvasSessionState();
  readonly canvasRenderOwner = new CanvasRenderOwner(this.canvasSessionState);
  private publishEditorFocus() {
    this.studioCtx.notifyInspectorFocusChanged();
  }

  canvasOverlayOpen(fullKey: string) {
    return !!this.canvasSessionState.get(fullKey, "open");
  }

  syncCanvasOverlayState(
    fullKey: string,
    selectionOpen: boolean,
    nativeOpen: boolean | undefined,
    defaultOpen?: boolean,
  ) {
    this.canvasSessionState.resolve(fullKey, "open", nativeOpen, defaultOpen);
    return !!this.canvasSessionState.reveal(fullKey, "open", selectionOpen);
  }

  get hasShownHiddenContent() {
    return (
      !!this.autoOpenedUuid ||
      this.canvasSessionState.hasReveals
    );
  }

  hideShownHiddenContent() {
    this.canvasSessionState.hideReveals();
    this.forceCloseAutoOpen();
    this.scheduleSync({ eval: true, styles: false, asap: true });
  }

  setCanvasOverlayOpen(fullKey: string, open: boolean) {
    this.canvasSessionState.set(fullKey, "open", open, true);
    this.scheduleSync({ eval: true, styles: false, asap: true });
  }

  get autoOpenedUuid() {
    return this.autoOpenStore.getState().autoOpenedUuid;
  }

  set autoOpenedUuid(val: string | undefined) {
    if (val === this.autoOpenedUuid) {
      return;
    }
    if (val && this._autoOpenTransitioning) {
      this._autoOpenTransitioning = false;
    }
    this.autoOpenStore.setState({ autoOpenedUuid: val });
  }

  resetAutoOpenState() {
    this._autoOpenTransitioning = false;
    this.autoOpenedUuid = undefined;
    this.disabledAutoOpenUuid = undefined;
  }

  forceCloseAutoOpen() {
    this.disabledAutoOpenUuid = this.autoOpenedUuid;
    this.autoOpenedUuid = undefined;
  }

  /**
   * Disables auto-open behaviour for a specific uuid.
   * This can be used to temporarily disable auto-open behaviour, even when the auto open mode is enabled.
   */
  get disabledAutoOpenUuid() {
    return this.selection.current().disabledAutoOpenUuid;
  }

  set disabledAutoOpenUuid(val: string | undefined) {
    this.selection.setDisabledAutoOpen(val);
    this.publishEditorFocus();
  }

  maybeClearAutoOpenedContentOnSelectionChange(
    previousSelection: Selectable | null,
    newSelection: Selectable | null,
  ) {
    // The if block below handles Auto-opening of hidden element on next selection only after its visibility style has changed.
    if (!this.autoOpenedUuid) {
      // We don't always want to clear disabledAutoOpenUuid. There are certain cases where we should keep it regardless of selection change.
      // These cases are handled by the if/else-if blocks below
      if (
        !isSlotSelection(newSelection) &&
        newSelection?.tpl.uuid === this.disabledAutoOpenUuid
      ) {
        // NOTE: The user is on node-A in the outline tab, and they click on the visibility toggle of node-B
        // The visibility takes effect, setting disabledAutoOpenUuid,
        // The selection happens later. i.e. node selection happened after visibility toggle has taken effect.
        // since this is still the first selection of node-B while its visibility has changed, we want to keep the disabledAutoOpenUuid, so it stays hidden till its next selection.
        // So, do not clear auto-open state here
      } else if (!newSelection && this.disabledAutoOpenUuid) {
        // NOTE: This is the case with dynamic visibility,
        // when the data picker is opened and the expression evaluates to false, the disabledAutoOpenUuid is set.
        // when the data picker is closed, the newSelection is unnecessarily set to null for a bit (this technically does not make sense, but is the current behaviour)
        // we don't want to clear the disabledAutoOpenUuids in this case either, because the node-A
        // So, do not clear auto-open state here
      } else {
        this.resetAutoOpenState();
      }
      return;
    }

    // nothing previously auto-opened, no need to clear
    if (!previousSelection) {
      return;
    }

    // nothing selected, clear
    if (!newSelection) {
      this.resetAutoOpenState();
      return;
    }

    // If the first selection hasn't changed in multi-selection mode, no need to clear auto-opened content
    if (previousSelection === newSelection) {
      return;
    }

    const ancestor = this.focusedTplAncestorsThroughComponents()
      .map((item) => item.node)
      .find((tplOrSlotSel) =>
        isSlotSelection(tplOrSlotSel)
          ? tplOrSlotSel.slotParam.uuid === this.autoOpenedUuid
          : tplOrSlotSel.uuid === this.autoOpenedUuid,
      );

    // When we find an ancestor that matches the autoOpenedUuid:
    // 1. If this ancestor is NOT a TplComponent, keep the autoOpenedUuid - it represents the
    //    slot/tpltag containing the currently selected element
    // 2. If this ancestor IS a TplComponent, clear the autoOpenedUuid - the new selection might be
    //    in a trigger slot and we don't want to keep the component expanded
    if (ancestor && !isKnownTplComponent(ancestor)) {
      return;
    }

    // Defer clearing autoOpenedUuid to prevent banner flashing if a new UUID is set during render
    if (this.studioCtx.isAutoOpenMode && newSelection) {
      this._autoOpenTransitioning = true;

      // Clear after rendering has had a chance to set a new UUID
      setTimeout(() => {
        if (this._autoOpenTransitioning) {
          this.resetAutoOpenState();
        }
      }, 0);
    } else {
      this.resetAutoOpenState();
    }
  }

  get _focusedSelectables(): readonly (Selectable | null)[] {
    return this.selection.targets();
  }
  set _focusedSelectables(objs: readonly (Selectable | null)[]) {
    const current = this.selection.targets();
    this.selection.setTargets(objs);
    if (
      !arrayEq(objs, current, (a, b) => {
        if (a instanceof SlotSelection && b instanceof SlotSelection) {
          return (
            a.slotParam.uuid === b.slotParam.uuid && a.val?.key === b.val?.key
          );
        }
        return a === b;
      })
    ) {
      this.publishEditorFocus();
      this.tryBlurEditingText();

      // When using multi-selection, we only apply auto-open behavior to the first selected item, hence the use of 0 index.
      this.maybeClearAutoOpenedContentOnSelectionChange(current[0], objs[0]);
    }
  }

  readonly adopteeHighlightStore = createAdopteeHighlightStore();
  get _highlightedAdoptees(): readonly Adoptee[] {
    return this.adopteeHighlightStore.getState().adoptees;
  }
  set _highlightedAdoptees(adoptees: readonly Adoptee[]) {
    this.adopteeHighlightStore.setState({ adoptees });
  }

  get _currentComponentCtx() { return this.selection.context(); }
  set _currentComponentCtx(context: ComponentCtx | null) {
    this.selection.setContext(context);
    this.publishEditorFocus();
  }

  readonly variants = new ViewVariantState(
    () => this.studioCtx.modelSnapshots,
    () => this.arenaFrame(),
    () => this.site,
    () => this.studioCtx.hasPendingModelChanges(),
    () => !!this.frameState.valRootStore.getState(),
  );
  get variantStore() { return this.variants.store; }
  styleInputs = new ViewStyleInputs(() => this.studioCtx.modelSnapshots, this.disposeSignal);
  resetStyleInputs() {
    if (!this._isDisposed) { this.styleInputs = new ViewStyleInputs(() => this.studioCtx.modelSnapshots, this.disposeSignal); }
  }


  /** Install selection and variant snapshots before notifying either owner. */
  transactionSelectionInputs<Result>(command: () => Result): Result {
    return this.styleInputs.deferPublication(() => this.selection.deferPublication(() => this.variants.deferPublication(() => {
      const result = this.selection.transaction(() => this.variants.transaction(command));
      if (!this.studioCtx.hasPendingModelChanges()) { this.styleInputs.prepareCommit(); }
      return result;
    })));
  }

  _viewState: { viewingCode?: boolean };
  readonly canvasCtx: CanvasCtx;
  readonly frameState: FrameState;
  readonly viewOps: ViewOps;

  getViewOps() {
    return ensure(this.viewOps, "Unexpected nullish viewOps");
  }

  get styleMgr() {
    return this.studioCtx.styleMgrBcast;
  }
  get styleChanged() {
    return this.studioCtx.styleChanged;
  }
  get clipboard() {
    return this.studioCtx.clipboard;
  }

  get component() {
    return this.arenaFrame().container.component;
  }

  dbCtx() {
    return this.studioCtx.dbCtx();
  }

  enforcePastingAsSibling = false;

  constructor(args: ViewCtxArgs) {
    super();

    ({
      studioCtx: this.studioCtx,
      viewportCtx: this.viewportCtx,
      canvasCtx: this.canvasCtx,
      arenaFrame: this._arenaFrame,
    } = args);
    this.modelLifetime = this.studioCtx.arenaState.lifetime();
    this.frameState = this.canvasCtx.frameState;
    this.viewOps = new ViewOps({ viewCtx: this });
    this.csEvaluator = new DevCliSvrEvaluator({
      viewCtx: this,
      frameState: this.frameState,
    });
    this.variants.transaction(() => {
      this.variants.replaceFrames([new RootComponentVariantFrame(this.arenaFrame())]);
      this.variants.setGlobal(new GlobalVariantFrame(this.site, this.arenaFrame()));
    });
    this.setEditingTextContext(null);
    this._focusedDomElts = [];
    this._focusedTpls = [];
    // Either ValNode or SlotSelection
    this._focusedSelectables = [];
    this.selection.setHover(null, null);
    this._currentComponentCtx = null;
    this._viewState = {};

    const mirrorRoot = document.documentElement;
    const updateMirror = () => (() => {
      setCanvasMirrorTarget(this, mirrorRoot.getAttribute("data-plasmic-canvas-mirror") ?? undefined);
    })();
    const mirrorObserver = new MutationObserver(updateMirror);
    mirrorObserver.observe(mirrorRoot, { attributes: true, attributeFilter: ["data-plasmic-canvas-mirror"] });
    updateMirror();
    this.disposals.push(() => mirrorObserver.disconnect());

    // An overview needs every current artboard, independently of viewport clipping.
    const updateViewportVisibility = () => {
      if (this.isDisposed) { return; }
      if (!this.studioCtx.isTransforming() && this.isRenderActive()) {
        this.syncQueue.resume();
      } else {
        this.syncQueue.pause();
      }
    };
    const visibilityFrame = this.studioCtx.modelSnapshots.ref(this.arenaFrame());
    this.disposals.push(
      this.frameState.valRootStore.subscribe(() => this.variants.syncRuntime()),
      this.variants.subscribePrepared(() => this.styleInputs.prepareCommit()),
      this.variantStore.subscribe(() => this.styleInputs.publishCommit()),
      this.frameState.valRootStore.subscribe(() => { this.styleInputs.prepareCommit(); this.styleInputs.publishCommit(); }),
      this.csEvaluator.renderStatusStore.subscribe(() => { this.styleInputs.prepareCommit(); this.styleInputs.publishCommit(); }),
      this.selectionStore.subscribe((state, previous) => {
        const focusChanged = state.tpls !== previous.tpls || state.targets !== previous.targets || state.cloneKeys !== previous.cloneKeys || state.context !== previous.context || state.disabledAutoOpenUuid !== previous.disabledAutoOpenUuid;
        if (!this.isDisposed && state.tpls !== previous.tpls) {
          const frame = this.currentComponentStackFrame();
          if (frame.hasPrivateVariants()) { this.change(() => frame.clearPrivateVariants()); }
        }
        if (state.hoverDom !== previous.hoverDom) { this.studioCtx.syncHoveredViewCtx(); }
        if (focusChanged) {
          this.standaloneInspectorReads?.dispose();
          this.standaloneInspectorReads = undefined;
        }
        if (focusChanged || state.part !== previous.part || state.doms !== previous.doms) {
          this.publishEditorFocus();
        }
      }),
      subscribeViewport(this.studioCtx, (state) => state.visibleScalerBox, updateViewportVisibility),
      subscribeViewport(this.studioCtx, (state) => state.isTransforming, updateViewportVisibility),
      subscribeStudioArena(this.studioCtx, (state) => state.frames.includes(visibilityFrame), updateViewportVisibility),
      subscribeStudioLiveMode(this.studioCtx, updateViewportVisibility),
      subscribeStudioSelection(this.studioCtx, (state) => state.view === this, updateViewportVisibility),
      // Mirror target changes come from the DOM observer above; geometry changes
      // come from model edits (the arena frame layout). Both used to be tracked
      // by one MobX reaction.
      subscribeToSelector(
        this.canvasMirrorStore,
        (state) => state.target,
        updateViewportVisibility,
      ),
      this.studioCtx.modelRevisions.subscribeModelKeys([modelKeys.site], updateViewportVisibility),

    );
    // Replaces the reaction's `fireImmediately: true`.
    updateViewportVisibility();
  }

  canvasObservers = new Set<CanvasObserverLease>();
  private uncommittedCanvasObservers = new Map<CanvasObserverLease, ReturnType<typeof setTimeout>>();

  trackCanvasObserver(reaction: CanvasObserverLease) {
    if (this._isDisposed) {
      reaction.dispose();
      return;
    }
    this.canvasObservers.add(reaction);
    // An abandoned React render never runs effect cleanup. A render resumed
    // after this deadline recreates its reaction before tracking or committing.
    this.uncommittedCanvasObservers.set(reaction, setTimeout(() => {
      this.disposeCanvasObserver(reaction);
    }, 10000));
  }

  commitCanvasObserver(reaction: CanvasObserverLease) {
    clearTimeout(this.uncommittedCanvasObservers.get(reaction));
    this.uncommittedCanvasObservers.delete(reaction);
  }

  disposeCanvasObserver(reaction: CanvasObserverLease) {
    this.commitCanvasObserver(reaction);
    this.canvasObservers.delete(reaction);
    reaction.dispose();
  }

  /**
   * Disposes native render leases and cuts cyclic dependencies
   * as possible.
   */
  dispose() {
    this.editingComponentPartText?.finish(true);
    this.contentEditor.dispose();
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;
    this.viewLifetimeController.abort();
    for (const stop of this.readySubscriptions) { stop(); }
    this.styleInputs.dispose();
    this.textDataRequestsStore.setState(Object.freeze({ editing: null, creating: null }), true);
    this.selection.dispose();
    this.contextDataSetters.clear();
    this.standaloneInspectorReads?.dispose();
    this.variants.dispose();
    this.canvasRenderOwner.dispose();
    this.canvasSessionState.dispose();
    if (this.canvasRerenderFrame !== undefined) {
      cancelAnimationFrame(this.canvasRerenderFrame);
    }
    this._canvasRerenderQueue?.clear();
    this.canvasErrorObservers.clear();
    this.uncommittedCanvasObservers.forEach(clearTimeout);
    this.uncommittedCanvasObservers.clear();
    this.disposals.forEach((d) => d());
    this._highlightParamsDispose?.();
    this._editingTextResizeObserver?.disconnect();
    this.canvasObservers.forEach(
      (reaction) => !reaction.isDisposed && reaction.dispose(),
    );
    this.canvasObservers.clear();
    this.canvasCtx.dispose();
    disposeCanvasFactories(this);
    this.csEvaluator?.dispose();
    (this.csEvaluator as any) = null;
  }

  get isDisposed() {
    return this._isDisposed;
  }

  get globalFrame() { return this.variants.global(); }

  get isEditingNonBaseVariant() { return this.variants.isEditingNonBaseVariant(); }

  valComponentStack() {
    const currentValComponent = maybe(this.currentComponentCtx(), (cc) =>
      cc.valComponent(),
    );
    const owners =
      maybe(currentValComponent, (vc) => this.parentComponents(vc)) || [];
    const stack = [
      this.component ? this.valState().maybeValSysRoot() : undefined,
      ...owners.reverse(),
      currentValComponent,
    ].filter(Boolean);
    return ensureArrayOfInstances(stack, ValComponent);
  }

  tryBlurEditingText() {
    this.editingComponentPartText?.finish();
    const ctx = this.editingTextContext();
    if (!ctx) {
      return;
    }

    this.change(() => {
      this.getViewOps().saveText();

      ctx.val.handle?.exitEdit();

      this.canvasCtx.clearRange();
      this.setEditingTextContext(null);

      // Retain explicit model-command focus after editing. A queued change
      // must not steal focus from a panel input the user has already entered.
      if (document.activeElement instanceof HTMLIFrameElement) {
        this.studioCtx.canvasClipper().focus({ preventScroll: true });
      }
    });
  }

  /**
   * Set focus inside an ViewCtx by tpl.  You probably want setStudioFocusByTpl
   * instead, which also switches the studio to focus on this ViewCtx.
   */
  private setViewCtxFocusByTpl(
    x: TplNode | null,
    anchorCloneKey = this.focusedCloneKey(),
    opts: {
      appendToMultiSelection?: boolean;
      noRestoreRightTab?: boolean;
    } = {},
  ) {
    return this.transactionSelectionInputs(() => {
    this.setFocusedComponentPart(undefined);
    opts.appendToMultiSelection = !!opts.appendToMultiSelection;

    (() => {
      if (x != null) {
        const [valNode, doms] = this.maybeDomsForTpl(x, {
          anchorCloneKey,
        });

        if (opts.appendToMultiSelection) {
          let maybeIdxToDelete: number | undefined = undefined;
          for (let idx = 0; idx < this._focusedSelectables.length; idx++) {
            if (
              x === this._focusedTpls[idx] &&
              (anchorCloneKey ?? null) === this._focusedCloneKeys[idx]
            ) {
              maybeIdxToDelete = idx;
            }
          }

          if (maybeIdxToDelete) {
            this._focusedTpls = this._focusedTpls.filter((_value, index) => index !== maybeIdxToDelete);
            this._focusedSelectables = this._focusedSelectables.filter((_value, index) => index !== maybeIdxToDelete);
            this._focusedDomElts = this._focusedDomElts.filter((_value, index) => index !== maybeIdxToDelete);
            this._focusedCloneKeys = this._focusedCloneKeys.filter((_value, index) => index !== maybeIdxToDelete);
          } else {
            this._focusedTpls = [...this._focusedTpls, x];
            this._focusedSelectables = [...this._focusedSelectables, valNode];
            this._focusedDomElts = [
              ...this._focusedDomElts,
              doms ? $(doms) : null,
            ];
            this._focusedCloneKeys = [
              ...this._focusedCloneKeys,
              anchorCloneKey,
            ];
          }
        } else {
          const changed = this.focusedTpl() !== x;
          this._focusedTpls = [x];
          this._focusedSelectables = [valNode];
          this._focusedDomElts = [doms ? $(doms) : null];
          this._focusedCloneKeys = [anchorCloneKey];
          if (!opts.noRestoreRightTab && changed) {
            this.studioCtx.restoreLastElementTab();
          }
        }

        //if @_focusedDomElt?
        //  @_checkDomEltIsFocusable(@_focusedDomElt)
      } else if (!opts.appendToMultiSelection) {
        this._focusedDomElts = [];
        this._focusedSelectables = [];
        this._focusedTpls = [];
        this._focusedCloneKeys = [];
      }
    })();
    });
  }

  maybeDomsForTpl = (
    tpl: TplNode,
    opts: {
      anchorCloneKey?: string;
      ignoreFocusedCloneKey?: boolean;
    },
  ) => {
    const valNodes = this.maybeTpl2ValsInContext(tpl, opts);
    const valNode = valNodes.length > 0 ? valNodes[0] : null;
    return tuple(
      valNode,
      valNode
        ? this.renderState.sel2dom(valNode, this.canvasCtx, opts.anchorCloneKey)
        : null,
    );
  };

  maybeTpl2ValsInContext(
    x: TplNode,
    opts?: {
      allowAnyContext?: boolean;
      anchorCloneKey?: string;
      ignoreFocusedCloneKey?: boolean;
    },
  ) {
    // Controls may finish rendering while their frame is being detached.
    // A disposed frame has no rendered values and has released its evaluator.
    if (this.isDisposed || !this.valState().maybeValSysRoot()) {
      return [];
    }
    const vals = withoutNils([
      this.renderState.tpl2bestVal(
        x,
        opts?.anchorCloneKey ??
          (!opts?.ignoreFocusedCloneKey ? this.focusedCloneKey() : undefined),
      ),
    ]);
    if (!vals) {
      return [];
    }

    if (opts?.allowAnyContext) {
      return vals;
    }

    const curOwner = this.currentValComponent();
    return vals.filter((val) => val.valOwner?.key === curOwner.key);
  }

  get renderState() {
    return this.frameState.renderState;
  }

  /**
   * This will auto-pop frames off the drill stack as necessary.  It thus
   * assumes the TplNode to select is one along the drill stack so far.  This
   * should be unique since we have no recursion, and the UI currently only
   * supports selecting TplNodes that are in one of the drill stack frames.
   */
  setStudioFocusByTpl(
    x: TplNode | null,
    anchorCloneKey = this.focusedCloneKey(),
    opts: { appendToMultiSelection?: boolean } = {},
  ) {
    if (x && this.studioCtx.canvasContentEditor && !this.contentEditor.containsTpl(x)) {
      this.studioCtx.canvasContentEditor.exit();
    }
    this.popDrillForTpl(x);
    this.setViewCtxFocusByTpl(x, anchorCloneKey, opts);
    this.studioCtx.setStudioFocusOnViewCtxContent(this);
  }

  private popDrillForTpl(x: TplNode | null) {
    if (!x || !this.valState().maybeValSysRoot()) {
      this.setCurrentComponentCtx(null);
      return;
    }
    // Adjust component ctx for new Tpl focus.
    const c = $$$(x).owningComponent();
    const valFrames = this.valComponentStack();
    const targetValFrame = ensure(
      valFrames.find((f) => f.tpl.component === c),
      () =>
        `popDrillForTpl ${Tpls.summarizeTpl(
          x,
        )}: There must be a component frame for owning component ${
          c.name
        }; current frames: [${valFrames
          .map((f) => f.tpl.component.name)
          .join(",")}]`,
    );
    if (targetValFrame === valFrames[0]) {
      this.setCurrentComponentCtx(null);
    } else {
      this.setCurrentComponentCtx(
        new ComponentCtx({ valComponent: targetValFrame }),
      );
    }
  }

  setTriggerEditingTextDataPicker(x: boolean | null) {
    // The DataPicker is rendered by the TypogrpahySection.
    // Make sure TypographySection is rendered on the settings tab.
    if (x) {
      this.studioCtx.switchRightTab(RightTabKey.style);
    }
    this.textDataRequestsStore.setState((state) => state.editing === x ? state : Object.freeze({ ...state, editing: x }), true);
  }

  setTriggerCreatingTextDataToken(x: DataToken | null) {
    const creating = x ? this.studioCtx.modelSnapshots.ref(x) : null;
    this.textDataRequestsStore.setState((state) => state.creating === creating ? state : Object.freeze({ ...state, creating }), true);
  }

  getTriggerCreatingTextDataToken() {
    const creating = this.textDataRequestsStore.getState().creating;
    return creating ? this.studioCtx.modelSnapshots.resolve(creating) : null;
  }

  setEditingTextContext(x: EditingTextContext | null) {
    this.editingTextStore.setState({ editingTextContext: x });

    // Update canvas overlay to exclude the area of the text editor, to allow interactions with it.
    this._editingTextResizeObserver?.disconnect();
    if (x) {
      this._editingTextResizeObserver = new ResizeObserver(
        ([{ target }]: ResizeObserverEntry[]) => {
          this.canvasCtx.updateCanvasOverlay(target.getBoundingClientRect());
        },
      );

      this.renderState.val2dom(x.val, this.canvasCtx).forEach((domElt) => {
        this.canvasCtx.updateCanvasOverlay(domElt.getBoundingClientRect());
        this._editingTextResizeObserver?.observe(domElt);
      });
    } else {
      this.canvasCtx.resetCanvasOverlay();
    }
  }

  selectableToCloneKeys(
    val: Selectable | null | undefined,
    anchorCloneKey = this.focusedCloneKey(),
  ) {
    if (val) {
      return this.renderState.sel2CloneKeys(val, anchorCloneKey);
    }
    return [];
  }

  selectionDom(selectable: Selectable, cloneKey?: string): JQuery | null {
    const dom = this.renderState.sel2dom(selectable, this.canvasCtx, cloneKey);
    if (!dom) {
      return null;
    }
    const $dom = $(ensureArray(dom));
    const part = $dom.attr("data-plasmic-canvas-part");
    if (!part) {
      return $dom;
    }
    // Projected parts can render in several places (for example column cells).
    // The component declares the scope; every selection entry uses these bounds.
    return $dom
      .closest("[data-plasmic-canvas-part-scope]")
      .find("[data-plasmic-canvas-part]")
      .filter((_, element) => {
        const val = this.dom2val($(element));
        return (
          $(element).attr("data-plasmic-canvas-part") === part &&
          val instanceof ValNode &&
          val.tpl === selectable.tpl &&
          val.valOwner ===
            (selectable instanceof ValNode
              ? selectable.valOwner
              : selectable.val?.valOwner)
        );
      });
  }

  computeFocus(
    val: Selectable | null | undefined,
    anchorCloneKey: string | undefined = this.focusedCloneKey(),
  ) {
    if (!val) {
      return {
        val: null,
        focusedTpl: null,
        focusedDom: null,
        focusedClonedKey: null,
      };
    }
    if (val instanceof SlotSelection && val.tpl != null && val.val == null) {
      const maybeValComponent = maybe(
        this.renderState.tpl2bestVal(val.getTpl(), anchorCloneKey),
        (v) => ensureInstance(v, ValComponent),
      );
      if (maybeValComponent) {
        val = val.withVal(maybeValComponent);
      }
    }
    const focusedTpl = switchType(val)
      .when(SlotSelection, (_) => null)
      .when(ValNode, (v) => v.tpl)
      .result();
    // It's possible for val to exist but to render as an empty React
    // component that has no real DOM element (e.g. Overlay).
    const $focusedDom = this.selectionDom(val, anchorCloneKey);
    const focusedCloneKey =
      val && isValSelectable(val) ? this.sel2cloneKey(val) : undefined;
    return { val, focusedTpl, focusedDom: $focusedDom, focusedCloneKey };
  }

  /**
   * This will auto-pop frames off the drill stack as necessary.  It thus
   * assumes the ValNode to select is one along the drill stack so far.  This
   * should be unique since we have no recursion, and the UI currently only
   * supports selecting ValNodes that are in one of the drill stack frames.
   */
  setStudioFocusBySelectable(
    val: Selectable | null | undefined,
    anchorCloneKey = this.focusedCloneKey(),
    opts: { appendToMultiSelection?: boolean } = {},
  ) {
    if (val && !this.contentEditor.contains(val)) {
      this.studioCtx.canvasContentEditor?.exit();
    }
    this.popDrillForTpl(val ? tplFromSelectable(val) : null);
    this.setViewCtxFocusBySelectable(val, anchorCloneKey, opts);
    this.studioCtx.setStudioFocusOnViewCtxContent(this);
  }

  /** The candidates from a canvas layer query all share the current editing scope. */
  setStudioFocusByCanvasLayers(
    targets: readonly { target: Selectable; cloneKey: string | undefined }[],
    append: boolean,
  ) {
    this.transactionSelectionInputs(() => {
      const selectables = append ? [...this._focusedSelectables] : [];
      const tpls = append ? [...this._focusedTpls] : [];
      const doms = append ? [...this._focusedDomElts] : [];
      const keys = append ? [...this._focusedCloneKeys] : [];
      const identity = (target: Selectable | null) => makeSelectableFullKey(target) ?? target;
      const seen = new Set(selectables.map(identity));
      const previousLength = selectables.length;
      for (const { target, cloneKey } of targets) {
        const key = identity(target);
        if (seen.has(key)) {
          continue;
        }
        const focus = this.computeFocus(target, cloneKey);
        if (!focus.val) {
          continue;
        }
        seen.add(key);
        selectables.push(focus.val);
        tpls.push(focus.focusedTpl);
        doms.push(focus.focusedDom ?? null);
        keys.push(focus.focusedCloneKey ?? undefined);
      }
      if (append && selectables.length === previousLength) {
        return;
      }
      if (selectables.length === 0) {
        this.popDrillForTpl(null);
      }
      this.setFocusedComponentPart(undefined);
      this._focusedTpls = tpls;
      this._focusedDomElts = doms;
      this._focusedCloneKeys = keys;
      this._focusedSelectables = selectables;
      this.studioCtx.setStudioFocusOnViewCtxContent(this);
    });
  }

  /**
   * Restores the ViewCtx state according to the argument snapshot.  Note that
   * after restoring, the ValNodes may not match up with what is in ValState
   * anymore; someone needs to call updateCtxPostChange() to fix this.  Either
   * this is called right before eval (and eval will call updateCtxPostChange()
   * for you) or you have to do it yourself.
   */
  restoreViewState(view: ViewStateSnapshot) {
    return this.transactionSelectionInputs(() => {
    assert(
      view.focusedFrame === this.arenaFrame(),
      () => `Should only restore view state of focused frame`,
    );

    this.restoreCurrentComponentCtxAndStack(
      view.currentComponentCtx,
      ensure(
        view.vcComponentStack,
        () =>
          `View must have component stack if view included a focused view ctx`,
      ),
    );
    this.variants.setShowDefaultSlots(view.vcShowDefaultSlotContents ?? false);
    if (!view.focusedOnFrame) {
      if (
        view.focusedSelectable &&
        isTplAttachedToSite(this.site, asTpl(view.focusedSelectable))
      ) {
        this.setViewCtxFocusBySelectable(
          view.focusedSelectable,
          view.vcFocusedCloneKey,
        );
      } else if (
        view.nextFocusedTpl &&
        isTplAttachedToSite(this.site, view.nextFocusedTpl)
      ) {
        this.setViewCtxFocusByTpl(view.nextFocusedTpl);
      } else {
        this.setViewCtxFocusByTpl(null);
      }
      this.studioCtx.setStudioFocusOnViewCtxContent(this);
    }
    });
  }

  /**
   * See StudioCtx.pruneDetachedTpls().  After restoring an undo record,
   * we check all direct refences ViewCtx has on tpl nodes, and remove
   * those references of those nodes have been detached.
   */
  pruneDetachedTpls() {
    const focusedTpl = this.focusedTpl();
    if (focusedTpl && !isTplAttachedToSite(this.site, focusedTpl)) {
      this.setViewCtxFocusByTpl(null);
    }

    const componentCtx = this.currentComponentCtx();
    if (
      componentCtx &&
      !isTplAttachedToSite(this.site, componentCtx.tplComponent())
    ) {
      this.setCurrentComponentCtxQuietly(null);
    }

    const newStackFrames = this.componentStackFrames().filter((f) =>
      isTplAttachedToSite(this.site, f.tplComponent),
    );
    if (newStackFrames.length !== this.componentStackFrames().length) {
      this.variants.replaceFrames(newStackFrames);
    }
  }

  setViewCtxHoverBySelectable(
    val: Selectable | null | undefined,
    anchorCloneKey?: string,
  ) {
    return this.transactionSelectionInputs(() => {
    if (val && !this.contentEditor.contains(val)) {
      val = null;
    }
    const { focusedDom } = this.computeFocus(val, anchorCloneKey);
    this.selection.setHover(val, focusedDom);
    });
  }

  private setViewCtxFocusBySelectable(
    val: Selectable | null | undefined,
    anchorCloneKey?: string,
    opts: {
      appendToMultiSelection?: boolean;
      noRestoreRightTab?: boolean;
    } = {},
  ) {
    return this.transactionSelectionInputs(() => {
    if (!val || tplFromSelectable(val) !== this.focusedTpl() ||
        anchorCloneKey !== this.focusedCloneKey() || opts.appendToMultiSelection) {
      this.setFocusedComponentPart(undefined);
    }
    opts.appendToMultiSelection = !!opts.appendToMultiSelection;

    (() => {
      const {
        val: finalVal,
        focusedTpl,
        focusedDom,
        focusedCloneKey,
      } = this.computeFocus(val, anchorCloneKey);

      if (opts.appendToMultiSelection) {
        if (finalVal) {
          if (this._focusedSelectables.includes(finalVal)) {
            // Removing of multi selection
            const idx = this._focusedSelectables.indexOf(finalVal);
            this._focusedSelectables = this._focusedSelectables.filter((_value, index) => index !== idx);
            if (idx === 0) {
              this.resetAutoOpenState();
            }
            this._focusedTpls = this._focusedTpls.filter((_value, index) => index !== idx);
            this._focusedDomElts = this._focusedDomElts.filter((_value, index) => index !== idx);
            this._focusedCloneKeys = this._focusedCloneKeys.filter((_value, index) => index !== idx);
          } else {
            // Adding to multi selection
            this._focusedSelectables = [...this._focusedSelectables, finalVal];
            this._focusedTpls = [...this._focusedTpls, focusedTpl];
            this._focusedDomElts = [
              ...this._focusedDomElts,
              focusedDom ?? null,
            ];
            this._focusedCloneKeys = [
              ...this._focusedCloneKeys,
              focusedCloneKey,
            ];
          }
        }
      } else {
        if (finalVal) {
          const changed = this.focusedSelectable() !== finalVal;
          this._focusedSelectables = [finalVal];
          this._focusedTpls = [focusedTpl];
          this._focusedDomElts = [focusedDom ?? null];
          this._focusedCloneKeys = [focusedCloneKey];
          if (!opts.noRestoreRightTab && changed) {
            this.studioCtx.restoreLastElementTab();
          }
        } else {
          this._focusedSelectables = [];
          this._focusedTpls = [];
          this._focusedDomElts = [];
          this._focusedCloneKeys = [];
        }
      }
    })();
    });
  }
  clearViewCtxFocus() {
    return this.transactionSelectionInputs(() => {
    // Clear any drilled context on the viewCtx we're defocusing.
    this.setCurrentComponentCtxQuietly(null);
    this.setViewCtxFocusByTpl(null);
    this.setViewCtxHoverBySelectable(null);
    });
  }
  /**
   * @deprecated Use {@link focusedSelectables} to handle multi-selection.
   */
  focusedSelectable(): Selectable | null | undefined {
    return head(this._focusedSelectables);
  }
  focusedSelectables(): readonly (Selectable | null)[] {
    return this._focusedSelectables;
  }

  isStale() {
    return !this.valState().maybeValSysRoot() || !this.syncQueue.idle();
  }
  private mergeEvalArgs(optss: ViewCtxSyncArgs[]): ViewCtxSyncArgs {
    if (optss.length === 1) {
      return optss[0];
    }
    return {
      asap: optss.some((opts) => opts.asap),
      eval: optss.some((opts) => opts.eval),
      styles: optss.some((opts) => opts.styles),
    };
  }
  // Use a set to avoid multiple calls to the same function as it can be registered
  // due to several changes to observables.
  private _canvasRerenderQueue: Set<() => void> = new Set();
  private canvasErrorObservers = new Set<() => void>();
  subscribeToCanvasChanges(f: () => void) {
    if (!this._isDisposed) {
      this.canvasErrorObservers.add(f);
    }
    return () => this.canvasErrorObservers.delete(f);
  }
  private canvasRerenderFrame?: number;
  addRerenderObserver(f: () => void) {
    if (this._isDisposed) {
      return;
    }
    this._canvasRerenderQueue.add(f);
    this.scheduleObserverRefresh();
  }
  private scheduleObserverRefresh() {
    if (this._isDisposed || this.canvasRerenderFrame !== undefined) {
      return;
    }
    this.canvasRerenderFrame = requestAnimationFrame(() => {
      this.canvasRerenderFrame = undefined;
      if (this._isDisposed || !this._canvasRerenderQueue.size) {
        return;
      }
      if (!this.syncQueue.idle()) {
        // The evaluation pass will flush these observers, including paused frames.
        return;
      }
      if (this.studioCtx.hasPendingModelChanges()) {
        this.scheduleObserverRefresh();
        return;
      }
      this.flushRerenderQueue();
      (() => this.updateCtxPostChange())();
    });
  }
  flushRerenderQueue() {
    const rerenderFns = [...this._canvasRerenderQueue, ...this.canvasErrorObservers];
    this._canvasRerenderQueue.clear();
    this.canvasCtx.Sub.ReactDOM.unstable_batchedUpdates(() => {
      rerenderFns.forEach((f) => f());
    });
  }

  private async syncInternal(optss: ViewCtxSyncArgs[]) {
    const opts = this.mergeEvalArgs(optss);
    const doEval = async () => {
      if (this._isDisposed) {
        // The queue may still hold syncs scheduled before disposal.
        // csEvaluator is gone by now, so there's nothing left to evaluate.
        return;
      }
      console.log(
        `${this.tplMgr().describeArenaFrame(this.arenaFrame())}: Eval ${
          opts.asap ? "sync" : "async"
        } styles=${opts.styles} eval=${opts.eval}`,
      );
      if (opts.styles) {
        this.studioCtx.styleMgrBcast.upsertStyleSheets(this);
        if (this.isFocusedViewCtx()) {
          L.defer(() => this.studioCtx.styleChanged.dispatch());
        }
      }
      if (opts.eval) {
        const renderDone = this.studioCtx.loadTimings.begin(
          "frame-first-render",
          this.arenaFrame().uuid,
        );
        const registration = this.studioCtx.arenaState.viewRegistry.forFrame(this.arenaFrame());
        let completedFirstRender = false;
        this._evalInProgress = true;
        this.refreshRenderReadyAttr();
        try {
        await this.canvasCtx.hostLessPkgsLock;
        if (this.isDisposed) {
          return;
        }
        this.canvasCtx.syncFrameInfo(this);
        await this.csEvaluator.evalAsync();
        this.flushRerenderQueue();
        // Cross the same task boundary as evaluation without detaching the
        // post-eval promise: failures must release the sync queue too.
        await new Promise<void>((resolve) => defer(resolve));
        if (!this.isDisposed) {
          await this.studioCtx.change(
                () => {
                  if (!this.isDisposed) {
                    this.csEvaluator.runPostEvalTasks();
                    this.updateCtxPostChange();
                  }
                  return ok();
                },
                {
                  noUndoRecord: true,
                },
          );
        }
        if (
          !this.isDisposed &&
          !this.initialRenderReady &&
          this.valState().maybeValSysRoot()
        ) {
          completedFirstRender = true;
        }
        } finally {
          this._evalInProgress = false;
          const registry = this.studioCtx.arenaState.viewRegistry;
          if (completedFirstRender && !this.isDisposed &&
              this.studioCtx.arenaState.isCurrentLifetime(this.modelLifetime) &&
              registration?.view === this && registry.forFrame(this.arenaFrame()) === registration) {
            // Marker, native inputs and timing effects precede the first ready notification.
            this.refreshRenderReadyAttr(true);
            renderDone();
            this.studioCtx.recordCanvasFrameRendered(this.arenaFrame());
            this._initialRenderReady.setState(true, true);
          } else {
            this.refreshRenderReadyAttr();
          }
        }
      }
    };

    // The active artboard is user-visible work. Waiting for an idle deadline
    // before its first render can starve startup on a busy host. Subsequent
    // evaluations and background artboards retain the existing idle policy.
    if (opts.asap || (!this.initialRenderReady && this.arenaFrame() === this.studioCtx.activeCanvasFrame)) {
      await doEval();
    } else {
      await requestIdleCallbackAsync(async () => {
        if (this._isDisposed) {
          return;
        }
        if (
          this.studioCtx.isPanning() ||
          this.studioCtx.hasPendingModelChanges()
        ) {
          // We're in the middle of panning or other model changes, so this is less important;
          // let's not kick off any expensive operations right now
          console.log("Delaying VC eval");
          spawn(this.syncQueue.push(opts));
        } else {
          await doEval();
        }
      });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  private syncQueue = asynclib.cargo(
    safeCallbackify(async (args: ViewCtxSyncArgs[]) => {
      try {
        await this.syncInternal(args);
      } catch (error) {
        if (!this.isDisposed && this.studioCtx.arenaState.isCurrentLifetime(this.modelLifetime)) {
          this.studioCtx.reportCanvasFrameError(this.arenaFrame(), error);
        }
      }
    }),
  );

  scheduleSync(opts: ViewCtxSyncArgs) {
    if (!opts.eval && !opts.styles) {
      return;
    }
    spawn(this.syncQueue.push(opts));
    if (opts.eval) {
      // A re-render is pending; the canvas is not render-ready until it ends.
      setRenderReadyAttr(this.maybeCanvasDoc(), false);
    }
    if (opts.asap) {
      (this.syncQueue as any).process();
    }
  }

  async awaitSync() {
    this.syncQueue.resume();
    await drainQueue(this.syncQueue);
    if (!this._isDisposed && this._canvasRerenderQueue.size) {
      this.flushRerenderQueue();
      (() => this.updateCtxPostChange())();
    }
    this.refreshRenderReadyAttr();
  }

  private _evalInProgress = false;

  private maybeCanvasDoc(): Document | undefined {
    if (this._isDisposed) {
      return undefined;
    }
    try {
      return this.canvasCtx.doc() ?? undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Syncs RENDER_READY_ATTR on the canvas iframe. Pending syncs are counted by
   * queue length; the cargo worker running doEval is covered by
   * _evalInProgress, so this is safe to call from inside the worker.
   */
  private refreshRenderReadyAttr(initialRenderReady = this.initialRenderReady) {
    setRenderReadyAttr(
      this.maybeCanvasDoc(),
      isRenderReady({
        initialRenderReady,
        evalInProgress: this._evalInProgress,
        pendingSyncs: this.syncQueue.length(),
      })
    );
  }

  triggerEditingTextDataPicker() {
    return this.textDataRequestsStore.getState().editing;
  }

  editingTextContext() {
    return this.editingTextStore.getState().editingTextContext;
  }

  /**
   * Set `forDataRepCollection` if you want to get the canvasEnv with only
   * the items that can be used in the tpl dataRep collection field. This
   * argument is necessary because canvasEnv for a TplNode will contain
   * currentItem and currentIndex *after* the dataRep collection evaluation,
   * which we can't use for the dataRep collection field (it's like trying
   * to do `currentItem.map(currentItem => <Foo />)`).
   *
   */
  getCanvasEnvForTpl = (
    tpl: TplNode,
    opts?: {
      forDataRepCollection?: boolean;
      keep$StateRef?: boolean;
      anchorCloneKey?: string;
      ignoreFocusedCloneKey?: boolean;
    },
  ) => {
    const closestEnv = (() => {
        // Resolve the closest rendered value using the requested clone anchor.
        let bestTpl = tpl;
        let vals = this.maybeTpl2ValsInContext(bestTpl, opts);
        while (
          (!vals ||
            vals.length === 0 ||
            !vals[0].env ||
            !vals[0].wrappingEnv) &&
          bestTpl.parent
        ) {
          bestTpl = bestTpl.parent;
          vals = this.maybeTpl2ValsInContext(bestTpl, opts);
        }
        if (!vals || vals.length === 0) {
          return undefined;
        }
        const val = vals[0];
        if (
          bestTpl !== tpl &&
          val instanceof ValComponent &&
          val.slotCanvasEnvs.size > 0
        ) {
          // We couldn't get a corresponding `ValNode` for the `tpl`, but we
          // found a corresponding `ValNode` for an ancestor `TplComponent`
          // which provides data to the slots, so we will try to get the
          // `CanvasEnv` from `val.slotCanvasEnvs` in order to include the
          // provided data.
          let ancestorTpl = getAncestorSlotArg(tpl);
          while (ancestorTpl && ancestorTpl.tplComponent !== val.tpl) {
            ancestorTpl = getAncestorSlotArg(ancestorTpl.tplComponent);
          }
          if (
            ancestorTpl &&
            ancestorTpl.tplComponent === val.tpl &&
            val.slotCanvasEnvs.has(ancestorTpl.arg.param)
          ) {
            return ensure(
              val.slotCanvasEnvs.get(ancestorTpl.arg.param),
              () => `Already checked`,
            );
          }
        }
        const canvasEnv =
          opts?.forDataRepCollection && bestTpl === tpl
            ? val.wrappingEnv
            : val.env;
        return canvasEnv;
      })();

    if (!closestEnv) {
      return undefined;
    }
    if (opts?.keep$StateRef) {
      return closestEnv;
    }

    // we need to make all plasmic state proxy into aplain object to not mutate it
    // when evaluating exprs outside canvas
    const plainCanvasEnv = Object.fromEntries(
      Object.entries(closestEnv).map(([key, value]) => [
        key,
        // `is$StateProxy` calls `isValtioProxy` which might try to read
        // Plasmic proxy from `mkUndefinedDataProxy` which would throw
        // `PlasmicUndefinedDataError`, so we swallow it here
        swallow(() => this.canvasCtx.Sub.reactWeb.is$StateProxy(value))
          ? L.cloneDeep(value)
          : value,
      ]),
    ) as CanvasEnv;
    return plainCanvasEnv;
  };

  getComponentEvalContext(
    tpl: TplTag | TplComponent,
    param?: Param,
    options?: { anchorCloneKey?: string; ignoreFocusedCloneKey?: boolean },
  ): ComponentEvalContext {
    const linkedProps = isKnownTplComponent(tpl)
      ? getLinkedCodeProps(tpl.component)
      : undefined;
    const maybeLinkedProp = param
      ? linkedProps?.get(param.variable.name)
      : undefined;
    const actualTpl = maybeLinkedProp ? maybeLinkedProp[0] : tpl;
    const valComps = this.maybeTpl2ValsInContext(actualTpl, {
      allowAnyContext: true,
      ...options,
    });
    if (valComps && valComps[0] instanceof ValComponent) {
      const valComp = valComps[0];
      return {
        componentPropValues: valComp.codeComponentProps ?? {},
        invalidArgs: valComp.invalidArgs ?? [],
        ccContextData: this.getContextData(valComp) ?? null,
      };
    }
    return {
      componentPropValues:
        isKnownTplComponent(tpl) && isKnownTplComponent(actualTpl)
          ? evalUnrenderedCodeProps(this, tpl, actualTpl, options?.anchorCloneKey, !!options?.ignoreFocusedCloneKey)
          : {},
      invalidArgs: [],
      ccContextData: undefined,
    };
  }

  getCanvas$StateReferencesForTpl(tpl: TplNode) {
    const canvasEnv =
      this.getCanvasEnvForTpl(tpl, { keep$StateRef: true }) ?? {};
    return Object.fromEntries(
      Object.entries(canvasEnv).filter(([_key, val]) =>
        // `is$StateProxy` calls `isValtioProxy` which might try to read
        // Plasmic proxy from `mkUndefinedDataProxy` which would throw
        // `PlasmicUndefinedDataError`, so we swallow it here
        swallow(() => this.canvasCtx.Sub.reactWeb.is$StateProxy(val)),
      ),
    );
  }

  projectFlags() {
    return this.studioCtx.projectFlags();
  }

  private get$StateInEnv() {
    const component = this.currentComponent();
    const env = this.getCanvasEnvForTpl(component.tplTree, {
      keep$StateRef: true,
    });
    return this.canvasCtx.Sub.reactWeb.getStateCommandValue(env?.$state ?? {});
  }

  getCanvasStateValue(state: State) {
    const $state = this.get$StateInEnv();
    const statePath = getStateVarName(state).split(".");
    return generateStateValueProp($state, statePath);
  }

  setCanvasStateValue(state: State, val: any) {
    const $state = this.get$StateInEnv();
    const statePath = getStateVarName(state).split(".");
    generateStateOnChangeProp($state, statePath)(val);
  }

  getStateCurrentInitialValue(state: State) {
    const $state = this.get$StateInEnv();
    const statePath = getStateVarName(state).split(".");
    return this.canvasCtx.Sub.reactWeb.getCurrentInitialValue(
      $state,
      statePath,
    );
  }

  resetCanvasStateValue(state: State) {
    const $state = this.get$StateInEnv();
    const statePath = getStateVarName(state).split(".");
    return this.canvasCtx.Sub.reactWeb.resetToInitialValue($state, statePath);
  }

  hasUnstableStateInitializer(state: State) {
    return (
      this.canvasCtx.Sub.reactWeb.hasUnstableStateInitializer?.(
        this.get$StateInEnv(),
        getStateVarName(state).split("."),
      ) ?? false
    );
  }

  /**
   * @deprecated Use {@link focusedDomElts} to handle multi-selection.
   */
  focusedDomElt() {
    return head(this._focusedDomElts);
  }

  focusedDomElts() {
    return this._focusedDomElts;
  }

  /**
   * Checks if the focused element can be resized via dragging.
   *
   * Returns true only if:
   * 1. The Tpl type supports resizing (checked via isTplResizable)
   * 2. The current dimension values are draggable
   *
   */
  isFocusedResizeDraggable = () => {
    const selectable = this.focusedSelectable();
    if (!selectable || selectable instanceof SlotSelection || isFixedSlotRoot(this, selectable.tpl)) {
      return { width: false, height: false };
    }
    const vtm = this.variantTplMgr();
    const { height, width } = isTplResizable(selectable.tpl, vtm);

    if (!Tpls.isTplVariantable(selectable.tpl)) {
      return { height, width };
    }

    const effectiveVs = vtm.effectiveVariantSetting(selectable.tpl);
    const effectiveExpr = effectiveVs?.rshWithTheme();
    if (!effectiveExpr) {
      return { height, width };
    }

    const tokenRefResolver = makeTokenRefResolver(this.site);
    const heightVal = effectiveExpr.get("height");
    const widthVal = effectiveExpr.get("width");

    return {
      height:
        height && isDraggableSize(tokenRefResolver(heightVal) || heightVal),
      width: width && isDraggableSize(tokenRefResolver(widthVal) || widthVal),
    };
  };

  /**
   * @deprecated Use {@link focusedTpls} to handle multi-selection.
   *
   * If includeSlots is true, then also try getting the TplNode from
   * SlotSelection, if that's what's currently selected.
   */
  focusedTpl(includeSlots?: boolean): TplNode | null {
    if (includeSlots == null) {
      includeSlots = false;
    }
    if (includeSlots) {
      const focusObj = this.focusedSelectable();
      return (
        switchType(focusObj)
          .when(SlotSelection, (slotSelection) =>
            (slotSelection.val != null ? slotSelection.val.tpl : undefined) !=
            null
              ? slotSelection.val != null
                ? slotSelection.val.tpl
                : undefined
              : slotSelection.tpl,
          )
          .elseUnsafe(() => head(this._focusedTpls)) ?? null
      );
    } else {
      return head(this._focusedTpls) ?? null;
    }
  }
  focusedTpls(): readonly (TplNode | null)[] {
    return this._focusedTpls;
  }
  isFocusedViewCtx() {
    return this.studioCtx.focusedViewCtx() === this;
  }
  highlightedAdoptees() {
    return this._highlightedAdoptees;
  }
  setHighlightedAdoptees(adoptees: Adoptee[]) {
    this._highlightedAdoptees = adoptees;
  }

  isOutOfContext(tpl: TplNode) {
    const spotlightComponent = maybe(this.currentComponentCtx(), (ctx) =>
      ctx.component(),
    );
    return (
      !!spotlightComponent &&
      $$$(tpl).tryGetOwningComponent() !== spotlightComponent
    );
  }

  // null means that we're in the top-level context.  The page itself can
  // technically be thought of as a component, but it's not currently
  // represented that way.
  currentComponentCtx() {
    return this._currentComponentCtx;
  }
  private setCurrentComponentCtxQuietly(ctx: ComponentCtx | null) {
    return this.transactionSelectionInputs(() => {
    if (
      ctx === this._currentComponentCtx ||
      (!!ctx &&
        !!this._currentComponentCtx &&
        ctx.eq(this._currentComponentCtx))
    ) {
      return;
    }

    if (this._currentComponentCtx && !ctx) {
      // Always reset showDefaultSlotContents to false when we exit component ctx
      this.variants.setShowDefaultSlots(false);
    }
    this._currentComponentCtx = ctx;

    //
    // Now auto-maintain the component stack
    //
    if (ctx) {
      const existingIndex = this.componentStackFrames().findIndex(
        (f) => f.tplComponent === ctx.tplComponent(),
      );
      if (existingIndex >= 0) {
        // We're going up the stack
        this.variants.replaceFrames(
          this.componentStackFrames().slice(0, existingIndex + 1),
        );
        this.setViewCtxHoverBySelectable(null);
      } else {
        // We're adding a new component to the stack
        this.variants.replaceFrames([...this.componentStackFrames(), new TransientComponentVariantFrame(ctx.tplComponent())]);
      }
    } else {
      // We're exiting spotlight mode, so only the root should be on the stack
      this.variants.replaceFrames([this.componentStackFrames()[0]]);
      this.setViewCtxHoverBySelectable(null);
    }
    });
  }
  restoreCurrentComponentCtxAndStack(
    ctx: ComponentCtx | undefined,
    stack: ComponentVariantFrame[],
  ) {
    return this.transactionSelectionInputs(() => {
      this.setCurrentComponentCtxQuietly(ctx || null);
      this.variants.replaceFrames(stack.map((frame) => frame.clone()));
      this.variants.setGlobal(new GlobalVariantFrame(this.site, this.arenaFrame()));
    });
  }
  setCurrentComponentCtx(ctx: ComponentCtx | null) {
    return this.transactionSelectionInputs(() => {
    if (
      ctx === this._currentComponentCtx ||
      (!!ctx &&
        !!this._currentComponentCtx &&
        ctx.eq(this._currentComponentCtx))
    ) {
      return;
    }

    this.change(() => {
      // Clear focus before setting component ctx.
      this.setViewCtxFocusByTpl(null);
      this.setViewCtxHoverBySelectable(null);

      this.setCurrentComponentCtxQuietly(ctx);
    });
    });
  }

  showDefaultSlotContents() {
    return this.variants.showDefaultSlots();
  }
  setShowDefaultSlotContents(show: boolean) {
    this.change(() => {
      this.variants.setShowDefaultSlots(show);
    });
  }
  /**
   * Returns true if we are currently showing default slot contents for
   * `tplComponent`
   */
  showingDefaultSlotContentsFor(tplComponent: TplComponent) {
    return (
      // Either `tplComponent` is the root component -- in which case, we always show
      // default slot contents
      tplComponent === this.tplSysRoot() ||
      // Or, defaultSlotContents mode is turned on, and tplComponent is the
      // current component context
      (this.showDefaultSlotContents() &&
        this.componentStackFrames().some(
          (f) => f.tplComponent === tplComponent,
        ))
    );
  }
  /**
   * Returns true if we are currently showing default slot contents for
   * `component`
   */
  showingDefaultSlotContentsForComponent(component: Component) {
    return (
      // Either `tplComponent` is the root component -- in which case, we always show
      // default slot contents
      component === this.component ||
      // Or, defaultSlotContents mode is turned on, and tplComponent is the
      // current component context
      (this.showDefaultSlotContents() &&
        this.componentStackFrames().some(
          (f) => f.tplComponent.component === component,
        ))
    );
  }
  enterComponentCtxForVal(val: ValComponent, trigger: "alt+enter" | "menu") {
    const cloneKey =
      trigger === "alt+enter" ? this.focusedCloneKey() : undefined;
    this.setCurrentComponentCtx(new ComponentCtx({ valComponent: val }));
    if (val.contents && val.contents.length > 0) {
      this.setStudioFocusBySelectable(val.contents[0], cloneKey);
    } else {
      this.setStudioFocusByTpl(val.tpl.component.tplTree, cloneKey);
    }
    trackEvent("ComponentSpotlight", { trigger });
  }
  tagMeta() {
    return metaSvc;
  }
  // Misc view state
  viewState() {
    return this._viewState;
  }
  setViewState(viewState: any) {
    this._viewState = viewState;
  }
  stopUnlogged() {
    this.studioCtx.stopUnlogged();
  }

  startUnlogged() {
    this.studioCtx.startUnlogged();
  }
  isUnlogged() {
    return this.studioCtx.isUnlogged();
  }

  componentStackFrames() {
    return this.variants.frames();
  }

  currentComponentStackFrame() {
    return last(this.componentStackFrames());
  }

  /** Keep each artboard's interactive variants in its canvas-only root frame. */
  syncInteractiveVariants($state: $State) {
    return this.variants.transaction(() => {
    if (!this.component.variantGroups.some((group) => group.linkedState)) {
      return;
    }
    let root = this.componentStackFrames()[0];
    if (root instanceof RootComponentVariantFrame) {
      const transient = new TransientComponentVariantFrame(root.tplComponent);
      transient.setTargetVariants(root.getTargetVariants());
      transient.setPinnedVariants(root.getPinnedVariants());
      this.variants.replaceFrames([transient, ...this.componentStackFrames().slice(1)]);
      root = transient;
    }
    const valRoot = this.valState().maybeValSysRoot();
    new ClientPinManager(
      root,
      this.globalFrame,
      valRoot ? makeVariantEvalState(this, valRoot) : new Map(),
    ).setVariantsFrom$State($state);
    });
  }

  currentComponent() {
    return (
      maybe(this.currentComponentCtx(), (cc) => cc.component()) ||
      this.strictComponent()
    );
  }

  /**
   * Returns the "current" TplComponent, which is either the root TplComponent
   * for this frame, or if there's a currentComponentCtx(), the TplComponent
   * in the current context.
   */
  currentTplComponent() {
    return (
      maybe(this.currentComponentCtx(), (cc) => cc.tplComponent()) ||
      this.componentArgsContainer()
    );
  }

  currentValComponent() {
    return (
      maybe(this.currentComponentCtx(), (cc) => cc.valComponent()) ||
      this.valState().valSysRoot()
    );
  }

  /**
   * Creates the variant setting if it doesn't exist.
   */
  currentVariantSetting(tpl: TplNode) {
    return this.variantTplMgr().getCurrentVariantSetting(tpl);
  }

  /**
   * Returns either the variant setting for the current variant, or if none
   * exists, returns the base variant setting.  Only use for reading, not
   * for writing.
   */
  effectiveCurrentVariantSetting(tpl: TplNode) {
    return this.variantTplMgr().effectiveVariantSetting(tpl);
  }

  currentVariantSettingForFocus() {
    const tpl = ensureInstance(
      this.focusedTpl(true),
      TplTag,
      TplComponent,
      TplSlot,
    );
    const vs = this.currentVariantSetting(tpl);
    return vs;
  }

  private strictComponent() {
    return ensure(this.component, `Expected component to exist`);
  }

  // These root/userRoot/sysRoot are all from the topLevel component
  tplRoot() {
    return this.tplUserRoot();
  }
  tplUserRoot() {
    return this.strictComponent().tplTree;
  }
  tplSysRoot() {
    return this.componentArgsContainer();
  }

  // These root/userRoot/sysRoot are from the current component
  currentCtxTplUserRoot() {
    return this.currentComponent().tplTree;
  }
  currentCtxTplRoot() {
    return this.currentComponent().tplTree;
  }

  componentArgsContainer() {
    return this.arenaFrame().container;
  }

  getTplCodeComponentMeta(tpl: Tpls.TplCodeComponent) {
    return this.getCodeComponentMeta(tpl.component);
  }

  getCodeComponentMeta(comp: CodeComponent) {
    return this.canvasCtx.getRegisteredCodeComponentsMap().get(comp.name)?.meta;
  }

  /**
   * When a brand new Tpl is inserted, we have to wait until it's rendered
   * to select it.  Since any Tpl can result in multiple Vals, we determine the
   * best one to select by using the current selection as an anchor.
   *
   * @param useParentAsAnchor Normally we call bestValForTpl with initialSel
   *   being just the current val selection, but if the corresponding val node
   *   with that key will no longer exist in the newly rendered val tree, then
   *   we instead use the current val selection's parent node as the anchor.
   *   It's a little smarter than just passing initialFocusedSelectable =
   *   SQ(focusedObject).parent() since it handles edge cases like when we're at
   *   the root of a component.
   *
   * @param initialFocusedSelectable Use this instead of the true
   * viewCtx.focusedSelectable.  useParentAsAnchor can still be set to true, in
   * which case the parent calculation is based on this instead of the real
   * focusedSelectable.
   *
   * @param preserveCloneKey Whether to use the `focusedCloneKey` to compute the
   *  new selection.
   */
  selectNewTpl(
    newTpl: TplNode,
    useParentAsAnchor = false,
    initialFocusedSelectable = this.focusedSelectable(),
    preserveCloneKey?: boolean,
  ) {
    if (Tpls.isTplVariantable(newTpl)) {
      // need this since style-tab rely on the current VariantSetting to exist.
      // fixupChrome doesn't guarantee this since at that time, newTpl is not
      // yet selected.
      this.variantTplMgr().ensureCurrentVariantSetting(newTpl);
    }

    const cloneKey = preserveCloneKey ? this.focusedCloneKey() : undefined;

    // Immediately set focus by tpl, even though there may not be a corresponding
    // ValNode yet.  This is so that after newTpl is created but before evaluation
    // has finished, the focusedTpl() is pointing to the correct tpl instead
    // of some stale tpl that may no longer be a valid selection.  Example:
    // when converting something into a slot, that something may be be detached
    // from the tpl tree in the process.
    //
    // And we add a postEval() to "fix up" the correct reference to the
    // corresponding val node after evaluation is done.
    this.setStudioFocusByTpl(newTpl, cloneKey);

    // Function called to fix up our undo view state to point
    // to the new selectable, instead of tracking the nextFocusedTpl
    const fixUndoViewState = () => {
      this._nextFocusedTpl = undefined;
      this.studioCtx.createViewStateUndoRecord();
    };

    this._nextFocusedTpl = newTpl;
    const simpleSelect = () => {
      this.postEval(() => {
        if (this.focusedTpl() === newTpl) {
          this.setStudioFocusByTpl(newTpl, cloneKey);
          fixUndoViewState();
        }
      });
    };

    if (
      !initialFocusedSelectable ||
      !isValSelectable(initialFocusedSelectable)
    ) {
      // No existing val selection, so just directly select the tpl.
      return simpleSelect();
    }

    const initialValNode = ensureInstance(
      asVal(initialFocusedSelectable),
      ValNode,
    );
    const initialSq = SQ(initialValNode, this.valState()).fullstack();
    const frameNum = initialSq.frameNum();

    let anchorValNode = initialValNode;

    if (useParentAsAnchor) {
      const valParent = initialSq.parent().tryGet();

      if (!valParent || !(valParent instanceof ValNode)) {
        // No parent means this is the top-most element already in the
        // document.  Trivial to just select it directly.
        return simpleSelect();
      }

      const parentFrameNum = initialSq.parent().frameNum();

      // bestValForTpl only works when the initial val we're selecting relative
      // to is in a frame that is at or above the current frame (see that
      // function for an explanation).
      //
      // Normally we rely on the parent being in the same frame.  But if the
      // removed ValNode is a component root, then the parent is in a higher
      // frame (the parent is another ValComponent, different from the one
      // being inserted!).  Womp womp.  So we special case this code path to
      // just select the child we inserted.

      if (parentFrameNum !== frameNum) {
        this.postEval(() => {
          if (this.focusedTpl() === newTpl) {
            this.setStudioFocusBySelectable(
              SQ(this.renderState.tryGetUpdatedVal(valParent), this.valState())
                .fullstack()
                .firstChild()
                .tryGet(),
              cloneKey,
            );
            fixUndoViewState();
          }
        });
        return;
      }

      anchorValNode = valParent;
    }

    this.postEval(() => {
      if (this.focusedTpl() === newTpl) {
        // The anchor may not exist at the same key anymore in the new ValState
        const initialSel = this.renderState.tryGetUpdatedVal(anchorValNode);
        if (initialSel) {
          const bestVal = bestValForTpl(
            newTpl,
            frameNum,
            this.valState(),
            initialSel,
            this.tplUserRoot(),
          );
          // It's possible that bestVal returns undefined because of a inconsistency in valNodes caused by fake nodes created
          // by globalHook, since the fake nodes are linked in the tree only for properly detecting the owner (valOwner) of
          // a given element, they don't have parent links. In this case, we just select the newTpl directly without heuristics.
          if (bestVal) {
            this.setStudioFocusBySelectable(bestVal, cloneKey);
          } else {
            this.setStudioFocusByTpl(newTpl, cloneKey);
          }
        } else {
          this.setStudioFocusByTpl(newTpl, cloneKey);
        }
        fixUndoViewState();
      }
    });
  }

  /**
   * Select nodes after they were pasted or drag-n-dropped. This uses
   * `postEval` because nodes are not rendered before evaluation when
   * they're being inserted.
   */
  selectNewTpls(tpls: TplNode[]) {
    for (let i = 0; i < tpls.length; i++) {
      this.setStudioFocusByTpl(tpls[i], undefined, {
        appendToMultiSelection: i !== 0,
      });
    }
    this.postEval(() => {
      for (let i = 0; i < tpls.length; i++) {
        this.setStudioFocusByTpl(tpls[i], undefined, {
          appendToMultiSelection: i !== 0,
        });
      }
    });
  }

  selectFromSelectionId(selectableKey?: string) {
    if (this.hasValState) {
      this.setStudioFocusBySelectable(
        this.getSelectableFromSelectionId(selectableKey),
      );
      return;
    }
    this.postEval(() => {
      this.setStudioFocusBySelectable(
        this.getSelectableFromSelectionId(selectableKey),
      );
    });
  }

  getSelectableFromSelectionId(selectableKey?: string) {
    const tryGetSelectableFromKey = (key: string) => {
      const maybeVal = this.renderState.fullKey2val(key);
      if (maybeVal) {
        return maybeVal;
      }
      // Try get a SlotSelection
      const [valCompKey, paramUuid] = key.split("~");
      if (!valCompKey || !paramUuid) {
        return undefined;
      }
      const valComp = this.renderState.fullKey2val(valCompKey);
      if (!valComp || !(valComp instanceof ValComponent)) {
        return undefined;
      }
      const param = valComp.tpl.component.params.find(
        (p) => p.uuid === paramUuid,
      );
      if (!param) {
        return undefined;
      }
      return new SlotSelection({ slotParam: param, val: valComp });
    };
    return selectableKey
      ? tryGetSelectableFromKey(selectableKey)
      : this.valState().maybeValUserRoot();
  }

  /**
   * Tries to re-pick and set the focusedDomElts based on the current
   * focusedSelectable. Useful for when focusedSelectable/tpl
   * have been set, but focusedDomElts have not yet because rendering has
   * not finished.
   */
  recomputeFocusedDomElts() {
    if ((this.focusedSelectables()?.length ?? 0) > 1) {
      // TODO(multi)
      return false;
    }

    // Hidden slot/overlay content can mount after its selection observers flush.
    // Resolve its ValNode as well as its DOM once that content becomes available.
    const pendingTpl = !this.focusedSelectable() && this.focusedTpl();
    if (pendingTpl) {
      this.setViewCtxFocusByTpl(pendingTpl, this.focusedCloneKey(), {
        noRestoreRightTab: true,
      });
    }

    const newDoms = this.computeFocus(
      this.focusedSelectable(),
      this.focusedCloneKey(),
    ).focusedDom;
    const focusedDomElt = this.focusedDomElt();
    if (
      !newDoms ||
      !focusedDomElt ||
      !arrayEq(Array.from(focusedDomElt), Array.from(newDoms))
    ) {
      this._focusedDomElts =
        this.focusedSelectables()?.length === 1 ? [newDoms ?? null] : [];
      return true;
    }
    return !!pendingTpl && !!this.focusedSelectable();
  }

  change(f: () => void) {
    this.studioCtx.changeSpawn(() => {
      // Only invoke f if this ViewCtx has not been disposed in the meanwhile
      if (!this._isDisposed) {
        f();
      }
    });
  }

  changeSelection(f: () => void) {
    this.studioCtx.changeSelection(() => {
      if (!this._isDisposed) {
        f();
      }
    });
  }

  private _dndMgr: any;
  _unsafeDndMgr() {
    return this._dndMgr;
  }
  _unsafeSetDndMgr(dndMgr: any) {
    this._dndMgr = dndMgr;
  }

  bundleAllForTransport() {
    const allBundle = this.studioCtx.bundleSite() as any;
    allBundle.siteId = this.siteInfo.id;
    return allBundle;
  }

  eltFinder = (val: ValNode) => {
    return this.renderState.sel2dom(val, this.canvasCtx);
  };

  postEval(f: () => any) {
    this.csEvaluator.addPostEval(f);
  }

  valState() {
    return this.csEvaluator.valState();
  }

  /**
   * Returns a CmpTplMgr that is variant-aware.  If we are creating a TplTag
   * while a non-base variant is selected, we make it conditionally shown only
   * in this variant.
   */
  variantTplMgr(fixdComponentStackFrames?: boolean) {
    return new VariantTplMgr(
      fixdComponentStackFrames
        ? this.componentStackFrames().slice()
        : this.componentStackFrames(),
      this.site,
      this.tplMgr(),
      this.globalFrame,
      this.getCanvasEnvForTpl,
    );
  }

  /** Resolve a hover's rendered variants without entering its component owners. */
  hoverVariantTplMgr(selectable: Selectable) {
    const currentFrames = this.componentStackFrames();
    const owners = SQ(selectable, this.valState()).ownersArrayUp().reverse();
    const frames = [
      currentFrames[0],
      ...owners.map(
        (owner) =>
          currentFrames.find((frame) => frame.tplComponent === owner.tpl) ??
          new TransientComponentVariantFrame(owner.tpl),
      ),
    ];
    return new VariantTplMgr(
      frames,
      this.site,
      this.tplMgr(),
      this.globalFrame,
      this.getCanvasEnvForTpl,
    );
  }

  /**
   * After re-rendering, updates all references to ValNodes in ViewCtx with
   * updated ValNodes from ValState.  Also fixes up what should be in focus.
   *
   * This should be called from cseval after eval-render pass.  At this
   * stage, the valState() has the new valnodes.
   */
  updateCtxPostChange() {
    return this.transactionSelectionInputs(() => {
    try {
    // Helper function that tries to return the new ValNode with the argument key
    const getMatchingValInUpdatedTree = <T extends ValNode>(
      valNode: T,
    ): T | undefined => {
      return this.renderState.tryGetUpdatedVal(valNode);
    };

    // Helper function that checks if tpl is in the current component context
    const tplInContext = (tpl: TplNode) =>
      $$$(tpl).ancestors().last().get(0) === this.currentCtxTplRoot();

    // First, we fix up ComponentCtx, which has a reference to ValComponent
    const curCompCtx = this.currentComponentCtx();
    if (curCompCtx != null) {
      // This may set the context to null if the ValComponent no longer exists.
      const newValComponent = getMatchingValInUpdatedTree(
        curCompCtx.valComponent(),
      );
      if (newValComponent) {
        if (curCompCtx.valComponent() !== newValComponent) {
          this._currentComponentCtx = new ComponentCtx({
            valComponent: newValComponent as ValComponent,
          });
        }
      } else {
        // It is ok to clear the viewCtx context - the setTplVisibility event
        // will be propagate to parent and trigger a re-focus event.
        this.clearViewCtxFocus();
        return;
      }
    }

    const getUpdatedMatchingSelectable = (obj: Selectable) => {
      return switchType(obj)
        .when(SlotSelection, (slotSelection: /*TWZ*/ SlotSelection) => {
          if (slotSelection.val != null) {
            const val = getMatchingValInUpdatedTree(slotSelection.val);
            if (val != null) {
              return slotSelection.withVal(ensureInstance(val, ValComponent));
            } else {
              return null;
            }
          } else {
            return slotSelection;
          }
        })
        .when(ValNode, (valNode) => getMatchingValInUpdatedTree(valNode))
        .result();
    };

    // Next, we fix up focused selectables.
    const objs = this.focusedSelectables();
    const tpls = this.focusedTpls();
    const cloneKeys = this.focusedCloneKeys();
    let focusedCount = 0;
    for (let i = 0; i < objs.length; i++) {
      const obj = objs[i];
      const tpl = tpls[i];
      const cloneKey = cloneKeys[i];

      if (obj) {
        const newObj = getUpdatedMatchingSelectable(obj);

        if (newObj) {
          this.setViewCtxFocusBySelectable(newObj, cloneKey, {
            appendToMultiSelection: focusedCount > 0,
            noRestoreRightTab: true,
          });
          focusedCount++;
        } else {
          // If we can't map the old Selectable to a new Selectable, then the
          // val no longer exists; but maybe its tpl still does! So try to see if the
          // tpl is still there.  This is important for when you are causing the dataRep or
          // dataCond to no longer generate that val - you still want to be
          // able to keep editing that tpl, rather than have it disappear on
          // you suddenly in the right pane.
          if (obj instanceof SlotSelection && tplInContext(obj.getTpl())) {
            this.setViewCtxFocusBySelectable(obj.valToTpl(), undefined, {
              appendToMultiSelection: focusedCount > 0,
              noRestoreRightTab: true,
            });
            focusedCount++;
          } else if (obj instanceof ValNode && tplInContext(obj.tpl)) {
            this.setViewCtxFocusByTpl(obj.tpl, undefined, {
              appendToMultiSelection: focusedCount > 0,
              noRestoreRightTab: true,
            });
            focusedCount++;
          }
        }
      } else if (tpl && tplInContext(tpl)) {
        // It's possible that there's a focused tpl, but no corresponding focusedSelectable,
        // because at the time of focus, we were still rendering the val tree so did not find
        // a corresponding valnode.  If so, set it now.
        this.setViewCtxFocusByTpl(tpl, undefined, {
          appendToMultiSelection: focusedCount > 0,
          noRestoreRightTab: true,
        });
        focusedCount++;
      }
    }
    if (objs.length > 0 && !focusedCount) {
      // Finally, if all else failed, select the root node
      this.setViewCtxFocusByTpl(this.currentCtxTplUserRoot(), undefined, {
        noRestoreRightTab: true,
      });
    }

    // Next, we fix up the hovered Selectable
    const hoveredObj = this.hoveredSelectable();
    if (hoveredObj) {
      const newObj = getUpdatedMatchingSelectable(hoveredObj);
      // We don't try as hard to match this to an updated selectable as we do for
      // focused selectable, as we don't care that much about the hovered object.
      // If there's nothing matching, so be it.
      this.setViewCtxHoverBySelectable(newObj);
    }

    const editingTextContext = this.editingTextContext();
    if (editingTextContext) {
      const newVal =
        getMatchingValInUpdatedTree(editingTextContext.val!) ?? null;
      if (newVal) {
        if (newVal !== editingTextContext.val) {
          this.setEditingTextContext({
            val: newVal,
            targetVs: editingTextContext.targetVs!,
            draftText: maybe(newVal.text, (text) =>
              ensureInstance(text, RawText, RawTextLike),
            ),
            run: undefined,
            editor: undefined,
          });
        }
      } else {
        this.setEditingTextContext(null);
      }
    }
    } finally {
      this.publishEditorFocus();
      const selection = this.studioCtx.inspectorSelection;
      if (selection?.viewCtx === this) {selection.syncCanvas();}
      this.standaloneInspectorReads?.syncCanvas();
    }
    });
  }

  /**
   * Returns useful information to decide whether or not a frame needs to be
   * re-rendered after a change.
   */
  getSpotlightAndVariantsInfo(): SpotlightAndVariantsInfo {
    const lastComponentFrame = ensure(
      L.last(this.componentStackFrames()),
      () => `Must be at least one component stack frame in spotlight mode`,
    );
    return {
      componentStackFrameLength: this.componentStackFrames().length,
      lastComponentFrame,
      viewMode: this.arenaFrame().viewMode,
      showDefaultSlotContents: this.showDefaultSlotContents(),
      pinnedVariants: {
        ...lastComponentFrame.getPlainPins(),
        ...this.arenaFrame().pinnedGlobalVariants,
        ...Object.fromEntries(
          lastComponentFrame
            .getTargetVariants()
            .map((v) => tuple(v.uuid, true)),
        ),
        ...Object.fromEntries(
          this.arenaFrame().targetGlobalVariants.map((v) =>
            tuple(v.uuid, true),
          ),
        ),
      },
    };
  }

  focusedTplOrSlotSelection() {
    const focusedSelectable = this.focusedSelectable();
    return focusedSelectable instanceof SlotSelection
      ? focusedSelectable
      : this.focusedTpl();
  }

  focusedTplsOrSlotSelections() {
    return this._focusedSelectables.map((sel, i) =>
      sel instanceof SlotSelection ? sel : this._focusedTpls[i],
    );
  }

  isRenderActive() {
    const target = this.canvasMirrorStore.getState().target;
    return this.isVisible() || (target === "all" || target === this.arenaFrame().uuid) &&
      getArenaFrames(this.studioCtx.currentArena).includes(this.arenaFrame());
  }

  isVisible() {
    if (
      !getArenaFrames(this.studioCtx.currentArena).includes(this.arenaFrame())
    ) {
      return false;
    }

    if (this.studioCtx.isLiveMode && this.studioCtx.focusedViewCtx() === this) {
      return true;
    }

    const visibleScalerBox = this.viewportCtx.visibleScalerBox();
    const frameScalerRect = this.studioCtx.getArenaFrameScalerRect(
      this.arenaFrame(),
    );
    return frameScalerRect
      ? rectsIntersect(visibleScalerBox.rect(), frameScalerRect)
      : true;
  }

  ancestorComponents(valNode: /*TWZ*/ ValComponent | ValComponent) {
    const first = valNode instanceof ValComponent ? [valNode] : [];
    return [...[...first], ...[...this.valState().valOwners(valNode)]];
  }
  // Goes bottom-up, from given node to root, excluding given node.
  parentComponents(valNode: ValNode): ValComponent[] {
    return this.valState().valOwners(valNode);
  }

  get hasValState() {
    return !!this.valState().maybeValSysRoot();
  }

  customFunctionsSchema() {
    return this.studioCtx.customFunctionsSchema();
  }

  get customFunctions() {
    return this.canvasRenderOwner.functionInputs(this).store.getState();
  }

  // Fiber Related methods

  dom2val<T extends object = HTMLElement>(
    $dom: JQuery<T>,
  ): Selectable | undefined {
    return this.dom2focusObj($dom);
  }
  dom2tpl<T extends object = HTMLElement>($dom: JQuery<T>) {
    return ensure(this.dom2val($dom), "Couldn't find ValNode from DOM").tpl;
  }
  dom2focusObj<T extends object = HTMLElement>(
    $dom: /*TWZ*/ JQuery<T>,
  ): ValNode | SlotSelection | undefined {
    for (const elt of $dom.toArray()) {
      // React attaches the fiber node associated to the DOM node it renders
      // It can be found as an entry whose key starts with __reactInternalInstance$
      // (or __reactFiber$ for React 17)
      const key = Object.keys(elt).find(
        (k) =>
          k.startsWith("__reactInternalInstance$") ||
          k.startsWith("__reactFiber$"),
      );
      if (!key) {
        continue;
      }
      const maybeSelectable = this.fiberNodeToPlasmicData(elt[key]);
      if (maybeSelectable) {
        return maybeSelectable;
      }
    }
    return undefined;
  }
  sel2cloneKey(sel: Selectable | undefined | null) {
    if (!sel) {
      return undefined;
    } else if (sel instanceof SlotSelection) {
      return `${ensure(sel.val, `must be a val SlotSelection`).fullKey}~${
        sel.slotParam.uuid
      }`;
    } else {
      return sel.fullKey;
    }
  }

  /**
   * Similar to `instanceof Element` but also checks for Sub.Element
   */
  isElement(v: any): v is Element {
    return (
      v instanceof Element ||
      (!!this.canvasCtx.Sub.localElement &&
        v instanceof this.canvasCtx.Sub.localElement)
    );
  }

  private fiberNodeToPlasmicData(
    fiber: Fiber,
  ): ValNode | SlotSelection | undefined {
    let initialNode = true;
    // The ValNode might be passed to the enclosing component that rendered
    // this element, so go up in the Fiber tree.
    while (fiber) {
      fiber = getMostRecentFiberVersion(fiber);
      const selectable: ValNode | undefined =
        globalHookCtx.fiberToVal.get(fiber);
      if (selectable) {
        return selectable;
      }

      const slotPlaceholderKey =
        globalHookCtx.fiberToSlotPlaceholderKeys.get(fiber);
      if (slotPlaceholderKey) {
        const slotSelection = slotPlaceholderKey.toSlotSelection();
        const valComponentStack = slotSelection ? this.valComponentStack() : [];
        if (
          slotSelection &&
          (valComponentStack.length === 0 ||
            slotSelection.val !==
              valComponentStack[valComponentStack.length - 1])
        ) {
          return slotSelection;
        }
      }

      if (!fiber.return || (!initialNode && this.isElement(fiber.stateNode))) {
        // Exit if we hit another DOM node
        break;
      }
      fiber = fiber.return;
      initialNode = false;
    }
    return undefined;
  }


}

export interface ViewComponentProps {
  viewCtx: ViewCtx;
}

export function ensureBaseRs(
  viewCtx: ViewCtx,
  tpl: TplTag | TplComponent,
  props: CSSProperties = {},
  text: RichText | undefined = undefined,
) {
  const vs = viewCtx.variantTplMgr().ensureBaseVariantSetting(tpl);
  if (L.size(props) > 0 || !!text) {
    if (text) {
      vs.text = text;
    }
    RSH(vs.rs, tpl).merge(props);
  }
  return vs.rs;
}

export function ensureVariantRs(
  viewCtx: ViewCtx,
  tpl: TplTag | TplComponent,
  variant: Variant,
  props: CSSProperties = {},
) {
  const vs = viewCtx.variantTplMgr().ensureVariantSetting(tpl, [variant]);
  if (L.size(props) > 0) {
    RSH(vs.rs, tpl).merge(props);
  }
  return vs.rs;
}

export function getSetOfPinnedVariantsForViewCtx(
  viewCtx: ViewCtx,
  bundler: FastBundler,
) {
  return sortBy(
    [
      ...viewCtx.currentComponentStackFrame().getPinnedVariants().keys(),
      ...viewCtx.globalFrame.getPinnedVariants().keys(),
    ],
    (v) => bundler.addrOf(v)?.iid,
  );
}

// Unrendered tpls (e.g. Show is false) have no props, so evaluate the model args instead;
// linked props read the wrapper's args. InspectorSelection owns shared evaluation reads.
function evalUnrenderedCodeProps(viewCtx: ViewCtx, tpl: TplComponent, actualTpl: TplComponent, anchorCloneKey?: string, ignoreFocusedCloneKey = false) {
    const componentPropValues: Record<string, any> = {};
    const owner = $$$(tpl).tryGetOwningComponent();
    if (
      !isCodeComponent(actualTpl.component) ||
      // VariantTplMgr throws for owners without a frame in this ctx
      (owner &&
        !viewCtx.componentStackFrames().some((f) => f.component === owner))
    ) {
      return componentPropValues;
    }
    const linkedProps = getLinkedCodeProps(tpl.component);
    const effectiveVs = viewCtx.effectiveCurrentVariantSetting(tpl);
    const env = viewCtx.getCanvasEnvForTpl(tpl, { anchorCloneKey, ignoreFocusedCloneKey }) ?? {};
    const exprCtx = {
      projectFlags: viewCtx.projectFlags(),
      component: viewCtx.currentComponent(),
      inStudio: true,
    };
    for (const prop of tpl.component.params) {
      const [propTpl, targetProp] = linkedProps.get(prop.variable.name) ?? [
        tpl,
        prop,
      ];
      const expr =
        effectiveVs.args.find((arg) => arg.param === prop)?.expr ??
        prop.defaultExpr;
      if (propTpl !== actualTpl || !expr) {
        continue;
      }
      componentPropValues[targetProp.variable.name] = switchType(expr)
        .when(StyleExpr, () =>
          effectiveVs.variantSettings
            .map((vs) => vs.args.find((arg) => arg.param === prop)?.expr)
            .filter(isKnownStyleExpr)
            .map(makeStyleExprClassName)
            .join(" "),
        )
        .when(StyleTokenRef, ({ token }) =>
          isKnownColorPropType(prop.type) && prop.type.noDeref
            ? mkTokenRef(token)
            : makeTokenValueResolver(viewCtx.site)(
                toFinalToken(token, viewCtx.site),
                new VariantedStylesHelper(viewCtx.site, [
                  ...viewCtx.variantTplMgr().getActivatedVariantsForNode(tpl),
                ]),
              ),
        )
        .elseUnsafe(
          () =>
            swallow(() =>
              tryEvalExpr(
                getRawCode(expr, exprCtx),
                env,
                viewCtx.canvasCtx.win(),
              ),
            )?.val,
        );
    }
    return componentPropValues;
}
import type { CanvasComponentPart } from "@/wab/client/components/canvas/canvas-component-parts";
import type { CanvasPartTextEditor } from "@/wab/client/components/canvas/canvas-part-text-editor";
