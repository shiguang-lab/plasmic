import { showCanvasAuthNotification } from "@/wab/client/components/canvas/studio-canvas-util";
import { SubDeps } from "@/wab/client/components/canvas/subdeps";
import { PreviewCtx } from "@/wab/client/components/live/PreviewCtx";
import { buildPreviewModules, buildPreviewUpdate, subscribePreviewCodegen } from "@/wab/client/components/live/preview-codegen";
import { staticPreviewPageLinks } from "@/wab/client/components/live/preview-page-links";
import type { Component } from "@/wab/shared/model/classes";
import {
  liveFrame,
  syncPreview,
} from "@/wab/client/components/live/preview-sync";
import {
  getLiveFrameClientJs,
  getReactWebBundle,
} from "@/wab/client/components/studio/studio-bundles";
import { scriptExec } from "@/wab/client/script-exec";
import { getUiLocale } from "@/wab/client/i18n";
import { translate } from "@/wab/client/i18n/locales";
import { PlasmicWindowInternals } from "@/wab/client/frame-ctx/windows";
import { requestIdleCallback } from "@/wab/client/requestidlecallback";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { getBuiltinComponentRegistrations } from "@/wab/shared/code-components/builtin-code-components";
import { withTimeout } from "@/wab/shared/common";
import * as Sentry from "@sentry/browser";
import L from "lodash";

const LIVE_HOST_TIMEOUT_MS = 3 * 60 * 1000;

function currentPreviewUpdate(previewCtx: PreviewCtx) {
  if (!previewCtx.previewData) { return undefined; }
  return buildPreviewUpdate(previewCtx.studioCtx, {
    component: previewCtx.component,
    previewPath: previewCtx.previewPath,
    variants: previewCtx.variants,
    globals: previewCtx.global,
    pageParams: previewCtx.pageParams,
    pageQuery: previewCtx.pageQuery,
    appUser: { user: previewCtx.studioCtx.currentAppUser, userAuthToken: previewCtx.studioCtx.currentAppUserCtx.fakeAuthToken },
  });
}

/** Prepare the current page alongside host/library loading, then its authored
 * link destinations. No runtime is evaluated and no business state is mounted. */
export async function preparePreviewModules(previewCtx: PreviewCtx, signal: AbortSignal) {
  const component = previewCtx.component;
  if (signal.aborted || !component || !previewCtx.isLive) { return; }
  const compiler = previewCtx.previewCompiler;
  const update = currentPreviewUpdate(previewCtx);
  if (!update) { return; }
  await compiler.compile(update.modules, signal);
  await prepareLinkedPages(previewCtx, component, signal);
}

async function prepareLinkedPages(previewCtx: PreviewCtx, component: Component, signal: AbortSignal) {
  const compiler = previewCtx.previewCompiler;
  const site = previewCtx.studioCtx.site;
  for (const page of staticPreviewPageLinks(site, component)) {
    if (signal.aborted || previewCtx.studioCtx.site !== site) { return; }
    await compiler.compile(buildPreviewModules(previewCtx.studioCtx, page).modules, signal);
  }
}

export function pushPreviewModules(
  win: Window,
  previewCtx: PreviewCtx,
  opts: { lazy?: boolean; onRendered?: () => void },
) {
  const scheduler = opts.lazy
    ? (run: () => void) => requestIdleCallback(run)
    : undefined;
  const disposeRun = syncPreview(
    win,
    () => currentPreviewUpdate(previewCtx),
    (error) => {
      if (error) {
        console.error("Live frame refresh error", error);
        Sentry.captureException(error);
      } else {
        // A variant may change while modules compile or the root commits,
        // before its state setters exist. Apply the current values on commit.
        liveFrame(win).setGlobals(previewCtx.global);
        liveFrame(win).setProps(previewCtx.variants);
      }
      opts.onRendered?.();
    },
    {
      name: "liveUpdate",
      compileModules: previewCtx.previewCompiler.compile,
      scheduler,
      subscribe: (invalidate) => {
        const disposeRoute = previewCtx.store.subscribe((next, previous) => {
          const component = (state: typeof next) => state.previewData && typeof state.previewData.componentPath !== "string" ? state.previewData.componentPath.component : undefined;
          const pageParams = (state: typeof next) => state.previewData && typeof state.previewData.componentPath !== "string" ? state.previewData.componentPath.pageParams : undefined;
          if (component(next) !== component(previous) ||
            next.previewData?.previewPath !== previous.previewData?.previewPath ||
            !L.isEqual(pageParams(next), pageParams(previous)) ||
            !L.isEqual(next.previewData?.pageQuery, previous.previewData?.pageQuery)) {
            invalidate();
          }
        });
        const disposeModel = subscribePreviewCodegen(previewCtx.studioCtx, () => previewCtx.component, invalidate);
        const disposeUser = previewCtx.studioCtx.currentAppUserStore.subscribe(invalidate);
        return () => { disposeRoute(); disposeModel(); disposeUser(); };
      },
    },
  );

  // Route variants update runtime state independently of module generation.
  let disposed = false;
  const disposeVariants = previewCtx.store.subscribe((next, previous) => {
    if (L.isEqual(next.previewData?.variants, previous.previewData?.variants) &&
      L.isEqual(next.previewData?.global, previous.previewData?.global)) { return; }
    const update = () => {
      if (!disposed) {
        liveFrame(win).setGlobals(previewCtx.global);
        liveFrame(win).setProps(previewCtx.variants);
      }
    };
    if (scheduler) { scheduler(update); } else { update(); }
  });
  return () => {
    disposed = true;
    disposeRun();
    disposeVariants();
  };
}

