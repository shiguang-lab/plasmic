import { NavigationDropdown } from "@/wab/client/components/sidebar-tabs/ProjectPanel/NavigationDropdown";
import { OutlineTab } from "@/wab/client/components/sidebar-tabs/outline-tab";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { selectLeftTabKey } from "@/wab/client/studio-ctx/left-panel-state";
import { Splitter } from "antd";
import { createStyles } from "antd-style";

import * as React from "react";
import { useStore } from "zustand";

const useStyles = createStyles(() => ({
  root: { height: "100%", minHeight: 0, overflow: "hidden" },
  panel: {
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
  },
}));

export const StructurePanel = function StructurePanel() {
  const studioCtx = useStudioCtx();
  const navigationPanel = useStore(studioCtx.navigationPanelStore);
  const leftTabKey = useStore(
    studioCtx.leftPanelState.store,
    selectLeftTabKey,
  );
  const { styles } = useStyles();
  const [directoryExpanded, setDirectoryExpanded] = React.useState(true);
  const [directorySize, setDirectorySize] = React.useState<number | string>(
    "42%",
  );
  React.useEffect(() => {
    if (navigationPanel === "pages" && leftTabKey === "outline") {
      if (!directoryExpanded) {
        setDirectoryExpanded(true);
      } else {
        studioCtx.focusOnProjectSearchInput();
      }
    }
  }, [studioCtx, navigationPanel, leftTabKey, directoryExpanded]);

  return (
    <Splitter
      className={styles.root}
      orientation="vertical"
      classNames={{ panel: styles.panel }}
      styles={{ panel: { overflow: "hidden" } }}
      onResize={(sizes) => {
        if (directoryExpanded) {
          setDirectorySize(sizes[0]);
        }
      }}
    >
      <Splitter.Panel
        size={directoryExpanded ? directorySize : 84}
        min={directoryExpanded ? "20%" : 84}
        max={directoryExpanded ? "70%" : 84}
        resizable={directoryExpanded}
      >
        <div className="editor-page-navigation">
          <NavigationDropdown
            expanded={directoryExpanded}
            onExpandedChange={setDirectoryExpanded}
            onClose={() => studioCtx.setNavigationPanel("outline")}
          />
        </div>
      </Splitter.Panel>
      <Splitter.Panel min="30%">
        <OutlineTab />
      </Splitter.Panel>
    </Splitter>
  );
};
