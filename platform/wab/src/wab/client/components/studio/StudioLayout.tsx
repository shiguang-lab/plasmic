import { useEditorLayoutStyles } from "@/wab/client/components/ui/layout-styles";
import * as React from "react";

export function StudioLayout({
  hiddenForPreview,
  children,
}: {
  hiddenForPreview?: boolean;
  children?: React.ReactNode;
}) {
  const { styles, cx } = useEditorLayoutStyles();
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
