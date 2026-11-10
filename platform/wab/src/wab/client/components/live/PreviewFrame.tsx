import { trapInteractionError } from "@/wab/client/components/canvas/studio-canvas-util";
import { PreviewCtx, usePreviewSelector } from "@/wab/client/components/live/PreviewCtx";
import { PreviewLoading } from "@/wab/client/components/live/PreviewLoading";
import styles from "@/wab/client/components/live/PreviewViewport.module.scss";
import {
  onLoadInjectLiveRuntime,
  preparePreviewModules,
  pushPreviewModules,
} from "@/wab/client/components/live/live-syncer";
import { getViewportScale } from "@/wab/client/components/live/preview-viewport";
import { liveFrame, showPreviewLoadError } from "@/wab/client/components/live/preview-sync";
import {
  getHostLessPkgIdentity,
  getSortedHostLessPkgs,
  getVersionForCanvasPackages,
} from "@/wab/client/components/studio/studio-bundles";
import { useHostFrameCtx } from "@/wab/client/frame-ctx/host-frame-ctx";
import { installPreviewAgentCursor } from "@/wab/client/copilot/agent-cursor";
import { scriptExec } from "@/wab/client/script-exec";
import { useI18n } from "@/wab/client/i18n";
import { maybeToggleTrailingSlash } from "@/wab/client/utils/app-hosting-utils";
import { isComponentArena } from "@/wab/shared/Arenas";
import { usedHostLessPkgs } from "@/wab/shared/cached-selectors";
import { assert, ensure, spawn } from "@/wab/shared/common";
import {
  getCustomFrameForActivatedVariants,
  getFrameForActivatedVariants,
} from "@/wab/shared/component-arenas";
import { isPageComponent } from "@/wab/shared/core/components";
import {
  InteractionArgLoc,
  InteractionLoc,
  isInteractionLoc,
} from "@/wab/shared/core/exprs";
import { getDedicatedArena } from "@/wab/shared/core/sites";
import { getPublicUrl, getStaticBaseUrl } from "@/wab/shared/urls";
import { readBusinessAnchor } from "@plasmic-shared/preview";
import { theme as AntdTheme } from "antd";
import { createStyles } from "antd-style";
import React from "react";
import { useMountedState } from "react-use";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

const frameHash =
  `#live=true&origin=${encodeURIComponent(getPublicUrl())}` +
  `&staticBaseUrl=${encodeURIComponent(getStaticBaseUrl())}`;

interface PreviewFrameProps {
  onDimensionsChange?: (dimensions: { width: number; height: number }) => void;
  previewCtx: PreviewCtx;
}

class PreviewFrameBinding {
  private snapshot: Readonly<{ window: Window | null; generation: number }> = Object.freeze({ window: null, generation: 0 });
  private readonly listeners = new Set<() => void>();
  read = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  attach = (window: Window | null) => {
    if (this.snapshot.window === window) { return; }
    this.snapshot = Object.freeze({ ...this.snapshot, window });
    this.listeners.forEach((listener) => listener());
  };
  beginLoad() {
    this.snapshot = Object.freeze({ ...this.snapshot, generation: this.snapshot.generation + 1 });
    this.listeners.forEach((listener) => listener());
    return this.snapshot;
  }
  reset = () => {
    this.snapshot = Object.freeze({ window: null, generation: this.snapshot.generation + 1 });
    this.listeners.forEach((listener) => listener());
  };
  isCurrent(window: Window, generation: number) { return this.snapshot.window === window && this.snapshot.generation === generation; }
}

