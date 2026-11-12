import { isComposingKeyEvent } from "@/wab/commons/components/ReactUtil";
import type { Site } from "@/wab/shared/model/classes";
import { createStore } from "zustand/vanilla";
import { useCurrentModelWorld } from "@/wab/client/components/variants/variant-model-world";
import { useStudioRenderPolicy } from "@/wab/client/studio-ctx/studio-render-policy";
import { useAutoOpenedUuid } from "@/wab/client/studio-ctx/auto-open-state";
import { useEditingTextContext } from "@/wab/client/studio-ctx/editing-text-state";
import { usePageSettingsDialog } from "@/wab/client/studio-ctx/page-settings-state";
import { getContentEditorTarget } from "@/wab/client/studio-ctx/canvas-content-editor";
import { CanvasContentEditorControls } from "@/wab/client/components/canvas/CanvasContentEditorControls";
import { StudioLoading } from "@/wab/client/components/widgets/StudioLoading";
import { translate } from "@/wab/client/i18n/locales";

import { DndAdoptee, DndMarkers, DragMoveManager } from "@/wab/client/Dnd";
import { DragMoveFrameManager } from "@/wab/client/FreestyleManipulator";
import { ReadableClipboard } from "@/wab/client/clipboard/ReadableClipboard";
import { WritableClipboard } from "@/wab/client/clipboard/WritableClipboard";
import AutoOpenBanner from "@/wab/client/components/AutoOpenBanner";
import { BottomModals } from "@/wab/client/components/BottomModal";
import { maybeShowContextMenu } from "@/wab/client/components/ContextMenu";
import { PageSettingsDialog } from "@/wab/client/components/PageSettingsDialog";
import { CanvasDndOverlay } from "@/wab/client/components/canvas/CanvasDndOverlay";
import { isCanvasOverlay } from "@/wab/client/components/canvas/CanvasFrame";
import { CanvasOverlayToolbar } from "@/wab/client/components/canvas/CanvasOverlayToolbar";
import { FreestyleBox } from "@/wab/client/components/canvas/FreestyleBox";
import { CloneBoxes } from "@/wab/client/components/canvas/HoverBox/CloneBoxes";
import { HoverBoxes } from "@/wab/client/components/canvas/HoverBox/HoverBoxes";
import { PreselectBoxes } from "@/wab/client/components/canvas/HoverBox/PreselectBoxes";
import { MeasureTool } from "@/wab/client/components/canvas/MeasureTool";
import { FollowingPlayer } from "@/wab/client/components/canvas/Multiplayer/FollowingPlayer";
import { PlayerBoxes } from "@/wab/client/components/canvas/Multiplayer/PlayerBoxes";
import { PlayerCursors } from "@/wab/client/components/canvas/Multiplayer/PlayerCursors";
import RichTextToolbar from "@/wab/client/components/canvas/RichText/RichTextToolbar";
import { Spotlight } from "@/wab/client/components/canvas/Spotlight";
import { VariantsBar } from "@/wab/client/components/canvas/VariantsBar";
import { CanvasArenaShell } from "@/wab/client/components/canvas/canvas-arena";
import { CanvasClickTracker } from "@/wab/client/components/canvas/canvas-clicks";
import { isCanvasModifierPressed } from "@/wab/client/components/canvas/canvas-interactions";
import { CanvasCtx } from "@/wab/client/components/canvas/canvas-ctx";
import {
  getMarqueeFrames,
  selectAllInCanvas,
  selectMarquee,
} from "@/wab/client/components/canvas/marquee-selection";
import { closestTaggedNonTextDomElt } from "@/wab/client/components/canvas/studio-canvas-util";
import { getActiveCanvasModal } from "@/wab/client/components/canvas/canvas-modal-scope";
import { getMergedTextArg } from "@/wab/client/components/canvas/view-ops";
import { DevContainer } from "@/wab/client/components/dev";
import { ComponentPresetsModal } from "@/wab/client/components/insert-panel/ComponentPresetsModal";
import { PreviewCtx } from "@/wab/client/components/live/PreviewCtx";
import { makeFrameSizeMenu } from "@/wab/client/components/menus/FrameSizeMenu";
import { CanvasViewControls } from "@/wab/client/components/studio/CanvasViewControls";
import { EmptyCanvasPrompt } from "@/wab/client/components/studio/EmptyCanvasPrompt";
import { FocusedModeToolbar } from "@/wab/client/components/studio/FocusedModeToolbar/FocusedModeToolbar";
import { GlobalCssVariables } from "@/wab/client/components/studio/GlobalCssVariables";
import LeftPane from "@/wab/client/components/studio/LeftPane";
import { RightPane } from "@/wab/client/components/studio/RightPane";
import { TopFrameObserver } from "@/wab/client/components/studio/TopFrameObserver";
import { CodePreviewPanel } from "@/wab/client/components/studio/code-preview/CodePreviewPanel";
import { TopBar } from "@/wab/client/components/top-bar";
import { makeFrameMenu } from "@/wab/client/components/frame-menu";
import { getContextMenuForFocusedTpl } from "@/wab/client/components/tpl-menu";
import { BrowserAlertBanner } from "@/wab/client/components/widgets/BrowserAlertBanner";
import { DropdownButton } from "@/wab/client/components/widgets/DropdownButton";
import { AlertBanner } from "@/wab/client/components/widgets/plasmic/AlertBanner";
import { frameToClientPt } from "@/wab/client/coords";
import { plasmicIFrameWheelEvent } from "@/wab/client/definitions/events";
import { isArrowKey } from "@/wab/client/dom";
import { isCanvasIframeEvent } from "@/wab/client/dom-utils";
import {
  dispatchFrameInteraction,
  isForwardedFrameInteraction,
  trackFrameInteractions,
} from "@/wab/client/frame-ctx/frame-interactions";
import { getUiLocale } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import { PLATFORM } from "@/wab/client/platform";
import { bindShortcutHandlers } from "@/wab/client/shortcuts/shortcut-handler";
import { shouldHandleModelShortcut } from "@/wab/client/shortcuts/studio/studio-shortcut-handlers";
import { canHandleStudioModelInput, onStudioInputContextChange } from "@/wab/client/studio-ctx/studio-input";
import { isAnyModalOpen } from "@/wab/client/components/widgets/open-modals";
import { hasStudioCommandBarrier } from "@/wab/client/hooks/useStudioEscape";
import { STUDIO_SHORTCUTS } from "@/wab/client/shortcuts/studio/studio-shortcuts";
import { RightTabKey, StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { selectPanelsHidden } from "@/wab/client/studio-ctx/left-panel-state";
import { ViewportCtx } from "@/wab/client/studio-ctx/ViewportCtx";
import { useCanvasGeometry } from "@/wab/client/studio-ctx/viewport-state";
import { useStudioLiveMode } from "@/wab/client/studio-ctx/studio-mode-state";
import { useCanvasReveals } from "@/wab/client/studio-ctx/canvas-session-ui";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import {
  getArenaFrames,
  getFrameHeight,
  isDedicatedArena,
  isMixedArena,
} from "@/wab/shared/Arenas";
import {
  assert,
  ensure,
  ensureArray,
  maybe,
  spawn,
  tuple,
  unexpected,
} from "@/wab/shared/common";
import { isBaseVariantFrame } from "@/wab/shared/component-arenas";
import {
  isCodeComponent,
  isFrameComponent,
} from "@/wab/shared/core/components";
import {
  canConvertToSlot,
  canToggleVisibility,
  isTplComponent,
  isTplSlot,
  isTplTextBlock,
} from "@/wab/shared/core/tpls";
import { ValComponent, ValNode, ValTag } from "@/wab/shared/core/val-nodes";
import { isFixedSlotRoot } from "@/wab/client/components/canvas/fixed-slot-root";
import { dbg } from "@/wab/shared/dbg";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { Box, Pt } from "@/wab/shared/geom";
import { PositionLayoutType } from "@/wab/shared/layoututils";
import {
  ArenaFrame,
  isKnownTplComponent,
  isKnownTplTag,
} from "@/wab/shared/model/classes";
import { TplVisibility } from "@/wab/shared/visibility-utils";
import { inverseZoom } from "@/wab/styles/css-variables";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { Alert, notification } from "antd";
import { ArgsProps } from "antd/lib/notification";
import { default as cn, default as cx } from "classnames";
import $ from "jquery";
import { defer, noop, throttle } from "lodash";
import { ok } from "neverthrow";
import React, { createRef } from "react";
import { createPortal } from "react-dom";
import ResizeObserver from "resize-observer-polyfill";
import { SignalBinding } from "signals";
import { useStore } from "zustand";

const minDragPx = 4;
interface DragState {
  sourceViewCtx: ViewCtx;
  artboard?: { frame: ArenaFrame; lifetime: AbortSignal; click: () => void };
  initClientPt: Pt;
  initScreenX: number;
  initScreenY: number;
  /** Whether we've passed the min threshold to start dragging. */
  isDragging: boolean;
  dragMoveManager: DragMoveManager | DragMoveFrameManager | undefined;
}

interface ViewEditorProps {
  studioCtx: StudioCtx;
  viewCtx: ViewCtx | undefined;
  previewCtx: PreviewCtx;
  canvasLoading?: boolean;
  renderInteractive: boolean;
  renderDocs: boolean;
  renderDevMode: boolean;
  panelsHidden: boolean;
}
type ViewEditorState = { marqueeBox?: Box };

export class ViewEditorController {
  private disposed = false;
  readonly store = createStore<ViewEditorState & {hasDrag: boolean}>(() => ({hasDrag: false}));
  constructor(private props: ViewEditorProps) {}
  updateProps(props: ViewEditorProps) {
    this.props = props;
  }
  bindCanvas = (node: HTMLDivElement | null) => { this.canvas.current = node; };
  bindScaler = (node: HTMLDivElement | null) => { this.canvasScaler.current = node; };
  dispose() {
    this.disposed = true;
    const canvasClipper = this.canvasClipper;

    this.unbindShortcutHandlers?.();
    this.unregisterListeners();
    this.releaseFrameInteractions.forEach((release) => release());
    this.releaseFrameInteractions = [];
    this.resetInput();
    this.clearSuppressedClick?.();
    this.stopInsertionTracking?.();
    for (const entry of this.frameInputs.values()) { entry.release(); }

    this.resizeObserver?.disconnect();
    if (this.focusResetListener) {
      this.focusResetListener.detach();
      this.focusResetListener = undefined;
    }

    if (this.onClipperScrollListener) {
      canvasClipper?.removeEventListener(
        "scroll",
        this.onClipperScrollListener,
      );
      this.onClipperScrollListener = null;
    }

    this.props.studioCtx.viewportCtx?.dispose();
    this.props.studioCtx.viewportCtx = null;

    this.canvasClipper = null;

  }
private canvasClipper: HTMLElement | null = null;
private initialFitFrameUuid?: string;
private canvas = createRef<HTMLDivElement>();
private canvasScaler = createRef<HTMLDivElement>();
private onClipperScrollListener: (() => void) | null = null;
private _dragState?: DragState;
  private get dragState() { return this._dragState; }
  private set dragState(value: DragState | undefined) { this._dragState = value; this.store.setState((previous) => previous.hasDrag === !!value ? previous : { hasDrag: !!value }); }
private canvasClicks = new CanvasClickTracker();
private pendingCanvasClick?: { viewCtx: ViewCtx; target: JQuery; componentPart?: boolean };
private marquee?: {
    start: Pt;
    box: Box;
    isDragging: boolean;
    viewCtx?: ViewCtx;
    append: boolean;
    click: () => void;
    restore?: () => void;
    captureTarget?: Element;
    pointerId?: number;
  };
private measureToolTargets?: {
    targetDom?: JQuery;
    targetPt?: Pt;
    targetVc: ViewCtx;
  };
private resizeObserver?: ResizeObserver;
private unbindShortcutHandlers?: () => void;
private viewCtx() {
    return this.props.viewCtx;
  }
private ensureViewCtx() {
    return ensure(this.viewCtx(), () => "Expected viewCtx to exist");
  }
private siteOps() {
    return this.props.studioCtx.siteOps();
  }
private viewOps() {
    return ensure(
      ensure(this.viewCtx(), () => "Expected viewCtx to exist").viewOps,
      () => "Expected viewOps to exist",
    );
  }
private focusDefaultFrame() {
    if (!this.viewCtx()) {
      spawn(
        this.props.studioCtx.changeUnsafe(() =>
          this.props.studioCtx.focusNextFrame(),
        ),
      );
      return true;
    }
    return false;
  }
private releaseFrameInteractions: (() => void)[] = [];
private frameInputs = new Map<Document, { view: ViewCtx; release: () => void }>();
private stopGlobalInputs?: () => void;
private stopInsertionTracking?: () => void;
private gestureStart?: MouseEvent;
private pressedKeys = new Map<number, string>();
private resetInput = () => {
    const sc = this.props.studioCtx;
    const keys = [...this.pressedKeys];
    this.pressedKeys.clear();
    keys.forEach(([code]) => sc.markKeyup(code));
    if (keys.some(([, key]) => isArrowKey(key))) {
      sc.stopUnlogged();
    }
    if (!this.disposed && !this.measureToolTargets?.targetVc.isDisposed) {
      this.drawMeasureTool();
    }
    this.cancelCanvasGesture();
  };
private clearSuppressedClick?: () => void;
private listeners: (() => void)[] = [];
private registerListener<K extends keyof HTMLElementEventMap>(
    event: K,
    listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions,
    target: HTMLElement | Document = document.body,
  ) {
    const handle = (e: HTMLElementEventMap[K]) => {
      if (!isForwardedFrameInteraction(e)) {
        listener.call(document.body, e);
      }
    };
    target.addEventListener(event, handle as EventListener, options);
    this.listeners.push(() => target.removeEventListener(event, handle as EventListener, options));
  }
private unregisterListeners() {
    this.listeners.forEach(release => release());
    this.listeners.length = 0;
  }
private bindCanvasInputs(target: HTMLElement | Document, vc?: ViewCtx) {
    const down = (event: Event) => {
      if (isForwardedFrameInteraction(event)) { return; }
      const mouse = event as MouseEvent;
      spawn(this.handleMouseDown(mouse, vc ?? this.viewCtx()));
      if (this.pendingCanvasClick || this.marquee || this.dragState || this.props.studioCtx.isPanning()) {
        this.gestureStart = mouse;
        this.refreshGlobalInputs();
      }
    };
    const move = (event: Event) => {
      if (!this.stopGlobalInputs && !this.props.studioCtx.app.isDragging()) {
        if (!vc) { this.updateCursorLocation(event as MouseEvent); }
        spawn(this.handleMouseMove(event as MouseEvent, vc ?? this.viewCtx()));
      }
    };
    const over = (event: Event) => { if (!this.gestureStart) { this.handleMouseOver(event as MouseEvent, vc ?? this.viewCtx()); } };
    const out = (event: Event) => { if (!this.gestureStart) { this.handleMouseOut(event as MouseEvent, vc ?? this.viewCtx()); } };
    const menu = (event: Event) => this.handleContextMenu(event as MouseEvent, vc ?? this.viewCtx());
    target.addEventListener("pointerdown", down, !!vc);
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerover", over);
    target.addEventListener("pointerout", out);
    target.addEventListener("contextmenu", menu);
    return () => {
      target.removeEventListener("pointerdown", down, !!vc);
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerover", over);
      target.removeEventListener("pointerout", out);
      target.removeEventListener("contextmenu", menu);
    };
  }
private refreshGlobalInputs() {
    this.stopGlobalInputs?.();
    this.stopGlobalInputs = undefined;
    if (this.disposed || (!this.gestureStart && !this.props.studioCtx.dragInsertState())) { return; }
    const releases: (() => void)[] = [];
    for (const doc of [document, ...this.frameInputs.keys()]) {
      const vc = this.frameInputs.get(doc)?.view;
      const matches = (event: Event) => !isForwardedFrameInteraction(event) &&
        (!this.gestureStart || !("pointerId" in this.gestureStart) || !("pointerId" in event) || event.pointerId === this.gestureStart.pointerId);
      const move = (event: Event) => { if (matches(event)) { spawn(this.handleMouseMove(event as MouseEvent, vc ?? this.viewCtx())); } };
      const up = (event: Event) => {
        if (!this.gestureStart || !matches(event)) { return; }
        if (this.marquee?.isDragging || this.dragState?.isDragging || this.props.studioCtx.isPanning()) { this.suppressGestureClick(); }
        this.gestureStart = undefined;
        this.refreshGlobalInputs();
        spawn(this.handleMouseUp(event as MouseEvent, vc ?? this.viewCtx()));
      };
      const cancel = (event: Event) => { if (event.type === "blur" || matches(event)) { this.cancelCanvasGesture(); } };
      const escape = (event: KeyboardEvent) => this.handleDragEscape(event);
      doc.addEventListener("pointermove", move, true);
      doc.addEventListener("pointerup", up, true);
      doc.addEventListener("pointercancel", cancel, true);
      doc.addEventListener("lostpointercapture", cancel, true);
      doc.addEventListener("keydown", escape, true);
      if (vc) { doc.defaultView?.addEventListener("blur", cancel); }
      releases.push(() => {
        doc.removeEventListener("pointermove", move, true);
        doc.removeEventListener("pointerup", up, true);
        doc.removeEventListener("pointercancel", cancel, true);
        doc.removeEventListener("lostpointercapture", cancel, true);
        doc.removeEventListener("keydown", escape, true);
        if (vc) { doc.defaultView?.removeEventListener("blur", cancel); }
      });
    }
    this.stopGlobalInputs = () => releases.forEach(release => release());
  }
private cancelCanvasGesture = () => {
    if (this.gestureStart && !this.disposed) { this.suppressGestureClick(); }
    this.gestureStart = undefined;
    this.stopGlobalInputs?.(); this.stopGlobalInputs = undefined;
    this.cancelMarquee();
    if (this.dragState) { this.endDrag(true); }
    if (this.props.studioCtx.isPanning()) { this.props.studioCtx.endPanning(); }
    if (this.props.studioCtx.dragInsertState()) { this.props.studioCtx.setDragInsertState(undefined); }
  };
private suppressGestureClick() {
    this.clearSuppressedClick?.();
    const docs = [document, ...this.frameInputs.keys()];
    const clear = () => {
      docs.forEach(doc => { doc.removeEventListener("click", click, true); doc.removeEventListener("pointerdown", clear, true); });
      this.clearSuppressedClick = undefined;
    };
    const click = (event: Event) => {
      if ((event as MouseEvent).detail && !isForwardedFrameInteraction(event)) {
        event.preventDefault(); event.stopImmediatePropagation(); clear();
      }
    };
    docs.forEach(doc => { doc.addEventListener("click", click, true); doc.addEventListener("pointerdown", clear, true); });
    this.clearSuppressedClick = clear;
  }
initializeCanvas = (canvasClipper: HTMLElement | null) => {
    if (!canvasClipper || this.canvasClipper === canvasClipper) {
      return;
    }
    this.disposed = false;
    this.canvasClipper = canvasClipper;
    canvasClipper.classList.add("canvas-editor__canvas-clipper");
    canvasClipper.setAttribute("data-studio-model-input", "");
    canvasClipper.tabIndex = -1;
    const canvas = this.canvas.current;
    const canvasScaler = this.canvasScaler.current;
    if (!canvasClipper || !canvas || !canvasScaler) {
      unexpected();
    }

    this.releaseFrameInteractions.push(
      trackFrameInteractions(canvasClipper, (interaction) =>
        dispatchFrameInteraction(document, interaction),
      ),
    );

    // Ensure focus on this page, since we are being loaded in an iframe.
    window.focus();

    this.listeners.push(this.bindCanvasInputs(canvasClipper));
    window.addEventListener("blur", this.resetInput);
    this.listeners.push(
      () => window.removeEventListener("blur", this.resetInput),
      onStudioInputContextChange(this.props.studioCtx, this.resetInput),
    );
    this.registerListener("pointerleave", () => this.updateCursorLocation(null), undefined, canvasClipper);
    this.registerListener("dragenter", event => this.handleDragEnter(event), undefined, canvasClipper);
    this.registerListener("dragover", event => event.preventDefault(), undefined, canvasClipper);
    this.registerListener("drop", event => spawn(this.handleDrop(event)), undefined, canvasClipper);
    this.stopInsertionTracking = this.props.studioCtx.canvasInsertStore.subscribe(() => this.refreshGlobalInputs());

    // We need to make sure the wheel handler uses {passive: false} so that we
    // can call preventDefault / stopPropagation on it, to prevent the
    // browser from handling the wheel event
    this.registerListener("wheel", this.props.studioCtx.handleCanvasWheel, {
      passive: false,
    }, canvasClipper);

    this.registerListener("keydown", (e) => {
      if (!this.isFocusedOnCanvas() || e.defaultPrevented || e.cancelBubble || isComposingKeyEvent(e)) {
        return;
      }
      if (this.props.studioCtx.isDevMode) {
        // If spacebar is pressed, prevent default to avoid scrolling.
        // We want to start panning instead.
        if (e.keyCode === 32) {
          e.preventDefault();
        }
        this.props.studioCtx.markKeydown(e.which);
        const startArrowGroup = isArrowKey(e.key) &&
          ![...this.pressedKeys.values()].some(isArrowKey);
        this.pressedKeys.set(e.which, e.key);
        this.viewCtx()
          ?.getViewOps()
          .refreshHover(
            isCanvasModifierPressed(e) && !e.altKey,
          );
        if (startArrowGroup) {
          this.props.studioCtx.startUnlogged();
        }
        // Draw MeasureTool guides immediately on Alt
        if (this.props.studioCtx.isAltDown()) {
          this.drawMeasureTool();
        }
      }
    });

    this.registerListener("keyup", (e) => {
      const pressed = this.pressedKeys.get(e.which);
      if (pressed === undefined && (!this.isFocusedOnCanvas() || isComposingKeyEvent(e))) {
        return;
      }
      this.pressedKeys.delete(e.which);
      this.props.studioCtx.markKeyup(e.which);
      if (pressed && isArrowKey(pressed) && ![...this.pressedKeys.values()].some(isArrowKey)) {
        this.props.studioCtx.stopUnlogged();
      }
      if (this.isFocusedOnCanvas()) {
        this.viewCtx()
          ?.getViewOps()
          .refreshHover(
            isCanvasModifierPressed(e) && !e.altKey,
          );
        // Remove MeasureTool guides
        if (!this.props.studioCtx.isAltDown()) {
          this.drawMeasureTool();
        }
      }
    });

    this.registerListener("copy", async (e: ClipboardEvent) => {
      const vc = this.viewCtx();
      if (!vc || !this.isFocusedOnCanvas() || document.getSelection()?.isCollapsed === false) {
        return;
      }

      if (e.clipboardData) {
        e.preventDefault();
        await this.props.studioCtx.copy(
          WritableClipboard.fromDataTransfer(e.clipboardData),
          vc,
        );
      }
    });
    this.registerListener("cut", async (e: ClipboardEvent) => {
      const vc = this.viewCtx();
      if (!vc || !this.isFocusedOnCanvas() || document.getSelection()?.isCollapsed === false) {
        return;
      }

      if (e.clipboardData) {
        e.preventDefault();
        await this.props.studioCtx.cut(
          WritableClipboard.fromDataTransfer(e.clipboardData),
          vc,
        );
      }
    });
    this.registerListener("paste", async (e: ClipboardEvent) => {
      if (!this.isFocusedOnCanvas()) {
        return;
      }

      if (e.clipboardData) {
        e.preventDefault();
        await this.props.studioCtx.paste(
          ReadableClipboard.fromDataTransfer(e.clipboardData),
        );
      }
    });

    const initArena = this.props.studioCtx.currentArena;
    const viewportCtx = new ViewportCtx({
      dom: {
        updateCanvasPadding: (canvasPadding) => {
          canvas.style.padding = `${canvasPadding.y}px ${canvasPadding.x}px`;
        },
        updateArenaSize: (arenaSize) => {
          canvas.style.width = `${arenaSize.x}px`;
          canvas.style.height = `${arenaSize.y}px`;
        },
        scaleTo: (scale, smooth) => {
          canvasScaler.style.transform = `scale(${scale})`;
          canvasScaler.style.setProperty(inverseZoom, String(1 / scale));
          canvasScaler.style.transition = smooth
            ? `transform 0.5s, -webkit-transform 0.5s`
            : "";
        },
        scrollTo: (scroll, smooth) => {
          canvasClipper.scrollTo({
            left: scroll.x,
            top: scroll.y,
            behavior: smooth ? "smooth" : "auto",
          });
        },
        scrollBy: (scroll, smooth) => {
          canvasClipper.scrollBy({
            left: scroll.x,
            top: scroll.y,
            behavior: smooth ? "smooth" : "auto",
          });
        },
      },
      initialArena: initArena,
      initialClipperBox: Box.fromRect(canvasClipper.getBoundingClientRect()),
      initialClipperScroll: new Pt(
        canvasClipper.scrollLeft,
        canvasClipper.scrollTop,
      ),
    });
    this.props.studioCtx.viewportCtx = viewportCtx;

    if (initArena && !this.props.studioCtx.hasInitialEditorView) {
      const initArenaChildren = getArenaFrames(initArena);
      if (initArenaChildren.length > 0) {
        this.initialFitFrameUuid = initArenaChildren[0].uuid;
        spawn(
          this.props.studioCtx.changeUnsafe(() => {
            this.props.studioCtx.setStudioFocusOnFrame({
              frame: initArenaChildren[0] as ArenaFrame,
              autoZoom: false,
            });
          }),
        );
      }

      this.props.studioCtx.tryZoomToFitArena();
    }

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === canvasClipper) {
          // We want the client box of the clipper, so use getBoundingClientRect().
          // contentRect only provides the size of the box.
          viewportCtx.setClipperBox(
            Box.fromRect(canvasClipper.getBoundingClientRect()),
          );
        } else if (entry.target === canvasScaler) {
          // We want the size of the scaler, before CSS transforms, so use contentRect.
          // Note that CSS transforms do not trigger the resize observer.
          viewportCtx.setArenaScalerSize(
            Box.fromRect(entry.contentRect).size(),
          );
        }
      }
    });
    this.resizeObserver.observe(canvasClipper);
    this.resizeObserver.observe(canvasScaler);

    this.focusResetListener = this.props.studioCtx.focusReset.add(this.resetInput);

    this.onClipperScrollListener = () => {
      viewportCtx.setScroll(
        new Pt(canvasClipper.scrollLeft, canvasClipper.scrollTop),
      );
    };
    canvasClipper.addEventListener("scroll", this.onClipperScrollListener);

    const shortcutHandlers = {
      SELECT_ALL: (e: KeyboardEvent) => {
        const sc = this.props.studioCtx;
        if (
          !this.isFocusedOnCanvas() ||
          !sc.isDevMode ||
          sc.isInteractiveMode ||
          this.viewCtx()?.viewOps.isEditing()
        ) {
          return false;
        }
        e.preventDefault();
        spawn(sc.changeUnsafe(() => selectAllInCanvas(sc)));
        return true;
      },
      NAV_PARENT: (e: KeyboardEvent) =>
        this.focusDefaultFrame() ||
        this.handleHotkeyIfCanvasFocused(e, async () =>
          this.props.studioCtx.changeUnsafe(() => {
            const parent = this.viewOps().tryNavParent();
            if (!parent) {
              // If we're already at the root, then focus on the containing frame
              this.props.studioCtx.setStudioFocusOnFrame({
                frame: this.ensureViewCtx().arenaFrame(),
                autoZoom: false,
              });
            }
          }),
        ),
      NAV_CHILD: (e: KeyboardEvent) =>
        this.focusDefaultFrame() ||
        this.handleHotkeyIfCanvasFocused(e, async () =>
          this.props.studioCtx.changeUnsafe(() => {
            const viewCtx = this.ensureViewCtx();
            if (viewCtx.focusedComponentPart) {
              viewCtx.viewOps.tryEditText();
              return;
            }
            if (!viewCtx.focusedSelectable()) {
              // If we're not focused on anything object yet, then start from
              // the root of the current frame
              viewCtx.setStudioFocusByTpl(viewCtx.tplRoot());
            } else {
              const tpl = viewCtx.focusedTpl();
              if (this.viewOps().tryEnterFocusedComponent()) {
                return;
              } else if (tpl && isTplTextBlock(tpl)) {
                // If tpl is a rich text block, just try to edit it - don't nav
                // to its children.
                this.viewOps().tryEditText();
              } else if (tpl && isTplComponent(tpl) && getMergedTextArg(tpl)) {
                // We're currently selected on a TplComponent with a single visible
                // text arg. Navigating to child should edit that text.
                this.viewOps().tryEditText();
              } else {
                const child = this.viewOps().tryNavChild();
                if (!child) {
                  // Even when tpl is not a rich text block, it may be possible
                  // to edit text, for example, text slot default contents.
                  this.viewOps().tryEditText();
                }
              }
            }
          }),
        ),
      NAV_PREV_SIBLING: (e: KeyboardEvent) =>
        this.focusDefaultFrame() ||
        this.handleHotkeyIfCanvasFocused(e, async (e2) =>
          this.props.studioCtx.changeUnsafe(() => {
            if (
              this.props.studioCtx.focusedFrame() ||
              this.viewOps().isFocusedOnRootOfStretchFrame()
            ) {
              this.props.studioCtx.focusPrevFrame();
            } else {
              const prev = this.viewOps().tryNavPrev();
              if (!prev) {
                // If we're at the start, then go to parent
                shortcutHandlers.NAV_PARENT(e2);
              }
            }
          }),
        ),
      NAV_NEXT_SIBLING: (e: KeyboardEvent) =>
        this.focusDefaultFrame() ||
        this.handleHotkeyIfCanvasFocused(e, async (e2) =>
          this.props.studioCtx.changeUnsafe(() => {
            if (
              this.props.studioCtx.focusedFrame() ||
              this.viewOps().isFocusedOnRootOfStretchFrame()
            ) {
              this.props.studioCtx.focusNextFrame();
            } else {
              const next = this.viewOps().tryNavNext();
              if (!next) {
                // If we're at the end, then go to parent
                shortcutHandlers.NAV_PARENT(e2);
              }
            }
          }),
        ),
      DELETE: (e: KeyboardEvent) => this.handleDelete(e, { forceDelete: true }),
      HIDE: (e: KeyboardEvent) =>
        this.handleDelete(e, {
          forceDelete: false,
        }),
      ENTER_EDIT: (e: KeyboardEvent) =>
        this.handleHotkey(e, async () =>
          this.props.studioCtx.changeUnsafe(() => {
            const vc = this.ensureViewCtx();
            if (getContentEditorTarget(vc)) {
              void vc.contentEditor.enter();
              return;
            }
            const focusObj = vc.focusedSelectable();
            if (!focusObj) {
              return;
            }
            if (focusObj instanceof ValComponent && focusObj.tpl) {
              const codeComponent = isCodeComponent(focusObj.tpl.component);
              const ownedBySite = vc
                .tplMgr()
                .isOwnedBySite(focusObj.tpl.component);
              if (
                ownedBySite &&
                this.props.studioCtx.canEditComponent(focusObj.tpl.component) &&
                !codeComponent
              ) {
                // This is a ValComponent mapping to a Plasmic component, so enter
                // Master component edit mode
                vc.enterComponentCtxForVal(focusObj, "alt+enter");
              } else {
                notification.warning({
                  message: translate(
                    getUiLocale(),
                    codeComponent
                      ? "You cannot edit a code component."
                      : ownedBySite
                        ? "You cannot edit this component."
                        : "You cannot edit an imported component.",
                  ),
                });
              }
            } else {
              vc.getViewOps().tryEditText();
            }
          }),
        ),
      GO_TO_COMPONENT_ARENA: (e: KeyboardEvent) =>
        this.handleHotkey(e, async () =>
          this.props.studioCtx.changeUnsafe(() => {
            const vc = this.ensureViewCtx();
            const focusObj = vc.focusedSelectable();

            if (focusObj) {
              vc.studioCtx.switchToComponentArena(focusObj);
            }
          }),
        ),
      ENTER_EDIT_FRAME: (e: KeyboardEvent) =>
        this.handleHotkey(e, async () =>
          this.props.studioCtx.changeUnsafe(() => {
            const vc = this.ensureViewCtx();
            const focusObj = vc.focusedSelectable();
            if (!focusObj) {
              return;
            }
            const arena = vc.studioCtx.currentArena;
            if (!isMixedArena(arena)) {
              return;
            }
            if (focusObj instanceof ValComponent && focusObj.tpl) {
              const tplComponent = focusObj.tpl.component;
              const codeComponent = isCodeComponent(tplComponent);
              const ownedBySite = vc.tplMgr().isOwnedBySite(tplComponent);
              if (
                !codeComponent &&
                ownedBySite &&
                this.props.studioCtx.canEditComponent(tplComponent)
              ) {
                vc.studioCtx
                  .siteOps()
                  .createNewFrameForMixedArena(tplComponent, {});
              } else {
                notification.warning({
                  message: translate(
                    getUiLocale(),
                    codeComponent
                      ? "You cannot edit a code component."
                      : ownedBySite
                        ? "You cannot edit this component."
                        : "You cannot edit an imported component.",
                  ),
                });
              }
            }
          }),
        ),
      MOVE_LEFT: (e: KeyboardEvent) =>
        this.handleHotkey(e, async () =>
          this.props.studioCtx.changeUnsafe(() =>
            this.viewOps().moveBackward(),
          ),
        ),
      MOVE_RIGHT: (e: KeyboardEvent) =>
        this.handleHotkey(e, async () =>
          this.props.studioCtx.changeUnsafe(() => this.viewOps().moveForward()),
        ),
      MOVE_HOME: (e: KeyboardEvent) =>
        this.handleHotkey(e, async () =>
          this.props.studioCtx.changeUnsafe(() => this.viewOps().moveStart()),
        ),
      MOVE_END: (e: KeyboardEvent) =>
        this.handleHotkey(e, async () =>
          this.props.studioCtx.changeUnsafe(() => this.viewOps().moveEnd()),
        ),
      WRAP_HSTACK: (e: KeyboardEvent) =>
        this.handleHotkey(e, async () => {
          if (this.ensureViewCtx().focusedTpl()) {
            await this.viewOps().wrapInContainer("flex-row");
          }
        }),
      WRAP_VSTACK: (e: KeyboardEvent) =>
        this.handleHotkey(e, async () => {
          if (this.ensureViewCtx().focusedTpl()) {
            await this.viewOps().wrapInContainer("flex-column");
          }
        }),
      TOGGLE_VISIBILITY: (e: KeyboardEvent) => {
        this.handleHotkey(e, async () =>
          this.props.studioCtx.changeUnsafe(() => {
            const viewOps = this.viewOps();
            const focusedTpl = this.ensureViewCtx().focusedTpl();

            if (
              focusedTpl &&
              canToggleVisibility(focusedTpl, this.ensureViewCtx())
            ) {
              const currentVisibility =
                viewOps.getEffectiveTplVisibility(focusedTpl);
              if (currentVisibility === TplVisibility.Visible) {
                viewOps.setTplVisibility(
                  focusedTpl,
                  isTplSlot(focusedTpl)
                    ? TplVisibility.NotRendered
                    : TplVisibility.DisplayNone,
                );
              } else {
                viewOps.setTplVisibility(focusedTpl, TplVisibility.Visible);
              }
            }
          }),
        );
      },
      NUDGE_LEFT: (e) => {
        if (!this.props.studioCtx.isLiveMode) {
          this.handleHotkey(e, async (e2) =>
            this.props.studioCtx.changeUnsafe(() =>
              this.viewOps().nudgePosition("left", e2.shiftKey),
            ),
          );
        }
      },
      NUDGE_RIGHT: (e) => {
        if (!this.props.studioCtx.isLiveMode) {
          this.handleHotkey(e, async (e2) =>
            this.props.studioCtx.changeUnsafe(() =>
              this.viewOps().nudgePosition("right", e2.shiftKey),
            ),
          );
        }
      },
      NUDGE_UP: (e) =>
        this.handleHotkey(e, async (e2) =>
          this.props.studioCtx.changeUnsafe(() =>
            this.viewOps().nudgePosition("up", e2.shiftKey),
          ),
        ),
      NUDGE_DOWN: (e) =>
        this.handleHotkey(e, async (e2) =>
          this.props.studioCtx.changeUnsafe(() =>
            this.viewOps().nudgePosition("down", e2.shiftKey),
          ),
        ),
      GROW_WIDTH: (e) =>
        this.handleHotkey(e, async (e2) =>
          this.props.studioCtx.changeUnsafe(() =>
            this.viewOps().nudgeSize("width", true, e2.shiftKey),
          ),
        ),
      SHRINK_WIDTH: (e) =>
        this.handleHotkey(e, async (e2) =>
          this.props.studioCtx.changeUnsafe(() =>
            this.viewOps().nudgeSize("width", false, e2.shiftKey),
          ),
        ),
      GROW_HEIGHT: (e) =>
        this.handleHotkey(e, async (e2) =>
          this.props.studioCtx.changeUnsafe(() =>
            this.viewOps().nudgeSize("height", true, e2.shiftKey),
          ),
        ),
      SHRINK_HEIGHT: (e) =>
        this.handleHotkey(e, async (e2) =>
          this.props.studioCtx.changeUnsafe(() =>
            this.viewOps().nudgeSize("height", false, e2.shiftKey),
          ),
        ),
      TOGGLE_AUTOLAYOUT: (e: KeyboardEvent) =>
        this.handleHotkey(e, async () =>
          this.props.studioCtx.changeUnsafe(() =>
            this.viewOps().toggleAutoLayout(),
          ),
        ),
      TOGGLE_HSTACK: (e: KeyboardEvent) =>
        this.handleHotkey(e, async () =>
          this.props.studioCtx.changeUnsafe(() =>
            this.viewOps().setHstackLayout(),
          ),
        ),
      TOGGLE_VSTACK: (e: KeyboardEvent) =>
        this.handleHotkey(e, async () =>
          this.props.studioCtx.changeUnsafe(() =>
            this.viewOps().setVstackLayout(),
          ),
        ),
      AUTOSIZE: (e: KeyboardEvent) =>
        this.handleHotkey(e, async () =>
          this.props.studioCtx.changeUnsafe(() =>
            this.viewOps().autoSizeFocused(),
          ),
        ),
      DUPLICATE: (e) =>
        this.handleHotkey(e, async () =>
          this.props.studioCtx.changeUnsafe(() => this.viewOps().duplicate()),
        ),
      EXTRACT_COMPONENT: (e) =>
        this.handleHotkey(e, async () => {
          if (this.props.studioCtx.contentEditorMode) {
            return;
          }
          await this.props.studioCtx.changeUnsafe(() => {
            const vc = this.viewCtx();
            if (vc) {
              const tpl = vc.focusedTpl();
              const component = vc.arenaFrame().container.component;
              if (tpl) {
                if (
                  isFrameComponent(component) &&
                  vc.getViewOps().isRootNodeOfFrame(tpl)
                ) {
                  spawn(this.viewOps().convertFrameToComponent());
                } else {
                  spawn(this.viewOps().extractComponent());
                }
              } else if (
                this.props.studioCtx.focusedFrame() === vc.arenaFrame() &&
                isFrameComponent(component)
              ) {
                spawn(this.viewOps().convertFrameToComponent());
              }
            }
          });
        }),
      CONVERT_SLOT: (e) =>
        this.handleHotkey(e, async () =>
          this.props.studioCtx.changeUnsafe(() => {
            const tpl = this.ensureViewCtx().focusedTpl();
            if (tpl && canConvertToSlot(tpl)) {
              this.viewOps().convertToSlot(tpl);
            }
          }),
        ),
      COPY_ELEMENT_STYLE: (e) =>
        this.handleHotkey(e, async () =>
          this.props.studioCtx.changeUnsafe(() => this.viewOps().copyStyle()),
        ),
      PASTE_ELEMENT_STYLE: (e) =>
        this.handleHotkey(e, async () => {
          const styleProps =
            await this.viewOps().getPasteStylePropsFromClipboard();

          await this.props.studioCtx.change(() => {
            this.viewOps().pasteStyleClip(styleProps);
            return ok();
          });
        }),
      PASTE_AS_SIBLING: (e: KeyboardEvent) =>
        this.handleHotkey(e, async () => this.props.studioCtx.pasteAsSibling()),
      BOLD: (e) =>
        this.handleHotkey(e, async () =>
          this.props.studioCtx.changeUnsafe(() => this.viewOps().toggleBold()),
        ),
      DECREASE_FONT_SIZE: (e) =>
        this.handleHotkey(e, async () =>
          this.props.studioCtx.changeUnsafe(() =>
            this.viewOps().updateFontSize(-1),
          ),
        ),
      INCREASE_FONT_SIZE: (e) =>
        this.handleHotkey(e, async () =>
          this.props.studioCtx.changeUnsafe(() =>
            this.viewOps().updateFontSize(1),
          ),
        ),
      DECREASE_FONT_WEIGHT: (e) =>
        this.handleHotkey(e, async () =>
          this.props.studioCtx.changeUnsafe(() =>
            this.viewOps().updateFontWeight(-1),
          ),
        ),
      INCREASE_FONT_WEIGHT: (e) =>
        this.handleHotkey(e, async () =>
          this.props.studioCtx.changeUnsafe(() =>
            this.viewOps().updateFontWeight(1),
          ),
        ),
      CONVERT_LINK: (e) =>
        this.handleHotkey(e, async () =>
          this.props.studioCtx.changeUnsafe(() => {
            this.viewOps().convertToLink();
          }),
        ),
    };
    this.unbindShortcutHandlers = bindShortcutHandlers(
      document.body,
      STUDIO_SHORTCUTS,
      shortcutHandlers,
      shouldHandleModelShortcut(this.props.studioCtx),
    );
  };
