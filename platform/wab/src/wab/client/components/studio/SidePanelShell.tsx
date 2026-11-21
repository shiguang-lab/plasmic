import styles from "./SidePanelShell.module.less";
import { mergeRefs } from "@/wab/commons/components/ReactUtil";
import React from "react";

export const SIDE_PANEL_TRANSITION_MS = 180;

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