function installPreviewInteractionHandlers(frameWindow: Window, previewCtx: PreviewCtx) {
    (frameWindow as any).__PlasmicWrapUserFunction = (
      loc: InteractionLoc | InteractionArgLoc,
      fn: () => any,
      args: Record<string, any>,
    ) => {
      try {
        if (isInteractionLoc(loc) && loc.actionName === "navigation") {
          if (
            typeof args.destination !== "string" ||
            !args.destination.trim()
          ) {
            throw new Error(
              "Navigation destination must be a non-empty string",
            );
          }
          spawn(previewCtx.handleNavigation(args.destination));
          return;
        }
        return fn();
      } catch (error) {
        liveFrame(frameWindow).reportError(error, { kind: "interaction", fatal: false, interactionUuid: loc.interactionUuid });
        trapInteractionError(previewCtx.studioCtx, loc, error);
        throw error;
      }
    };
    (frameWindow as any).__PlasmicWrapUserPromise = async (
      loc: InteractionLoc | InteractionArgLoc,
      promise: Promise<any>,
    ) => {
      const runtimeGeneration = liveFrame(frameWindow).getDiagnostics().generation;
      try {
        return await promise;
      } catch (error) {
        liveFrame(frameWindow).reportError(error, { kind: "interaction", fatal: false, interactionUuid: loc.interactionUuid }, runtimeGeneration);
        trapInteractionError(previewCtx.studioCtx, loc, error);
        throw error;
      }
    };

}

interface LivePreview {
  loading: boolean;
  attachFrame: (window: Window | null) => void;
  onLoad: () => Promise<void>;
  reset: () => void;
}

