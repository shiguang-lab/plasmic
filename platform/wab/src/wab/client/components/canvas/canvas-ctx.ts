import {
  dispatchFrameInteraction,
  trackFrameInteractions,
} from "@/wab/client/frame-ctx/frame-interactions";
import { getUiLocale } from "@/wab/client/i18n";
import { translate } from "@/wab/client/i18n/locales";
/// <reference types="@types/resize-observer-browser" />
import { handleError, normalizeError } from "@/wab/client/ErrorNotifications";
import { isCanvasOverlay } from "@/wab/client/components/canvas/CanvasFrame";
import { mkCanvas } from "@/wab/client/components/canvas/canvas-rendering";
import { CanvasFrameInfoOwner } from "@/wab/client/components/canvas/canvas-frame-info";
import { CanvasRegistrations } from "@/wab/client/components/canvas/canvas-registrations";
import { CanvasHostlessInputs } from "@/wab/client/components/canvas/canvas-hostless-inputs";
import { SubDeps } from "@/wab/client/components/canvas/subdeps";
import {
  ensureCanvasRuntime,
  HostLessPackageRequest,
  getReactWebBundle,
  loadHostLessPackages,
  getVersionForCanvasPackages,
} from "@/wab/client/components/studio/studio-bundles";
import * as domMod from "@/wab/client/dom";
import { NodeAndOffset } from "@/wab/client/dom";
import { upsertJQSelector } from "@/wab/client/dom-utils";
import { scriptExec } from "@/wab/client/script-exec";
import { ENV } from "@/wab/client/env";
import { PlasmicWindowInternals } from "@/wab/client/frame-ctx/windows";
import { globalHookCtx } from "@/wab/client/react-global-hook/globalHook";
import { FrameState } from "@/wab/client/react-global-hook/types";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import {
  getFrameHeight,
  isHeightAutoDerived,
  updateAutoDerivedFrameHeight,
} from "@/wab/shared/Arenas";
import { getBuiltinComponentRegistrations } from "@/wab/shared/code-components/builtin-code-components";
import { CodeComponentsRegistry } from "@/wab/shared/code-components/code-components";
import {
  ensure,
  assert,
  ensureInstance,
  spawn,
  withTimeout,
} from "@/wab/shared/common";
import { Box } from "@/wab/shared/geom";
import { disposeOwnedComputedFns } from "@/wab/shared/mobx-util";
import { ArenaFrame } from "@/wab/shared/model/classes";
import { CodeLibraryRegistration } from "@/wab/shared/register-library";
import { getStaticBaseUrl } from "@/wab/shared/urls";
import {
  ComponentRegistration,
  CustomFunctionRegistration,
} from "@plasmicapp/host";
import { notification } from "antd";
import $ from "jquery";
import L from "lodash";
import React from "react";

let gCanvasCtxIndex = 0;

/**
 * Timeout for waiting for canvas-ctx to be ready.
 * We are generous here because we don't want to timeout too early
 */
const CANVAS_CTX_TIMEOUT_PERIOD = 3 * 60 * 1000; // 3 minutes

export class CanvasCtx {
  /**
   * Simply for debugging purposes - give each a CanvasCtx a number.
   */
  private _index = gCanvasCtxIndex++;
  private ccRegistry: CodeComponentsRegistry;

  _$viewport: /*TWZ*/ JQuery<HTMLIFrameElement>;
  _win: /*TWZ*/ typeof window;
  private _frameState: FrameState | undefined;
  _$doc: /*TWZ*/ JQuery<HTMLDocument>;
  _controlStyleNode: HTMLStyleElement;
  _$html: /*TWZ*/ JQuery;
  _$head: /*TWZ*/ JQuery;
  _$userBody: /*TWZ*/ JQuery;
  _$body: JQuery;
  _keyAdjustment: null | ((key: string) => string);
  _name: string;

  Sub: SubDeps;

  private bodySizeCleanup: (() => void) | undefined;
  private readonly pendingBodyWaits = new Set<() => void>();
  private disposals: (() => void)[] = [];

  readonly registrations = new CanvasRegistrations();
  installedHostLessPkgs = new Set<string>();
  private usedPackages: CanvasHostlessInputs | undefined;
  private _hostLessPkgsLock = Promise.resolve();

  get hostLessPkgsLock() {
    return this._hostLessPkgsLock;
  }

