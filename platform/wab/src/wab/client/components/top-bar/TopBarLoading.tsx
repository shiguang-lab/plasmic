import { BrandLink } from "@/wab/client/components/BrandLink";
import {
  AnonymousAvatar,
  AvatarGallery,
} from "@/wab/client/components/studio/Avatar";
import {
  EditorIconAction,
  EditorViewButton,
} from "@/wab/client/components/top-bar/EditorActions";
import styles from "@/wab/client/components/top-bar/TopBar.module.scss";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { useI18n } from "@/wab/client/i18n";
import layout from "@/wab/client/plasmic/plasmic_kit_top_bar/PlasmicTopBar.module.css";
import { Button } from "antd";
import * as React from "react";

/** Startup chrome has no dependency on project controls or the editor model. */
export function TopBarLoading({ projectName }: { projectName?: string }) {
  const { t } = useI18n();
  const appCtx = React.useContext(AppCtxContext);
  const mac = navigator.userAgent.includes("PlasmicDesktop/darwin");
  const windows = navigator.userAgent.includes("PlasmicDesktop/win32");
  return (
    <div
      className={`${layout.root} ${styles.topBar} ${mac ? styles.desktop : ""} ${windows ? styles.desktopWindows : ""}`}
    >
      <div
        className={layout.left}
        style={mac ? { paddingLeft: 96 } : undefined}
      >
        <BrandLink brand={appCtx?.appConfig.brands?.[""]} />
        <Button type="text" className="editor-project-title" disabled>
          {projectName ?? t("Project")}
        </Button>
        <Button
          type="text"
          className="editor-project-trigger"
          aria-label={t("Project menu")}
          disabled
        >
          ⋮
        </Button>
        <span className="editor-history-divider" />
        <EditorIconAction
          action="Published versions"
          className="editor-history-action"
          disabled
        />
      </div>
      <div className="editor-primary-actions">
        <div className="editor-history-controls">
          <EditorIconAction action="Undo" disabled />
          <EditorIconAction action="Redo" disabled />
        </div>
        <span className="editor-action-divider" />
        <EditorIconAction action="Comments" disabled />
        <EditorIconAction action="Preview" disabled />
        <EditorIconAction action="Open preview in new tab" disabled />
        <span className="editor-action-divider" />
        <EditorIconAction action="Code" disabled />
        <EditorViewButton disabled />
        <Button type="primary" disabled>
          {t("Publish")}
        </Button>
        <span className="editor-action-divider" />
        {appCtx?.selfInfo ? (
          <AvatarGallery users={[appCtx.selfInfo]} />
        ) : (
          <AnonymousAvatar />
        )}
      </div>
    </div>
  );
}
