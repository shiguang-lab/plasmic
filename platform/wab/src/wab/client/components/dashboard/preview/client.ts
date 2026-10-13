import {
  readPreview,
  writePreview,
} from "@/wab/client/components/dashboard/preview/cache";
import { PreviewQueue } from "@/wab/client/components/dashboard/preview/queue";
import {
  previewChannel,
  type PreviewRequest,
} from "@/wab/client/components/dashboard/preview/types";
import { ENV } from "@/wab/client/env";
import { deserializeApiError } from "@/wab/shared/ApiErrors/errors";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { getStaticBaseUrl } from "@/wab/shared/urls";

const queue = new PreviewQueue();

export function renderPreview(request: PreviewRequest, signal: AbortSignal) {
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
    frame.src = `/canvas-preview/index.html?v=${encodeURIComponent(ENV.COMMITHASH)}#live=true&origin=${encodeURIComponent(location.origin)}&staticBaseUrl=${encodeURIComponent(request.staticBaseUrl)}`;
    document.body.append(frame);
  });
}

export function subscribePreview(
  userId: string,
  projectId: string,
  listener: (blob?: Blob) => void,
) {
  const key = `${userId}:${projectId}:${ENV.COMMITHASH}`;
  return queue.subscribe(
    key,
    async (signal) => {
      // Check permissions and the current shared revision before using a local image.
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
      const hit = await readPreview(key, revision).catch(() => undefined);
      signal.throwIfAborted();
      if (hit) {
        return hit;
      }
      const blob = await renderPreview(
        {
          projectId,
          revision,
          flags: DEVFLAGS,
          staticBaseUrl: getStaticBaseUrl(),
        },
        signal,
      );
      signal.throwIfAborted();
      await writePreview(key, revision, blob).catch(() => {
        /* Storage is optional; retain the generated preview. */
      });
      signal.throwIfAborted();
      return blob;
    },
    listener,
  );
}
