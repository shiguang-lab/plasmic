import styles from "@/wab/client/components/top-bar/TopBar.module.scss";
import * as React from "react";

export const EditorBrandGroup = React.forwardRef<
  HTMLDivElement,
  { children: React.ReactNode }
>(function EditorBrandGroup({ children }, ref) {
  return (
    <div ref={ref} className={styles.brandGroup}>
      {children}
      {navigator.userAgent.includes("PlasmicDesktop/") && (
        <span data-desktop-update-slot="header" />
      )}
    </div>
  );
});