export function useLivePreview(previewCtx: PreviewCtx): LivePreview {
  const { revealStudio } = useHostFrameCtx();
  const { t } = useI18n();
  const errorDisplay = { title: t("Preview unavailable"), label: t("Back to editor"), onReturn: () => { spawn(previewCtx.stopLiveMode()); } };
  const { token } = AntdTheme.useToken();
  const full = usePreviewSelector(previewCtx, (state) => state.previewData?.full ?? false);
  const route = usePreviewSelector(previewCtx, (state) => state.previewData);
  const pageHash = route?.pageHash ?? "";
  const isLive = usePreviewSelector(previewCtx, (state) => state.isLive);
  const [binding] = React.useState(() => new PreviewFrameBinding());
  const frame = React.useSyncExternalStore(binding.subscribe, binding.read, binding.read);
  const [loadedFrame, setLoadedFrame] = React.useState<ReturnType<PreviewFrameBinding["read"]> | null>(null);
  const [settledFrame, setSettledFrame] = React.useState<ReturnType<PreviewFrameBinding["read"]> | null>(null);
  const frameLoaded = loadedFrame === frame;

  React.useEffect(() => {
    if (!isLive || !route) { return; }
    const preparation = new AbortController();
    // The foreground render queue presents compilation errors for its current
    // page. Speculative destinations must not replace the page being viewed.
    void preparePreviewModules(previewCtx, preparation.signal).catch(() => undefined);
    return () => preparation.abort();
  }, [previewCtx, isLive, route]);

  React.useEffect(() => {
    const win = frame.window;
    if (!frameLoaded || !win) {
      return;
    }
    liveFrame(win).setErrorTitle(errorDisplay.title, errorDisplay);
    const dispose = installPreviewAgentCursor(win, {
      label: t("AI assistant"),
      color: token.colorPrimary,
      scale: () => {
        const iframe = win.frameElement;
        return iframe
          ? iframe.getBoundingClientRect().width /
              (iframe as HTMLElement).offsetWidth || 1
          : 1;
      },
    });
    const clear = () => {
      // SPA navigation keeps the iframe but must discard the previous target.
      win.dispatchEvent(
        new (win as Window & typeof globalThis).CustomEvent(
          "plasmic-agent-cursor",
          { detail: { action: "clear" } },
        ),
      );
    };
    clear();
    const stop = previewCtx.store.subscribe((next, previous) => {
      if (next.previewData !== previous.previewData) { clear(); }
    });
    return () => {
      stop();
      dispose();
    };
  }, [frameLoaded, frame.window, previewCtx, t, token.colorPrimary]);

  const usedPkgs = usePreviewPackages(previewCtx);
  const [installedPkgs, setInstalledPkgs] = React.useState<string[]>([]);
  const [installationStatus, setInstallationStatus] = React.useState<"idle" | "loading" | "failed">("idle");
  const isMounted = useMountedState();

  const reset = () => {
    binding.reset();
    setInstallationStatus("idle");
    setInstalledPkgs([]);
    setLoadedFrame(null);
    setSettledFrame(null);
  };

  const scrollToHash = () => {
    const current = binding.read();
    const win = current.window;
    if (!win || !previewCtx.pageHash) { return; }
    // Components and anchor targets can settle in separate event turns.
    setTimeout(() => {
      setTimeout(() => {
        if (!isMounted() || !binding.isCurrent(win, current.generation)) { return; }
        const id = readBusinessAnchor(previewCtx.pageHash);
        win.document.getElementById(id)?.scrollIntoView();
      }, 0);
    }, 0);
  };

  const onAnchorClick = (href: string) => {
    if (!href) {
      return;
    }

    spawn(previewCtx.handleNavigation(href));
  };

  const onLoad = async () => {
    const currentFrame = binding.beginLoad();
    setLoadedFrame(null);
    setInstalledPkgs([]);
    setInstallationStatus("idle");
    const frameWindow = ensure(currentFrame.window, `Frame must be loaded`);
    const generation = currentFrame.generation;
    try {
      await onLoadInjectLiveRuntime(
        previewCtx.studioCtx,
        frameWindow,
        true,
        onAnchorClick,
        (href) => previewCtx.hrefForNavigation(href),
      );
    } catch (error) {
      if (!isMounted() || !binding.isCurrent(frameWindow, generation)) { return; }
      // The iframe owner retries this specific cross-origin URL failure.
      if ((error as Error)?.name === "SecurityError") { throw error; }
      await showPreviewLoadError(frameWindow, error, errorDisplay);
      if (!isMounted() || !binding.isCurrent(frameWindow, generation)) { return; }
      setSettledFrame(currentFrame);
      if (full && isMounted() && binding.isCurrent(frameWindow, generation)) {
        await revealStudio();
      }
      return;
    }
    if (
      !isMounted() ||
      !binding.isCurrent(frameWindow, generation)
    ) {
      return;
    }

    installPreviewInteractionHandlers(frameWindow, previewCtx);

    setLoadedFrame(currentFrame);
  };

  React.useEffect(() => {
    const installedPkgsSet = new Set(installedPkgs);
    if (!frameLoaded || !frame.window || installationStatus !== "idle") {
      return;
    }
    const win = frame.window;
    const generation = frame.generation;
    const isCurrentFrame = () =>
      isMounted() &&
      binding.isCurrent(win, generation);
    if (
      usedPkgs.some(
        (pkg) =>
          !installedPkgsSet.has(
            getHostLessPkgIdentity(pkg, previewCtx.studioCtx.site),
          ),
      )
    ) {
      setInstallationStatus("loading");
      spawn(
        (async () => {
          const modules = await getSortedHostLessPkgs(
            win,
          previewCtx.studioCtx.appCtx.api,
            usedPkgs,
            getVersionForCanvasPackages(win),
            previewCtx.studioCtx.site,
          );
          const currentPackages = new Set(modules.map(([pkg]) => pkg));
          const newInstalledPkgs = installedPkgs.filter((pkg) =>
            currentPackages.has(pkg),
          );
          for (const [pkg, pkgModule] of modules) {
            if (!installedPkgsSet.has(pkg)) {
              if (!isCurrentFrame()) {
                return;
              }
              scriptExec(win, pkgModule);
              newInstalledPkgs.push(pkg);
            }
          }
          if (isCurrentFrame()) {
            setInstalledPkgs(newInstalledPkgs);
            setInstallationStatus("idle");
          }
        })().catch(async (error) => {
          if (!isCurrentFrame()) { return; }
          setInstallationStatus("failed");
          await showPreviewLoadError(win, error, errorDisplay);
          if (!isCurrentFrame()) { return; }
          setSettledFrame(frame);
          if (full && isCurrentFrame()) { await revealStudio(); }
        }),
      );
    }
  }, [
    frame,
    frame.window,
    frameLoaded,
    usedPkgs,
    installedPkgs,
    installationStatus,
    full,
    revealStudio,
    isMounted,
  ]);

  // Load component in live frame when it's ready or component changes.
  React.useEffect(() => {
    const installedPkgsSet = new Set(installedPkgs);
    if (
      !frameLoaded ||
      !frame.window ||
      installationStatus !== "idle" ||
      usedPkgs.some(
        (pkg) =>
          !installedPkgsSet.has(
            getHostLessPkgIdentity(pkg, previewCtx.studioCtx.site),
          ),
      )
    ) {
      return;
    }

    const win = frame.window;
    const generation = frame.generation;
    let active = true;
    let readyNotified = false;
    const dispose = pushPreviewModules(win, previewCtx, {
      lazy: false,
      onRendered: () => {
        if (
          active &&
          !readyNotified &&
          binding.isCurrent(win, generation)
        ) {
          readyNotified = true;
          setSettledFrame(frame);
          if (full) { spawn(revealStudio()); }
        }
      },
    });

    // If previewCtx has a hash, scroll frame to it.
    if (previewCtx.pageHash) {
      scrollToHash();
    }

    return () => {
      active = false;
      dispose();
    };
  }, [
    frame,
    frame.window,
    frameLoaded,
    installationStatus,
    usedPkgs,
    installedPkgs,
    full,
    revealStudio,
  ]);

  // Route inputs are subscribed independently of package installation.
  React.useEffect(() => {
    if (!frame.window || !isLive) { return; }
    if (pageHash) { scrollToHash(); } else { frame.window.scrollTo(0, 0); }
  }, [frame.window, previewCtx, isLive, route, pageHash]);

  return {
    loading: settledFrame !== frame,
    attachFrame: binding.attach,
    onLoad,
    reset,
  };
}

