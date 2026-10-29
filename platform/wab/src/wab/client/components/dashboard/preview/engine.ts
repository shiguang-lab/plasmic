import { overviewLayout } from "@/wab/client/components/dashboard/preview/layout";
import { load, ready } from "@/wab/client/components/dashboard/preview/renderer";
import { rasterize, snapshot } from "@/wab/client/components/dashboard/preview/snapshot";
import { previewCanvasBackground, previewChannel, type PreviewRequest } from "@/wab/client/components/dashboard/preview/types";
import { ensure } from "@/wab/shared/common";

async function generate(request: PreviewRequest) {
  const { pages } = await load(request);
  const positions = overviewLayout(pages);
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 360;
  const ctx = ensure(canvas.getContext("2d"), "Overview context");
  ctx.fillStyle = previewCanvasBackground;
  ctx.fillRect(0, 0, 640, 360);
  // Artboards of one project share fonts and images; inline each URL once.
  const assets = new Map<string, Promise<string>>();
  try {
    for (let i = 0; i < pages.length; i++) {
      const board = pages[i],
        rect = positions[i];
      const frame = ensure(
        window.frameElement,
        "Preview iframe",
      ) as HTMLElement;
      frame.style.width = `${board.width}px`;
      frame.style.height = `${board.height}px`;
      await (window as any).__renderCover(board.uuid);
      await ready();
      const shot = await snapshot(document, board.width, board.height, assets);
      if (shot.stats.assetErrors.length) {
        throw new Error(shot.stats.assetErrors.join("\n"));
      }
      // Decode one source SVG at a time, then draw directly into a thumbnail-sized canvas.
      // Keeping the SVG viewport intact preserves foreignObject CSS in WebKit.
      const image = await rasterize(
        shot.svg,
        Math.max(1, Math.ceil(rect.width)),
        Math.max(1, Math.ceil(rect.height)),
      );
      const bitmap = await createImageBitmap(image);
      try {
        ctx.drawImage(bitmap, rect.left, rect.top, rect.width, rect.height);
      } finally {
        bitmap.close();
      }
      (window as any).__Sub.hostUtils.setPlasmicRootNode(null);
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
    }
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Preview encoding failed"))),
        "image/png",
      ),
    );
    return await blob.arrayBuffer();
  } finally {
    (window as any).__Sub?.hostUtils.setPlasmicRootNode(null);
    document.querySelectorAll("canvas").forEach((c) => {
      c.width = c.height = 0;
    });
    canvas.width = canvas.height = 0;
  }
}

async function start(event: MessageEvent) {
  if (
    event.source !== window.parent ||
    event.origin !== location.origin ||
    event.data?.channel !== previewChannel ||
    event.data.type !== "start"
  ) {
    return;
  }
  window.removeEventListener("message", start);
  try {
    const bytes = await generate(event.data.request);
    window.parent.postMessage(
      { channel: previewChannel, type: "result", bytes },
      location.origin,
      [bytes],
    );
  } catch (error) {
    window.parent.postMessage(
      { channel: previewChannel, type: "error", message: String(error) },
      location.origin,
    );
  }
}
window.addEventListener("message", start);
window.parent.postMessage(
  { channel: previewChannel, type: "ready" },
  location.origin,
);
