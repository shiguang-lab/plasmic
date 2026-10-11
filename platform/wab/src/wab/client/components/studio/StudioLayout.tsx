import { useEditorLayoutStyles } from "@/wab/client/components/ui/layout-styles";
import * as React from "react";

export function StudioLayout({ children }: { children?: React.ReactNode }) {
  const { styles, cx } = useEditorLayoutStyles();
  return (
    <div className={cx("studio", styles.root)}>
      <div className="studio__main-area">{children}</div>
    </div>
  );
}
