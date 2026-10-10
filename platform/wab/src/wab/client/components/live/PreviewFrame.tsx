import { trapInteractionError } from "@/wab/client/components/canvas/studio-canvas-util";
import { PreviewCtx } from "@/wab/client/components/live/PreviewCtx";
import styles from "@/wab/client/components/live/PreviewViewport.module.scss";
import {
  onLoadInjectSystemJS,
  pushPreviewModules,
} from "@/wab/client/components/live/live-syncer";
import { getViewportScale } from "@/wab/client/components/live/preview-viewport";
import {
  getHostLessPkgIdentity,
  getSortedHostLessPkgs,
  getVersionForCanvasPackages,
} from "@/wab/client/components/studio/studio-bundles";
import { scriptExec } from "@/wab/client/dom-utils";
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
import { createStyles } from "antd-style";
import { autorun } from "mobx";
import { observer } from "mobx-react";
import React from "react";
import { useMountedState } from "react-use";

const frameHash =
  `#live=true&origin=${encodeURIComponent(getPublicUrl())}` +
  `&staticBaseUrl=${encodeURIComponent(getStaticBaseUrl())}`;

interface PreviewFrameProps {
  onDimensionsChange?: (dimensions: { width: number; height: number }) => void;
  previewCtx: PreviewCtx;
}

interface LivePreview {
  frameRef: React.MutableRefObject<Window | null>;
  onLoad: () => Promise<void>;
  reset: () => void;
}

