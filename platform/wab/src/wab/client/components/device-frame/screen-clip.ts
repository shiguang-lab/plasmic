import type { CSSProperties } from "react";

type ScreenBox = { left: number; top: number; width: number; height: number };

/** Clip feedback to the actual screen, not to a rounded version of its target. */
export function screenClipStyle(
  screen: ScreenBox & { radius: number },
  target: ScreenBox,
  scale = 1,
): CSSProperties {
  const top = (screen.top - target.top) * scale;
  const left = (screen.left - target.left) * scale;
  const right = (target.left + target.width - screen.left - screen.width) * scale;
  const bottom = (target.top + target.height - screen.top - screen.height) * scale;
  return {
    clipPath: `inset(${top}px ${right}px ${bottom}px ${left}px round ${screen.radius * scale}px)`,
  };
}

/** The iframe's rendered radius also covers Preview and content-editing mode. */
export function viewportScreen(viewport: Element) {
  const radius = parseFloat(getComputedStyle(viewport).borderTopLeftRadius);
  return radius > 0 ? {
    left: 0,
    top: 0,
    width: viewport.clientWidth,
    height: viewport.clientHeight,
    radius,
  } : undefined;
}