  constructor({
    $viewport,
    name,
  }: {
    $viewport: JQuery<HTMLIFrameElement>;
    name: string;
  }) {
    this._$viewport = $viewport;
    this._name = name;
    this._keyAdjustment = null;
  }

  private async updateCcRegistry(requests: readonly HostLessPackageRequest[], sc: StudioCtx) {
    if (this._isDisposed) { return; }
    const previousFetch = this._hostLessPkgsLock;
    this.registrations.begin();
    this._hostLessPkgsLock = previousFetch
      .catch(() => undefined)
      .then(async () => {
        if (this._isDisposed) { return; }
        const currentPackages = new Set(requests.map((request) => request.identity));
        const pkgsData = await loadHostLessPackages(
          this._win,
          sc.appCtx.api,
          requests.filter(
            (request) => request.authoring || !this.installedHostLessPkgs.has(request.identity),
          ),
          getVersionForCanvasPackages(this._win),
        );
        if (this._isDisposed) { return; }
          for (const pkg of this.installedHostLessPkgs) {
            if (!currentPackages.has(pkg)) {
              this.installedHostLessPkgs.delete(pkg);
            }
          }
          for (const [pkg, pkgModule] of pkgsData) {
            if (!this.installedHostLessPkgs.has(pkg)) {
              scriptExec(this._win, pkgModule);
              this.installedHostLessPkgs.add(pkg);
            }
          }
          // Clear the memoized map
          this.ccRegistry?.clear();
          this.registrations.refresh();
      })
      .finally(() => {
        this.registrations.end();
      });
    await this._hostLessPkgsLock;
  }

  isUpdatingCcRegistry() {
    return this.registrations.loadingStore.getState();
  }

  private updatePkgsList(requests: readonly HostLessPackageRequest[], sc: StudioCtx) {
    if (requests.length || this.installedHostLessPkgs.size) {
      spawn(this.updateCcRegistry(requests, sc));
    }
  }

  setInteractiveMode(interactive: boolean) {
    if (interactive) {
      this._$html.addClass("__interactive_canvas");
      this._$html.removeClass("__non_interactive_canvas");
    } else {
      this._$html.addClass("__non_interactive_canvas");
      this._$html.removeClass("__interactive_canvas");
    }
  }

  /**
   * Creates the canvas overlay which covers the non-interactive canvas to prevent interactions
   * See canvas-overlay.md
   * @param arenaFrame
   */
  createCanvasOverlay(arenaFrame: ArenaFrame) {
    this._$body.append(
      $("<div />").attr({
        class: "__wab_canvas_overlay __wab_canvas_overlay_bottom_right",
        "data-frame-uid": arenaFrame.uid,
      }),
      $("<div />").attr({
        class: "__wab_canvas_overlay __wab_canvas_overlay_top_left",
        "data-frame-uid": arenaFrame.uid,
      }),
    );
  }

  /**
   * Reset canvas overlay to default state, which is to cover the whole canvas
   */
  resetCanvasOverlay() {
    this._$body.find(".__wab_canvas_overlay").css("clip-path", "none");
  }

  /**
   * Removes a rectangular region (corresponding to the Slatejs text editor) from the canvas overlay,
   * to enable interactions within that area.
   */
  updateCanvasOverlay(excludingRect: DOMRect) {
    const { top, bottom, right, left } = excludingRect;
    // we break the canvas overlay into two parts
    // one that covers the area to the top and left of the excluded rect
    this._$body
      .find(".__wab_canvas_overlay_top_left")
      .css(
        "clip-path",
        `polygon(0 0, 100% 0, 100% ${top}px, ${left}px ${top}px, ${left}px 100%, 0 100%)`,
      );
    // the other that covers the area to the bottom and right of the excluded rect
    this._$body
      .find(".__wab_canvas_overlay_bottom_right")
      .css(
        "clip-path",
        `polygon(100% ${top}px, ${right}px ${top}px, ${right}px ${bottom}px, ${left}px ${bottom}px, ${left}px 100%, 100% 100%)`,
      );
  }