export function useLivePreview(previewCtx: PreviewCtx): LivePreview {
  const frameRef = React.useRef<Window | null>(null);
  const [frameLoaded, setFrameLoaded] = React.useState(false);

  const usedPkgs = usedHostLessPkgs(previewCtx.studioCtx.site);
  const [installedPkgs, setInstalledPkgs] = React.useState<string[]>([]);
  const [isInstalling, setIsInstalling] = React.useState(false);
  const isMounted = useMountedState();

  const reset = () => {
    frameRef.current = null;
    setInstalledPkgs([]);
    setFrameLoaded(false);
  };

  const scrollToHash = () => {
    if (!frameRef.current || !previewCtx.pageHash) {
      return;
    }

    // We run it in the next-next event loop iteration in case it's still loading.
    // We need TWO setTimeouts for links where both the component and hash change (e.g. /path#anchor).
    // TODO: Trigger the scroll exactly when the anchored element is rendered.
    setTimeout(() => {
      setTimeout(() => {
        const id = previewCtx.pageHash.replace(/^#/, "");
        const anchorElement = frameRef.current?.document.getElementById(id);
        anchorElement?.scrollIntoView();
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
    const frameWindow = ensure(frameRef.current, `Frame must be loaded`);
    await onLoadInjectSystemJS(
      previewCtx.studioCtx,
      frameWindow,
      true,
      onAnchorClick,
    );

    (frameWindow as any).__PlasmicWrapUserFunction = (
      loc: InteractionLoc | InteractionArgLoc,
      fn: () => any,
      args: Record<string, any>,
    ) => {
      try {
        if (isInteractionLoc(loc) && loc.actionName === "navigation") {
          if (args.destination.startsWith("#")) {
            frameWindow.document
              .getElementById(args.destination.substring(1))
              ?.scrollIntoView({ behavior: "smooth" });
          } else {
            spawn(previewCtx.handleNavigation(`${args.destination}`));
          }
          return;
        }
        return fn();
      } catch (error) {
        trapInteractionError(previewCtx.studioCtx, loc, error);
        throw error;
      }
    };
    (frameWindow as any).__PlasmicWrapUserPromise = async (
      loc: InteractionLoc | InteractionArgLoc,
      promise: Promise<any>,
    ) => {
      try {
        return await promise;
      } catch (error) {
        trapInteractionError(previewCtx.studioCtx, loc, error);
        throw error;
      }
    };

    setFrameLoaded(true);
  };

  React.useEffect(() => {
    const installedPkgsSet = new Set(installedPkgs);
    if (!frameLoaded || !frameRef.current || isInstalling) {
      return;
    }
    const win = frameRef.current;
    if (
      usedPkgs.some(
        (pkg) =>
          !installedPkgsSet.has(
            getHostLessPkgIdentity(pkg, previewCtx.studioCtx.site),
          ),
      )
    ) {
      setIsInstalling(true);
      spawn(
        (async () => {
          const newInstalledPkgs = [...installedPkgs];
          for (const [pkg, pkgModule] of await getSortedHostLessPkgs(
            usedPkgs,
            getVersionForCanvasPackages(win),
            previewCtx.studioCtx.site,
          )) {
            if (!installedPkgsSet.has(pkg)) {
              if (!isMounted()) {
                return;
              }
              scriptExec(win, pkgModule);
              newInstalledPkgs.push(pkg);
            }
          }
          if (isMounted()) {
            setInstalledPkgs(newInstalledPkgs);
            setIsInstalling(false);
          }
        })(),
      );
    }
  }, [
    frameRef.current,
    frameLoaded,
    usedPkgs,
    installedPkgs,
    isInstalling,
    isMounted,
  ]);

  // Load component in live frame when it's ready or component changes.
  React.useEffect(() => {
    const installedPkgsSet = new Set(installedPkgs);
    if (
      !frameLoaded ||
      !frameRef.current ||
      isInstalling ||
      usedPkgs.some(
        (pkg) =>
          !installedPkgsSet.has(
            getHostLessPkgIdentity(pkg, previewCtx.studioCtx.site),
          ),
      )
    ) {
      return;
    }

    const doc = frameRef.current.document;
    const dispose = pushPreviewModules(doc, previewCtx, { lazy: false });

    // If previewCtx has a hash, scroll frame to it.
    if (previewCtx.pageHash) {
      scrollToHash();
    }

    return () => {
      dispose();
    };
  }, [frameRef.current, frameLoaded, isInstalling, usedPkgs, installedPkgs]);

  // This effect scrolls when the component or hash changes.
  React.useEffect(() => {
    return autorun(() => {
      if (!frameRef.current || (!previewCtx.isLive && !previewCtx.popup)) {
        return;
      }

      if (previewCtx.pageHash) {
        scrollToHash();
      } else {
        frameRef.current.scrollTo(0, 0);
      }
    });
  }, [frameRef.current, previewCtx]);

  return {
    frameRef,
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

export const PreviewFrame = observer(function PreviewFrame({
  previewCtx,
  onDimensionsChange,
}: PreviewFrameProps) {
  const { styles: themeStyles } = usePreviewStyles();
  const { t: uiT } = useI18n();
  const studioCtx = previewCtx.studioCtx;
  const stageRef = React.useRef<HTMLDivElement | null>(null);
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const { frameRef, onLoad } = useLivePreview(previewCtx);
  const [available, setAvailable] = React.useState({ width: 0, height: 0 });
  const [draft, setDraft] = React.useState<{
    width: number;
    height: number;
  } | null>(null);
  const [dragging, setDragging] = React.useState(false);
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
    frameRef.current = iframeRef.current?.contentWindow || null;
  }, [iframeRef.current]);

  React.useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    const resizeObserver = new ResizeObserver(() => {
      setAvailable({ width: stage.clientWidth, height: stage.clientHeight });
    });
    setAvailable({ width: stage.clientWidth, height: stage.clientHeight });
    resizeObserver.observe(stage);
    return () => resizeObserver.disconnect();
  }, []);

  React.useEffect(() => {
    setDraft(null);
  }, [previewCtx.viewport, previewCtx.width, previewCtx.height]);

  const setFrameColor = React.useCallback(
    (
      iframe: React.MutableRefObject<HTMLIFrameElement | null>,
      color: string | null | undefined,
    ) => {
      if (iframe.current?.contentDocument?.body?.style) {
        iframe.current.contentDocument.body.style.backgroundColor = color ?? "";
      }
    },
    [],
  );
  useFrameBgColor(iframeRef, previewCtx, setFrameColor);

  const fillsWindow = previewCtx.full || previewCtx.viewport === "desktop";
  const dimensions = draft ?? {
    width: previewCtx.width,
    height: previewCtx.height,
  };
  const scale = fillsWindow
    ? 1
    : dragging && drag.current
      ? drag.current.scale
      : getViewportScale(available, dimensions);
  const viewport = {
    viewport: previewCtx.viewport,
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
      className={`${styles.viewport} ${themeStyles.root} ${previewCtx.full ? styles.full : ""}`}
    >
      <div
        ref={stageRef}
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
                studioCtx.getHostUrl(),
              ) + frameHash
            }
            ref={iframeRef}
            onLoad={async () => {
              try {
                await onLoad();
              } catch (e: any) {
                if (!toggleTrailingSlash && e?.name === "SecurityError") {
                  setToggleTrailingSlash(true);
                  return;
                }
                throw e;
              }
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
          {!previewCtx.full &&
            previewCtx.viewport === "custom" &&
            (["left", "right", "bottom"] as const).map((edge) => (
              <button
                key={edge}
                type="button"
                aria-label={
                  edge === "bottom"
                    ? "Drag to resize preview height"
                    : `Drag to resize preview width (${edge} edge)`
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
      {!previewCtx.full && (
        <div className={styles.status} role="status">
          {viewport.width} × {viewport.height} px
          {previewCtx.viewport !== "desktop" &&
            ` · ${uiT("Zoom")} ${Math.round(scale * 100)}%`}
        </div>
      )}
    </div>
  );
});

export function useFrameBgColor<T>(
  iframeRef: React.MutableRefObject<T | null>,
  previewCtx: PreviewCtx,
  setFrameColor: (
    iframe: React.MutableRefObject<T | null>,
    color: string | undefined | null,
  ) => void,
) {
  const adjustBackgroundColor = () => {
    if (!previewCtx.component || isPageComponent(previewCtx.component)) {
      setFrameColor(iframeRef, null);
      return;
    }

    // We go directly through `getDedicatedArena` because studioCtx.getDedicatedArena
    // checks for editing mode, which is not relevant for picking the color of the frame.
    const componentArena = getDedicatedArena(
      previewCtx.studioCtx.site,
      previewCtx.component,
    );

    if (!componentArena) {
      setFrameColor(iframeRef, null);
      return;
    }

    assert(isComponentArena(componentArena), "Expected component arena");

    const activeVariants = new Set(previewCtx.getVariants());
    const currentFrame =
      getCustomFrameForActivatedVariants(componentArena, activeVariants) ??
      getFrameForActivatedVariants(componentArena, activeVariants);

    setFrameColor(iframeRef, currentFrame?.bgColor);
  };

  React.useEffect(() => {
    adjustBackgroundColor();
  }, [
    previewCtx.component,
    previewCtx.variants,
    previewCtx.global,
    previewCtx.studioCtx.focusedFrame()?.bgColor,
    iframeRef.current,
  ]);
}
