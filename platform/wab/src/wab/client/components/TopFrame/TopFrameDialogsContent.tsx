import { HostConfig } from "@/wab/client/components/HostConfig";
import { DataSourcePicker } from "@/wab/client/components/TopFrame/DataSourcePicker";
import CloneProjectModal from "@/wab/client/components/TopFrame/TopBar/CloneProjectModal";
import ProjectNameModal from "@/wab/client/components/TopFrame/TopBar/ProjectNameModal";
import PublishFlowDialogWrapper from "@/wab/client/components/TopFrame/TopBar/PublishFlowDialogWrapper";
import ShareModal from "@/wab/client/components/TopFrame/TopBar/ShareModal";
import UpsellModal from "@/wab/client/components/TopFrame/TopBar/UpsellModal";
import type { TopFrameChromeProps } from "@/wab/client/components/TopFrame/TopFrameChrome";
import { AppAuthSettingsModal } from "@/wab/client/components/app-auth/AppAuthSettings";
import { MergeModalWrapper } from "@/wab/client/components/merge/MergeFlow";
import { ContentEditorConfigModal } from "@/wab/client/components/modals/ContentEditorConfigModal";
import { EnableLocalizationModal } from "@/wab/client/components/modals/EnableLocalizationModal";
import { useI18n } from "@/wab/client/i18n";
import { TopFrameTours } from "@/wab/client/tours/tutorials/TutorialTours";
import { spawn } from "@/wab/shared/common";
import { notification } from "antd";
import * as React from "react";
export function TopFrameDialogsContent(props: TopFrameChromeProps) {
  const {
    appCtx,
    project,
    editorPerm,
    perms,
    topFrameApi,
    refreshStudio,
    refreshProjectAndPerms,
    isRefreshingProjectData,
    refreshBranchData,
    ...rest
  } = props;
  const { t: studioUiT } = useI18n();
  return (
    <>
      <ProjectNameModal
        project={project}
        refreshProjectAndPerms={refreshProjectAndPerms}
        showProjectNameModal={rest.showProjectNameModal}
        setShowProjectNameModal={topFrameApi.setShowProjectNameModal}
      />
      <CloneProjectModal
        project={project}
        showCloneProjectModal={rest.showCloneProjectModal}
        setShowCloneProjectModal={topFrameApi.setShowCloneProjectModal}
      />
      {rest.showHostModal && (
        <HostConfig
          appCtx={appCtx}
          project={project}
          onCancel={() => {
            spawn(topFrameApi.setShowHostModal(false));
          }}
          isRefreshingProjectData={isRefreshingProjectData}
          onUpdate={async (canSkipRefresh) => {
            if (!canSkipRefresh) {
              await refreshStudio();
            } else {
              refreshBranchData();
              refreshProjectAndPerms();
            }
          }}
        />
      )}
      {rest.showUpsellForm && (
        <UpsellModal
          appCtx={appCtx}
          {...rest.showUpsellForm}
          setShowUpsellForm={rest.setShowUpsellForm}
        />
      )}
      <PublishFlowDialogWrapper
        project={project}
        refreshProjectAndPerms={refreshProjectAndPerms}
        activatedBranch={rest.activatedBranch}
        editorPerm={editorPerm}
        latestPublishedVersionData={rest.latestPublishedVersionData}
        revisionNum={rest.revisionNum}
        showPublishModal={rest.showPublishModal}
        keepPublishModalOpen={rest.keepPublishModalOpen && !rest.showShareModal}
        setShowPublishModal={topFrameApi.setShowPublishModal}
      />
      <MergeModalWrapper
        project={project}
        editorPerm={editorPerm}
        latestPublishedVersionData={rest.latestPublishedVersionData}
        revisionNum={rest.revisionNum}
        mergeModalContext={rest.mergeModalContext}
        setMergeModalContext={topFrameApi.setMergeModalContext}
        currentBranch={rest.activatedBranch}
      />
      <ShareModal
        refreshProjectAndPerms={refreshProjectAndPerms}
        project={project}
        perms={perms}
        showShareModal={rest.showShareModal}
        setShowShareModal={topFrameApi.setShowShareModal}
      />
      {rest.dataSourcePicker && (
        <DataSourcePicker
          {...rest.dataSourcePicker.args}
          onSelected={async (result) => {
            if (result?.sourceId) {
              await appCtx.api.allowProjectToDataSource(
                result.sourceId,
                project.id,
              );
            }
            rest.dataSourcePicker?.resolve(result);
          }}
          onCanceled={() => {
            rest.dataSourcePicker?.resolve("CANCELED");
          }}
          project={project}
        />
      )}
      {rest.showUiConfigModal && (
        <ContentEditorConfigModal
          title={studioUiT("Studio UI for {part1}", {
            part1: String(project.name),
          })}
          appCtx={appCtx}
          level={"project"}
          onSubmit={async (newConfig) => {
            if (newConfig) {
              await appCtx.api.updateProjectMeta(project.id, {
                uiConfig: newConfig,
              });
            }
            await topFrameApi.setShowUiConfigModal(false);
            notification.info({
              message: studioUiT(
                "Changes in the configuration UI will only take place after refreshing the page",
              ),
              duration: 5,
            });
          }}
          onCancel={() => topFrameApi.setShowUiConfigModal(false)}
          config={project.uiConfig ?? {}}
        />
      )}
      {rest.showLocalizationModal && (
        <EnableLocalizationModal
          isLocalizationEnabled={rest.isLocalizationEnabled}
          project={project}
          onDone={() => topFrameApi.setShowLocalizationModal(false)}
        />
      )}
      {rest.showAppAuthModal && (
        <AppAuthSettingsModal
          appCtx={appCtx}
          project={project}
          defaultPageRoleId={rest.defaultPageRoleId}
          setDefaultPageRoleId={rest.setDefaultPageRoleId}
          onCancel={() => topFrameApi.setShowAppAuthModal(false)}
        />
      )}
      <React.Suspense fallback={null}>
        <TopFrameTours
          appCtx={appCtx}
          tourState={rest.onboardingTour}
          projectId={project.id}
          topFrameApi={topFrameApi}
          changeTourState={topFrameApi.setOnboardingTour}
        />
      </React.Suspense>
    </>
  );
}
