import { Box, Rect } from "@/wab/shared/geom";

/** All coordinates are relative to the canvas overlay's containing element. */
export function placeContentEditorToolbar(
  owner: Rect,
  safe: Rect,
  size: { width: number; height: number },
  obstacles: Rect[],
) {
  const width = size.width;
  const height = size.height;
  // Clamp to the component, not to the remaining visible viewport. Once the
  // toolbar reaches the component's left edge, it moves behind the panels with
  // the component instead of detaching to keep every action visible.
  const minLeft = owner.left;
  const maxLeft = Math.max(minLeft, owner.left + owner.width - width);
  const verticallyVisible =
    owner.top < safe.top + safe.height && owner.top + owner.height > safe.top;
  const anchor = {
    left: Math.max(minLeft, Math.min(safe.left + safe.width - width, maxLeft)),
    top: verticallyVisible
      ? Math.max(
          safe.top,
          Math.min(owner.top - height - 8, safe.top + safe.height - height),
        )
      : owner.top - height - 8,
  };
  const protectedBoxes = obstacles.map((rect) =>
    Box.fromRect({
      left: rect.left - 4,
      top: rect.top - 4,
      width: rect.width + 8,
      height: rect.height + 8,
    }),
  );
  const candidates = [
    anchor,
    ...obstacles.flatMap((rect) => [
      { left: anchor.left, top: rect.top - height - 8 },
      { left: anchor.left, top: rect.top + rect.height + 8 },
    ]),
    ...obstacles.flatMap((rect) => [
      { left: rect.left - width - 8, top: anchor.top },
      { left: rect.left + rect.width + 8, top: anchor.top },
    ]),
  ];
  const position =
    (verticallyVisible ? candidates : [anchor]).find(
      (candidate) =>
        candidate.left >= minLeft &&
        candidate.left <= maxLeft &&
        candidate.top >= safe.top &&
        candidate.top + height <= safe.top + safe.height &&
        !protectedBoxes.some((box) =>
          box.intersects(Box.fromRect({ ...candidate, width, height })),
        ),
    ) ?? anchor;
  return { ...position, maxWidth: Math.max(width, safe.width) };
}