export function initPreviewInteractionGlobals(frameWindow: Window) {
  // Preview events execute normally without retaining Studio's interaction caches.
  (frameWindow as any).__PLASMIC_CACHE_$STEP_VALUE = () => {};
  (frameWindow as any).__PLASMIC_CACHE_EVENT_ARGS = () => {};
}

export async function onLoadInjectLiveRuntime(
  studioCtx: StudioCtx,
  frameWindow: Window,
  captureExceptions = true,
  onAnchorClick?: (href: string) => void,
  previewHref?: (href: string) => string | undefined,
) {
  await waitForLiveHost(frameWindow);
  if (!(frameWindow as any).__PlasmicReactWebBundle) {
    scriptExec(frameWindow, await getReactWebBundle());
  }
  (frameWindow as any).__PlasmicBuiltinRegistry = Object.values(
    getBuiltinComponentRegistrations({
      ...(frameWindow as any).__Sub,
      reactWeb: (frameWindow as any).__PlasmicReactWebBundle,
      dataSources: (frameWindow as any).__PlasmicDataSourcesBundle,
      dataSourcesContext: (frameWindow as any)
        .__PlasmicDataSourcesContextBundle,
    }),
  );
  (frameWindow as any).__PLASMIC__ = {
    EXECUTE_SERVER_QUERY: studioCtx.executeServerQuery,
  } as PlasmicWindowInternals;
  (frameWindow as any).__PLASMIC_EXECUTE_DATA_OP =
    studioCtx.executePlasmicDataOp;
  (frameWindow as any).__PLASMIC_MUTATE_DATA_OP =
    studioCtx.refreshFetchedDataFromPlasmicQuery;
  (frameWindow as any).__PLASMIC_GET_ALL_CACHE_KEYS =
    studioCtx.getAllDataOpCacheKeys;
  initPreviewInteractionGlobals(frameWindow);
  (frameWindow as any).__PLASMIC_STUDIO_PATH = () => {
    return studioCtx.previewCtx?.previewPath;
  };
  (frameWindow as any).__PLASMIC_AUTH_OVERRIDE = () => {
    showCanvasAuthNotification("preview mode");
  };
  const liveFrameClientJs = await getLiveFrameClientJs();
  scriptExec(frameWindow, liveFrameClientJs);
  liveFrame(frameWindow).setErrorTitle(translate(getUiLocale(), "Preview unavailable"));
  swallowAnchorClicks(frameWindow.document, onAnchorClick, previewHref);
  (
    frameWindow as unknown as { __Sub: SubDeps }
  ).__Sub.hostUtils.registerRenderErrorListener((error: Error) => {
    liveFrame(frameWindow).reportError(error, { kind: "render", fatal: true });
    console.error("Live frame render error", error);
    if (captureExceptions) {
      Sentry.captureException(error);
    }
  });
}

// The host can load `@plasmicapp/host` after the frame's load event.
export async function waitForLiveHost(win: Window) {
  const isReady = () =>
    !!(win as any).__Sub && !!win.document.querySelector(".__wab_user-body");
  if (isReady()) {
    return;
  }
  let cleanup = () => {
    /* */
  };
  try {
    await withTimeout(
      new Promise<void>((resolve) => {
        const check = () => isReady() && resolve();
        const observer = new MutationObserver(check);
        observer.observe(win.document, { childList: true, subtree: true });
        // MutationObserver sometimes stops firing in Chrome
        const intervalId = window.setInterval(check, 500);
        cleanup = () => {
          observer.disconnect();
          window.clearInterval(intervalId);
        };
      }),
      "Couldn't find the live preview host",
      LIVE_HOST_TIMEOUT_MS,
    );
  } finally {
    cleanup();
  }
}

export function swallowAnchorClicks(
  doc: Document,
  onAnchorClick?: (href: string) => void,
  previewHref?: (href: string) => string | undefined,
) {
  const anchorHrefs = new WeakMap<
    HTMLAnchorElement,
    { source: string; encoded: string }
  >();
  const click = (event: MouseEvent) => {
    const target = event.target as Element | null;
    const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!anchor || anchor.hasAttribute("download") || event.defaultPrevented) {
      return;
    }
    const raw = anchor.getAttribute("href");
    const previous = anchorHrefs.get(anchor);
    const href = raw === previous?.encoded ? previous.source : raw;
    if (!href) {
      return;
    }
    if (href === "#") {
      event.preventDefault();
      return;
    }
    const encoded = previewHref?.(href);
    if (previewHref && !encoded) {
      return;
    }
    if (
      event.type === "contextmenu" ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0 ||
      (anchor.target && anchor.target !== "_self")
    ) {
      if (encoded) {
        anchor.setAttribute("href", encoded);
        anchorHrefs.set(anchor, { source: href, encoded });
        if (event.type === "contextmenu") {
          return;
        }
        setTimeout(() => {
          if (anchor.getAttribute("href") === encoded) {
            anchor.setAttribute("href", href);
            anchorHrefs.delete(anchor);
          }
        }, 0);
      }
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    onAnchorClick?.(href);
  };
  doc.body.addEventListener("click", click, true);
  doc.body.addEventListener("auxclick", click, true);
  doc.body.addEventListener("contextmenu", click, true);
}