  async *initViewPort(
    $viewport: JQuery<HTMLIFrameElement>,
    arenaFrame: ArenaFrame,
    sc: StudioCtx,
  ) {
    if (this._isDisposed) { return; }
    this._$viewport = $viewport;
    this._win = ensure(
      $viewport.get(0).contentWindow as typeof window,
      "Failed to get contentWindow from canvas viewport",
    );
    this._frameState = globalHookCtx.createFrameState({
      uid: arenaFrame.uid,
      objectPrototype: this._win.Object.prototype,
    });
    const runtimeWindow = this._win;
    const onError = (event: ErrorEvent) => {
      if (!this._isDisposed) { handleCanvasError(event.error); }
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!this._isDisposed) { handleCanvasError(event.reason); }
    };
    runtimeWindow.addEventListener("error", onError);
    runtimeWindow.addEventListener("unhandledrejection", onUnhandledRejection);
    this.disposals.push(() => {
      runtimeWindow.removeEventListener("error", onError);
      runtimeWindow.removeEventListener("unhandledrejection", onUnhandledRejection);
    });
    const doc = this._win.document;
    const $doc = (this._$doc = $(doc) as JQuery<HTMLDocument>);
    // This document can end before the owning Studio editor unmounts.
    this.disposals.push(
      trackFrameInteractions(doc, (interaction) =>
        dispatchFrameInteraction(document, interaction),
      ),
    );

    this._$html = $doc.find("html");
    this._$head = this._$html.find("head");
    this._controlStyleNode = upsertJQSelector(
      "style#controlStyles",
      () => this._$head.append($("<style />").attr({ id: "controlStyles" })),
      this._$head,
    )[0] as HTMLStyleElement;
    upsertJQSelector(
      `link[href='${getStaticBaseUrl()}/styles/canvas/canvas.${
        ENV.COMMITHASH
      }.css']`,
      () =>
        this._$head.append(
          $("<link />").attr({
            rel: "stylesheet",
            type: "text/css",
            href: `${getStaticBaseUrl()}/styles/canvas/canvas.${
              ENV.COMMITHASH
            }.css`,
            crossOrigin: "anonymous",
          }),
        ),
      this._$head,
    );
    this._$body = this._$html.find("body").first();
    this.createCanvasOverlay(arenaFrame);
    const hostReadyDone = sc.loadTimings.begin(
      "frame-host-ready",
      arenaFrame.uuid,
    );
    yield "user-body-wait";
    if (this._isDisposed) { return; }
    const userBody = await withTimeout(
      this.waitForUserBody(),
      "Couldn't get userBody",
      CANVAS_CTX_TIMEOUT_PERIOD,
    );
    if (this._isDisposed || !userBody) { return; }
    this._$userBody = userBody;
    hostReadyDone();
    // We reinsert things because some frameworks (Remix Hydrogen dev server) blow away the entire document.
    // We also do it earlier so that we can intercept clicks as much as possible, rather than waiting for __wab_user_body first.
    this._$head = this._$html.find("head");
    this._$body = this._$html.find("body").first();
    // Call after the host renders its user body. Next renders <html> itself, so
    // mutating its class beforehand is seen as a server/client mismatch.
    this.setInteractiveMode(sc.isInteractiveMode);
    upsertJQSelector(
      `link[href='${getStaticBaseUrl()}/styles/canvas/canvas.${
        ENV.COMMITHASH
      }.css']`,
      () =>
        this._$head.append(
          $("<link />").attr({
            rel: "stylesheet",
            type: "text/css",
            href: `${getStaticBaseUrl()}/styles/canvas/canvas.${
              ENV.COMMITHASH
            }.css`,
            crossOrigin: "anonymous",
          }),
        ),
      this._$head,
    );
    if (!this._$body.find(".__wab_canvas_overlay").length) {
      this.createCanvasOverlay(arenaFrame);
    }
    const scriptsDone = sc.loadTimings.begin("frame-runtime", arenaFrame.uuid);
    yield "script-wait";
    if (this._isDisposed) { return; }
    await ensureCanvasRuntime(this._win);
    if (this._isDisposed) { return; }
    const reactWebBundle = await withTimeout(
      getReactWebBundle(),
      "Couldn't get reactWebBundle.",
      CANVAS_CTX_TIMEOUT_PERIOD,
    );
    if (this._isDisposed) { return; }
    scriptExec(this._win, reactWebBundle);

