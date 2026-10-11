import { ensure } from "@/wab/shared/common";
export async function compose(
  pages: Array<{
    blob: Blob;
    width: number;
    height: number;
    left: number;
    top: number;
    name: string;
  }>,
) {
  const bounds = {
    left: Math.min(...pages.map((p) => p.left)),
    top: Math.min(...pages.map((p) => p.top)),
    right: Math.max(...pages.map((p) => p.left + p.width)),
    bottom: Math.max(...pages.map((p) => p.top + p.height)),
  };
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 360;
  const ctx = ensure(canvas.getContext("2d"), "Overview context");
  ctx.fillStyle = "#e8e9ef";
  ctx.fillRect(0, 0, 640, 360);
  const scale = Math.min(
    624 / (bounds.right - bounds.left),
    344 / (bounds.bottom - bounds.top),
  );
  const offsetX = (640 - (bounds.right - bounds.left) * scale) / 2,
    offsetY = (360 - (bounds.bottom - bounds.top) * scale) / 2;
  const positions = [];
  for (const page of pages) {
    const bitmap = await createImageBitmap(page.blob);
    const rect = {
      name: page.name,
      left: offsetX + (page.left - bounds.left) * scale,
      top: offsetY + (page.top - bounds.top) * scale,
      width: page.width * scale,
      height: page.height * scale,
    };
    ctx.drawImage(bitmap, rect.left, rect.top, rect.width, rect.height);
    bitmap.close();
    positions.push(rect);
  }
  try {
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Composite failed"))),
        "image/png",
      ),
    );
    return { blob, bounds, positions };
  } finally {
    canvas.width = canvas.height = 0;
  }
}