focusResetListener: SignalBinding | undefined = undefined;
private isFocusedOnCanvas() {
    return canHandleStudioModelInput(this.props.studioCtx);
  }
private handleHotkey(
    e: KeyboardEvent,
    f: (e: KeyboardEvent) => Promise<void>,
  ) {
    const vc = this.viewCtx();
    if (vc && !vc.viewOps.isEditing() && this.props.studioCtx.isDevMode) {
      spawn(f(e));
      return true;
    } else {
      return false;
    }
  }
private handleHotkeyIfCanvasFocused(
    e: KeyboardEvent,
    f: (e: KeyboardEvent) => Promise<void>,
  ) {
    if (!this.isFocusedOnCanvas()) {
      return false;
    }

    return this.handleHotkey(e, f);
  }
handleDragEnter(e: DragEvent | React.DragEvent<HTMLDivElement>) {
    if (this.props.studioCtx.isInteractiveMode) {
      return;
    }
    e.preventDefault();
  }
updateCursorLocation(
    e: MouseEvent | React.MouseEvent<HTMLDivElement> | null,
    vc?: ViewCtx,
  ) {
    let data: { left: number; top: number } | null = null;
    if (e) {
      let clientPt = new Pt(e.pageX, e.pageY);
      if (vc) {
        clientPt = frameToClientPt(clientPt, vc);
      }
      const pt = this.props.studioCtx.viewportCtx!.clientToScaler(clientPt);
      data = {
        left: pt.x,
        top: pt.y,
      };
    }
    this.props.studioCtx.updateCursorLocation(data);
  }
