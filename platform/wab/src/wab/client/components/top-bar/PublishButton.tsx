import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
/** @format */

import { menuSection } from "@/wab/client/components/menu-builder";
import { useLatestPublishedRevisionNumber } from "@/wab/client/components/sidebar-tabs/versions-tab/useLatestPublishedRevisionNumber";
import { EditorIconAction } from "@/wab/client/components/top-bar/EditorActions";
import { IFrameAwareDropdownMenu } from "@/wab/client/components/widgets";
import { useAppCtx, useTopFrameApi } from "@/wab/client/contexts/AppContexts";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { showError } from "@/wab/client/ErrorNotifications";
import { DefaultPublishButtonProps } from "@/wab/client/plasmic/plasmic_kit_top_bar/PlasmicPublishButton";
import { TutorialEventsType } from "@/wab/client/tours/tutorials/tutorials-events";
import { MainBranchId } from "@/wab/shared/ApiSchema";
import { spawnWrapper } from "@/wab/shared/common";
import { DownOutlined } from "@ant-design/icons";
import { Button, Menu, Tooltip, message } from "antd";
import classNames from "classnames";
import * as React from "react";
import { useStore } from "zustand";

interface PublishButtonProps extends DefaultPublishButtonProps {
  enable?: boolean;
}

export function PublishButton(props: PublishButtonProps) {
  const { t } = useI18n();
  const studioCtx = useStudioCtx();
  const appCtx = useAppCtx();
  const topFrameApi = useTopFrameApi();
  const isTemplate = studioCtx.siteInfo.isTemplate;
  const [publishingTemplate, setPublishingTemplate] = React.useState(false);

  const latestPublishedRevNum = useLatestPublishedRevisionNumber(studioCtx);
  const hasReleases = useStore(
    studioCtx.versionHistory.store,
    (state) => state.releases.length > 0,
  );
  const currentRevisionNum = useStore(
    studioCtx.versionHistory.store,
    (state) => state.currentRevisionNum,
  );
  const projectName = useStore(
    studioCtx.projectMetadataStore,
    (state) => state.name,
  );
  const branchId = useStore(
    studioCtx.uiEnvironment.store,
    (state) => state.branchId,
  );
  const redCircle =
    hasReleases &&
    !!latestPublishedRevNum &&
    latestPublishedRevNum < currentRevisionNum;

  if (!props.enable) {
    return null;
  }

  const isPlasmicLevels =
    !isTemplate &&
    projectName.includes("Plasmic Levels") &&
    !projectName.endsWith("Primary Copy");

  const publishTooltip = (
    <>
      <UiText message={"Publish a new version of your project"} />
      {redCircle && (
        <div className="mt-sm">
          <UiText message={"(This project has unpublished changes.)"} />
        </div>
      )}
    </>
  );

  if (branchId !== null && !isTemplate) {
    const branchMenu = () => (
      <Menu>
        {menuSection(
          "branch",
          <Menu.Item
            key="merge"
            onClick={async () => {
              await topFrameApi.setMergeModalContext({
                subject: {
                  toBranchId: MainBranchId,
                  fromBranchId: branchId,
                },
              });
            }}
          >
            <strong>{t("Merge changes from this branch")}</strong>
          </Menu.Item>,
          <Menu.Item
            key="pull"
            onClick={async () => {
              await topFrameApi.setMergeModalContext({
                subject: {
                  toBranchId: branchId,
                  fromBranchId: MainBranchId,
                },
              });
            }}
          >
            <strong>{t("Update from main branch")}</strong>
          </Menu.Item>,
          appCtx.appConfig.commitsOnBranches && (
            <Menu.Item
              key="commit"
              onClick={async () => {
                await topFrameApi.setShowPublishModal(true);
              }}
            >
              <strong>{t("Save a checkpoint")}</strong>
            </Menu.Item>
          ),
        )}
      </Menu>
    );

    return (
      <span
        className={classNames(
          "editor-publish-wrapper",
          "editor-publish-branch-group",
          props.className,
        )}
      >
        <Tooltip trigger={["hover", "focus"]} title={publishTooltip}>
          <EditorIconAction
            action="Publish"
            type="primary"
            className="editor-publish-action"
            aria-label={t("Publish")}
            onClick={() =>
              topFrameApi.setMergeModalContext({
                subject: {
                  toBranchId: MainBranchId,
                  fromBranchId: branchId,
                },
              })
            }
          />
        </Tooltip>
        <IFrameAwareDropdownMenu menu={branchMenu}>
          <Button
            type="primary"
            className="editor-publish-branch-menu"
            aria-label={t("{part1} menu", { part1: t("Publish") })}
            icon={<DownOutlined aria-hidden />}
          />
        </IFrameAwareDropdownMenu>
        {redCircle && (
          <span className="editor-publish-badge" aria-hidden="true" />
        )}
      </span>
    );
  }

  return (
    <span className={classNames("editor-publish-wrapper", props.className)}>
      <Tooltip
        trigger={["hover", "focus"]}
        title={
          isPlasmicLevels ? t("Disabled for Plasmic Levels") : publishTooltip
        }
      >
        <EditorIconAction
          action="Publish"
          id="topbar-publish-btn"
          type="primary"
          className="editor-publish-action"
          aria-label={t("Publish")}
          disabled={isPlasmicLevels || (isTemplate && branchId !== null)}
          loading={publishingTemplate}
          onClick={spawnWrapper(async () => {
            if (isTemplate) {
              setPublishingTemplate(true);
              try {
                await studioCtx.save({ noErrorNotification: true });
                if (studioCtx.hasUnsavedChanges()) {
                  void message.error(
                    t("Save the template draft before publishing"),
                  );
                } else {
                  await studioCtx.appCtx.api.publishDesignTemplate(
                    studioCtx.siteInfo.id,
                  );
                  void message.success(t("Template published"));
                }
              } catch (error) {
                showError(error, { title: "Template operation failed" });
              }
              setPublishingTemplate(false);
              return;
            }
            studioCtx.tourActionEvents.dispatch({
              type: TutorialEventsType.PublishButtonClicked,
            });
            return topFrameApi.setShowPublishModal(true);
          })}
        />
      </Tooltip>
      {redCircle && (
        <span className="editor-publish-badge" aria-hidden="true" />
      )}
    </span>
  );
}

export default PublishButton;
