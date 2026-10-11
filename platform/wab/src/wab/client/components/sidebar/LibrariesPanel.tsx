import InsertPanel from "@/wab/client/components/insert-panel/InsertPanel";
import { ProjectDependenciesPanel } from "@/wab/client/components/sidebar/ProjectDependencies";
import { PanelCloseButton } from "@/wab/client/components/studio/PanelCloseButton";
import { useLibraryPanelStyles } from "@/wab/client/components/ui/layout-styles";
import { useI18n } from "@/wab/client/i18n";
import { useStudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { spawn } from "@/wab/shared/common";
import { Tabs } from "antd";
import { observer } from "mobx-react";
import React from "react";

export const LibrariesPanel = observer(function LibrariesPanel() {
  const studioCtx = useStudioCtx();
  const { t } = useI18n();
  const { styles } = useLibraryPanelStyles();
  const canViewImports =
    !!studioCtx.appCtx.selfInfo &&
    studioCtx.getLeftTabPermission("imports") !== "hidden";
  const closePanel = () =>
    spawn(studioCtx.changeUnsafe(() => studioCtx.switchLeftTab(undefined)));
  return (
    <div className={styles.root}>
      <Tabs
        className="editor-navigation-tabs"
        classNames={{ header: "editor-panel-header" }}
        tabBarExtraContent={<PanelCloseButton onClick={closePanel} />}
        activeKey={canViewImports ? studioCtx.libraryTab : "store"}
        onChange={(tab) =>
          studioCtx.setLibraryTab(tab === "imports" ? "imports" : "store")
        }
        destroyOnHidden
        items={[
          {
            key: "store",
            label: t("Component store"),
            children: <InsertPanel mode="store" onClose={closePanel} />,
          },
          ...(canViewImports
            ? [
                {
                  key: "imports",
                  label: t("Imported projects"),
                  children: <ProjectDependenciesPanel />,
                },
              ]
            : []),
        ]}
      />
    </div>
  );
});
