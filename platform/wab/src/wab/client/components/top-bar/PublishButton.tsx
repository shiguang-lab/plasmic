import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
/** @format */

import { menuSection } from "@/wab/client/components/menu-builder";
import { useAppCtx, useTopFrameApi } from "@/wab/client/contexts/AppContexts";
import CirclesvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__CircleSvg";
import {
  DefaultPublishButtonProps,
  PlasmicPublishButton,
} from "@/wab/client/plasmic/plasmic_kit_top_bar/PlasmicPublishButton";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { TutorialEventsType } from "@/wab/client/tours/tutorials/tutorials-events";
import { MainBranchId } from "@/wab/shared/ApiSchema";
import { spawnWrapper } from "@/wab/shared/common";
import { PlasmicIcon } from "@plasmicapp/react-web";
import { Menu, Tooltip } from "antd";
import { useStore } from "zustand";
import { useLatestPublishedRevisionNumber } from "@/wab/client/components/sidebar-tabs/versions-tab/useLatestPublishedRevisionNumber";
import * as React from "react";

interface PublishButtonProps extends DefaultPublishButtonProps {
  enable?: boolean;
}

export function PublishButton(
  props: PublishButtonProps,
) {
  const { t } = useI18n();
  const studioCtx = useStudioCtx();
  const appCtx = useAppCtx();
  const topFrameApi = useTopFrameApi();

  const latestPublishedRevNum = useLatestPublishedRevisionNumber(studioCtx);
  const hasReleases = useStore(studioCtx.versionHistory.store, (state) => state.releases.length > 0);
  const currentRevisionNum = useStore(studioCtx.versionHistory.store, (state) => state.currentRevisionNum);
  const projectName = useStore(studioCtx.projectMetadataStore, (state) => state.name);
  const branchId = useStore(studioCtx.uiEnvironment.store, (state) => state.branchId);
  const redCircle = hasReleases && !!latestPublishedRevNum && latestPublishedRevNum < currentRevisionNum;

  if (!props.enable) {
    return null;
  }

  const isPlasmicLevels =
    projectName.includes("Plasmic Levels") &&
    !projectName.endsWith("Primary Copy");


  return (
    <>
      <PlasmicPublishButton
        menuButton={
          branchId === null
            ? { "aria-label": t("Publish menu") }
            : {
                style: {
                  display: "flex",
                },
                onClick: () => {
                  return topFrameApi.setMergeModalContext({
                    subject: {
                      toBranchId: MainBranchId,
                      fromBranchId: branchId,
                    },
                  });
                },
                menu: () => (
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
                ),
                tooltip: (
                  <>
                    <UiText message={"Publish a new version of your project"} />
                    {redCircle && (
                      <div className="mt-sm">
                        <UiText
                          message={"(This project has unpublished changes.)"}
                        />
                      </div>
                    )}
                  </>
                ),
              }
        }
        button={
          branchId !== null
            ? {
                style: { display: "none" },
              }
            : {
                wrap: !isPlasmicLevels
                  ? undefined
                  : (node) => (
                      <Tooltip title={t("Disabled for Plasmic Levels")}>
                        {node}
                        <div className={"cover"}></div>
                      </Tooltip>
                    ),
                props: {
                  "aria-label": t("Publish"),
                  children: t("Publish"),
                  id: "topbar-publish-btn",
                  onClick: spawnWrapper(() => {
                    studioCtx.tourActionEvents.dispatch({
                      type: TutorialEventsType.PublishButtonClicked,
                    });
                    return topFrameApi.setShowPublishModal(true);
                  }),
                  disabled: isPlasmicLevels,
                  tooltip: (
                    <>
                      <UiText
                        message={"Publish a new version of your project"}
                      />
                      {redCircle && (
                        <div className="mt-sm">
                          <UiText
                            message={"(This project has unpublished changes.)"}
                          />
                        </div>
                      )}
                    </>
                  ),
                },
              }
        }
      />
      {redCircle && (
        <PlasmicIcon
          PlasmicIconType={CirclesvgIcon}
          className={
            redCircle ? "red-circle-top-right" : "yellow-circle-top-right"
          }
          role={"img"}
        />
      )}
    </>
  );
}

export default PublishButton;