    scriptsDone();
    (this._win as any).__PLASMIC__ = {
      EXECUTE_SERVER_QUERY: sc.executeServerQuery,
    } as PlasmicWindowInternals;
    // Overwrite the default executePlasmicDataOp with a custom one for in-studio use
    (this._win as any).__PLASMIC_EXECUTE_DATA_OP = sc.executePlasmicDataOp;
    // Cache interaction information in studio
    (this._win as any).__PLASMIC_CACHE_$STEP_VALUE = sc.save$stepValue;
    (this._win as any).__PLASMIC_CACHE_EVENT_ARGS = sc.saveInteractionArgs;
    (this._win as any).__PLASMIC_MUTATE_DATA_OP =
      sc.refreshFetchedDataFromPlasmicQuery;
    (this._win as any).__PLASMIC_GET_ALL_CACHE_KEYS = sc.getAllDataOpCacheKeys;
    (this._win as any).__PLASMIC_STUDIO_PATH = sc.getCurrentPathName;

    this.usedPackages?.dispose();
    this.usedPackages = new CanvasHostlessInputs(sc, (requests) => this.updatePkgsList(requests, sc));
    const hostlessDone = sc.loadTimings.begin(
      "frame-component-packages",
      arenaFrame.uuid,
    );
    yield "hostless-wait";
    if (this._isDisposed) { return; }
    await withTimeout(
      this.hostLessPkgsLock,
      "Couldn't acquire hostLessPkgsLock.",
      CANVAS_CTX_TIMEOUT_PERIOD,
    );

    if (this._isDisposed) { return; }
    hostlessDone();
    let dataSources: SubDeps["dataSources"] = (this._win as any)
      .__PlasmicDataSourcesBundle;
    // Also need to check usePlasmicDataConfig() as usePlasmicInvalidate() and
    // usePlasmicQueries() depend on it, and usePlasmicDataConfig() is
    // actually re-exported from @plasmicapp/query, so just because
    // usePlasmicInvalidate() exists doesn't mean usePlasmicDataConfig() exists.
    // That's because data-sources is provided by react-web, but query is provided
    // by the user's custom host. This also applies to usePlasmicQueries.
    if (dataSources && typeof dataSources.usePlasmicDataConfig !== "function") {
      dataSources = {
        ...dataSources,
        usePlasmicDataConfig: undefined,
        usePlasmicInvalidate: undefined,
        usePlasmicQueries: undefined,
      };
    }

    this.Sub = {
      ...(this._win as any).__Sub,
      ...(this._win as any).__CanvasPkgs,
      reactWeb: (this._win as any).__PlasmicReactWebBundle,
      dataSources,
      dataSourcesContext: (this._win as any).__PlasmicDataSourcesContextBundle,
    };

    this.ccRegistry = new CodeComponentsRegistry(
      this._win,
      getBuiltinComponentRegistrations(this.Sub),
    );
    this.registrations.install(this.ccRegistry);

    spawn(
      this.waitForUserBody().then(($userBody) => {
        if (!this._isDisposed && $userBody) {
          this.observeUserBodySize(sc, arenaFrame, $userBody[0]);
        }
      }),
    );

