import structurePanelContainerStyles from "./StructurePanelContainer.module.less";
import { NavigationDropdown } from "@/wab/client/components/sidebar-tabs/ProjectPanel/NavigationDropdown";
import { OutlineTab } from "@/wab/client/components/sidebar-tabs/outline-tab";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { selectLeftTabKey } from "@/wab/client/studio-ctx/left-panel-state";
import { Splitter } from "antd";
import * as React from "react";
import { useStore } from "zustand";

export const StructurePanel = function StructurePanel() {
  const studioCtx = useStudioCtx();
  const navigationPanel = useStore(studioCtx.navigationPanelStore);
  const leftTabKey = useStore(
    studioCtx.leftPanelState.store,
    selectLeftTabKey,
  );

  const publishedTemplate = studioCtx.isPublishedTemplate;
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
      className={structurePanelContainerStyles.root}
      orientation="vertical"
      classNames={{ panel: structurePanelContainerStyles.panel }}
      styles={{ panel: { overflow: "hidden" } }}
      onResize={(sizes) => {
        if (directoryExpanded) {
          setDirectorySize(sizes[0]);
        }
      }}
    >
      <Splitter.Panel
        size={publishedTemplate ? undefined : directoryExpanded ? directorySize : 84}
        min={publishedTemplate ? undefined : directoryExpanded ? "20%" : 84}
        max={publishedTemplate ? undefined : directoryExpanded ? "70%" : 84}
        resizable={!publishedTemplate && directoryExpanded}
      >
        <div className="editor-page-navigation">
          <NavigationDropdown
            expanded={directoryExpanded}
            onExpandedChange={setDirectoryExpanded}
            onClose={() => studioCtx.setNavigationPanel("outline")}
          />
        </div>
      </Splitter.Panel>
      {!publishedTemplate && <Splitter.Panel min="30%">
        <OutlineTab />
      </Splitter.Panel>}
    </Splitter>
  );
};