const usePreviewStyles = createStyles(({ token }) => ({
  root: {
    "--preview-surface": token.colorBgContainer,
    "--preview-layout": token.colorBgLayout,
    "--preview-text": token.colorText,
    "--preview-muted": token.colorTextSecondary,
    "--preview-border": token.colorBorderSecondary,
    "--preview-primary": token.colorPrimary,
  },
}));

export function PreviewFrame({
  previewCtx,
  onDimensionsChange,
}: PreviewFrameProps) {
  const { styles: themeStyles } = usePreviewStyles();
  const { t: uiT } = useI18n();
  const studioCtx = previewCtx.studioCtx;
  const hostUrl = useStore(studioCtx.uiEnvironment.store, (state) => state.hostUrl);
  const full = usePreviewSelector(previewCtx, (state) => state.previewData?.full ?? false);
  const viewportMode = usePreviewSelector(previewCtx, (state) => state.previewData?.viewport ?? "desktop");
  const width = usePreviewSelector(previewCtx, (state) => state.previewData?.width ?? 320);
  const height = usePreviewSelector(previewCtx, (state) => state.previewData?.height ?? 480);
  const [stage, setStage] = React.useState<HTMLDivElement | null>(null);
  const [iframe, setIframe] = React.useState<HTMLIFrameElement | null>(null);
  const { attachFrame, onLoad, loading } = useLivePreview(previewCtx);
  const attachIframe = React.useCallback((element: HTMLIFrameElement | null) => {
    setIframe(element);
    attachFrame(element?.contentWindow ?? null);
  }, [attachFrame]);
  const [available, setAvailable] = React.useState({ width: 0, height: 0 });
  const [draft, setDraft] = React.useState<{
    width: number;
    height: number;
  } | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const [dragScale, setDragScale] = React.useState<number>();
  const [toggleTrailingSlash, setToggleTrailingSlash] = React.useState(false);
  const drag = React.useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
    scale: number;
    edge: "left" | "right" | "bottom";
  } | null>(null);

  React.useEffect(() => {
    if (!stage) {
      return;
    }
    const resizeObserver = new ResizeObserver(() => {
      setAvailable({ width: stage.clientWidth, height: stage.clientHeight });
    });
    setAvailable({ width: stage.clientWidth, height: stage.clientHeight });
    resizeObserver.observe(stage);
    return () => resizeObserver.disconnect();
  }, [stage]);

  React.useEffect(() => {
    setDraft(null);
  }, [viewportMode, width, height]);

  const updateFrameBgColor = useFrameBgColor(iframe, previewCtx);

  const fillsWindow = full || viewportMode === "desktop";
  const dimensions = draft ?? {
    width: width,
    height: height,
  };
  const scale = fillsWindow
    ? 1
    : dragging && dragScale !== undefined
      ? dragScale
      : getViewportScale(available, dimensions);
  const viewport = {
    viewport: viewportMode,
    ...(fillsWindow ? available : dimensions),
  };

  React.useEffect(() => {
    onDimensionsChange?.({ width: viewport.width, height: viewport.height });
  }, [onDimensionsChange, viewport.width, viewport.height]);

  const draggedDimensions = (event: React.PointerEvent) => {
    const start = ensure(drag.current, "Expected active preview resize");
    const deltaX = (event.clientX - start.x) / start.scale;
    const deltaY = (event.clientY - start.y) / start.scale;
    return {
      width: Math.round(
        Math.min(
          7680,
          Math.max(
            240,
            start.width +
              (start.edge === "bottom"
                ? 0
                : deltaX * (start.edge === "left" ? -2 : 2)),
          ),
        ),
      ),
      height: Math.round(
        Math.min(
          7680,
          Math.max(240, start.height + (start.edge === "bottom" ? deltaY : 0)),
        ),
      ),
    };
  };

  return (
    <div
      className={`${styles.viewport} ${themeStyles.root} ${full ? styles.full : ""}`}
    >
      <div
        ref={setStage}
        className={`${styles.stage} ${fillsWindow ? styles.desktop : ""}`}
        data-test-id="preview-stage"
      >
        <div
          className="CanvasFrame__Container CanvasFrame__Container--live"
          style={{
            display: "block",
            width: fillsWindow ? "100%" : dimensions.width,
            height: fillsWindow ? "100%" : dimensions.height,
            left: fillsWindow
              ? 0
              : (available.width - dimensions.width * scale) / 2,
            top: fillsWindow ? 0 : 20,
            transform: fillsWindow ? undefined : `scale(${scale})`,
            transformOrigin: "top left",
            boxShadow: fillsWindow ? "none" : undefined,
            borderRadius: fillsWindow ? 0 : 8,
            outline: fillsWindow
              ? undefined
              : "1px solid var(--preview-border)",
          }}
        >
          <iframe
            src={
              maybeToggleTrailingSlash(
                toggleTrailingSlash,
                hostUrl,
              ) + frameHash
            }
            ref={attachIframe}
            onLoad={() => {
              updateFrameBgColor();
              return onLoad().catch((error: unknown) => {
              if (!toggleTrailingSlash && error != null && typeof error === "object" && "name" in error && error.name === "SecurityError") {
                setToggleTrailingSlash(true);
                return;
              }
              throw error;
              });
            }}
            title={uiT("Page preview")}
            style={{
              width: "100%",
              height: "100%",
              border: 0,
              display: "block",
              borderRadius: "inherit",
            }}
            data-test-id="live-frame"
          />
          {dragging && <div className="CanvasFrame__Cover" />}
          {!full &&
            viewportMode === "custom" &&
            (["left", "right", "bottom"] as const).map((edge) => (
              <button
                key={edge}
                type="button"
                aria-label={
                  edge === "bottom"
                    ? uiT("Drag to resize preview height")
                    : uiT("Drag to resize preview width ({part1} edge)", {
                        part1: String(edge),
                      })
                }
                className={`${styles.resize} ${styles[edge]}`}
                onPointerDown={(event) => {
                  if (event.button !== 0) {
                    return;
                  }
                  event.preventDefault();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  drag.current = {
                    x: event.clientX,
                    y: event.clientY,
                    ...dimensions,
                    scale,
                    edge,
                  };
                  setDragScale(scale);
                  setDragging(true);
                }}
                onPointerMove={(event) => {
                  if (drag.current) {
                    setDraft(draggedDimensions(event));
                  }
                }}
                onPointerUp={(event) => {
                  if (!drag.current) {
                    return;
                  }
                  const next = draggedDimensions(event);
                  drag.current = null;
                  setDraft(next);
                  setDragging(false);
                  spawn(
                    previewCtx.pushViewport({ viewport: "custom", ...next }),
                  );
                }}
                onPointerCancel={() => {
                  drag.current = null;
                  setDraft(null);
                  setDragging(false);
                }}
                onKeyDown={(event) => {
                  const step =
                    event.key === "ArrowRight" || event.key === "ArrowDown"
                      ? 10
                      : event.key === "ArrowLeft" || event.key === "ArrowUp"
                        ? -10
                        : 0;
                  if (!step) {
                    return;
                  }
                  event.preventDefault();
                  const next = { ...dimensions };
                  const axis = edge === "bottom" ? "height" : "width";
                  next[axis] = Math.min(7680, Math.max(240, next[axis] + step));
                  spawn(
                    previewCtx.pushViewport({ viewport: "custom", ...next }),
                  );
                }}
              />
            ))}
        </div>
      </div>
      {loading && <PreviewLoading />}
    </div>
  );
}

