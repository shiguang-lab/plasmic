import { useViewEntryForFrame, useViewReady } from "@/wab/client/studio-ctx/arena-state";
import { useActiveContentEditor, useContentEditor } from "@/wab/client/studio-ctx/canvas-content-editor";
import { useShallow } from "zustand/react/shallow";
import { useFrameHeight } from "@/wab/client/studio-ctx/frame-heights";
import { useStudioOverlayState } from "@/wab/client/studio-ctx/studio-overlay-state";
import { CanvasFrameHash } from "@/wab/client/components/canvas/canvas-frame-hash-observer";
import { useStudioRenderPolicy } from "@/wab/client/studio-ctx/studio-render-policy";
import { CanvasFrameLoad } from "@/wab/client/components/canvas/canvas-frame-load";
import { DragMoveFrameManager } from "@/wab/client/FreestyleManipulator";
import { CanvasActions } from "@/wab/client/components/canvas/CanvasActions/CanvasActions";
import { CanvasArtboardSelectionHandle } from "@/wab/client/components/canvas/CanvasFrame/CanvasArtboardSelectionHandle";
import styles from "@/wab/client/components/canvas/CanvasFrame/CanvasFrame.module.scss";
import { CanvasHeader } from "@/wab/client/components/canvas/CanvasFrame/CanvasHeader";
import { headRegexp } from "@/wab/client/components/canvas/CanvasFrame/headRegexp";
import { CopilotActivityOverlay } from "@/wab/client/components/canvas/CopilotActivityOverlay";
import { CanvasCtx } from "@/wab/client/components/canvas/canvas-ctx";
import { absorbEditingCanvasEvent, isCanvasModifierPressed } from "@/wab/client/components/canvas/canvas-interactions";
import { selectAllInCanvas } from "@/wab/client/components/canvas/marquee-selection";
import {
  absorbLinkClick,
  showCanvasPageNavigationNotification,
} from "@/wab/client/components/canvas/studio-canvas-util";
import { CanvasCommentMarkers } from "@/wab/client/components/comments/CanvasCommentMarkers";
import { useI18n } from "@/wab/client/i18n";
import { bindShortcutHandlers } from "@/wab/client/shortcuts/shortcut-handler";
import { STUDIO_SHORTCUTS } from "@/wab/client/shortcuts/studio/studio-shortcuts";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import {
  XDraggable,
  XDraggableEvent,
} from "@/wab/commons/components/XDraggable";
import { AsyncGeneratorReturnType } from "@/wab/commons/types";
import { AnyArena, getArenaName } from "@/wab/shared/Arenas";
import {
  cx,
  ensure,
  spawn,
  spawnWrapper,
  tuple,
} from "@/wab/shared/common";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { Pt } from "@/wab/shared/geom";
import { ArenaFrame } from "@/wab/shared/model/classes";
import { Skeleton } from "antd";
import $ from "jquery";
import { useStore } from "zustand";
import { useCanvasComponentInputs, type CanvasViewFieldRecipe } from "@/wab/client/components/canvas/canvas-view-inputs";
import { ok } from "neverthrow";
import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useMountedState, useUnmount } from "react-use";

/** Consume the viewport's async loading protocol as a lifetime-owned command. */
async function initializeCanvasViewport(
  ctx: CanvasCtx,
  viewport: JQuery<HTMLIFrameElement>,
  frame: ArenaFrame,
  studio: StudioCtx,
  load: CanvasFrameLoad,
  publish: (state: AsyncGeneratorReturnType<CanvasCtx["initViewPort"]>) => void,
): Promise<boolean> {
  for await (const state of ctx.initViewPort(viewport, frame, studio)) {
    if (!load.isActive()) { return false; }
    publish(state);
  }
  return load.isActive();
}

interface CanvasFrameProps {
  studioCtx: StudioCtx;
  onFrameLoad: (frame: ArenaFrame, canvasCtx: CanvasCtx) => void;
  arena: AnyArena;
  arenaFrame: ArenaFrame;
  isFree: boolean;
}