async handleDrop(e: DragEvent | React.DragEvent<HTMLDivElement>) {
    if (this.props.studioCtx.isInteractiveMode) {
      return;
    }
    e.preventDefault();
    if (e.dataTransfer) {
      await this.props.studioCtx.paste(
        ReadableClipboard.fromDataTransfer(e.dataTransfer),
      );
    }
  }
private async handleMouseDown(
    e: MouseEvent,
    focusedVc: ViewCtx | undefined | null,
  ) {
    this.pendingCanvasClick = undefined;
    if (
      (e.target as HTMLElement).closest(
        ".canvas-editor__canvas-scrollbar .os-scrollbar",
      )
    ) {
      return;
    }
    if (
      this.props.studioCtx.isLiveMode ||
      this.props.studioCtx.isInteractiveMode
    ) {
      return;
    }

    // ignore the events if we are in freestyle mode
    if (this.props.studioCtx.freestyleState()) {
      return;
    }

    this.props.studioCtx.setWatchPlayerId(null);

    // Panning has a higher precedence than anything else.
    if (e.button === 1 || this.props.studioCtx.isPanMode()) {
      if (getArenaFrames(this.props.studioCtx.currentArena).length) {
        this.props.studioCtx.startPanning(e);
      }
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    const isMacContextMenu = PLATFORM == "osx" && e.button === 0 && e.ctrlKey;
    if (e.button !== 0 || isMacContextMenu) {
      if (e.button === 2 || isMacContextMenu) {
        // right click in the frame. preventDefault so that input doesn't
        // receive focus.
        if ((e.target as HTMLElement).ownerDocument.defaultView !== window) {
          e.preventDefault();
        }
      }
      return;
    }

    const sc = this.props.studioCtx;
    const insertion = sc.dragInsertState();
    if (insertion) {
      const target = insertion.dragMgr.tentativeVc;
      const extraInfo = await insertion.spec.asyncExtraInfo?.(sc);
      if (extraInfo === false) {
        return;
      }
      spawn(
        sc.changeUnsafe(() => {
          if (sc.dragInsertState() !== insertion) {
            return;
          }
          if (target && !target.isDisposed && insertion.dragMgr.tentativeVc === target) {
            insertion.dragMgr.endDrag(insertion.spec, extraInfo);
          }
          sc.setDragInsertState(undefined);
        }),
      );
      return;
    }

    const artboard = this.getArtboardTitleFrame(e);
    if (artboard) {
      e.preventDefault();
      e.stopPropagation();
      this.canvasClicks.reset();
      this.canvasClipper?.focus({ preventScroll: true });
      sc.changeSelection(() =>
        sc.setStudioFocusOnFrame({
          frame: artboard,
          autoZoom: false,
          appendToMultiSelection: e.shiftKey,
        }),
      );
      return;
    }

    const eventTarget = e.target as HTMLElement;
    if (
      [
        this.canvasClipper,
        this.canvas.current,
        this.canvasScaler.current,
      ].includes(eventTarget) ||
      eventTarget.classList.contains("canvas-editor__canvas-clipper-grid")
    ) {
      this.startMarquee(e, undefined, () => {
        this.props.studioCtx.changeSelection(() => {
          this.props.studioCtx.setStudioFocusOnFrame({
            frame: undefined,
            autoZoom: false,
          });
        });
      }, true);
      return;
    }

    const r = this.extractEventTarget(e, focusedVc);
    if (!r) {
      return;
    }
    const [$target, targetVc] = r;

    if (!targetVc) {
      // Make sure that the onBlur events are called before resetting
      // the focus.
      this.canvasClipper?.focus({ preventScroll: true });
      this.props.studioCtx.changeSelection(() => {
        // A click that visually outside the frame. Clear focus
        this.props.studioCtx.setStudioFocusOnFrame({
          frame: undefined,
          autoZoom: false,
        });
      });
      return;
    }

    // Next, we treat the mouse click as potentially selecting something on
    // the canvas.  We only do so if what we clicked on is not an element that
    // we're currently editing the text of, because in that case, we want the
    // click to work as usual within the text editor
    if (targetVc.getViewOps().isEditing(e.target as HTMLElement)) {
      return;
    }

    // We're handling the event
    e.preventDefault();
    e.stopPropagation();
    // If the user's app components install document listeners, we try to stop them from firing. For example, prevent triggering listeners from overlays/modals that dismiss on clicking outside.
    e.stopImmediatePropagation();

    // Commit panel input blur before selecting, and retain explicit canvas focus.
    document.getSelection()?.removeAllRanges();
    this.canvasClipper?.focus({ preventScroll: true });

    const frame = targetVc.arenaFrame();
    if (
      frame &&
      !sc.canvasContentEditor &&
      !sc.isPositionManagedFrame(frame) &&
      !e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey &&
      sc.focusedFrames().includes(frame)
    ) {
      // Keep the artboard selection until the pointer commits to a click or drag.
      const pressedAt = Date.now();
      this.dragState = {
        ...this.makeDragState(e, targetVc),
        artboard: {
          frame,
          lifetime: sc.arenaState.lifetime(),
          click: () => this.handleLayerMouseDown(e, $target, targetVc, pressedAt),
        },
      };
      return;
    }

    this.handleLayerMouseDown(e, $target, targetVc);
  }

  private makeDragState(e: MouseEvent, sourceViewCtx: ViewCtx): DragState {
    const point = new Pt(e.clientX, e.clientY);
    return {
      sourceViewCtx,
      initClientPt: isCanvasIframeEvent(e)
        ? frameToClientPt(point, sourceViewCtx)
        : point,
      initScreenX: e.screenX,
      initScreenY: e.screenY,
      isDragging: false,
      dragMoveManager: undefined,
    };
  }

  private handleLayerMouseDown(
    e: MouseEvent,
    $target: JQuery,
    targetVc: ViewCtx,
    pressedAt?: number,
  ) {
    const clickOnly = pressedAt !== undefined;
    const internalElements = targetVc.canvasCtx.$wabInternalElements();
    if (internalElements.find((elm) => $target.is(elm))) {
      // Clicked on the empty space between root and frame
      const focusFrame = () => targetVc.changeSelection(() => {
        targetVc.canvasCtx.clearRange();
        targetVc.studioCtx.setStudioFocusOnFrame({
          frame: targetVc.arenaFrame(),
          autoZoom: false,
        });
      });
      if (clickOnly) {
        focusFrame();
      } else {
        this.startMarquee(e, targetVc, focusFrame, true);
      }
      return;
    }

    const closest = closestTaggedNonTextDomElt($target, targetVc, {
      excludeNonSelectable: true,
    });

    if (closest == null) {
      notification.warning({
        message: translate(getUiLocale(), "Unknown element"),
        description: (
          <span>
            <UiText
              message={
                "Plasmic cannot determine which layer the the clicked element belongs to. This happens typically on code component where Plasmic doesn't know the structure of the DOM in the component. {part1}{part2}Please select nodes from the tree in the left panel."
              }
              values={{ part1: <br />, part2: <br /> }}
            />
          </span>
        ),
      });
      targetVc.change(() => {
        targetVc.setStudioFocusByTpl(null);
        targetVc.canvasCtx.clearRange();
      });
      return;
    }


    const partTarget = !isCanvasModifierPressed(e) && !e.shiftKey && !e.altKey
      ? getCanvasComponentPartTarget(targetVc, $target[0]) : undefined;
    const editingPartContent = partTarget && targetVc.focusedTpl() !== partTarget.part.tpl &&
      targetVc.focusedDomElt()?.toArray().some((element) => partTarget.part.element.contains(element));
    targetVc.setFocusedComponentPart(undefined);
    if (partTarget) {
      const { owner, part } = partTarget;
      if (!editingPartContent || targetVc.dom2focusObj(closest) === owner) {
        targetVc.changeSelection(() => {
          targetVc.getViewOps().tryFocusObj(owner, { exact: true, anchorCloneKey: targetVc.sel2cloneKey(owner) });
          targetVc.setFocusedComponentPart(part);
          targetVc.studioCtx.switchRightTab(RightTabKey.style);
        });
        this.canvasClicks.start(e, part.tpl, pressedAt);
        this.pendingCanvasClick = { viewCtx: targetVc, target: closest, componentPart: true };
        return;
      }
    }

    this.canvasClicks.start(e, targetVc, pressedAt);
    this.pendingCanvasClick = { viewCtx: targetVc, target: closest };

    const focusedSelectables = targetVc.focusedSelectables();
    const directSelect = isCanvasModifierPressed(e);
    const deepSelect = directSelect && !e.altKey;
    const focusable = targetVc
      .getViewOps()
      .getFinalFocusable(closest, { deepSelect }).val;

    if (
      focusable instanceof ValNode &&
      targetVc.getViewOps().isRootNodeOfFrame(focusable.tpl)
    ) {
      const focusRoot = () => {
        targetVc.getViewOps().tryFocusDomElt(closest, {
          appendToMultiSelection: e.shiftKey,
          deepSelect,
          exact: false,
        });
      };
      if (clickOnly) {
        focusRoot();
      } else {
        this.startMarquee(e, targetVc, focusRoot);
      }
      return;
    }

    if (e.shiftKey || !focusable || !focusedSelectables.includes(focusable)) {
      const focusedSelectable = targetVc.getViewOps().tryFocusDomElt(closest, {
        appendToMultiSelection: e.shiftKey,
        deepSelect,
        exact: false,
      });

      if (directSelect && e.altKey) {
        targetVc.change(() => {
          targetVc.studioCtx.switchToComponentArena(focusedSelectable);
        });
      }
    }

    if (!clickOnly && !(focusable instanceof ValNode && isFixedSlotRoot(targetVc, focusable.tpl))) {
      this.dragState = this.makeDragState(e, targetVc);
    }
  }
private throttledWarn = throttle(
    (args: ArgsProps) => notification.warning(args),
    5000,
    {
      trailing: false,
    },
  );
private async handleMouseMove(e: MouseEvent, vc: ViewCtx | undefined | null) {
    this.canvasClicks.move(e);
    if (
      this.props.studioCtx.isLiveMode ||
      this.props.studioCtx.isInteractiveMode
    ) {
      return;
    }
    // Sometimes, especially in debug mode, your ctrl/meta key up event may be
    // lost due to focused in debug panel. Here we update the key status.
    this.props.studioCtx.tryUpdateKeyboardStatus(e);
    if (this.props.studioCtx.tryPanning(e)) {
      return;
    }

    // Record where the mouse is
    const $target = $(e.target as HTMLElement);
    const isOverFrame =
      $target.parents().is(".__wab_user-body") ||
      $target.is(".__wab_user-body") ||
      isCanvasOverlay($target);
    if (isOverFrame && vc) {
      this.updateCursorLocation(e, vc);
    }
    const point = new Pt(e.clientX, e.clientY);
    const clientPt = isCanvasIframeEvent(e) && vc
      ? frameToClientPt(point, vc)
      : point;
    this.props.studioCtx.setCursorClientPt(clientPt);

    if (this.marquee) {
      if (
        this.props.studioCtx.isPanMode() ||
        this.props.studioCtx.freestyleState()
      ) {
        this.cancelMarquee();
      } else {
        this.marquee.box = Box.spanning(this.marquee.start, clientPt);
        this.marquee.isDragging ||=
          clientPt.dist(this.marquee.start) >= minDragPx;
        if (this.marquee.isDragging) {
          this.store.setState({ marqueeBox: this.marquee.box });
        }
      }
      return;
    }

    const sc = this.props.studioCtx;
    const insertion = sc.dragInsertState();
    if (insertion) {
      await sc.changeUnsafe(() => {
        if (sc.dragInsertState() !== insertion) {
          return;
        }
        const manager = insertion.dragMgr;
        if (
          !Box.fromRect(
            this.props.studioCtx.canvasClipper().getBoundingClientRect(),
          ).contains(new Pt(e.clientX, e.clientY))
        ) {
          manager.clear();
        } else {
          manager.drag(new Pt(e.pageX, e.pageY), e);
        }
      });
      return;
    }

    const s = this.dragState;
    if (!s) {
      // handle mouse hover
      this.genericHandleMouseOver(e, vc);
      return;
    }

    if (s.sourceViewCtx.isDisposed || sc.freestyleState()) {
      return;
    }
    if (s.artboard?.lifetime.aborted) {
      this.cancelCanvasGesture();
      return;
    }

    // Screen coordinates stay consistent when the pointer crosses iframes.
    if (
      !s.isDragging &&
      Math.hypot(e.screenX - s.initScreenX, e.screenY - s.initScreenY) >= minDragPx
    ) {
      if (s.artboard) {
        const { frame } = s.artboard;
        if (
          sc.canvasContentEditor ||
          sc.isPositionManagedFrame(frame) ||
          !sc.focusedFrames().includes(frame)
        ) {
          this.cancelCanvasGesture();
          return;
        }
        this.dragState = { ...s, isDragging: true };
        const manager = new DragMoveFrameManager(sc, frame, s.initClientPt);
        if (!manager.aborted()) {
          this.dragState = { ...this.dragState, dragMoveManager: manager };
          sc.setIsDraggingObject(true);
        }
      } else {
        const vc = s.sourceViewCtx;
        // ignore fixed elements, we do this verification here, because we want to warn
        // the user only when he tries to drag
        const focusedTpl = vc.focusedTpl();
        if (
          focusedTpl &&
          (isKnownTplTag(focusedTpl) || isKnownTplComponent(focusedTpl))
        ) {
          const position = vc.getViewOps().getPositionType(focusedTpl);
          if (position === PositionLayoutType.fixed) {
            this.throttledWarn({
              message: translate(
                getUiLocale(),
                "You cannot drag a fixed element. Use the right menu to change the position.",
              ),
            });
            return;
          }
        }
        if (focusedTpl && isTplTextBlock(focusedTpl.parent)) {
          this.throttledWarn({
            message: translate(
              getUiLocale(),
              "You cannot drag an inline element from a rich-text block.",
            ),
          });
          return;
        }

        const focusObjs = vc.focusedSelectables();
        if (
          focusObjs.length === 1 &&
          focusObjs[0] instanceof ValNode &&
          vc.getViewOps().isRootNodeOfFrame(focusObjs[0].tpl)
        ) {
          return;
        }
        const movable = focusObjs
          .filter((obj) => obj instanceof ValTag || obj instanceof ValComponent)
          .filter((obj) => {
            const elements = vc.eltFinder(obj);
            return elements != null && ensureArray(elements).length > 0;
          });
        if (!movable.length) {
          return;
        }
        this.dragState = {
          ...s,
          isDragging: true,
          dragMoveManager: new DragMoveManager(vc, movable, s.initClientPt),
        };
        sc.setIsDraggingObject(true);
      }
    }
    const dragMoveManager = this.dragState?.dragMoveManager;
    if (dragMoveManager) {
      await dragMoveManager.drag(clientPt, e);
      if (dragMoveManager.aborted() && this.dragState?.dragMoveManager === dragMoveManager) {
        this.endDrag();
      }
    }
  }
private handleDragEscape = (e: KeyboardEvent) => {
    if (e.key === "Escape" && !e.defaultPrevented && !isComposingKeyEvent(e) && !isAnyModalOpen() && !hasStudioCommandBarrier() && (this.gestureStart || this.marquee || this.dragState || this.props.studioCtx.isPanning() || this.props.studioCtx.dragInsertState())) {
      // Consume gesture cancellation before the global deselect shortcut.
      e.preventDefault();
      e.stopPropagation();
      this.cancelCanvasGesture();
    }
  };
private endDrag(cancelled = false) {
    const s = ensure(this.dragState, () => "Expected dragState to exist");
    if (s.isDragging) {
      this.canvasClicks.reset();
      this.pendingCanvasClick = undefined;
    }
    if (s.dragMoveManager) {
      if (s.dragMoveManager instanceof DragMoveManager) {
        s.dragMoveManager.endDrag(cancelled);
      } else {
        s.dragMoveManager.endDrag();
      }
    }
    this.dragState = undefined;
    this.gestureStart = undefined;
    this.refreshGlobalInputs();
    this.props.studioCtx.setIsDraggingObject(false);
  }
private handleMouseOut = (e: MouseEvent, vc?: ViewCtx) => {
    if (
      this.props.studioCtx.isLiveMode ||
      this.props.studioCtx.isInteractiveMode
    ) {
      return;
    }
    if (vc) {
      vc.change(() => {
        vc.getViewOps().tryHoverObj(undefined, { exact: true });
        vc.setMeasureToolDomElt(null);
      });
    }
  };
private handleMouseOver = (e: MouseEvent, focusedVc?: ViewCtx) => {
    this.genericHandleMouseOver(e, focusedVc);
  };
private genericHandleMouseOver = (
    e: MouseEvent,
    focusedVc: ViewCtx | null | undefined,
  ) => {
    const sc = this.props.studioCtx;
    if (sc.isLiveMode || sc.isInteractiveMode) {
      return;
    }
    const r = this.extractEventTarget(e, focusedVc);
    if (!r) {
      return;
    }
    const [$target, targetVc] = r;
    if (!targetVc) {
      // mouse visually moved out of the iframe
      if (focusedVc) {
        focusedVc.getViewOps().tryHoverObj(undefined, { exact: true });
      }
      return;
    }
    // Resolve on every hover event: modifier changes can change the candidate
    // even when the pointer stays over the same DOM element.

      if ($target.is(".__wab_root")) {
        targetVc.getViewOps().tryHoverObj(undefined, { exact: true });
        targetVc.setMeasureToolDomElt(null);
      } else {
        targetVc.getViewOps().tryHoverDomElt($target, {
          deepSelect: isCanvasModifierPressed(e) && !e.altKey,
          exact: false,
        });
      }


    // Measure Tool computations
    const $focusedDomElt = maybe(focusedVc, (vc) => vc.focusedDomElt());
    const arenaBounds = new Box(
      0,
      0,
      targetVc.arenaFrame().width,
      getFrameHeight(targetVc.arenaFrame()),
    );
    const cursorPt = new Pt(e.clientX, e.clientY);
    const $measureTool = targetVc.$measureToolDomElt();
    this.measureToolTargets = $focusedDomElt
      ? {
          targetDom:
            $target &&
            (!$measureTool ||
              $measureTool instanceof Pt ||
              !$target.is($measureTool))
              ? $target
              : undefined,
          targetPt: arenaBounds.contains(cursorPt)
            ? cursorPt.moveBy(
                targetVc.arenaFrame().left ?? 0,
                targetVc.arenaFrame().top ?? 0,
              )
            : undefined,
          targetVc: targetVc,
        }
      : undefined;
    this.drawMeasureTool();
  };
private drawMeasureTool = () => {
    if (!this.measureToolTargets) {
      return;
    }

    const sc = this.props.studioCtx;
    const { targetDom, targetPt, targetVc } = this.measureToolTargets;
    const $measureTool = targetVc.$measureToolDomElt();
    if (
      sc.isAltDown() &&
      !sc.isShiftDown() &&
      !sc.isMetaDown() &&
      !sc.isCtrlDown() &&
      targetDom
    ) {
      // Set DOM element as the target
      targetVc.setMeasureToolDomElt(targetDom);
    } else if (sc.isAltDown() && sc.isShiftDown() && targetPt) {
      // Set the adjusted cursor as the target
      targetVc.setMeasureToolDomElt(targetPt);
    } else if (!sc.isAltDown() && $measureTool !== null) {
      // Clear MeasureTool from view
      targetVc.setMeasureToolDomElt(null);
    }
  };
private async handleMouseUp(e: MouseEvent, vc: ViewCtx | undefined | null) {
    const artboardPress = this.dragState?.artboard;
    const sc = this.props.studioCtx;
    if (artboardPress && (
      artboardPress.lifetime.aborted ||
      sc.isLiveMode ||
      sc.isInteractiveMode ||
      sc.freestyleState() ||
      sc.canvasContentEditor ||
      !getArenaFrames(sc.currentArena).includes(artboardPress.frame)
    )) {
      this.endDrag(true);
      return;
    }
    if (artboardPress && !this.dragState?.isDragging) {
      this.endDrag();
      artboardPress.click();
    }

    const click = this.pendingCanvasClick;
    this.pendingCanvasClick = undefined;
    if (
      !click ||
      this.props.studioCtx.isLiveMode ||
      this.props.studioCtx.isInteractiveMode ||
      this.props.studioCtx.freestyleState()
    ) {
      this.canvasClicks.reset();
    }
    const drillDown = this.canvasClicks.finish(e);
    const finishClick = () => {
      if (
        drillDown &&
        click &&
        !this.props.studioCtx.isLiveMode &&
        !this.props.studioCtx.isInteractiveMode &&
        !this.props.studioCtx.freestyleState() &&
        !click.viewCtx.viewOps.isEditing(e.target as HTMLElement)
      ) {
        if (click.componentPart) {
          if (click.viewCtx.focusedComponentPart?.text) {
            click.viewCtx.change(() => click.viewCtx.viewOps.tryEditText());
          } else {
            click.viewCtx.setFocusedComponentPart(undefined);
            click.viewCtx.viewOps.deepFocusElement(click.target);
          }
        } else {
          click.viewCtx.viewOps.deepFocusElement(click.target);
        }
      }
    };
    if (this.marquee) {
      const marquee = this.marquee;
      const end =
        isCanvasIframeEvent(e) && vc
          ? frameToClientPt(new Pt(e.clientX, e.clientY), vc)
          : new Pt(e.clientX, e.clientY);
      marquee.box = Box.spanning(marquee.start, end);
      this.clearMarquee();
      this.store.setState({ marqueeBox: undefined });
      if (marquee.isDragging) {
        this.canvasClicks.reset();
        const sc = this.props.studioCtx;
        const frames = !marquee.viewCtx
          ? getMarqueeFrames(sc, marquee.box)
          : [];
        if (frames.length) {
          spawn(
            sc.changeUnsafe(() =>
              sc.setStudioFocusOnFrames(
                marquee.append ? [...sc.focusedFrames(), ...frames] : frames,
              ),
            ),
          );
          return;
        }
        const targetVc =
          marquee.viewCtx ??
          this.props.studioCtx.viewCtxs.find((view) => view.contentEditor.target) ??
          this.props.studioCtx.viewCtxs
            .filter((viewCtx) => viewCtx.isVisible())
            .reduce<ViewCtx | undefined>((best, viewCtx) => {
              const overlapArea = (candidate: ViewCtx | undefined) => {
                const overlap =
                  candidate &&
                  Box.fromRect(
                    candidate.canvasCtx.viewport().getBoundingClientRect(),
                  ).intersection(marquee.box);
                return overlap ? overlap.width() * overlap.height() : 0;
              };
              return overlapArea(viewCtx) > overlapArea(best) ? viewCtx : best;
            }, undefined);
        if (targetVc) {
          selectMarquee(targetVc, marquee.box, marquee.append);
        } else if (!marquee.append) {
          marquee.click();
        }
      } else {
        marquee.click();
        finishClick();
      }
      return;
    }
    if (this.props.studioCtx.isPanning()) {
      this.props.studioCtx.endPanning();
      e.preventDefault(); // avoid generating a paste event on Linux
    }
    if (
      (!vc && !this.dragState?.artboard) ||
      this.props.studioCtx.isLiveMode ||
      this.props.studioCtx.isInteractiveMode
    ) {
      return;
    }
    // ignore the events if we are in freestyle mode
    if (this.props.studioCtx.freestyleState()) {
      return;
    }
    const s = this.dragState;
    if (s?.dragMoveManager) {
      const end = isCanvasIframeEvent(e) && vc
        ? frameToClientPt(new Pt(e.clientX, e.clientY), vc)
        : new Pt(e.clientX, e.clientY);
      await s.dragMoveManager.drag(end, e);
    }
    if (s && this.dragState === s) {
      this.endDrag();
    }
    if (!s?.isDragging) {
      finishClick();
    }
  }
private startMarquee(
    e: MouseEvent,
    viewCtx: ViewCtx | undefined,
    click: () => void,
    clearOnPress = false,
  ) {
    this.canvasClipper?.focus({ preventScroll: true });
    const sc = this.props.studioCtx;
    const previousVc = sc.focusedViewCtx();
    const previousFrames = sc.focusedFrames().slice();
    const previousFrame = sc.focusedFrame();
    const previousContext = previousVc?.currentComponentCtx() ?? undefined;
    const previousStack = previousVc?.componentStackFrames().map((frame) => frame.clone());
    const previousSelection = previousVc?.focusedSelectables().map((selectable, index) => ({
      selectable,
      tpl: previousVc.focusedTpls()[index],
      cloneKey: previousVc.focusedCloneKeys()[index],
    }));
    const eagerClear = clearOnPress && !e.shiftKey;
    const restore = eagerClear ? () => sc.changeSelection(() => {
      if (previousVc && !previousVc.isDisposed && previousStack) {
        previousVc.restoreCurrentComponentCtxAndStack(previousContext, previousStack);
        previousVc.setStudioFocusByTpl(null);
        previousSelection?.forEach(({ selectable, tpl, cloneKey }, index) => {
          const opts = { appendToMultiSelection: index > 0 };
          if (selectable) {
            previousVc.setStudioFocusBySelectable(selectable, cloneKey, opts);
          } else {
            previousVc.setStudioFocusByTpl(tpl, cloneKey, opts);
          }
        });
      }
      if (previousFrames.length || previousFrame || !previousVc) {
        sc.setStudioFocusOnFrames(previousFrames);
      }
    }) : undefined;
    if (eagerClear) {
      click();
    }
    const start =
      isCanvasIframeEvent(e) && viewCtx
        ? frameToClientPt(new Pt(e.clientX, e.clientY), viewCtx)
        : new Pt(e.clientX, e.clientY);
    const captureTarget = e.target as Element;
    const pointerId =
      "pointerId" in e && typeof e.pointerId === "number"
        ? e.pointerId
        : undefined;
    this.marquee = {
      start,
      box: start.toZeroBox(),
      isDragging: false,
      viewCtx,
      append: e.shiftKey,
      click: eagerClear || (clearOnPress && e.shiftKey) ? noop : click,
      restore,
      captureTarget,
      pointerId,
    };
    if (pointerId !== undefined) {
      captureTarget.setPointerCapture(pointerId);
    }
    e.preventDefault();
    e.stopPropagation();
  }
private clearMarquee() {
    const marquee = this.marquee;
    this.marquee = undefined;
    this.gestureStart = undefined;
    this.refreshGlobalInputs();
    if (
      marquee?.pointerId !== undefined &&
      marquee.captureTarget?.hasPointerCapture(marquee.pointerId)
    ) {
      marquee.captureTarget.releasePointerCapture(marquee.pointerId);
    }
  }
private cancelMarquee = () => {
    this.canvasClicks.reset();
    this.pendingCanvasClick = undefined;
    if (this.marquee) {
      const restore = this.marquee.restore;
      this.clearMarquee();
      restore?.();
      this.store.setState({ marqueeBox: undefined });
    }
  };
private handleContextMenu = (e: MouseEvent, focusedVc?: ViewCtx) => {
    const sc = this.props.studioCtx;
    if (sc.isLiveMode || sc.isInteractiveMode) {
      return;
    }
    const frame = this.getArtboardTitleFrame(e);
    if (frame) {
      const viewCtx = sc.tryGetViewCtxForFrame(frame);
      if (viewCtx) {
        if (!sc.focusedFrames().includes(frame)) {
          sc.changeSelection(() => sc.setStudioFocusOnFrame({ frame, autoZoom: false }));
        }
        e.preventDefault();
        e.stopPropagation();
        maybeShowContextMenu(e, makeFrameMenu({ viewCtx, frame }));
      }
      return;
    }
    if (!focusedVc) {
      return;
    }
    const r = this.extractEventTarget(e, focusedVc);
    if (!r) {
      return;
    }
    const [$target, targetVc] = r;
    if (!targetVc) {
      return;
    }

    if (targetVc.focusedComponentPart?.element.contains($target[0])) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    const { val } = targetVc.getViewOps().getFinalFocusable($target);

    targetVc.change(() => {
      if (val) {
        const tpl = val instanceof ValNode ? val.tpl : val.getTpl();
        const focusedTpls = targetVc.focusedTpls();
        if (!focusedTpls.some((ftpl) => ftpl === tpl)) {
          targetVc.getViewOps().tryFocusObj(val, { exact: false });
        }
      } else {
        targetVc.setStudioFocusByTpl(null);
      }
    });

    targetVc.tryBlurEditingText();
    const menu = getContextMenuForFocusedTpl(targetVc);

    e.preventDefault();
    e.stopPropagation();

    // This event originated from within the frame, so we can't just pass it
    // directly into showContextMenu(), as the menu dropdown will be created
    // in the Studio frame, but the event coordinates are from the artboard
    // frame.  So instead, we translate the event coordinates to the outer
    // Studio frame
    const outerClientPt = frameToClientPt(
      new Pt(e.clientX, e.clientY),
      targetVc,
    );

    // And then we can use this directly as the pageX/pageY, because the
    // Studio frame has no scrolling so the two are the same.
    maybeShowContextMenu(e, menu, {
      pageX: outerClientPt.x,
      pageY: outerClientPt.y,
    });
  };
  private getArtboardTitleFrame(e: MouseEvent) {
    const sc = this.props.studioCtx;
    const target = e.target as Element;
    if (
      target.ownerDocument !== document ||
      target.closest(".CanvasFrame__Label__variant")
    ) {
      return undefined;
    }
    const uid = target.closest("[data-canvas-artboard-uid]")?.getAttribute("data-canvas-artboard-uid");
    return uid && !sc.canvasContentEditor
      ? getArenaFrames(sc.currentArena).find((frame) => frame.uid === Number(uid))
      : undefined;
  }
private extractEventTarget(
    e: MouseEvent,
    focusedVc: ViewCtx | undefined | null,
  ): [JQuery, ViewCtx | undefined] | undefined {
    const result = this.extractCanvasEventTarget(e, focusedVc);
    if (!result) {
      return undefined;
    }
    const [$target, targetVc] = result;
    const modal = getActiveCanvasModal($target[0]?.ownerDocument);
    if (modal && !modal.contains($target[0])) {
      // The mask must not expose a model ancestor behind the foreground dialog.
      return undefined;
    }
    // The iframe and hidden ancestors still provide React/data context, but
    // only the isolated content belongs to the visible editing surface.
    if (
      targetVc && !targetVc.contentEditor.containsElement($target[0])
    ) {
      return tuple($target, undefined);
    }
    return result;
  }
private extractCanvasEventTarget(
    e: MouseEvent,
    focusedVc: ViewCtx | undefined | null,
  ): [JQuery, ViewCtx | undefined] | undefined {
    const $target = $(e.target as HTMLElement);
    if (isCanvasOverlay($target)) {
      const frameUid = +ensure(
        $target.attr("data-frame-uid"),
        "Expected attr data-frame-uid to exist",
      );
      const targetVc = this.props.studioCtx.viewCtxs.find(
        (v) => v.arenaFrame().uid === frameUid,
      );
      if (!targetVc || !targetVc.canvasCtx.$eltForTplRoot().length) {
        return;
      }
      const actualTargetElt = targetVc.canvasCtx.getActualTargetUnderCanvasOverlay(
        e.clientX,
        e.clientY,
      );
      return actualTargetElt && [$(actualTargetElt as HTMLElement), targetVc];
    }

    // ignore all mousedown events if not from the left button.
    // ignore events from dev-env, which handles events by themselves.
    // ignore events if there is no viewCtx.
    if (!focusedVc || $target.parents().is(".dev-env")) {
      return undefined;
    }

    const $body = focusedVc.canvasCtx.$body();
    if (!$target.is($body) && !$target.parents().is($body)) {
      return undefined;
    }

    return tuple($target, focusedVc);
  }
private handleDelete(
    e: KeyboardEvent,
    { forceDelete }: { forceDelete: boolean },
  ) {
    return this.handleHotkey(e, async () => {
      const currentArena = this.props.studioCtx.currentArena;
      const focusedArenaFrame = this.props.studioCtx.focusedFrame();

      if (
        focusedArenaFrame &&
        !(
          isDedicatedArena(currentArena) &&
          isBaseVariantFrame(this.props.studioCtx.site, focusedArenaFrame)
        )
      ) {
        // delete the frame
        await this.siteOps().removeArenaFrame(focusedArenaFrame!);
      } else {
        await this.ensureViewCtx().getViewOps().tryDelete({ forceDelete });
      }
    });
  }
onFrameLoad = (frame: ArenaFrame, canvasCtx: CanvasCtx) => {
    const studioCtx = this.props.studioCtx;

    // View registration is a native lifecycle command. It must remain synchronous
    // because undo restoration can await this artboard inside a model change.

      const vc = studioCtx.createViewCtx(frame, canvasCtx);
      const doc = canvasCtx.$doc().get(0);

      const releaseInputs = this.bindCanvasInputs(doc, vc);
      const wheel = () => document.dispatchEvent(new Event(plasmicIFrameWheelEvent));
      doc.addEventListener("wheel", wheel);
      const release = () => {
        vc.disposeSignal.removeEventListener("abort", release);
        releaseInputs(); doc.removeEventListener("wheel", wheel);
        this.frameInputs.delete(doc);
        if (this.dragState?.sourceViewCtx === vc || this.marquee?.viewCtx === vc || this.pendingCanvasClick?.viewCtx === vc) { this.cancelCanvasGesture(); }
        else { this.refreshGlobalInputs(); }
      };
      this.frameInputs.set(doc, { view: vc, release });
      this.refreshGlobalInputs();
      vc.disposeSignal.addEventListener("abort", release, { once: true });
      canvasCtx
        .$body()
        // Handle drag-n-drop files into an artboard
        .on("drop", (e) => {
          spawn(
            this.handleDrop(
              ensure(e.originalEvent, () => "Expected originalEvent to exist"),
            ),
          );
        })
        .on("dragenter", (e) =>
          this.handleDragEnter(
            ensure(e.originalEvent, () => "Expected originalEvent to exist"),
          ),
        )
        .on("dragover", (e) => e.preventDefault());

    // The inspector becomes available when the first ViewCtx is created. Fit
    // once after it mounts so the initial overview accounts for its occlusion.
    if (frame.uuid === this.initialFitFrameUuid) {
      this.initialFitFrameUuid = undefined;
      const arena = studioCtx.currentArena;
      if (getArenaFrames(arena).includes(frame)) {
        defer(() => {
          if (studioCtx.currentArena === arena && studioCtx.viewportCtx) {
            studioCtx.tryZoomToFitArena();
          }
        });
      }
    }
  };
}