function usePreviewPackages(previewCtx: PreviewCtx) {
  const studioCtx = previewCtx.studioCtx;
  const readPackages = React.useCallback(() => {
    const packages = usedHostLessPkgs(studioCtx.site);
    return { packages, identities: packages.map((pkg) => getHostLessPkgIdentity(pkg, studioCtx.site)) };
  }, [studioCtx]);
  const store = React.useMemo(() => createStore(readPackages), [readPackages]);
  React.useEffect(() => {
    const sync = () => {
      const next = readPackages();
      const previous = store.getState();
      if (next.identities.length !== previous.identities.length || next.identities.some((identity, index) => identity !== previous.identities[index])) { store.setState(next, true); }
    };
    const dispose = studioCtx.subscribeModelChanges((event) => {
      if (event.type === "site-replaced" || event.summary.changes.some(({ path, changeNode }) => (path ?? [changeNode]).some(({ field }) => ["projectDependencies", "hostLessPackageInfo"].includes(field)))) { sync(); }
    });
    sync();
    return dispose;
  }, [studioCtx, store, readPackages]);
  return useStore(store, (state) => state.packages);
}

function setFrameBackground(iframe: HTMLIFrameElement | null, color: string | null | undefined) {
  if (iframe?.contentDocument?.body) { iframe.contentDocument.body.style.backgroundColor = color ?? ""; }
}

