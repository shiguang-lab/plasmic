import { PublicLink } from "@/wab/client/components/PublicLink";
import {
  AnonymousAvatar,
  AvatarGallery,
} from "@/wab/client/components/studio/Avatar";
import styles from "@/wab/client/components/top-bar/TopBar.module.scss";
import { useAppCtx } from "@/wab/client/contexts/AppContexts";
import { useI18n } from "@/wab/client/i18n";
import { MessageKey } from "@/wab/client/i18n/locales";
import { PlasmicPublishButton } from "@/wab/client/plasmic/plasmic_kit_top_bar/PlasmicPublishButton";
import PlasmicTopBar from "@/wab/client/plasmic/plasmic_kit_top_bar/PlasmicTopBar";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import { UiConfig } from "@/wab/shared/ui-config-utils";
import { Button, ButtonProps, Tooltip, theme } from "antd";
import * as React from "react";

const actionPaths = {
  Undo: "M9 5L4 10l5 5 M4 10h10a6 6 0 0 1 0 12",
  Redo: "M15 5l5 5-5 5 M20 10H10a6 6 0 0 0 0 12",
  Comments: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  Preview: "M8 21h8 M12 17v4",
  "Share project":
    "M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6 M16 6l-4-4-4 4 M12 2v13",
  Code: "M8 6l-6 6 6 6 M16 6l6 6-6 6 M14 3l-4 18",
  "Published versions": "M3 4v5h5 M3 9a9 9 0 1 1-1 7 M12 7v5l4 2",
  "Open preview in new tab":
    "M15 3h6v6 M10 14L21 3 M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6",
} satisfies Partial<Record<MessageKey, string>>;

export const EditorIconAction = React.forwardRef<
  HTMLButtonElement,
  ButtonProps & { action: keyof typeof actionPaths }
>(function EditorIconAction({ action, ...props }, ref) {
  const { t } = useI18n();
  return (
    <Button
      ref={ref}
      type="text"
      className="editor-icon-action"
      aria-label={t(action)}
      icon={
        <svg viewBox="0 0 24 24" aria-hidden="true">
          {action === "Preview" && (
            <rect x="2" y="3" width="20" height="14" rx="2" />
          )}
          <path d={actionPaths[action]} />
        </svg>
      }
      {...props}
    />
  );
});

export const EditorViewButton = React.forwardRef<
  HTMLButtonElement,
  ButtonProps
>(function EditorViewButton(props, ref) {
  const { t } = useI18n();
  return (
    <Button
      ref={ref}
      type="text"
      aria-label={t("View")}
      id="view-menu"
      {...props}
    >
      {t("View")}
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="editor-view-chevron"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </Button>
  );
});

export function EditorBrandLink({
  brand = {},
  ...props
}: React.ComponentProps<"a"> & { brand?: UiConfig["brand"] }) {
  const { t } = useI18n();
  const { token } = theme.useToken();
  return (
    <Tooltip title={brand.logoTooltip ?? t("Back to dashboard")}>
      <PublicLink
        {...props}
        className={`${props.className ?? ""} ${styles.logoLink}`}
        href={brand.logoHref ?? APP_ROUTES.dashboard.fill({})}
        aria-label={brand.logoTooltip ?? t("Back to dashboard")}
      >
        {brand.logoImgSrc ? (
          <img
            src={brand.logoImgSrc}
            alt={brand.logoAlt ?? brand.logoTooltip ?? t("Back to dashboard")}
          />
        ) : (
          <>
            <svg
              className="editor-brand-mark"
              style={{ fill: token.colorPrimary }}
              viewBox="0 0 32 32"
              aria-hidden="true"
            >
              <path d="M7 3h14a8 8 0 0 1 0 16h-7l4-5h3a3 3 0 0 0 0-6H11z M11 13h7l-4 5h-3a3 3 0 0 0 0 6h10l-4 5h-6a8 8 0 0 1 0-16z" />
            </svg>
            <span
              className="editor-brand-label"
              style={{ color: token.colorText }}
            >
              Plasmic
            </span>
          </>
        )}
      </PublicLink>
    </Tooltip>
  );
}

// The data-free header is also the header used by the initialized editor.
// Project-aware callers supply title, menus, permissions, and event handlers.
export function TopBarChrome({
  projectName,
  projectReady = false,
  ...props
}: React.ComponentProps<typeof PlasmicTopBar> & {
  projectName?: string;
  projectReady?: boolean;
}) {
  const { t } = useI18n();
  const appCtx = useAppCtx();
  const mac = navigator.userAgent.includes("PlasmicDesktop/darwin");
  const windows = navigator.userAgent.includes("PlasmicDesktop/win32");
  const empty = { render: () => null };
  if (projectReady) {
    return <PlasmicTopBar {...props} />;
  }
  return (
    <PlasmicTopBar
      root={{
        className: `${styles.topBar} ${mac ? styles.desktop : ""} ${windows ? styles.desktopWindows : ""}`,
      }}
      left={{
        props: {
          style: mac ? { paddingLeft: 80, borderRadius: 24 } : undefined,
        },
        wrapChildren: (children) => (
          <>
            {children}
            <span className="editor-history-divider" />
            <EditorIconAction
              action="Published versions"
              className="editor-history-action"
              disabled
            />
          </>
        ),
      }}
      logoLink={{
        render: (linkProps) => (
          <EditorBrandLink
            {...linkProps}
            brand={appCtx.appConfig.brands?.[""]}
          />
        ),
      }}
      projectTitle={{
        render: () => (
          <Button
            type="text"
            className="editor-project-title"
            disabled
            icon={
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 7V5h6l2 2h10v13H3z" />
              </svg>
            }
          >
            {projectName ?? t("Project")}
          </Button>
        ),
      }}
      projectMenu={{
        render: () => (
          <Button
            type="text"
            className="editor-project-trigger"
            aria-label={t("Project menu")}
            disabled
            icon={
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="5" r="1" fill="currentColor" />
                <circle cx="12" cy="12" r="1" fill="currentColor" />
                <circle cx="12" cy="19" r="1" fill="currentColor" />
              </svg>
            }
          />
        ),
      }}
      right={{
        wrapChildren: () => (
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
            <EditorIconAction action="Share project" disabled />
            <EditorIconAction action="Code" disabled />
            <EditorViewButton disabled />
            <PlasmicPublishButton
              button={{ disabled: true }}
              menuButton={{ render: () => null }}
            />
            <span className="editor-action-divider" />
            {appCtx.selfInfo ? (
              <AvatarGallery users={[appCtx.selfInfo]} />
            ) : (
              <AnonymousAvatar />
            )}
          </div>
        ),
      }}
      hideAvatar
      freeTrial={empty}
      saveIndicator={empty}
      branchSeparator={empty}
      branchSegment={empty}
      branchSwitcher={empty}
      arenaSeparator={empty}
      arenaSegment={empty}
      arenaSwitcher={empty}
      previewSelect={empty}
      variantsComboSelect={empty}
      viewAsButton={empty}
      zoomButton={empty}
      viewButton={empty}
      play={empty}
      livePopOutButton={empty}
      commentButton={empty}
      aiButton={empty}
      codeButton={empty}
      shareButton={empty}
      publishButton={empty}
      stop={empty}
      avatar={empty}
      {...props}
    />
  );
}
