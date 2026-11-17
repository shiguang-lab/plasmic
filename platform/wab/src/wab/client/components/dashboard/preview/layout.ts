import type { ArtboardBounds } from "@/wab/client/components/dashboard/preview/types";

/** Include the shared shell's buttons, outline and shadow outside the viewport. */
export function previewBounds(board: ArtboardBounds) {
  const x = board.deviceFrame ? board.deviceFrame.insetX + 32 : 0;
  const y = board.deviceFrame ? board.deviceFrame.insetY + 32 : 0;
  return {
    left: board.left - x,
    top: board.top - y,
    width: board.width + 2 * x,
    height: board.height + 2 * y,
  };
}

export function overviewLayout(boards: ArtboardBounds[]) {
  if (
    !boards.length ||
    boards.some(
      (b) =>
        ![b.width, b.height, b.left, b.top].every(Number.isFinite) ||
        b.width <= 0 ||
        b.height <= 0 ||
        b.width * b.height > 16_000_000,
    )
  ) {
    throw new Error("Invalid or oversized preview artboard");
  }
  boards = boards.map(previewBounds);
  const left = Math.min(...boards.map((b) => b.left));
  const top = Math.min(...boards.map((b) => b.top));
  const width = Math.max(...boards.map((b) => b.left + b.width)) - left;
  const height = Math.max(...boards.map((b) => b.top + b.height)) - top;
  const scale = Math.min(624 / width, 344 / height);
  return boards.map((b) => ({
    left: (640 - width * scale) / 2 + (b.left - left) * scale,
    top: (360 - height * scale) / 2 + (b.top - top) * scale,
    width: b.width * scale,
    height: b.height * scale,
  }));
}
