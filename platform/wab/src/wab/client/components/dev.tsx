import { isWithinKeyboardInteractiveElement } from "@/wab/client/dom-utils";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { cx } from "@/wab/shared/common";
import * as React from "react";

interface DevContainerProps {
  showControls?: boolean;
  viewCtx?: ViewCtx;
  defaultHidden?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}
export function DevContainer(props: DevContainerProps) {
    return (
      <div
        onContextMenu={(e) => {
          // Disable context menu within Studio for most elements except
          // keyboard interactive elements, where it's nice to have options
          // like copy/paste functionality.
          if (!isWithinKeyboardInteractiveElement(e.target as Element)) {
            e.preventDefault();
          }
        }}
        className={cx(props.className, {
          "dev-env": true,
          invisible:
            props.showControls === undefined
              ? props.defaultHidden
              : !props.showControls,
        })}
        style={props.style}
        onMouseEnter={props.onMouseEnter}
        onMouseLeave={props.onMouseLeave}
      >
        {props.children}
      </div>
    );
}
