import InsertPanel from "@/wab/client/components/insert-panel/InsertPanel";
import { ProjectDependenciesPanel } from "@/wab/client/components/sidebar/ProjectDependencies";
import { PanelCloseButton } from "@/wab/client/components/studio/PanelCloseButton";
import { useLibraryPanelStyles } from "@/wab/client/components/ui/layout-styles";
import { useI18n } from "@/wab/client/i18n";
import { useStudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { spawn } from "@/wab/shared/common";
import { observer } from "mobx-react";
import React from "react";

export const LibrariesPanel = observer(function LibrariesPanel() {
  const studioCtx = useStudioCtx();
  const { t } = useI18n();
  const { styles } = useLibraryPanelStyles();
  const canViewImports =
    !!studioCtx.appCtx.selfInfo &&
    studioCtx.getLeftTabPermission("imports") !== "hidden";
  const showImports = canViewImports && studioCtx.libraryTab === "imports";
  const closePanel = () =>
    spawn(studioCtx.changeUnsafe(() => studioCtx.switchLeftTab(undefined)));
  return (
    <div className={styles.root}>
      <div className="editor-panel-header">
        <span>{t(showImports ? "Imported projects" : "Component store")}</span>
        <PanelCloseButton onClick={closePanel} />
      </div>
      <div className="library-panel-content">
        {showImports ? (
          <ProjectDependenciesPanel />
        ) : (
          <InsertPanel mode="store" onClose={closePanel} />
        )}
      </div>
    </div>
  );
});
