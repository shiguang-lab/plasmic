import { BrandLink } from "@/wab/client/components/BrandLink";
import { EditorBrandGroup } from "@/wab/client/components/top-bar/EditorBrandGroup";
import {
  AnonymousAvatar,
  Avatar,
} from "@/wab/client/components/studio/Avatar";
import { EditorIconAction } from "@/wab/client/components/top-bar/EditorActions";
import styles from "@/wab/client/components/top-bar/TopBar.module.scss";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { openDesktopBrowser } from "@/wab/client/desktop-browser";
import { useI18n } from "@/wab/client/i18n";
import layout from "@/wab/client/plasmic/plasmic_kit_top_bar/PlasmicTopBar.module.css";
import { spawn } from "@/wab/shared/common";
import { Avatar as AntAvatar, Button, Tooltip } from "antd";
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
      <EditorBrandGroup>
        <div
          className={layout.left}
          style={mac ? { paddingLeft: 96 } : undefined}
        >
          <BrandLink brand={appCtx?.appConfig.brands?.[""]} />
          <Button type="text" className="editor-project-title" disabled>
            {projectName ?? t("Project")}
          </Button>
          <Button
            color="primary"
            variant="link"
            className="editor-project-trigger"
            aria-label={t("Project menu")}
            disabled
          >
            ⋮
          </Button>
          <span className="editor-history-divider" />
          <EditorIconAction
            action="Published versions"
            color="primary"
            variant="link"
            className="editor-history-action"
            disabled
          />
        </div>
      </EditorBrandGroup>
      <div className={`${layout.right} editor-primary-actions`}>
        <EditorIconAction action="Comments" disabled />
        <EditorIconAction action="Preview" disabled />
        <EditorIconAction action="Present" disabled />
        <span className="editor-action-divider" />
        <EditorIconAction
          action="Publish"
          type="primary"
          className="editor-publish-action"
          disabled
        />
        <span className="editor-action-divider" />
        <AntAvatar.Group className="editor-collaborator-group">
          {appCtx?.selfInfo ? (
            <Avatar user={appCtx.selfInfo} />
          ) : (
            <AnonymousAvatar />
          )}
        </AntAvatar.Group>
        {navigator.userAgent.includes("PlasmicDesktop/") && (
          <Tooltip trigger={["hover", "focus"]} title={t("Import from the web")}>
            <EditorIconAction
              action="Import from the web"
              data-test-id="import-from-web-button"
              onClick={() => spawn(openDesktopBrowser())}
            />
          </Tooltip>
        )}
      </div>
    </div>
  );
}