export function ViewEditor_(props: ViewEditorProps) {
  const {studioCtx, viewCtx} = props;
  const [owner, setOwner] = React.useState(() => ({ studioCtx, controller: new ViewEditorController(props) }));
  let current = owner;
  if (current.studioCtx !== studioCtx) { current = {studioCtx, controller: new ViewEditorController(props)}; setOwner(current); }
  const {controller} = current;
  React.useLayoutEffect(() => { controller.updateProps(props); }, [controller, props]);
  React.useLayoutEffect(() => { dbg.viewEditor = controller; return () => { if (dbg.viewEditor === controller) { delete dbg.viewEditor; } controller.dispose(); }; }, [controller]);
  const {marqueeBox, hasDrag} = useStore(controller.store);
  const arenaInputs = useStore(studioCtx.arenaState.store);
  const startup = useStore(studioCtx.startupStore);
  const registry = useStore(studioCtx.arenaState.viewRegistry.store);
  const insertion = useStore(studioCtx.canvasInsertStore);
  const draggingObject = useStore(studioCtx.draggingObjectStore);
  const isLive = useStudioLiveMode(studioCtx);
  const subscribeReady = React.useCallback((listener: () => void) => studioCtx.subscribeActiveCanvasInputs(listener), [studioCtx]);
  const readReady = React.useCallback(() => studioCtx.activeCanvasReady, [studioCtx]);
  const activeCanvasReady = React.useSyncExternalStore(subscribeReady, readReady, readReady);
  const canvasLoading = props.canvasLoading || !activeCanvasReady;
  const panelsHidden = props.panelsHidden;
  const world = useCurrentModelWorld(studioCtx);
  const mixed = useStore(world.models.field<Site, "arenas">(world.site, "arenas"));
  const pages = useStore(world.models.field<Site, "pageArenas">(world.site, "pageArenas"));
  const components = useStore(world.models.field<Site, "componentArenas">(world.site, "componentArenas"));
  const arenas = [...mixed, ...pages, ...components].map((ref) => world.models.resolve(ref));
  const canvasContainer = React.useRef<HTMLDivElement>(null);
    return (
      <div
        className={cn("canvas-editor", {
          "canvas-editor--panels-hidden": panelsHidden,
        })}
      >
        {viewCtx && <CanvasOverlayToolbar viewCtx={viewCtx} fallback />}
        {arenaInputs.current && (
          <>
            <ComponentPresetsModal />
          </>
        )}
        <GlobalCssVariables />
        <div className="canvas-editor__outer-main-area">
          <BrowserAlertBanner />
          <DevContainer className="canvas-editor__top-bar" showControls={true}>
            <TopBar />
            {!isLive &&
              !props.renderDocs && (
                <TopFrameObserver
                  studioReady={!canvasLoading && startup.viewportLoaded}
                />
              )}
          </DevContainer>

          <div className="canvas-editor__hsplit">
            <LeftPane key={world.site.uid} studioCtx={studioCtx} />
            <div
              ref={canvasContainer}
              className={cn("canvas-editor__canvas-container", {
                "canvas-editor__canvas-container__focus_mode":
                  arenaInputs.focusedMode,
              })}
            >
              <FollowingPlayer studioCtx={studioCtx} />
              {props.renderDevMode && (
                <div className="canvas-editor__top-pane">
                  <div className="canvas-editor__top-pane__floating-elements-container">
                    {studioCtx.alertBannerState && (
                      <div className="canvas-editor__alert-banner-container">
                        <AlertBanner studioCtx={studioCtx} />
                      </div>
                    )}
                    {<CanvasInsertionAlert studioCtx={studioCtx} />}
                  </div>
                </div>
              )}
              <Scrollbar
                ref={(node) => controller.initializeCanvas(node)}
                defer={false}
                className="canvas-editor__canvas-scrollbar"
              >
                {props.renderDevMode && (
                  <div className="canvas-editor__canvas-clipper-grid" />
                )}
                <div ref={(node) => controller.bindCanvas(node)} className="canvas-editor__canvas">
                  <div
                    ref={(node) => controller.bindScaler(node)}
                    className="canvas-editor__scaler"
                  >
                    {!props.canvasLoading &&
                      startup.routeLoaded &&
                      arenas.map(
                        (arena) => (
                          <CanvasArenaShell
                            key={arena.uid}
                            arena={arena}
                            studioCtx={studioCtx}
                            onFrameLoad={controller.onFrameLoad}
                          />
                        ),
                      )}
                    <DevContainer
                      className="abs"
                      showControls={props.renderDevMode}
                    >
                      <div className="canvas-editor__hoverbox-scroller">
                        {viewCtx && (
                          <Spotlight viewCtx={viewCtx} />
                        )}
                        <PlayerBoxes />
                        {!props.renderInteractive && <CloneBoxes />}
                        {!props.renderInteractive && <PreselectBoxes />}
                        {!props.renderInteractive && (
                          <HoverBoxes studioCtx={studioCtx} />
                        )}
                        <MeasureTool />
                        <FreestyleBox />
                        {marqueeBox && (
                          <CanvasMarquee studioCtx={studioCtx} box={marqueeBox} />
                        )}
                        <input
                          className="hidden-image-selector"
                          type="file"
                          accept={".gif,.jpg,.jpeg,.png,.avif,.tif,.svg"}
                        />
                        <>
                          {!props.renderInteractive &&
                            registry.map(({ view: vc, frame }) => (
                              <DndMarkers
                                key={frame.uid}
                                viewCtx={vc}
                              />
                            ))}
                        </>
                        {!props.renderInteractive && viewCtx && (
                          <>
                            <DndAdoptee key="dnd-adoptee" />
                          </>
                        )}
                        <div
                          className={
                            insertion.dragInsert ? "DragInsertState" : ""
                          }
                        />
                      </div>
                    </DevContainer>
                  </div>
                  <div className="canvas-editor__viewport-click-guard" />
                </div>
                {!arenaInputs.focusedMode && <VariantsBar />}
              </Scrollbar>
              {(canvasLoading || !startup.viewportLoaded) && (
                <StudioLoading />
              )}
              <CanvasDndOverlay container={canvasContainer} />
              <EditingTextToolbar viewCtx={viewCtx} />
              {DEVFLAGS.codePreview && (
                <CodePreviewPanel studioCtx={studioCtx} />
              )}
              <PlayerCursors />
              <FocusedModeToolbar studioCtx={studioCtx} />
              {props.renderDevMode && <CanvasContentEditorControls studioCtx={studioCtx} />}
              {props.renderDevMode && (
                <CanvasViewControls studioCtx={studioCtx} />
              )}
              {props.renderDevMode && (
                <>
                  {!props.renderInteractive && viewCtx && <HiddenContentBanner viewCtx={viewCtx} />}
                </>
              )}
            </div>
            <RightPane studioCtx={studioCtx} canvasLoading={canvasLoading} />
          </div>

          <DevContainer
            showControls={props.renderDevMode}
            defaultHidden={true}
            className={cx({
              "canvas-editor__bottom-pane": true,
              "canvas-editor__bottom-pane--expanded": false,
            })}
          />
        </div>
        {draggingObject &&
          !hasDrag &&
          createPortal(<div className="drag-guard" />, document.body)}
        <PageSettingsDialogHost studioCtx={studioCtx} />
        <BottomModals
          onFocusedIndexChange={(newIndex) =>
            studioCtx.setFocusedBottomModalIndex(newIndex)
          }
        />
      </div>
    );

}