export function useFrameBgColor(iframe: HTMLIFrameElement | null, previewCtx: PreviewCtx) {
  const adjustBackgroundColor = () => {
    if (!previewCtx.component || isPageComponent(previewCtx.component)) {
      setFrameBackground(iframe,  null);
      return;
    }

    // We go directly through `getDedicatedArena` because studioCtx.getDedicatedArena
    // checks for editing mode, which is not relevant for picking the color of the frame.
    const componentArena = getDedicatedArena(
      previewCtx.studioCtx.site,
      previewCtx.component,
    );

    if (!componentArena) {
      setFrameBackground(iframe,  null);
      return;
    }

    assert(isComponentArena(componentArena), "Expected component arena");

    const activeVariants = new Set(previewCtx.getVariants());
    const currentFrame =
      getCustomFrameForActivatedVariants(componentArena, activeVariants) ??
      getFrameForActivatedVariants(componentArena, activeVariants);

    setFrameBackground(iframe,  currentFrame?.bgColor);
  };

  React.useEffect(() => {
    adjustBackgroundColor();
    const stopRoute = previewCtx.store.subscribe((next, previous) => {
      if (next.previewData !== previous.previewData) { adjustBackgroundColor(); }
    });
    const stopModel = previewCtx.studioCtx.subscribeModelChanges(() => adjustBackgroundColor());
    return () => { stopRoute(); stopModel(); };
  }, [previewCtx, iframe]);
  return adjustBackgroundColor;
}
