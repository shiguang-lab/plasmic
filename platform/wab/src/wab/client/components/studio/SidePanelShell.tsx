import { mergeRefs } from "@/wab/commons/components/ReactUtil";
import { createStyles } from "antd-style";
import React from "react";

export const SIDE_PANEL_TRANSITION_MS = 180;
const useStyles = createStyles(() => ({
  viewport: {
    position: "absolute",
    top: 0,
    bottom: 0,
    // Clip the hidden panel at its own edge, leaving room for shadows and handles.
    clipPath: "inset(-100% -100% -100% 0)",
    "&[data-side='right']": { clipPath: "inset(-100% 0 -100% -100%)" },
    pointerEvents: "none",
  },
  shell: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    transform: "translateX(-100%)",
    opacity: 0,
    visibility: "hidden",
    pointerEvents: "none",
    transition: `transform ${SIDE_PANEL_TRANSITION_MS}ms ease, opacity ${SIDE_PANEL_TRANSITION_MS}ms ease, visibility 0s linear ${SIDE_PANEL_TRANSITION_MS}ms`,
    "&[data-side='right']": { transform: "translateX(100%)" },
    "&[data-open='true']": {
      transform: "translateX(0)",
      opacity: 1,
      visibility: "visible",
      pointerEvents: "auto",
      transitionDelay: "0s",
    },
    "@media (prefers-reduced-motion: reduce)": { transition: "none" },
  },
}));

/** One persistent shell. A content change never changes its transition state. */
export const SidePanelShell = React.forwardRef<
  HTMLDivElement,
  {
    open: boolean;
    side: "left" | "right";
    style?: React.CSSProperties;
    /** Suspend hidden content's effects while retaining DOM/state. Disable
     * preservation when its model owner retires so old controls are removed. */
    preserveContent?: boolean;
    children?: React.ReactNode;
  }
>(function SidePanelShell({ open, side, style, preserveContent = false, children }, ref) {
  const { styles } = useStyles();
  const shellRef = React.useRef<HTMLDivElement>(null);
  const mergedRef = React.useMemo(() => mergeRefs(ref, shellRef), [ref]);
  React.useLayoutEffect(() => {
    shellRef.current?.toggleAttribute("inert", !open);
  }, [open]);
  const [present, setPresent] = React.useState(open);
  React.useEffect(() => {
    if (open) {
      setPresent(true);
      return;
    }
    const timeout = setTimeout(
      () => setPresent(false),
      SIDE_PANEL_TRANSITION_MS,
    );
    return () => clearTimeout(timeout);
  }, [open]);
  return (
    <div
      className={`canvas-editor__${side}-pane-viewport ${styles.viewport}`}
      data-side={side}
      style={style}
    >
      <div
        ref={mergedRef}
        className={`canvas-editor__${side}-pane ${styles.shell}`}
        data-side={side}
        data-open={open}
        data-test-id={`${side}-panel-shell`}
        aria-hidden={!open}
      >
        {preserveContent ? (
          <React.Activity mode={open || present ? "visible" : "hidden"}>
            {children}
          </React.Activity>
        ) : open || present ? children : null}
      </div>
    </div>
  );
});