function CanvasInsertionAlert({studioCtx}: {studioCtx: StudioCtx}) {

    const arena = useStore(studioCtx.arenaState.store);
    const { freestyle: freestyleState, dragInsert: dragInsertState } = useStore(studioCtx.canvasInsertStore);
    if (freestyleState) {
      return (
        <div className="canvas-editor__floating-msg no-pointer-events">
          <Alert
            message={translate(
              getUiLocale(),
              "Click where you want to insert a new {part1} element.",
              { part1: String(freestyleState.spec.label) },
            )}
          />
        </div>
      );
    }
    if (dragInsertState) {
      return (
        <div className="canvas-editor__floating-msg no-pointer-events">
          <Alert
            message={translate(
              getUiLocale(),
              "Click where you want to insert a new {part1} element.",
              { part1: String(dragInsertState.spec.label) },
            )}
          />
        </div>
      );
    }
    if (!arena.current || arena.frames.length === 0) {
      assert(
        arena.kind !== "component",
        `Component arenas cannot be empty`,
      );
      if (!arena.current || arena.kind === "mixed") {
        return (
          <EmptyCanvasPrompt
            studioCtx={studioCtx}
            emptyProject={!arena.current}
          />
        );
      }
      return (
        <div className="canvas-editor__floating-msg">
          <Alert
            message={
              arena.kind === "page"
                ? translate(getUiLocale(), "This page is empty.")
                : translate(getUiLocale(), "This project is empty.")
            }
            description={
              arena.kind === "page" ? (
                <>
                  <p>
                    <UiText
                      message={
                        "You can add artboards to with different screen sizes for viewing your page."
                      }
                    />
                  </p>
                  <p>
                    <DropdownButton
                      type="primary"
                      menu={() =>
                        makeFrameSizeMenu({
                          studioCtx,
                          onClick: (size) => {
                            spawn(
                              studioCtx.changeUnsafe(() => {
                                studioCtx
                                  .siteOps()
                                  .addScreenSizeToPageArenas(size);
                              }),
                            );
                          },
                        })
                      }
                    >
                      <UiText message={"Add a screen size"} />
                    </DropdownButton>
                  </p>
                </>
              ) : null
            }
          />
        </div>
      );
    }
    return null;

}


