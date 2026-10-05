import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import React from "react";

// react-window reads the scrolling element from currentTarget and uses the
// outer ref for scrollToItem(). Both must point at the OverlayScrollbars viewport.
export const VirtualListScrollbar = React.forwardRef<
  HTMLElement,
  Omit<React.HTMLAttributes<HTMLDivElement>, "onScroll"> & {
    onScroll?: (event: { currentTarget: HTMLElement }) => void;
  }
>(function VirtualListScrollbar({ onScroll, style, ...props }, ref) {
  return (
    <Scrollbar
      {...props}
      ref={ref}
      defer={false}
      style={{ ...style, overflow: "hidden" }}
      events={{
        scroll: (instance) =>
          onScroll?.({ currentTarget: instance.elements().viewport }),
      }}
    />
  );
});
