import {
  readPreview,
  writePreview,
} from "@/wab/client/components/dashboard/preview/cache";
import { PreviewQueue } from "@/wab/client/components/dashboard/preview/queue";
import {
  previewChannel,
  previewFormat,
  type PreviewRequest,
} from "@/wab/client/components/dashboard/preview/types";
import { ENV } from "@/wab/client/env";
import { deserializeApiError } from "@/wab/shared/ApiErrors/errors";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { getStaticBaseUrl } from "@/wab/shared/urls";

const queue = new PreviewQueue();

function engineUrl(request: PreviewRequest) {
  return `${location.origin}/canvas-preview/index.html?v=${encodeURIComponent(ENV.COMMITHASH)}#live=true&origin=${encodeURIComponent(location.origin)}&staticBaseUrl=${encodeURIComponent(request.staticBaseUrl)}`;
}

/** Desktop renders previews in a separate process with the same engine document. */
interface DesktopPreviewBridge {
  render(
    id: string,
    src: string,
    request: PreviewRequest,
    scale: number,
  ): Promise<Uint8Array<ArrayBuffer>>;
  cancel(id: string): void;
}
function desktopPreviewBridge() {
  return (window as Window & { desktopPreview?: DesktopPreviewBridge })
    .desktopPreview;
}

export function renderPreview(request: PreviewRequest, signal: AbortSignal) {
  const desktop = desktopPreviewBridge();
  return desktop
    ? renderInDesktop(desktop, request, signal)
    : renderInFrame(request, signal);
}

async function renderInDesktop(
  desktop: DesktopPreviewBridge,
  request: PreviewRequest,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  const id = crypto.randomUUID();
  const abort = () => desktop.cancel(id);
  signal.addEventListener("abort", abort, { once: true });
  try {
    const bytes = await desktop.render(
      id,
      engineUrl(request),
      request,
      window.devicePixelRatio || 1,
    );
    signal.throwIfAborted();
    return new Blob([bytes], { type: "image/png" });
  } catch (error) {
    // Report cancellation the same way as the in-page renderer.
    signal.throwIfAborted();
    throw error;
  } finally {
    signal.removeEventListener("abort", abort);
  }
}

function renderInFrame(request: PreviewRequest, signal: AbortSignal) {
  return new Promise<Blob>((resolve, reject) => {
    signal.throwIfAborted();
    const frame = document.createElement("iframe");
    frame.title = "Canvas preview renderer";
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    frame.setAttribute("inert", "");
    // Keep its viewport on-screen: WebKit suspends animation frames in off-screen iframes.
    frame.style.cssText =
      "position:fixed;left:0;top:0;width:1440px;height:1024px;border:0;pointer-events:none;opacity:0;z-index:-1";
    let settled = false;
    const finish = (error?: unknown, blob?: Blob) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      window.removeEventListener("message", message);
      signal.removeEventListener("abort", abort);
      frame.onload = frame.onerror = null;
      // Destroy the entire realm, including codegen memoization, roots, timers and styles.
      frame.src = "about:blank";
      frame.remove();
      if (blob) {
        resolve(blob);
      } else {
        reject(error);
      }
    };
    const abort = () => finish(signal.reason);
    const message = (event: MessageEvent) => {
      if (
        event.source !== frame.contentWindow ||
        event.origin !== location.origin ||
        event.data?.channel !== previewChannel
      ) {
        return;
      }
      if (event.data.type === "ready") {
        frame.contentWindow?.postMessage(
          { channel: previewChannel, type: "start", request },
          location.origin,
        );
      } else if (
        event.data.type === "result" &&
        event.data.bytes instanceof ArrayBuffer
      ) {
        finish(undefined, new Blob([event.data.bytes], { type: "image/png" }));
      } else if (event.data.type === "error") {
        finish(new Error(event.data.message));
      }
    };
    const timer = setTimeout(
      () => finish(new Error("Canvas preview timed out")),
      90_000,
    );
    signal.addEventListener("abort", abort, { once: true });
    window.addEventListener("message", message);
    frame.onerror = () => finish(new Error("Canvas preview failed to load"));
    // Keep the runtime in a separate same-origin document, never import it into Dashboard.
    frame.src = engineUrl(request);
    document.body.append(frame);
  });
}

export function subscribePreview(
  userId: string,
  projectId: string,
  listener: (blob?: Blob) => void,
  /** Called when this project's preview starts generating (not while it waits in the queue). */
  onGenerating?: () => void,
) {
  const key = `${userId}:${projectId}`;
  const controller = new AbortController();
  const { signal } = controller;
  let unsubscribe: (() => void) | undefined;
  void (async () => {
    const cached = await readPreview(key).catch(() => undefined);
    signal.throwIfAborted();
    if (cached) {
      listener(cached.blob);
    }
    try {
      const response = await fetch(
        `/api/v1/projects/${encodeURIComponent(projectId)}/revision-without-data`,
        { signal },
      );
      if (!response.ok) {
        throw deserializeApiError(
          await response
            .json()
            .then((body) => body.error)
            .catch(() => undefined),
          response.status,
        );
      }
      const { rev } = await response.json();
      const revision: number = rev.revision;
      if (!Number.isInteger(revision)) {
        throw new Error("Invalid preview revision");
      }
      signal.throwIfAborted();
      // A new app build alone does not invalidate previews; Desktop releases
      // ship several times a day. Bump `previewFormat` when rendering changes.
      if (cached?.revision === revision && cached.format === previewFormat) {
        return;
      }
      unsubscribe = queue.subscribe(
        `${key}:${revision}`,
        async (renderSignal) => {
          const blob = await renderPreview(
            {
              projectId,
              revision,
              flags: DEVFLAGS,
              staticBaseUrl: getStaticBaseUrl(),
            },
            renderSignal,
          );
          renderSignal.throwIfAborted();
          await writePreview(key, revision, blob).catch(() => {
            /* Storage is optional; retain the generated preview. */
          });
          renderSignal.throwIfAborted();
          return blob;
        },
        (blob) => {
          if (!signal.aborted && (blob || !cached)) {
            listener(blob);
          }
        },
        onGenerating &&
          (() => {
            if (!signal.aborted) {
              onGenerating();
            }
          }),
      );
    } catch {
      if (!signal.aborted && !cached) {
        listener(undefined);
      }
    }
  })().catch(() => {
    /* Unsubscribing cancels cache delivery as well as background work. */
  });
  return () => {
    controller.abort();
    unsubscribe?.();
  };
}
