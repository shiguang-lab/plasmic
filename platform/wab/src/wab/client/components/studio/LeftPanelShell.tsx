import { mergeRefs } from "@/wab/commons/components/ReactUtil";
import { createStyles } from "antd-style";
import React from "react";

export const LEFT_PANEL_TRANSITION_MS = 180;
const useStyles = createStyles(() => ({
  shell: {
    position: "absolute",
    top: 0,
    bottom: 0,
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    transform: "translateX(calc(-100% - 72px))",
    visibility: "hidden",
    pointerEvents: "none",
    transition: `transform ${LEFT_PANEL_TRANSITION_MS}ms ease, visibility 0s linear ${LEFT_PANEL_TRANSITION_MS}ms`,
    "&[data-open='true']": {
      transform: "translateX(0)",
      visibility: "visible",
      pointerEvents: "auto",
      transitionDelay: "0s",
    },
    "@media (prefers-reduced-motion: reduce)": { transition: "none" },
  },
}));

/** One persistent shell. A content change never changes its transition state. */
export const LeftPanelShell = React.forwardRef<
  HTMLDivElement,
  {
    open: boolean;
    width: number;
    left: string;
    children?: React.ReactNode;
  }
>(function LeftPanelShell({ open, width, left, children }, ref) {
  const { styles } = useStyles();
  const shellRef = React.useRef<HTMLDivElement>(null);
  const mergedRef = React.useMemo(() => mergeRefs(ref, shellRef), [ref]);
  React.useLayoutEffect(() => {
    shellRef.current?.toggleAttribute("inert", !open);
  }, [open]);
  const lastContent = React.useRef<React.ReactNode>();
  const [present, setPresent] = React.useState(open);
  if (open) {
    lastContent.current = children;
  }
  React.useEffect(() => {
    if (open) {
      setPresent(true);
      return;
    }
    const timeout = setTimeout(
      () => setPresent(false),
      LEFT_PANEL_TRANSITION_MS,
    );
    return () => clearTimeout(timeout);
  }, [open]);
  return (
    <div
      ref={mergedRef}
      className={`canvas-editor__left-pane ${styles.shell}`}
      style={{ width, left }}
      data-open={open}
      data-test-id="left-panel-shell"
      aria-hidden={!open}
    >
      {open ? children : present ? lastContent.current : null}
    </div>
  );
});
