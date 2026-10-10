import { useEditorPopupStyles } from "@/wab/client/components/ui/layout-styles";
import { plasmicIFrameMouseDownEvent } from "@/wab/client/definitions/events";
import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
/** @format */

import { PublicLink } from "@/wab/client/components/PublicLink";
import { usePreviewCtx } from "@/wab/client/components/live/PreviewCtx";
import {
  MenuBuilder,
  TextAndShortcut,
} from "@/wab/client/components/menu-builder";
import {
  AnonymousAvatar,
  AvatarGallery,
} from "@/wab/client/components/studio/Avatar";
import LeftTabStrip from "@/wab/client/components/studio/LeftTabStrip";
import { OnlineCollaborators } from "@/wab/client/components/studio/OnlineCollaborators";
import CodeButton from "@/wab/client/components/top-bar/CodeButton";
import LivePopOutButton from "@/wab/client/components/top-bar/LivePopOutButton";
import PublishButton from "@/wab/client/components/top-bar/PublishButton";
import styles from "@/wab/client/components/top-bar/TopBar.module.scss";
import ViewButton from "@/wab/client/components/top-bar/ViewButton";
import { useShareDialog } from "@/wab/client/components/top-bar/useShareDialog";
import { Icon } from "@/wab/client/components/widgets/Icon";
import Select from "@/wab/client/components/widgets/Select";
import { useAppCtx, useTopFrameApi } from "@/wab/client/contexts/AppContexts";
import ComponentIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Component";
import PageIcon from "@/wab/client/plasmic/plasmic_kit_design_system/icons/PlasmicIcon__Page";
import PlasmicTopBar from "@/wab/client/plasmic/plasmic_kit_top_bar/PlasmicTopBar";
import { getComboForAction } from "@/wab/client/shortcuts/studio/studio-shortcuts";
import { useStudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import {
  STUDIO_ONBOARDING_TUTORIALS,
  STUDIO_ONBOARDING_TUTORIALS_LIST,
} from "@/wab/client/tours/tutorials/tutorials-meta";
import { ensure, spawn, withoutNils } from "@/wab/shared/common";
import {
  isCodeComponent,
  isFrameComponent,
  isPageComponent,
  isReusableComponent,
} from "@/wab/shared/core/components";
import { isAdminTeamEmail } from "@/wab/shared/devflag-utils";
import { pruneUnusedImageAssets } from "@/wab/shared/prune-site";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import { naturalSort } from "@/wab/shared/sort";
import {
  canEditProjectConfig,
  canPublishProject,
  getLeftTabPermission,
} from "@/wab/shared/ui-config-utils";
import { fixPageHrefsToLocal } from "@/wab/shared/utils/split-site-utils";
import { Button, Menu, Popover, Tooltip, notification, theme } from "antd";
import { observer } from "mobx-react";
import { ok } from "neverthrow";
import React from "react";
import useSWR from "swr";

export const outlineModes = ["blocks", "inlines", "all"];

interface TopBarProps {
  preview?: boolean;
}

function _TopBar({ preview }: TopBarProps) {
  const { t } = useI18n();
  const { token } = theme.useToken();
  const { styles: popupStyles } = useEditorPopupStyles();
  const studioCtx = useStudioCtx();
  const appCtx = useAppCtx();
  const previewCtx = usePreviewCtx();
  const topFrameApi = useTopFrameApi();
  const { openShareDialog } = useShareDialog();
  const [projectOpen, setProjectOpen] = React.useState(false);
  React.useEffect(() => {
    const close = () => setProjectOpen(false);
    document.addEventListener(plasmicIFrameMouseDownEvent, close);
    return () =>
      document.removeEventListener(plasmicIFrameMouseDownEvent, close);
  }, []);
  React.useEffect(() => {
    if (!projectOpen) {
      return;
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      if (
        Array.from(
          document.querySelectorAll<HTMLElement>(
            ".ant-dropdown, .editor-management-menu button[aria-expanded=true]",
          ),
        ).some((element) => element.getClientRects().length > 0)
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setProjectOpen(false);
      leftRef.current
        ?.querySelector<HTMLButtonElement>(".editor-project-trigger")
        ?.focus();
    };
    document.addEventListener("keydown", closeOnEscape, true);
    return () => document.removeEventListener("keydown", closeOnEscape, true);
  }, [projectOpen]);
  const isMacDesktop = navigator.userAgent.includes("PlasmicDesktop/darwin");
  const topBarRef = React.useRef<HTMLDivElement>(null);
  const leftRef = React.useRef<HTMLDivElement>(null);
  const rightRef = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    if (!isMacDesktop) {
      return;
    }
    const root = ensure(topBarRef.current, "Top bar is mounted");
    const left = ensure(leftRef.current, "Top bar left section is mounted");
    const right = ensure(rightRef.current, "Top bar right section is mounted");
    // Electron only honors drag regions in the main frame, so mirror the
    // header's empty space there instead of marking this host iframe draggable.
    const update = () => {
      const bounds = root.getBoundingClientRect();
      const start =
        Math.max(
          left.getBoundingClientRect().left,
          ...Array.from(
            left.children,
            (child) => child.getBoundingClientRect().right,
          ),
        ) + 8;
      const end = right.getBoundingClientRect().left - 8;
      spawn(
        topFrameApi.setDesktopTitleBarDragRegion(
          end > start
            ? {
                left: start,
                top: bounds.top,
                width: end - start,
                height: bounds.height,
              }
            : null,
        ),
      );
    };
    const resizeObserver = new ResizeObserver(update);
    const observe = () => {
      resizeObserver.disconnect();
      [root, left, right, ...left.children, ...right.children].forEach(
        (element) => resizeObserver.observe(element),
      );
      update();
    };
    const mutationObserver = new MutationObserver(observe);
    mutationObserver.observe(root, { childList: true, subtree: true });
    observe();
    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      spawn(topFrameApi.setDesktopTitleBarDragRegion(null));
    };
  }, [isMacDesktop, topFrameApi]);
  const { data } = useSWR("top-bar-config", async () => {
    const [team, canEditUiConfig] = await Promise.all([
      topFrameApi.getCurrentTeam(),
      topFrameApi.canEditProjectUiConfig(),
    ]);
    return {
      team,
      canEditUiConfig,
    };
  });
  const team = data?.team;
  const canEditUiConfig = data?.canEditUiConfig;
  const isObserver = appCtx.selfInfo?.isObserver;

  const uiConfig = studioCtx.getCurrentUiConfig();

  const menu = canEditProjectConfig(uiConfig)
    ? () => {
        const builder = new MenuBuilder();
        builder.genSection(undefined, (push) => {
          builder.genSection(undefined, (push2) => {
            if (
              studioCtx.canEditProject() &&
              canEditProjectConfig(uiConfig, "rename")
            ) {
              push2(
                <Menu.Item
                  key="rename"
                  onClick={() => topFrameApi.setShowProjectNameModal(true)}
                >
                  {t("Rename project")}
                </Menu.Item>,
              );
            }

            {
              push2(
                <Menu.Item
                  key="duplicate"
                  onClick={() => topFrameApi.setShowCloneProjectModal(true)}
                >
                  {t("Duplicate project")}
                </Menu.Item>,
              );
            }
          });

          if (studioCtx.canEditProject() && !studioCtx.contentEditorMode) {
            builder.genSection(
              <UiText message={"Configuration"} />,
              (push2) => {
                push2(
                  <Menu.Item
                    key="configure"
                    data-test-id="configure-project"
                    onClick={() => {
                      spawn(topFrameApi.setShowHostModal(true));
                    }}
                  >
                    <UiText message={"Configure custom app host"} />
                  </Menu.Item>,
                );
                // Only show auth config if the app already uses it
                const showAuth = studioCtx.siteInfo.hasAppAuth;
                if (showAuth) {
                  push2(
                    <Menu.Item
                      key="app-auth"
                      onClick={() => {
                        spawn(topFrameApi.setShowAppAuthModal(true));
                      }}
                    >
                      <UiText message={"Configure app authentication"} />
                    </Menu.Item>,
                  );
                }

                if (canEditProjectConfig(uiConfig, "localization")) {
                  push2(
                    <Menu.Item
                      key="localization"
                      onClick={() => {
                        spawn(topFrameApi.setShowLocalizationModal(true));
                      }}
                    >
                      {t(
                        studioCtx.site.flags.usePlasmicTranslation
                          ? "Disable localization framework integration"
                          : "Enable localization framework integration",
                      )}
                    </Menu.Item>,
                  );
                }

                if (
                  appCtx.appConfig.secretApiTokenTeams?.includes(
                    studioCtx.siteInfo.teamId ?? "",
                  )
                ) {
                  push2(
                    <Menu.Item
                      key="secret"
                      onClick={() => {
                        spawn(topFrameApi.showRegenerateSecretTokenModal());
                      }}
                    >
                      <UiText message={"Regenerate secret project API token"} />
                    </Menu.Item>,
                  );
                }

                if (canEditUiConfig) {
                  push2(
                    <Menu.Item
                      key="ui-config"
                      onClick={() => {
                        spawn(topFrameApi.setShowUiConfigModal(true));
                      }}
                    >
                      <UiText message={"Configure Studio UI for project"} />
                    </Menu.Item>,
                  );
                }
              },
            );

            const isAdmin = isAdminTeamEmail(
              appCtx.selfInfo?.email,
              appCtx.appConfig,
            );
            if (isAdmin || appCtx.appConfig.debug) {
              builder.genSection(<UiText message={"Debug"} />, (push2) => {
                builder.genSub(<UiText message={"Optimization"} />, (push3) => {
                  push3(
                    <Menu.Item
                      key="cleanup"
                      onClick={() => {
                        spawn(
                          studioCtx.change(() => {
                            studioCtx.tplMgr().cleanRedundantOverrides();
                            return ok();
                          }),
                        );
                        notification.info({
                          message: `Redundant overrides have been cleaned. You can run this again every time you want to clean them.`,
                        });
                      }}
                    >
                      <UiText message={"Remove redundant overrides"} />
                    </Menu.Item>,
                  );
                  push3(
                    <Menu.Item
                      key="prune-images"
                      onClick={async () => {
                        spawn(
                          studioCtx.change(() => {
                            const pruned = pruneUnusedImageAssets(
                              studioCtx.site,
                            );
                            notification.success({
                              message: `Pruned ${pruned.size} assets`,
                            });
                            return ok();
                          }),
                        );
                      }}
                    >
                      <UiText message={"Remove unused image assets"} />
                    </Menu.Item>,
                  );
                  push3(
                    <Menu.Item
                      key="cleanup-invisible"
                      onClick={async () => {
                        spawn(
                          studioCtx.change(() => {
                            const result = studioCtx
                              .tplMgr()
                              .lintElementVisibilities({
                                performUpdates: true,
                              });

                            console.log(result);

                            notification.success({
                              message: `Fixed ${Object.keys(
                                result.total,
                              )} invisible elements in ${
                                Object.keys(result.changesByComponent).length
                              }`,
                            });
                            return ok();
                          }),
                        );
                      }}
                    >
                      <UiText message={"Lint and fix invisible elements"} />
                    </Menu.Item>,
                  );
                });
                if (isAdmin) {
                  push2(
                    <Menu.SubMenu
                      title={
                        <span>
                          <UiText message={"Start onboarding tour"} />
                        </span>
                      }
                    >
                      {STUDIO_ONBOARDING_TUTORIALS_LIST.map((tour) => {
                        return (
                          <Menu.Item
                            key={tour}
                            onClick={() => {
                              studioCtx.setOnboardingTourState({
                                run: true,
                                stepIndex: 0,
                                tour,
                                flags: {},
                                triggers: [],
                              });
                            }}
                          >
                            {t("{tour} - {count} steps", {
                              tour,
                              count: STUDIO_ONBOARDING_TUTORIALS[tour].length,
                            })}
                          </Menu.Item>
                        );
                      })}
                    </Menu.SubMenu>,
                  );

                  builder.genSub(
                    <UiText message={"Site-splitting utils"} />,
                    (push3) => {
                      push3(
                        <Menu.Item
                          key="fix-page-hrefs-to-local"
                          onClick={async () =>
                            studioCtx.changeUnsafe(() => {
                              fixPageHrefsToLocal(studioCtx.site);
                            })
                          }
                        >
                          <UiText
                            message={"Convert page hrefs to local pages"}
                          />
                        </Menu.Item>,
                      );
                    },
                  );
                }
              });
            }
          }
        });

        return builder.build({
          menuName: "project-menu",
        });
      }
    : undefined;

  const brand =
    uiConfig.brand ??
    appCtx.appConfig.brands?.[studioCtx.siteInfo.teamId ?? ""] ??
    appCtx.appConfig.brands?.[""];

  const previewPages = previewCtx.studioCtx.site.components.filter((c) =>
    isPageComponent(c),
  );
  const previewComponents = previewCtx.studioCtx.site.components.filter(
    (c) => isReusableComponent(c) && !isCodeComponent(c),
  );
  const previewArtboards = previewCtx.studioCtx.site.components.filter((c) =>
    isFrameComponent(c),
  );

  const canUndo = studioCtx.canEditProject() && studioCtx.canUndo();
  const canRedo = studioCtx.canEditProject() && studioCtx.canRedo();

  return (
    <>
      <PlasmicTopBar
        root={{
          ref: topBarRef,
          className: `${styles.topBar} ${isMacDesktop ? styles.desktop : ""} ${isObserver ? "topbar--isObserver" : ""}`,
        }}
        left={{
          props: { ref: leftRef },
          wrapChildren: (children) => (
            <>
              {children}
              <span className="editor-history-divider" aria-hidden="true" />
              <Tooltip title={t("Published versions")}>
                <Button
                  className="editor-history-action"
                  type="text"
                  aria-label={t("Published versions")}
                  disabled={
                    !appCtx.selfInfo ||
                    getLeftTabPermission(uiConfig, "versions", {
                      isContentCreator: studioCtx.contentEditorMode,
                    }) === "hidden"
                  }
                  onClick={() => {
                    spawn(
                      studioCtx.changeUnsafe(() => {
                        studioCtx.setShowAddDrawer(false);
                        if (studioCtx.panelsHidden) {
                          studioCtx.togglePanels();
                        }
                        studioCtx.switchLeftTab("versions");
                      }),
                    );
                  }}
                  icon={
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M3 4v5h5 M3 9a9 9 0 1 1-1 7 M12 7v5l4 2" />
                    </svg>
                  }
                />
              </Tooltip>
            </>
          ),
        }}
        right={{
          props: { ref: rightRef },
          wrapChildren: (children) =>
            preview ? (
              children
            ) : (
              <div className="editor-primary-actions">
                {!preview && (
                  <>
                    <div className="editor-history-controls">
                      <Tooltip
                        title={
                          <TextAndShortcut shortcut={getComboForAction("UNDO")}>
                            {t("Undo")}
                          </TextAndShortcut>
                        }
                      >
                        <Button
                          aria-label={t("Undo")}
                          type="text"
                          className="editor-icon-action"
                          icon={
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M9 5L4 10l5 5 M4 10h10a6 6 0 0 1 0 12" />
                            </svg>
                          }
                          disabled={!canUndo}
                          onClick={() => spawn(studioCtx.undo())}
                        />
                      </Tooltip>
                      <Tooltip
                        title={
                          <TextAndShortcut shortcut={getComboForAction("REDO")}>
                            {t("Redo")}
                          </TextAndShortcut>
                        }
                      >
                        <Button
                          aria-label={t("Redo")}
                          type="text"
                          className="editor-icon-action"
                          icon={
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M15 5l5 5-5 5 M20 10H10a6 6 0 0 0 0 12" />
                            </svg>
                          }
                          disabled={!canRedo}
                          onClick={() => spawn(studioCtx.redo())}
                        />
                      </Tooltip>
                    </div>
                    <span className="editor-action-divider" />
                  </>
                )}
                <Tooltip
                  trigger={["hover", "focus"]}
                  title={
                    studioCtx.showComments()
                      ? t("Comments")
                      : t(
                          "You do not have permission to comment on this project.",
                        )
                  }
                >
                  <Button
                    type="text"
                    className="editor-icon-action"
                    disabled={!studioCtx.showComments()}
                    aria-label={t("Comments")}
                    aria-pressed={studioCtx.showCommentsPanel}
                    data-test-id="top-comment-icon"
                    onClick={() => studioCtx.toggleCommentsPanel()}
                    icon={
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    }
                  />
                </Tooltip>
                <Tooltip
                  trigger={["hover", "focus"]}
                  title={
                    <TextAndShortcut
                      shortcut={getComboForAction("TOGGLE_PREVIEW_MODE")}
                    >
                      {t("Preview")}
                    </TextAndShortcut>
                  }
                >
                  <Button
                    type="text"
                    className="editor-icon-action"
                    disabled={
                      !studioCtx.currentArena || studioCtx.currentArenaEmpty
                    }
                    aria-label={t("Preview")}
                    data-test-id="enter-live-mode-btn"
                    onClick={() => {
                      void studioCtx.changeUnsafe(() =>
                        studioCtx.toggleDevControls(),
                      );
                    }}
                    icon={
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <rect x="2" y="3" width="20" height="14" rx="2" />
                        <path d="M8 21h8 M12 17v4" />
                      </svg>
                    }
                  />
                </Tooltip>
                <LivePopOutButton iconOnly />
                <span className="editor-action-divider" />
                <Tooltip
                  trigger={["hover", "focus"]}
                  title={t("Share project")}
                >
                  <Button
                    type="text"
                    className="editor-icon-action"
                    onClick={openShareDialog}
                    aria-label={t("Share project")}
                    icon={
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6 M16 6l-4-4-4 4 M12 2v13" />
                      </svg>
                    }
                  />
                </Tooltip>
                {!studioCtx.contentEditorMode && (
                  <CodeButton showOptions={false} />
                )}
                <ViewButton />
                <PublishButton
                  enable={
                    studioCtx.canEditProject() && canPublishProject(uiConfig)
                  }
                />
                <span className="editor-action-divider" />
                <OnlineCollaborators studioCtx={studioCtx} />
                {appCtx.selfInfo ? (
                  <AvatarGallery users={[appCtx.selfInfo]} />
                ) : (
                  <AnonymousAvatar />
                )}
              </div>
            ),
        }}
        mode={preview ? "preview" : undefined}
        hideAvatar
        // Projects outside an org (e.g. in a playground) have no trial.
        freeTrial={team ? { team } : { render: () => null }}
        logoLink={{
          render: (props) => (
            <Tooltip title={brand.logoTooltip ?? t("Back to dashboard")}>
              <PublicLink
                {...props}
                className={`${props.className ?? ""} ${styles.logoLink}`}
                href={brand.logoHref ?? APP_ROUTES.dashboard.fill({})}
              >
                {brand.logoImgSrc ? (
                  <img
                    src={brand.logoImgSrc}
                    alt={brand.logoTooltip ?? t("Back to dashboard")}
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
          ),
        }}
        projectTitle={{
          render: () => (
            <Button
              type="text"
              className="editor-project-title"
              title={studioCtx.siteInfo.name}
              aria-label={t("Rename project")}
              disabled={
                !studioCtx.canEditProject() || !canEditProjectConfig(uiConfig)
              }
              onClick={() => spawn(topFrameApi.setShowProjectNameModal(true))}
              icon={
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 7V5h6l2 2h10v13H3z" />
                </svg>
              }
            >
              <span className="editor-project-name">
                {studioCtx.siteInfo.name}
              </span>
            </Button>
          ),
        }}
        projectMenu={{
          render: () => (
            <Popover
              arrow={false}
              trigger="click"
              open={projectOpen}
              onOpenChange={setProjectOpen}
              placement="bottomLeft"
              align={{ offset: [0, 8] }}
              content={
                <div className={`${styles.projectActions} ${popupStyles.root}`}>
                  {menu?.()}
                  <LeftTabStrip
                    useVersionsCTA={false}
                    managementOnly
                    onNavigate={() => setProjectOpen(false)}
                  />
                </div>
              }
            >
              <Button
                type="text"
                className="editor-project-trigger"
                aria-label={t("Project menu")}
                title={t("Project menu")}
                aria-expanded={projectOpen}
                data-test-id="project-menu-btn"
                icon={
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="5" r="1" fill="currentColor" />
                    <circle cx="12" cy="12" r="1" fill="currentColor" />
                    <circle cx="12" cy="19" r="1" fill="currentColor" />
                  </svg>
                }
              />
            </Popover>
          ),
        }}
        arenaSegment={{ render: () => null }}
        arenaSeparator={{ render: () => null }}
        branchSeparator={{
          wrap: (n) => (studioCtx.showBranching() ? n : null),
        }}
        branchSegment={{
          wrap: (n) => (studioCtx.showBranching() ? n : null),
        }}
        publishButton={{
          render: preview ? undefined : () => null,
          props: {
            enable: studioCtx.canEditProject() && canPublishProject(uiConfig),
          },
        }}
        avatar={{
          render: () => (
            <AvatarGallery users={withoutNils([appCtx.selfInfo])} />
          ),
        }}
        play={{
          render: preview ? undefined : () => null,
          "aria-label": t("Preview"),
          onClick: () => {
            void studioCtx.changeUnsafe(() => studioCtx.toggleDevControls());
          },
          tooltip: (
            <TextAndShortcut
              shortcut={getComboForAction("TOGGLE_PREVIEW_MODE")}
            >
              {t("Preview")}
            </TextAndShortcut>
          ),
          disabled: !studioCtx.currentArena || studioCtx.currentArenaEmpty,
          ...{ "data-test-id": "enter-live-mode-btn" },
        }}
        stop={{
          "aria-label": t("Back to editor"),
          onClick: () => {
            void studioCtx.changeUnsafe(() => studioCtx.toggleDevControls());
          },
          tooltip: (
            <TextAndShortcut shortcut={"esc"}>
              {t("Back to editor")}
            </TextAndShortcut>
          ),

          ...{ "data-test-id": "exit-live-mode-btn" },
        }}
        codeButton={
          !preview || studioCtx.contentEditorMode
            ? {
                render: () => null,
              }
            : {}
        }
        zoomButton={preview ? {} : { render: () => null }}
        viewButton={{ render: preview ? undefined : () => null }}
        shareButton={{ wrap: preview ? undefined : () => null }}
        commentButton={{
          wrap: preview && studioCtx.showComments() ? undefined : () => null,
          props: {
            "aria-label": t("Comments"),
            active: studioCtx.showCommentsPanel,
            onClick: () => studioCtx.toggleCommentsPanel(),
            "data-test-id": "top-comment-icon",
          },
        }}
        aiButton={{
          wrap:
            preview && studioCtx.chatCopilotEnabled() ? undefined : () => null,
          props: {
            "aria-label": t("AI assistant"),
            active: studioCtx.isCopilotChatOpen,
            onClick: () => spawn(topFrameApi.toggleCopilotChat()),
          },
        }}
        // TODO: We are currently not showing the live popout button on
        // preview mode. That will require abstracting LivePreview out of
        // it, so that when it is unmounted and mounted again (on route change)
        // things continue working.
        livePopOutButton={{ wrap: () => null }}
        previewSelect={
          preview
            ? {
                "aria-label": t("Select component"),
                children: (
                  <>
                    {previewPages.length > 0 && (
                      <Select.OptionGroup title={t("Pages")}>
                        {naturalSort(previewPages, (c) => c.name).map((c) => (
                          <Select.Option key={c.uuid} value={c.uuid}>
                            <Icon icon={PageIcon} style={{ marginRight: 4 }} />
                            {c.name}{" "}
                            <span style={{ fontSize: "0.9em", opacity: 0.7 }}>
                              (
                              {
                                ensure(
                                  c.pageMeta,
                                  "Page component is expected to have page meta",
                                ).path
                              }
                              )
                            </span>
                          </Select.Option>
                        ))}
                      </Select.OptionGroup>
                    )}
                    {previewComponents.length > 0 && (
                      <Select.OptionGroup title={t("Components")}>
                        {naturalSort(previewComponents, (c) => c.name).map(
                          (c) => (
                            <Select.Option key={c.uuid} value={c.uuid}>
                              <Icon
                                icon={ComponentIcon}
                                style={{ marginRight: 4 }}
                              />
                              {c.name}
                            </Select.Option>
                          ),
                        )}
                      </Select.OptionGroup>
                    )}
                    {previewArtboards.length > 0 && (
                      <Select.OptionGroup title={t("Artboards")}>
                        {previewArtboards.map((c) => (
                          <Select.Option key={c.uuid} value={c.uuid}>
                            {c.name || "Unnamed artboard"}
                          </Select.Option>
                        ))}
                      </Select.OptionGroup>
                    )}
                  </>
                ),
                value: previewCtx.component?.uuid,
                onChange: (uuid) => {
                  const component = ensure(
                    previewCtx.studioCtx.site.components.find(
                      (c) => c.uuid == uuid,
                    ),
                    "Could not find component with selected UUID",
                  );
                  void previewCtx.pushComponent(component);
                },
              }
            : null
        }
        variantsComboSelect={{}}
      />
    </>
  );
}

export const TopBar = observer(_TopBar);