    yield "done";
  }

  private observeUserBodySize(
    sc: StudioCtx,
    arenaFrame: ArenaFrame,
    userBody: HTMLElement,
  ) {
    this.bodySizeCleanup?.();
    if (this._isDisposed) { return; }
    let closed = false;
    let pendingFrame: number | undefined;
    const MAX_RESIZES_WITHOUT_USER_EDIT = 16;
    let resizeObserverLastChangeCounter = sc._changeCounter;
    let resizeObserverResizeCounter = 0;
    let resizeObserverLastFullPageHeight = sc.fullPageHeight;
    let height = 0;
    const observer = new ResizeObserver(([entry]: ResizeObserverEntry[]) => {
      if (closed) { return; }
      height = Math.round(entry.contentRect.height);
      if (pendingFrame !== undefined) {
        return;
      }
      // Coalesce measurements into the next paint without waiting for content
      // to stop resizing, so height toggles update promptly.
      pendingFrame = window.requestAnimationFrame(() => {
        if (closed) { return; }
        pendingFrame = undefined;
        if (isHeightAutoDerived(arenaFrame)) {
          const frameHeight = getFrameHeight(arenaFrame);
          if (height && height !== frameHeight) {
            // We need to resize, but we want to limit how many resizes
            // happen without user-edits (as measured by sc._changeCounter)
            if (
              resizeObserverLastChangeCounter !== sc._changeCounter ||
              resizeObserverLastFullPageHeight !== sc.fullPageHeight
            ) {
              // Reset the counter, a user edit or full-height toggle happened
              resizeObserverLastChangeCounter = sc._changeCounter;
              resizeObserverLastFullPageHeight = sc.fullPageHeight;
              resizeObserverResizeCounter = 0;
            } else {
              // No user edits made, but we still need to resize
              resizeObserverResizeCounter++;
            }

            if (resizeObserverResizeCounter < MAX_RESIZES_WITHOUT_USER_EDIT) {
              // Auto-derived height is transient and never saved in the bundle.
              updateAutoDerivedFrameHeight(arenaFrame, height);
            } else if (
              resizeObserverResizeCounter === MAX_RESIZES_WITHOUT_USER_EDIT
            ) {
              // If no changes happened, and we resized a bunch of times anyway,
              // then there's probably a code component messing with our height (e.g. 100vh)
              // See https://app.shortcut.com/plasmic/story/23759/high-pri-infinitely-expanding-canvas-when-css-overflows-vertically
              notification.warning({
                message: translate(
                  getUiLocale(),
                  "Incompatible height in {part1}",
                  { part1: String(sc.tplMgr().describeArenaFrame(arenaFrame)) },
                ),
                description: translate(
                  getUiLocale(),
                  "We've stopped auto-growing the height of this artboard. There may be a code component with incompatible height (e.g. 100vh, 110%, calc(100%+300px)), which will cause the artboard to grow forever. You can fix this by setting the height of the code component instance within the Studio, which will allow us to cap the height to device height in the artboard",
                ),
                duration: 0,
              });
            }
          }
        }
      });
    });
    const dispose = () => {
      if (closed) { return; }
      closed = true;
      observer.disconnect();
      if (pendingFrame !== undefined) { window.cancelAnimationFrame(pendingFrame); pendingFrame = undefined; }
      if (this.bodySizeCleanup === dispose) { this.bodySizeCleanup = undefined; }
    };
    this.bodySizeCleanup = dispose;
    observer.observe(userBody);
  }

  private async waitForUserBody(): Promise<JQuery<HTMLElement> | undefined> {
    if (this._isDisposed) { return undefined; }
    const getBody = () => {
      // Some frameworks or dev servers (Remix Hydrogen on Oxygen local dev server) can end up blowing away the entire document, so _$html would be an old unmounted handle.
      this._$html = this._$doc.find("html");
      const $userBody = this._$html.find(".__wab_user-body").first();
      if ($userBody.length > 0) {
        return $userBody;
      }
      return undefined;
    };

    const $maybeUserBody = getBody();
    if ($maybeUserBody) {
      // Already there!
      return $maybeUserBody;
    }

    return new Promise((resolve) => {
      let finished = false;
      const finish = ($userBody: JQuery<HTMLElement> | undefined) => {
        if (finished) { return; }
        finished = true;
        observer.disconnect();
        window.clearInterval(intervalId);
        this.pendingBodyWaits.delete(cancel);
        resolve($userBody);
      };
      const cancel = () => finish(undefined);
      const check = () => {
        const $userBody = getBody();
        if ($userBody) { finish($userBody); }
      };
      const observer = new MutationObserver(check);
      observer.observe(this._$body.get(0), { childList: true, subtree: true });
      // Some hosts do not deliver mutation records while an iframe is hidden.
      const intervalId = window.setInterval(check, 500);
      this.pendingBodyWaits.add(cancel);
    });
  }

  getRegisteredCodeComponents(): ComponentRegistration[] {
    return this.ccRegistry.getRegisteredCodeComponents();
  }

  getRegisteredCodeComponentsMap() {
    return this.ccRegistry.getRegisteredCodeComponentsMap();
  }

  getRegisteredCodeComponentsAndContextsMap() {
    return this.ccRegistry.getRegisteredComponentsAndContextsMap();
  }

  getRegisteredFunctions(): CustomFunctionRegistration[] {
    return this.ccRegistry.getRegisteredFunctions();
  }

  getRegisteredFunctionsMap() {
    return this.ccRegistry.getRegisteredFunctionsMap();
  }

  getRegisteredLibraries(): CodeLibraryRegistration[] {
    return this.ccRegistry.getRegisteredLibraries();
  }

  /**
   * Finds the actual target element under the canvas overlay (the layer that covers the non-interactive canvas)
   * @param x x coordinate of the click event
   * @param y y coordinate of the click event
   * @returns the nearest element under the canvas overlay, to be focused as a result of the click
   */
  getActualTargetUnderCanvasOverlay(x: number, y: number): Element | undefined {
    for (const elt of this.$doc().get(0).elementsFromPoint(x, y)) {
      if (!isCanvasOverlay($(elt as HTMLElement))) {
        return elt;
      }
    }
    return undefined;
  }

  // We cannot evaluate it in constructor since by then, the tplRoot hasn't
  // been rendered yet.
  $eltForTplRoot() {
    return this.$wabRoot().children().first();
  }

  private $wabRoot() {
    return this._$userBody.children().first();
  }

  // These are elements that is not from the components in the canvas.
  $wabInternalElements() {
    return [this._$userBody, this.$wabRoot()];
  }

  $head() {
    return this._$head;
  }

  viewportOffset() {
    return this.viewportContainerOffset();
  }
  viewportContainerOffset() {
    const viewportContainer = this.viewportContainer();
    return {
      top: viewportContainer.offsetTop,
      left: viewportContainer.offsetLeft,
    };
  }
  // Get the bounding box of the frame, which includes everything in the
  // FrameContainer. Currently it includes the iframe and the frame label.
  contentAreaBB() {
    const viewportContainer = this.viewportContainer();
    let bb = Box.fromRect(viewportContainer.getBoundingClientRect());
    $(viewportContainer)
      .children()
      .each((index, elem) => {
        if (getComputedStyle(elem).position === "absolute") {
          bb = bb.merge(elem.getBoundingClientRect());
        }
      });
    return bb.rect();
  }
  viewportContainer() {
    return ensure(
      this.viewport().parentElement,
      "Failed to get parentElement from viewport",
    );
  }
  viewport() {
    return ensureInstance(this.$viewport()[0], HTMLIFrameElement);
  }
  $viewport() {
    return this._$viewport;
  }
  win() {
    return this._win;
  }

  get frameState() {
    return ensure(this._frameState, "CanvasCtx hasn't been initialized");
  }

  $doc() {
    return this._$doc;
  }
  doc(): HTMLDocument {
    return this.$doc().get(0) as any as HTMLDocument;
  }
  $body() {
    return this._$body;
  }
  // This is the actual div representing the page body.
  $userBody() {
    return this._$userBody;
  }
  // This is body's parent, and also contains modals/popups, where event
  // listeners, selection logic, etc. should still work.
  $html() {
    return this._$html;
  }
  controlStyleSheet() {
    return this._controlStyleNode.sheet as CSSStyleSheet;
  }
  private visibleDisplayClasses = new Map<string, string>();

  /** Reveal an instance through its existing className contract, including code components. */
  getVisibleDisplayClass(display: string) {
    let name = this.visibleDisplayClasses.get(display);
    if (!name) {
      name = `__wab_canvas_visible_${this.visibleDisplayClasses.size}`;
      const sheet = this.controlStyleSheet();
      sheet.insertRule(`html body .${name} { display: ${display} !important; }`, sheet.cssRules.length);
      this.visibleDisplayClasses.set(display, name);
    }
    return name;
  }
  getRange(..._args) {
    return domMod.range(this.doc());
  }
  setRange(start?: NodeAndOffset, end?: NodeAndOffset) {
    return domMod.range(this.doc(), start, end);
  }
  clearRange(..._args) {
    return domMod.clearRange(this.doc());
  }
  setKeyAdjustment(_keyAdjustment) {
    this._keyAdjustment = _keyAdjustment;
  }

  refreshFetchedDataFromPlasmicQuery(invalidateKey?: string) {
    const maybeExistingMutateAllKeysFn = (this._win as any).__SWRMutateAllKeys;
    if (typeof maybeExistingMutateAllKeysFn === "function") {
      maybeExistingMutateAllKeysFn(invalidateKey);
    }
  }

  private _outlineModeRules: CSSRule[] = [];
  setOutlineMode(mode: boolean) {
    const ss = this.controlStyleSheet();
    if (mode) {
      this._outlineModeRules = [];
      const addRule = (ruleText: string) => {
        // sessionstack.js intercepts the insertRule method such that it
        // suppresses the return value. So we use explicit index here.
        ss.insertRule(ruleText, 0);
        this._outlineModeRules.push(ss.cssRules[0]);
      };
      // Draw outline for all "real" boxes, which are all the tags we create
      addRule(`
        .__wab_tag, .__wab_instance, .__wab_text {
          outline: 1px dotted rgba(0, 0, 255, .5) !important;
          outline-offset: 1px !important;
          -webkit-text-stroke: 1px #aaa !important;
          -webkit-text-fill-color: white !important;
          opacity: 1 !important;
        }
      `);

      // Hide box-shadow and border for all elements, including ones that don't
      // correspond to a ValTag (for example, inside foreign components)
      addRule(`
        * {
          box-shadow: none !important;
          border: none !important;
          background: none !important;
        }
      `);

      // Hide placeholders (but keep their size)
      addRule(`
        .__wab_placeholder {
          visibility: hidden;
        }
      `);
      addRule(`
        .__wab_flex-item {
          opacity: 1 !important;
        }
      `);
    } else {
      for (const rule of this._outlineModeRules) {
        const index = L.indexOf(ss.cssRules, rule);
        ss.deleteRule(index);
      }
      this._outlineModeRules = [];
    }
  }
  isOutlineMode() {
    return this._outlineModeRules.length > 0;
  }

  private frameInfoOwner: CanvasFrameInfoOwner | undefined;
  private canvasFrameComponent: ReturnType<typeof mkCanvas> | undefined;

  syncFrameInfo(viewCtx: ViewCtx) {
    if (this._isDisposed || !this.frameInfoOwner) {
      return;
    }
    assert(this.frameInfoOwner.viewCtx === viewCtx, "Canvas frame belongs to another view");
    this.frameInfoOwner.sync();
  }

  /** Prepare only an established frame; an unevaluated frame has no consumers. */
  prepareFrameInfo(viewCtx: ViewCtx): () => void {
    if (this._isDisposed || !this.frameInfoOwner) { return () => undefined; }
    assert(this.frameInfoOwner.viewCtx === viewCtx, "Canvas frame belongs to another view");
    return this.frameInfoOwner.prepare();
  }

  frameInfo(viewCtx: ViewCtx) {
    assert(!this._isDisposed, "Cannot read frame inputs for a disposed canvas");
    this.frameInfoOwner ??= new CanvasFrameInfoOwner(viewCtx);
    assert(this.frameInfoOwner.viewCtx === viewCtx, "Canvas frame belongs to another view");
    return this.frameInfoOwner.store;
  }

  rerender(children: React.ReactNode, viewCtx: ViewCtx) {
    const frameInfo = this.frameInfo(viewCtx);
    this.canvasFrameComponent ??= mkCanvas(this.Sub, viewCtx);
    this.syncFrameInfo(viewCtx);

    const r = this.Sub.React.createElement;

    const node = r(
      this.canvasFrameComponent,
      {
        frameInfo,
      },
      children,
    );

    this.Sub.hostUtils.setPlasmicRootNode(node);
  }

  private _isDisposed = false;
  dispose() {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;
    this.bodySizeCleanup?.();

    if (this.Sub) {
      // Unmount the canvas tree so the effects inside it are cleaned up, since
      // they reference this frame. The frame may already be detached, and then
      // its scheduler never runs, so render synchronously.
      try {
        this.Sub.ReactDOM.flushSync(() =>
          this.Sub.hostUtils.setPlasmicRootNode(null),
        );
      } catch (err) {
        console.error("Failed to unmount canvas", this._name, err);
      }
      disposeOwnedComputedFns(this.Sub);
      disposeOwnedComputedFns(this.Sub.React);
    }
    this._frameState?.dispose();
    this._frameState = undefined;
    this.frameInfoOwner?.dispose();
    this.frameInfoOwner = undefined;
    this.canvasFrameComponent = undefined;
    this.usedPackages?.dispose(); this.usedPackages = undefined;
    this.registrations.dispose();
    for (const dispose of this.disposals) {
      dispose();
    }
    for (const cancel of this.pendingBodyWaits) { cancel(); }
  }
}

function handleCanvasError(err: any) {
  if (err) {
    // Check if the error was created in Studio iframe
    let proto = err;
    let studioIframeProto: any = Object;
    while (Object.getPrototypeOf(proto) != null) {
      proto = Object.getPrototypeOf(proto);
    }
    while (Object.getPrototypeOf(studioIframeProto) != null) {
      studioIframeProto = Object.getPrototypeOf(studioIframeProto);
    }
    if (proto === studioIframeProto) {
      // If so, handle the error
      handleError(normalizeError(err));
    }
  }
}
