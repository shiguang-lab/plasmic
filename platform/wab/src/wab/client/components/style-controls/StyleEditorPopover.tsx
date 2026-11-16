import { isContextMenuOpen } from "@/wab/client/components/ContextMenu";
import styles from "@/wab/client/components/style-controls/PaintRows.module.scss";
import popoverStyles from "@/wab/client/components/style-controls/StyleEditorPopover.module.scss";
import { cx } from "@/wab/shared/common";
import { useStudioEscape } from "@/wab/client/hooks/useStudioEscape";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { Popover } from "antd";
import React, { useRef } from "react";
import { FocusScope } from "react-aria";

export function StyleEditorPopover({
  title,
  open,
  onOpenChange,
  content,
  children,
}: {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: React.ReactNode;
  children: React.ReactElement<React.ComponentPropsWithRef<"button">>;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  useStudioEscape(popupRef, open, () => {
    onOpenChange(false);
    triggerRef.current?.focus();
  });

  return (
    <Popover
      trigger="click"
      placement="leftTop"
      title={title}
      open={open}
      destroyOnHidden
      onOpenChange={(nextOpen) => {
        // Dimension and context menus can open in separate portals.
        if (
          !nextOpen &&
          (document.querySelector(".dropdown-overlay") || isContextMenuOpen())
        ) {
          return;
        }
        onOpenChange(nextOpen);
      }}
      content={
        open && (
          <FocusScope>
            <div
              ref={popupRef}
              className={cx(styles.fillPopover, popoverStyles.body)}
              role="dialog"
              aria-label={title}
            >
              <Scrollbar scrollX={false} className={styles.fillPopoverBody}>
                {content}
              </Scrollbar>
            </div>
          </FocusScope>
        )
      }
    >
      {React.cloneElement(children, {
        ref: triggerRef,
        "aria-haspopup": "dialog",
        "aria-expanded": open,
      })}
    </Popover>
  );
}
