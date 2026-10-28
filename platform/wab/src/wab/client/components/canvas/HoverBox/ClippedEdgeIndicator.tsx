import styles from "@/wab/client/components/canvas/HoverBox/ClippedEdgeIndicator.module.scss";
import {
  canRevealEdge,
  revealEdge,
} from "@/wab/client/components/canvas/HoverBox/visible-bounds";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { useI18n } from "@/wab/client/i18n";
import type { MessageKey } from "@/wab/client/i18n/locales";
import ChevronDownSvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__ChevronDownSvg";
import ChevronLeftSvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__ChevronLeftSvg";
import ChevronRightSvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__ChevronRightSvg";
import ChevronUpSvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__ChevronUpSvg";
import { Rect, Side } from "@/wab/shared/geom";
import { Tooltip } from "antd";
import cn from "classnames";
import * as React from "react";

const ICONS = {
  top: ChevronUpSvgIcon,
  bottom: ChevronDownSvgIcon,
  left: ChevronLeftSvgIcon,
  right: ChevronRightSvgIcon,
} as const;

const REVEAL_MESSAGES: Record<Side, MessageKey> = {
  top: "{distance}px more above. Click to scroll to the top edge.",
  bottom: "{distance}px more below. Click to scroll to the bottom edge.",
  left: "{distance}px more to the left. Click to scroll to the left edge.",
  right: "{distance}px more to the right. Click to scroll to the right edge.",
};

const STATIC_MESSAGES: Record<Side, MessageKey> = {
  top: "{distance}px above is cut off and can't be scrolled into view. Change the size in the right panel.",
  bottom:
    "{distance}px below is cut off and can't be scrolled into view. Change the size in the right panel.",
  left: "{distance}px to the left is cut off and can't be scrolled into view. Change the size in the right panel.",
  right:
    "{distance}px to the right is cut off and can't be scrolled into view. Change the size in the right panel.",
};

// Below this on-screen edge length the marker would cover most of the box.
const MIN_EDGE_LENGTH = 48;

/** How far the real `side` edge of `geometry` lies past `visible`. */
export function hiddenDistance(geometry: Rect, visible: Rect, side: Side) {
  switch (side) {
    case "top":
      return visible.top - geometry.top;
    case "left":
      return visible.left - geometry.left;
    case "bottom":
      return geometry.top + geometry.height - (visible.top + visible.height);
    case "right":
      return geometry.left + geometry.width - (visible.left + visible.width);
  }
}

/**
 * Markers for the sides of a selection whose real edge is clipped away, drawn
 * inside the visible box. They show how much of the element is hidden on that
 * side; when scroll containers hide the edge, clicking scrolls it into view so
 * its handles can be used.
 */
export function ClippedEdgeIndicators({
  elements,
  geometry,
  visible,
  clippedSides,
  zoom,
}: {
  /** The selection's DOM roots. */
  elements: Element[];
  /** The real box, in artboard pixels. */
  geometry: Rect;
  /** The drawn (visible) box, in artboard pixels. */
  visible: Rect;
  clippedSides: Record<Side, boolean>;
  zoom: number;
}) {
  const { t } = useI18n();
  const sides = (["top", "right", "bottom", "left"] as const).filter(
    (side) =>
      clippedSides[side] &&
      (side === "top" || side === "bottom" ? visible.width : visible.height) *
        zoom >=
        MIN_EDGE_LENGTH,
  );
  return (
    <>
      {sides.map((side) => {
        const distance = Math.round(hiddenDistance(geometry, visible, side));
        if (distance <= 0) {
          return null;
        }
        const revealable = canRevealEdge(elements, side);
        const message = t(
          revealable ? REVEAL_MESSAGES[side] : STATIC_MESSAGES[side],
          { distance },
        );
        return (
          <Tooltip key={side} title={message} mouseEnterDelay={0.3}>
            <button
              type="button"
              className={cn(styles.indicator, styles[side], {
                [styles.static]: !revealable,
              })}
              aria-label={message}
              aria-disabled={!revealable || undefined}
              data-clipped-edge={side}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                if (revealable) {
                  revealEdge(elements, side);
                }
              }}
            >
              <Icon icon={ICONS[side]} className={styles.icon} size={12} />
              {distance}
            </button>
          </Tooltip>
        );
      })}
    </>
  );
}