export function ViewEditor(props: Omit<ViewEditorProps, "renderInteractive" | "renderDocs" | "renderDevMode" | "panelsHidden">) {
  const renderInteractive = useStudioRenderPolicy(props.studioCtx, (policy) => policy.interactive);
  const renderDocs = useStudioRenderPolicy(props.studioCtx, (policy) => policy.docs);
  const renderDevMode = useStudioRenderPolicy(props.studioCtx, (policy) => policy.devMode);
  const panelsHidden = useStore(
    props.studioCtx.leftPanelState.store,
    selectPanelsHidden,
  );
  return <ViewEditor_ {...props} panelsHidden={panelsHidden} renderInteractive={renderInteractive} renderDocs={renderDocs} renderDevMode={renderDevMode} />;
}

function PageSettingsDialogHost({ studioCtx }: { studioCtx: StudioCtx }) {
  const { open, page } = usePageSettingsDialog(studioCtx);
  return (
    <PageSettingsDialog
      open={open}
      page={page}
      onClose={() =>
        studioCtx.changeUnsafe(() => {
          studioCtx.pageSettingsOpen = false;
        })
      }
    />
  );
}

function EditingTextToolbar({ viewCtx }: { viewCtx: ViewCtx | undefined }) {
  const editingText = useEditingTextContext(viewCtx);
  return editingText && viewCtx && !isFixedSlotRoot(viewCtx, editingText.val.tpl) ? <RichTextToolbar ctx={editingText} /> : null;
}

const HiddenContentBanner = React.memo(function HiddenContentBanner({ viewCtx }: { viewCtx: ViewCtx }) {
  const revealed = useCanvasReveals(viewCtx);
  const autoOpenedUuid = useAutoOpenedUuid(viewCtx);
  return autoOpenedUuid || revealed ? <AutoOpenBanner
    className="canvas-editor__bottom-banner" onHide={() => viewCtx.hideShownHiddenContent()} /> : null;
});

function CanvasMarquee({ studioCtx, box }: { studioCtx: StudioCtx; box: Box }) {
  const { scale, scroll, canvasPadding, clipperBox } = useCanvasGeometry(studioCtx);
  if (!studioCtx.viewportCtx) {return null;}
  const rect = box.plus(scroll).sub(canvasPadding).sub(clipperBox.topLeft()).scale(1 / scale).rect();
  return <div className="canvas-editor__marquee" style={{ ...rect, borderWidth: 1 / scale }} />;
}
import { getCanvasComponentPartTarget } from "@/wab/client/components/canvas/canvas-component-parts";