export const CanvasFrame = React.memo(function CanvasFrame({
  arena,
  arenaFrame,
  isFree,
  onFrameLoad,
  studioCtx,
}: CanvasFrameProps) {
  const { t: studioUiT } = useI18n();
  const frameHeight = useFrameHeight(studioCtx, arenaFrame);
  const modelFields = React.useCallback<CanvasViewFieldRecipe>((field) => {
    field(arenaFrame, "width", "left", "top", "container");
    field(arenaFrame.container, "component");
    if ("name" in arena) { field(arena, "name"); }
    else { field(arena.component, "name"); }
  }, [arena, arenaFrame]);
  const { alive } = useCanvasComponentInputs(studioCtx, arenaFrame, modelFields);
  const canComment = useStore(studioCtx.uiEnvironment.store, (state) => state.canComment);

  const [createdVc, setCreatedVc] = useState(false);
  const [iFrameKey, setIFrameKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const canvasName = `Canvas[${getArenaName(arena)}][${arenaFrame.uid}]`;
  const [toggleTrailingSlash, setToggleTrailingSlash] = useState(false);

  // We want to only load one CanvasFrame at a time, so we let StudioCtx
  // help us coordinate.  The load states are:
  // - unloaded: frame was first created
  // - queued: we've queued our load request, and is now waiting for our
  //   request to be served
  // - ready-to-load: our load request is being served, time to initiate load
  // - loading: we've written the host html to the iframe doc, now
  //   waiting for the onLoad event
  // - loaded: our iframe onLoad has finished executing.
  const isMounted = useMountedState();
  const [loadState, setLoadState] = useState<
    "unloaded" | "queued" | "ready-to-load" | "loading" | "loaded"
  >("unloaded");
  const [initState, setInitState] = useState<
    AsyncGeneratorReturnType<CanvasCtx["initViewPort"]> | undefined
  >(undefined);
  const modelLifetime = React.useMemo(() => studioCtx.arenaState.lifetime(), [studioCtx.arenaState, arenaFrame]);
  const loadRef = useRef<CanvasFrameLoad | null>(null);
  const frameHashRef = useRef<CanvasFrameHash | null>(null);
  React.useLayoutEffect(() => {
    if (modelLifetime.aborted || !studioCtx.arenaState.isCurrentLifetime(modelLifetime)) { return; }
    const hash = new CanvasFrameHash(studioCtx, arenaFrame, modelLifetime, (value) => {
      const win = iframeRef.current?.contentWindow;
      if (win && value !== win.location.hash) { win.location.hash = value; }
    });
    frameHashRef.current = hash;
    return () => {
      hash.dispose();
      if (frameHashRef.current === hash) { frameHashRef.current = null; }
    };
  }, [studioCtx, arenaFrame, modelLifetime, iFrameKey]);
  useEffect(() => {
    const load = new CanvasFrameLoad(modelLifetime, () => isMounted() && studioCtx.arenaState.isCurrentLifetime(modelLifetime));
    loadRef.current = load;
    if (load.isActive()) {
      const hash = ensure(frameHashRef.current, "Active iframe must have its committed URL source");
      load.own(() => {
        hash.dispose();
        if (frameHashRef.current === hash) { frameHashRef.current = null; }
      });
      setLoadState("unloaded");
      setCreatedVc(false);
      setInitState(undefined);
    }
    return () => {
      load.cancel();
      if (loadRef.current === load) { loadRef.current = null; }
    };
  }, [studioCtx, arenaFrame, modelLifetime, iFrameKey, isMounted]);
  const makeFrameHash = React.useCallback(
    () => ensure(frameHashRef.current, "Active iframe must have its committed URL source").getHash(),
    [studioCtx, arenaFrame, modelLifetime, iFrameKey],
  );

  useEffect(() => {
    const load = loadRef.current;
    if (loadState === "unloaded" && load?.isActive()) {
      const cancelQueued = studioCtx.queueCanvasFrame({
        load: () =>
          new Promise<void>((resolve, reject) => {
            if (load.begin(resolve, reject)) {
              setLoadState("ready-to-load");
            }
          }),
        arena,
        frame: arenaFrame,
        name: canvasName,
      });
      load.own(cancelQueued);
      setLoadState("queued");
    }
  }, [loadState, canvasName, studioCtx, arena, arenaFrame, modelLifetime, iFrameKey]);

  const registeredEntry = useViewEntryForFrame(studioCtx, arenaFrame);
  const entry = studioCtx.arenaState.isCurrentLifetime(modelLifetime) ? registeredEntry : undefined;
  const initialRenderReady = useViewReady(entry);
  const maybeViewCtx = useCallback(
    () => studioCtx.arenaState.isCurrentLifetime(modelLifetime) ? studioCtx.tryGetViewCtxForFrame(arenaFrame) : undefined,
    [studioCtx, arenaFrame, modelLifetime],
  );
  const viewCtx = useCallback(
    () => ensure(maybeViewCtx(), () => "Expected viewCtx to exist"),
    [maybeViewCtx],
  );
  const loadingStore = entry?.view.canvasCtx.registrations.loadingStore;
  const packagesLoading = useSyncExternalStore(
    useCallback((listener: () => void) => loadingStore ? loadingStore.subscribe(listener) : () => undefined, [loadingStore]),
    useCallback(() => loadingStore?.getState() ?? false, [loadingStore]),
    useCallback(() => false, []),
  );

  const needsToRecreateVc = createdVc && !entry;

  useEffect(() => {
    if (needsToRecreateVc && studioCtx.arenaState.isCurrentLifetime(modelLifetime)) {
      // force iframe to reload
      setIFrameKey(iFrameKey + 1);
      setCreatedVc(false);
    }
  }, [needsToRecreateVc]);

  useUnmount(() => {
    if (!studioCtx.arenaState.isCurrentLifetime(modelLifetime)) { return; }
    const vc = maybeViewCtx();
    if (vc) {
      studioCtx.disposeViewCtx(vc);
    }
  });

  const getTopClientPt = useCallback(
    (frameEvent: WheelEvent) => {
      // NOTE: the below commented out implementation attempts to compute the
      // pointer position with respect to the top-level page by looking at screen
      // positions and window sizes.  However, this was unreliable because there's
      // no way to get exactly where the viewport is within the window (the window can
      // have other chrome, like the URL bar, the devtools panel, etc), so this was
      // just an approximation.  The current implementation tries to compute this by
      // looking at the event's clientX/Y instead.  This is also inprecise, as clientX/Y
      // are integer-precision values, and when you're zoomed in, will not give you the
      // exact position of your cursor.  But for the purpose of doing zooming, this
      // is "good enough", and safer than using the screenX/screenY.

      // TODO: fix this hack. We can learn about the screen position of the
      // topmost viewport from a mouse event inside the iframe when scale is 1 or
      // any mouse event outside the iframe. This works when the topmost scale
      // is 1. When the topmost scale is not one, we have to just do a best
      // effort based on the toplevel window's scale.
      // clientX/clientY in topmost window. We cannot use e.clientX and e.clientY
      // because they are not scaled. This is hacky though - we are assuming the
      // browser window doesn't have fixed tab at the left and bottom. The problem
      // is that we don't know the position of the viewport inside the browser.
      // const clientX = frameEvent.screenX - window.screenX;
      // const clientY =
      //   frameEvent.screenY -
      //   window.screenY -
      //   (window.outerHeight - window.innerHeight);

      const frameBB = viewCtx().canvasCtx.viewport().getBoundingClientRect();
      const clientX = frameEvent.clientX * studioCtx.zoom + frameBB.left;
      const clientY = frameEvent.clientY * studioCtx.zoom + frameBB.top;
      return tuple(clientX, clientY);
    },
    [studioCtx, viewCtx],
  );

  const handleLoad = useCallback(
    async (viewport: HTMLIFrameElement, load: CanvasFrameLoad) => {
      if (!load.isActive() || loadState === "unloaded" || loadState === "queued") {
        return;
      }

      const $viewport = $(viewport);
      const ctx = createCanvasCtx($viewport, canvasName);
      const releaseContext = load.own(() => ctx.dispose());
      try {
        if (!await initializeCanvasViewport(ctx, $viewport, arenaFrame, studioCtx, load, setInitState)) { return; }
      } catch (e: any) {
        ctx.dispose();
        releaseContext();
        if (!load.isActive()) { return; }
        if (!toggleTrailingSlash && e?.name === "SecurityError") {
          console.log(
            "SecurityError while accessing artboard. Trying again...",
          );
          setToggleTrailingSlash(true);
          return;
        }
        load.fail(e);
        studioCtx.reportCanvasLoadError(e);
        return;
      }

      const onFocus = () => {
        if (!load.isActive()) { return; }
        if (
          !viewCtx().viewOps.isEditing() &&
          studioCtx.isDevMode &&
          !studioCtx.isInteractiveMode
        ) {
          viewCtx().canvasCtx.viewport().blur();
        }
      };

      const onWheel = (e: WheelEvent) => {
        if (!load.isActive()) { return; }
        const [topClientX, topClientY] = getTopClientPt(e);
        studioCtx.handleWheel(e, topClientX, topClientY);
      };

      const handleKeyUp = (e: JQuery.KeyUpEvent) => {
        if (!load.isActive() || studioCtx.isInteractiveMode) {
          return;
        }
        if (!viewCtx().viewOps.isEditing()) {
          studioCtx.markKeyup(e.which);
          viewCtx().viewOps.refreshHover(
            isCanvasModifierPressed(e) && !e.altKey,
          );
        }
      };

      const handleKeyDown = (e: JQuery.KeyDownEvent) => {
        if (!load.isActive() || studioCtx.isInteractiveMode) {
          return;
        }
        if (!viewCtx().viewOps.isEditing()) {
          studioCtx.markKeydown(e.which);
          viewCtx().viewOps.refreshHover(
            isCanvasModifierPressed(e) && !e.altKey,
          );
        }
      };

      const absorbEvent = (e: JQuery.UIEventBase | Event) => {
        if (!load.isActive() || !maybeViewCtx()) {
          return;
        }

        absorbEditingCanvasEvent(e, viewCtx());
      };

      // Runtime link notifications run after component handlers, in bubble phase.
      const absorbPreviewLink = (event: MouseEvent) => {
        if (load.isActive() && (studioCtx.isLiveMode || studioCtx.isInteractiveMode)) {
          absorbLinkClick(event, (href) =>
            showCanvasPageNavigationNotification(studioCtx, href),
          );
        }
      };

      // Prevent the frame from ever receiving focus.  We generally won't get
      // here
      // because the mousedown handler in the iframe also controls the focus.
      ctx.viewport().addEventListener("focus", onFocus);
      // Capture before React's root listeners. Selection uses pointer events;
      // text editing and runtime preview keep their native interaction.
      const html = ctx.$html().get(0);
      const absorbedEvents = [
        "click",
        "dblclick",
        "mouseup",
        "mouseover",
        "mouseout",
      ] as const;
      for (const event of absorbedEvents) {
        html.addEventListener(event, absorbEvent, true);
      }
      html.addEventListener("click", absorbPreviewLink);
      ctx.$html().on("keydown", handleKeyDown).on("keyup", handleKeyUp);

      const unbindShortcutHandlers = bindShortcutHandlers(
        ctx.$html().get(0),
        STUDIO_SHORTCUTS,
        {
          SELECT_ALL: () => {
            if (
              !load.isActive() ||
              !studioCtx.isDevMode ||
              studioCtx.isInteractiveMode ||
              viewCtx().viewOps.isEditing()
            ) {
              return false;
            }
            spawn(studioCtx.changeUnsafe(() => selectAllInCanvas(studioCtx)));
            return true;
          },
          TOGGLE_INTERACTIVE_MODE: () => {
            if (load.isActive()) { return studioCtx.changeUnsafe(() => studioCtx.toggleInteractiveMode()); }
            return undefined;
          },
        },
      );

      // On Chrome, wheel event on iframe's window/body/html/document cannot be
      // prevented/stopped. Also, the event is not bubbled to parent. See
      // https://www.chromestatus.com/features/6662647093133312 for more details.
      // So we make the body cover the entire iframe to capture the event
      // and absorb it.
      // We cannot register wheel handler using React's onWheel property - the
      // wheel event is now passive by default in Chrome, which means we cannot
      // call preventDefault on it.
      ctx.$html().get(0).addEventListener("wheel", onWheel, { passive: false });

      load.own(() => {
        ctx.$html().off("keydown", handleKeyDown).off("keyup", handleKeyUp);
        for (const event of absorbedEvents) {
          html.removeEventListener(event, absorbEvent, true);
        }
        html.removeEventListener("click", absorbPreviewLink);
        unbindShortcutHandlers();
        ctx.$html().get(0).removeEventListener("wheel", onWheel);
        ctx.viewport().removeEventListener("focus", onFocus);
      });

      studioCtx.fontManager.installAllUsedFonts([ctx.$head()]);
      ctx
        .doc()
        .documentElement.setAttribute(
          "data-plasmic-frame-uuid",
          arenaFrame.uuid,
        );
      ctx.doc().documentElement.setAttribute("data-plasmic-component-uuid", arenaFrame.container.component.uuid);
      if (!load.isActive()) { return; }
      onFrameLoad(arenaFrame, ctx);
      if (!load.isActive()) { return; }

      setCreatedVc(true);
      setLoadState("loaded");
      load.complete();


    },
    [
      studioCtx,
      viewCtx,
      maybeViewCtx,
      arenaFrame,
      loadState,
      toggleTrailingSlash,
      onFrameLoad,
      canvasName,
      getTopClientPt,
    ],
  );


  // Get the coordinate of a mouse event (that targeted element inside the frame
  // for vc) in the top most window.


  const handleSelectionClick = useCallback(() => {
    if (!studioCtx.arenaState.isCurrentLifetime(modelLifetime) || studioCtx.isInteractiveMode || maybeViewCtx()?.contentEditor.target) {
      return;
    }
    spawn(
      studioCtx.change(() => {
        if (!studioCtx.arenaState.isCurrentLifetime(modelLifetime)) { return ok(); }
        studioCtx.setStudioFocusOnFrame({ frame: arenaFrame });
        return ok();
      }),
    );
  }, [studioCtx, arenaFrame, maybeViewCtx, modelLifetime]);
  const handleArenaHandleClick = useCallback(
    (e?: React.MouseEvent<HTMLElement>) => {
      if (!studioCtx.arenaState.isCurrentLifetime(modelLifetime) || studioCtx.isInteractiveMode) {
        return;
      }
      if (!e?.shiftKey && studioCtx.focusedFrames().includes(arenaFrame)) {
        return;
      }
      spawn(
        studioCtx.change(() => {
          if (!studioCtx.arenaState.isCurrentLifetime(modelLifetime)) { return ok(); }
          studioCtx.setStudioFocusOnFrame({
            frame: arenaFrame,
            appendToMultiSelection: e?.shiftKey,
          });
          return ok();
        }),
      );
    },
    [studioCtx, arenaFrame, modelLifetime],
  );

  const dragMoveManager = useRef<DragMoveFrameManager | undefined>(undefined);

  const startMove = (e: XDraggableEvent) => {
    if (!studioCtx.arenaState.isCurrentLifetime(modelLifetime)) { return; }
    const clientPt = new Pt(e.mouseEvent.pageX, e.mouseEvent.pageY);
    if (studioCtx.isPositionManagedFrame(arenaFrame)) {
      return;
    }
    dragMoveManager.current = new DragMoveFrameManager(
      studioCtx,
      arenaFrame,
      clientPt,
    );

    if (dragMoveManager.current && dragMoveManager.current.aborted()) {
      dragMoveManager.current = undefined;
    } else {
      studioCtx.setIsDraggingObject(true);
    }
  };

  const dragMove = async (e: XDraggableEvent) => {
    if (dragMoveManager.current) {
      if (dragMoveManager.current.aborted()) {
        await stopMove();
      } else {
        const clientPt = new Pt(e.mouseEvent.pageX, e.mouseEvent.pageY);
        await dragMoveManager.current.drag(clientPt, e.mouseEvent);
        if (dragMoveManager.current && dragMoveManager.current.aborted()) {
          await stopMove();
        }
      }
    }
  };

  const stopMove = async () => {
    await studioCtx.change(() => {
      if (dragMoveManager.current) {
        dragMoveManager.current.endDrag();
        dragMoveManager.current = undefined;
      }
      studioCtx.setIsDraggingObject(false);
      return ok();
    });
  };

  useEffect(() => {
    const load = loadRef.current;
    if (load?.isActive() && loadState === "ready-to-load" && iframeRef.current) {
      const viewport = iframeRef.current;
      spawn(
        (async () => {
          const hostDone = studioCtx.loadTimings.begin(
            "frame-host-document",
            arenaFrame.uuid,
          );
          const html = await studioCtx.fetchHostPageHtml();
          if (!load.isActive()) { return; }
          const doc = ensure(
            viewport.contentDocument,
            () => "Expected contentDocument to exist",
          );



          // Artboard iframes have no network response, so PerformanceNavigationTiming
          // looks like a bfcache restore. transferSize, responseStart and encodedBodySize
          // are all 0 and deliveryType is "cache". In Next 16 the React debug channel reads
          // these, thinks it was restored from cache, and calls location.reload() which
          // orphans the artboard and leaves it blank. We spoof PerformanceNavigationTiming
          // to avoid this.
          //
          // Different Next versions key off different fields (as of July 2026):
          //   transferSize === 0                     -> reload  (16.2.7 - 16.2.10, wasServedFromCache)
          //   responseStart === 0 && responseEnd > 0 -> reload  (canary, "Safari tab-duplication" branch)
          //   deliveryType === "cache"               -> reload  (canary)
          const spoofFreshNavigationTimingScript = `
            (() => {
              if (typeof PerformanceNavigationTiming === "undefined") return;
              const proto = PerformanceNavigationTiming.prototype;
              const spoof = (prop, value) => {
                try {
                  Object.defineProperty(proto, prop, { configurable: true, get: () => value });
                } catch (e) {}
              };
              spoof("transferSize", 1);
              spoof("encodedBodySize", 1);
              spoof("responseStart", 1);
              spoof("deliveryType", "");
            })();
          `;

          // Stub dev-server HMR connections to avoid replacing the document written by
          // Studio. Next 12+ and Turbopack use WebSocket; webpack-hot-middleware
          // uses EventSource. Runs before the framework boots.
          //
          // Next 16 uses the React debug channel over its HMR socket, and won't
          // hydrate without it. So we connect it and deliver only those messages.
          const disableHmrScript = `
            (() => {
              const isHmr = (url) => /[^a-zA-Z]hmr($|[^a-zA-Z])/.test(url);
              const isNextHmr = (url) => /\\/_next\\/(webpack-)?hmr(\\?|$)/.test(url);
              window.EventSource = class extends EventSource {
                constructor(url, config) {
                  if (isHmr(url)) {
                    return { onerror() {}, onmessage() {}, onopen() {}, close() {} };
                  }
                  super(url, config);
                }
              };
              window.WebSocket = class extends WebSocket {
                constructor(url, protocols) {
                  if (isHmr(url) && !isNextHmr(url)) {
                    return { addEventListener() {}, removeEventListener() {}, send() {}, close() {}, readyState: 3 };
                  }
                  super(url, protocols);
                  if (!isNextHmr(url)) {
                    return;
                  }
                  let onmessage = null;
                  this.addEventListener("message", (event) => {
                    const data = event.data;
                    if (data instanceof ArrayBuffer && new Uint8Array(data)[0] === 0) {
                      onmessage?.call(this, event);
                    }
                  });
                  Object.defineProperty(this, "onmessage", {
                    get: () => onmessage,
                    set: (fn) => (onmessage = fn),
                  });
                }
              };
            })();
          `;

          const finalHtml = html.replace(
            headRegexp,
            `$&
            <script>
              ${spoofFreshNavigationTimingScript}
              ${disableHmrScript}

              window.history.replaceState({}, "", "${
                new URL(studioCtx.getHostUrl()).pathname + `#${makeFrameHash()}`
              }");
              !function(){const n=window,i="__REACT_DEVTOOLS_GLOBAL_HOOK__",o="__PlasmicPreambleVersion",t=function(){};
              if(void 0!==n){if(n.parent!==n)try{n[i]=n.parent[i]}catch(e){}if(!n[i]){const r=new Map;let d=0
              n[i]={supportsFiber:!0,renderers:r,inject:function(n){return r.set(++d,n),d},onCommitFiberRoot:t,onCommitFiberUnmount:t}}n[i][o]||(n[i][o]="1")}}()
              window.__PLASMIC_ARTBOARD = true;
            </script>
          `,
          );
          if (html.length === finalHtml.length) {
            throw new Error("Failed to inject Plasmic script into canvas host frame.");
          }

          doc.open();
          doc.write(finalHtml);
          doc.close();
          setLoadState("loading");

          if (doc.readyState === "complete") {
            hostDone();
            await handleLoad(viewport, load);
          } else {
            let releaseListener: () => void = () => undefined;
            const listener = spawnWrapper(async () => {
              if (doc.readyState === "complete") {
                doc.removeEventListener("readystatechange", listener);
                releaseListener();
                if (!load.isActive()) { return; }
                hostDone();
                await handleLoad(viewport, load);
              }
            });
            doc.addEventListener("readystatechange", listener);
            releaseListener = load.own(() => doc.removeEventListener("readystatechange", listener));
          }
        })().catch(error => {
          if (!load.isActive()) { return; }
          load.fail(error);
          studioCtx.reportCanvasLoadError(error);
        }),
      );
    }
  }, [loadState]);

  const interactive = useStudioRenderPolicy(studioCtx, (policy) => policy.interactive);
  const commentsOverlay = useStudioOverlayState(studioCtx, (state) => state.commentsOverlay);


  const contentView = useActiveContentEditor(studioCtx)?.viewCtx;
  const [contentSize, isContentEditing, contentReady] = useContentEditor(maybeViewCtx()?.contentEditor,
    useShallow((state) => [state.size, !!state.target, state.ready] as const));
  if (!alive || !studioCtx.arenaState.isCurrentLifetime(modelLifetime)) { return null; }
  return (
    <div className={styles.root} onClick={handleSelectionClick} style={contentView && contentView.arenaFrame() !== arenaFrame ? { visibility: "hidden", pointerEvents: "none" } : undefined}>
      <div
        className={"CanvasFrame__Container"}
        style={{
          ...(isFree
            ? {
                position: "absolute",
                left: ensure(
                  arenaFrame.left,
                  () => "Expected arenaFrame.left to exist",
                ),
                top: ensure(
                  arenaFrame.top,
                  () => "Expected arenaFrame.top to exist",
                ),
                width: contentSize?.width ?? arenaFrame.width,
                height: contentSize?.height ?? frameHeight,
              }
            : {
                width: contentSize?.width ?? arenaFrame.width,
                height: contentSize?.height ?? frameHeight,
              }),
          boxShadow: isContentEditing ? "none" : undefined,
        }}
        data-frame-id={`${arenaFrame.uid}`}
      >
        {(!initialRenderReady ||
          packagesLoading) && (
          <div
            className={styles.loadingOverlay}
            role="status"
            aria-label={studioUiT("Loading project…")}
            aria-busy="true"
          >
            <Skeleton
              active={loadState === "ready-to-load" || loadState === "loading" || packagesLoading}
              paragraph={{ rows: 5 }}
            />
          </div>
        )}
        <iframe
          style={isContentEditing ? { background: "transparent", opacity: contentReady ? 1 : 0 } : undefined}
          data-plasmic-frame-uuid={arenaFrame.uuid}
          data-plasmic-component-uuid={arenaFrame.container.component.uuid}
          className={cx(
            "canvas-editor__viewport",
            loadState !== "loaded" && "no-pointer-events",
          )}
          data-test-frame-uid={
            loadState === "unloaded" || loadState === "queued"
              ? undefined
              : arenaFrame.uid
          }
          allow="clipboard-read *; clipboard-write *"
          ref={iframeRef}
          key={
            iFrameKey +
            String(loadState === "unloaded" || loadState === "queued")
          }
        />
        {!isContentEditing && <><div
          className={"CanvasFrame__OverlayTop"}
          data-frame-uid={arenaFrame.uid}
        />
        <div
          className={"CanvasFrame__OverlayRight"}
          data-frame-uid={arenaFrame.uid}
        />
        <div
          className={"CanvasFrame__OverlayBottom"}
          data-frame-uid={arenaFrame.uid}
        />
        <div
          className={"CanvasFrame__OverlayLeft"}
          data-frame-uid={arenaFrame.uid}
        />
        </>}
        {DEVFLAGS.loadingDebug && (
          <div className={styles.statusBadge}>
            {loadState === "unloaded" && studioUiT("Mounted...")}
            {loadState === "queued" && studioUiT("Queued to be loaded...")}
            {loadState === "ready-to-load" &&
              studioUiT("Waiting to be loaded...")}
            {loadState === "loading" && studioUiT("Loading host...")}
            {initState === "user-body-wait" &&
              studioUiT("Waiting for host to render <PlasmicCanvasHost />...")}
            {initState === "script-wait" &&
              studioUiT("Executing artboard scripts...")}
            {initState === "hostless-wait" &&
              studioUiT("Installing built-in comopnent packages...")}
            {initState === "done" && studioUiT("Loaded")}
          </div>
        )}

        {!isContentEditing && <>
        <CanvasHeader studioCtx={studioCtx} frame={arenaFrame} arena={arena} />
        <XDraggable
          onStart={(e) => startMove(e)}
          onDrag={(e) => dragMove(e)}
          onStop={async () => stopMove()}
        >
          <span>
            <CanvasArtboardSelectionHandle
              frame={arenaFrame}
              onClick={handleArenaHandleClick}
            />
          </span>
        </XDraggable>
        {!interactive &&
          canComment &&
          commentsOverlay && (
            <CanvasCommentMarkers arena={arena} arenaFrame={arenaFrame} />
          )}
        <CanvasActions arena={arena} arenaFrame={arenaFrame} />
        </>}
        <CopilotActivityOverlay studioCtx={studioCtx} frame={arenaFrame} />
      </div>
    </div>
  );
});

function createCanvasCtx($viewport: JQuery<HTMLIFrameElement>, name: string) {
  return new CanvasCtx({
    $viewport,
    name,
  });
}

export function isCanvasOverlay($target: JQuery) {
  return $target.is(".__wab_canvas_overlay");
}
