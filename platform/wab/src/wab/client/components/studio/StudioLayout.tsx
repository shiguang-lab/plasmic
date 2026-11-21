import styles from "../ui/EditorLayout.module.less";
import { cx } from "@/wab/shared/common";
import * as React from "react";

export function StudioLayout({
  hiddenForPreview,
  children,
}: {
  hiddenForPreview?: boolean;
  children?: React.ReactNode;
}) {

  return (
    // Hide the whole editor without changing canvas geometry or panel state.
    <div
      className={cx("studio", styles.root)}
      inert={hiddenForPreview}
      style={hiddenForPreview ? { opacity: 0 } : undefined}
    >
      <div className="studio__main-area">{children}</div>
    </div>
  );
}
