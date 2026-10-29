import { AppCtx } from "@/wab/client/app-ctx";
import { desktopDraftBridge } from "@/wab/client/desktop-drafts";
import { isPlasmicPath } from "@/wab/client/cli-routes";
import { HostConfig } from "@/wab/client/components/HostConfig";
import { DataSourcePicker } from "@/wab/client/components/TopFrame/DataSourcePicker";
import CloneProjectModal from "@/wab/client/components/TopFrame/TopBar/CloneProjectModal";
import ProjectNameModal from "@/wab/client/components/TopFrame/TopBar/ProjectNameModal";
import PublishFlowDialogWrapper from "@/wab/client/components/TopFrame/TopBar/PublishFlowDialogWrapper";
import { showRegenerateSecretTokenModal } from "@/wab/client/components/TopFrame/TopBar/RegenerateSecretTokenModal";
import ShareModal from "@/wab/client/components/TopFrame/TopBar/ShareModal";
import UpsellModal from "@/wab/client/components/TopFrame/TopBar/UpsellModal";
import { AppAuthSettingsModal } from "@/wab/client/components/app-auth/AppAuthSettings";
import { CanvasAiComposer } from "@/wab/client/components/copilot/CanvasAiComposer";
import { isAnonymousQuotaReached } from "@/wab/client/components/copilot/anonymous-chat";
import { MergeModalWrapper } from "@/wab/client/components/merge/MergeFlow";
import { ContentEditorConfigModal } from "@/wab/client/components/modals/ContentEditorConfigModal";
import { EnableLocalizationModal } from "@/wab/client/components/modals/EnableLocalizationModal";
import {
  TopBarPromptBillingArgs,
  promptTeamUpgrade,
} from "@/wab/client/components/modals/PricingModal";
import { IconButton } from "@/wab/client/components/widgets/IconButton";
import {
  applyAiSessionAction,
  snapshotAiSession,
} from "@/wab/client/copilot/ai-session-view";
import {
  getLocalEditSession,
  localAiFetch,
} from "@/wab/client/copilot/local-edit-session";
import {
  openDesktopBrowser,
  openDesktopPreview,
} from "@/wab/client/desktop-browser";
import { fileDragMonitor } from "@/wab/client/file-drag/file-drag-monitor";
import { dispatchFrameInteraction } from "@/wab/client/frame-ctx/frame-interactions";
import {
  TopFrameApi,
  TopFrameApiArgs,
  TopFrameApiResolveType,
  TopFrameApiReturnType,
} from "@/wab/client/frame-ctx/top-frame-api";
import { useTopFrameCtx } from "@/wab/client/frame-ctx/top-frame-ctx";
import { getUiLocale, useI18n } from "@/wab/client/i18n";
import { translate } from "@/wab/client/i18n/locales";
import { UiText } from "@/wab/client/i18n/UiText";
import CloseIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Close";
import { useHistory, useLocation } from "@/wab/client/route/HistoryProvider";
import { Shortcut } from "@/wab/client/shortcuts/shortcut";
import { useBindShortcutHandlers } from "@/wab/client/shortcuts/shortcut-handler";
import {
  STUDIO_SHORTCUTS,
  StudioShortcutAction,
} from "@/wab/client/shortcuts/studio/studio-shortcuts";
import {
  TopFrameTourState,
  TopFrameTours,
} from "@/wab/client/tours/tutorials/TutorialTours";
import {
  ApiBranch,
  ApiPermission,
  ApiProject,
  MergeSrcDst,
  ProjectId,
} from "@/wab/shared/ApiSchema";
import { assert, asyncWrapper, ensure, mkUuid, spawn } from "@/wab/shared/common";
import type { LocalAiContext } from "@/wab/shared/copilot/local-edit";
import { isAdminTeamEmail } from "@/wab/shared/devflag-utils";
import { LocalizationConfig } from "@/wab/shared/localization";
import { getAccessLevelToResource } from "@/wab/shared/perms";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import { canEditUiConfig } from "@/wab/shared/ui-config-utils";
import { message, notification } from "antd";
import * as Comlink from "comlink";
import { Action, Location } from "history";
import { ExtendedKeyboardEvent } from "mousetrap";
import React from "react";
import * as Signals from "signals";

export interface MergeModalContext {
  subject: MergeSrcDst;
}

export interface TopFrameChromeProps {
  appCtx: AppCtx;
  project: ApiProject;
  refreshProjectAndPerms: () => void;
  isRefreshingProjectData: boolean;
  pathname: string;
  editorPerm: boolean;
  perms: ApiPermission[];
  refreshStudio: () => Promise<void>;
  topFrameApi: TopFrameApi;

  latestPublishedVersionData:
    { revisionId: string; version: string } | undefined;
  revisionNum: number;
  desktopTitleBarDragRegions: TopFrameApiArgs<"setDesktopTitleBarDragRegions">;
  isLocalizationEnabled: boolean;
  showPublishModal: boolean;
  keepPublishModalOpen: boolean;
  mergeModalContext: MergeModalContext | undefined;
  showShareModal: boolean;
  showProjectNameModal: boolean;
  showCloneProjectModal: boolean;
  showHostModal: boolean;
  showLocalizationModal: boolean;
  showUiConfigModal: boolean;
  showUpsellForm: TopBarPromptBillingArgs | undefined;
  setShowUpsellForm: (_: undefined) => void;
  showAppAuthModal: boolean;
  studioModalOpen: boolean;
  aiPanelOpen: boolean;
  localAiContext: LocalAiContext | undefined;
  activatedBranch: ApiBranch | undefined;
  dataSourcePicker:
    | {
        args: TopFrameApiArgs<"pickDataSource">;
        resolve: TopFrameApiResolveType<"pickDataSource">;
      }
    | undefined;
  defaultPageRoleId: string | null | undefined;
  setDefaultPageRoleId: (roleId: string | null | undefined) => void;
  onboardingTour: TopFrameTourState;
  refreshBranchData: () => void;
  shouldShowRegenerateSecretTokenModal: boolean;
  didShowRegenerateSecretTokenModal: () => void;
}

export const topFrameTourSignals = new Signals.Signal();

export function useProjectAiSession({ projectId, userId, branchId, enabled, panelOpen }: {
  projectId: string;
  userId: string | undefined;
  branchId: string | null;
  enabled: boolean;
  panelOpen: boolean;
}) {
  React.useEffect(() => {
    if (!enabled) {
      return;
    }
    const session = getLocalEditSession(projectId);
    session.userId = userId;
    return () => session.disconnect();
  }, [projectId, enabled, userId]);
  React.useEffect(() => {
    if (enabled) {
      void getLocalEditSession(projectId).setBranch(branchId);
    }
  }, [projectId, enabled, userId, branchId]);
  React.useEffect(() => {
    if (enabled && panelOpen) {
      return getLocalEditSession(projectId).retain();
    }
    return undefined;
  }, [projectId, enabled, userId, panelOpen]);
}

export function TopFrameChrome({
  appCtx,
  project,
  refreshProjectAndPerms,
  isRefreshingProjectData,
  pathname,
  editorPerm,
  perms,
  refreshStudio,
  topFrameApi,
  refreshBranchData,
  shouldShowRegenerateSecretTokenModal,
  didShowRegenerateSecretTokenModal,
  ...rest
}: TopFrameChromeProps) {
  const { t: studioUiT } = useI18n();

  useProjectAiSession({
    projectId: project.id,
    userId: appCtx.selfInfo?.id,
    branchId: rest.activatedBranch?.id ?? null,
    enabled: appCtx.appConfig.enableLocalAiEditing,
    panelOpen: rest.aiPanelOpen,
  });
  const { hostFrameApi, hostFrameApiReady } = useTopFrameCtx();
  React.useEffect(() => {
    if (!desktopDraftBridge()) {return;}
    const target = window as Window & { desktopDraftAction?: (action: "flush" | "show") => Promise<boolean> };
    target.desktopDraftAction = async action => {
      if (!hostFrameApiReady) {return true;}
      if (action === "flush") {return hostFrameApi.flushDesktopDraft();}
      await hostFrameApi.showDesktopDrafts();
      return true;
    };
    return () => { delete target.desktopDraftAction; };
  }, [hostFrameApi, hostFrameApiReady]);
  const location = useLocation();
  const preview =
    !!APP_ROUTES.projectPreview.parse(location.pathname, false) ||
    !!APP_ROUTES.projectPresentation.parse(location.pathname, false);
  const fullPreview = !!APP_ROUTES.projectPresentation.parse(
    location.pathname,
    false,
  );

  React.useEffect(() => {
    document.title = `${project.name} - Plasmic`;
  }, [project.name]);

  React.useEffect(() => {
    if (shouldShowRegenerateSecretTokenModal) {
      spawn(
        showRegenerateSecretTokenModal({
          appCtx,
          project,
        }),
      );
      didShowRegenerateSecretTokenModal();
    }
  }, [
    appCtx,
    project,
    shouldShowRegenerateSecretTokenModal,
    showRegenerateSecretTokenModal,
    didShowRegenerateSecretTokenModal,
  ]);

  React.useEffect(() => {
    if (fullPreview && appCtx.appConfig.showFullPreviewWarning) {
      const accessLevel = getAccessLevelToResource(
        { type: "project", resource: project },
        appCtx.selfInfo,
        perms,
      );

      const key = mkUuid();

      // Don't show it to the project owner or for projects created by @plasmic.app users
      if (
        accessLevel !== "owner" &&
        perms.every(
          (perm) =>
            perm.accessLevel !== "owner" ||
            !isAdminTeamEmail(perm.email, appCtx.appConfig),
        )
      ) {
        spawn(
          message.open({
            key,
            content: (
              <div className="rel fill-width" style={{ maxWidth: 400 }}>
                <IconButton
                  style={{ position: "absolute", right: 0, top: 0 }}
                  onClick={() => message.destroy(key)}
                >
                  <CloseIcon />
                </IconButton>
                <big>
                  <UiText
                    message={"You are previewing a page built in Plasmic"}
                  />{" "}
                  <br />
                  <br />
                </big>
                <p style={{ textAlign: "left" }}>
                  <UiText
                    message={
                      "Click {part1} to open the project in the Studio.{part2}{part3}: Notice this page might include and run third-party javascript, so be careful to not provide personal information or credentials while using it."
                    }
                    values={{
                      part1: (
                        <a
                          href={APP_ROUTES.project.fill({
                            projectId: project.id,
                          })}
                          target="_blank"
                        >
                          <UiText message={"here"} />
                        </a>
                      ),
                      part2: <br />,
                      part3: (
                        <strong>
                          <UiText message={"Important"} />
                        </strong>
                      ),
                    }}
                  />
                </p>
              </div>
            ),
            duration: 0,
            icon: [],
            type: "info",
          }),
        );
        return () => notification.destroy(key);
      }
    }
    return undefined;
  }, [fullPreview, appCtx, perms]);

  return (
    <>
      {!fullPreview &&
        (navigator.userAgent.includes("PlasmicDesktop/darwin") ||
          navigator.userAgent.includes("PlasmicDesktop/win32")) &&
        rest.desktopTitleBarDragRegions.map((region, index) => (
          <div
            key={index}
            className="desktop-titlebar-drag-region"
            aria-hidden="true"
            style={region}
          />
        ))}
      {!fullPreview &&
        (APP_ROUTES.projectDocs.parse(pathname, false) ? null : (
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
              keepPublishModalOpen={
                rest.keepPublishModalOpen && !rest.showShareModal
              }
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
            {hostFrameApiReady &&
              editorPerm &&
              rest.localAiContext &&
              !rest.aiPanelOpen &&
              !preview && (
                <CanvasAiComposer
                  appCtx={appCtx}
                  projectId={project.id}
                  context={rest.localAiContext}
                  onOpen={() => hostFrameApi.openCopilotChat()}
                  hiddenByModal={rest.studioModalOpen}
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
        ))}
      <ForwardShortcuts />
      <ShareFileDrag />
      <AnonymousChatUserStudioLock appCtx={appCtx} projectId={project.id} />
    </>
  );
}

function AnonymousChatUserStudioLock({
  appCtx,
  projectId,
}: {
  appCtx: AppCtx;
  projectId: ProjectId;
}) {
  const { hostFrameApi, hostFrameApiReady } = useTopFrameCtx();

  React.useEffect(() => {
    if (hostFrameApiReady && !appCtx.selfInfo) {
      spawn(
        (async () => {
          if (await isAnonymousQuotaReached(projectId)) {
            await hostFrameApi.blockChanges();
          }
        })(),
      );
    }
  }, [hostFrameApi, hostFrameApiReady, appCtx.selfInfo, projectId]);

  return null;
}

function ShareFileDrag() {
  const { hostFrameApi, hostFrameApiReady } = useTopFrameCtx();

  React.useEffect(() => {
    if (hostFrameApiReady) {
      return fileDragMonitor.subscribeRemote((event) =>
        spawn(hostFrameApi.onFileDragEventInTop(event)),
      );
    }
    return undefined;
  }, [hostFrameApi, hostFrameApiReady]);

  return null;
}

function ForwardShortcuts() {
  const { hostFrameApi, hostFrameApiReady } = useTopFrameCtx();
  useBindShortcutHandlers(
    document.body,
    STUDIO_SHORTCUTS,
    Object.fromEntries(
      (
        Object.entries(STUDIO_SHORTCUTS) as [StudioShortcutAction, Shortcut][]
      ).map(([action, shortcut]) => [
        action,
        (e: ExtendedKeyboardEvent) => {
          if (!hostFrameApiReady) {
            // The host frame is not ready, just swallow the event.
            return true;
          }

          const selection = document.getSelection();
          if (
            shortcut.action === "COPY" &&
            selection &&
            !selection.isCollapsed
          ) {
            // The top frame handles copying itself.
            return false;
          }

          // The host frame handles everything else below this line.

          if (shortcut.action === "COPY" || shortcut.action === "PASTE") {
            // Copy/paste can't be forwarded/dispatched to the host frame.
            // Focus on the host frame so the next user action is handled there.
            spawn(hostFrameApi.focusOnWindow());
          } else {
            spawn(
              hostFrameApi.forwardShortcut({
                key: e.key,
                shiftKey: e.shiftKey,
                ctrlKey: e.ctrlKey,
                metaKey: e.metaKey,
                code: e.code,
                keyCode: e.keyCode,
              }),
            );
          }
          return true;
        },
      ]),
    ),
  );
  return null;
}

export function useTopFrameState({
  appCtx,
  project,
  forceUpdate,
}: {
  appCtx: AppCtx;
  project: ApiProject | undefined;
  forceUpdate: () => void;
}) {
  const history = useHistory();

  const [studioReady, setStudioReady] = React.useState(false);
  const [latestPublishedVersionData, setLatestPublishedVersionData] =
    React.useState<{ revisionId: string; version: string }>();
  const [revisionNum, setRevisionNum] = React.useState(0);
  const [desktopTitleBarDragRegions, setDesktopTitleBarDragRegions] =
    React.useState<TopFrameApiArgs<"setDesktopTitleBarDragRegions">>([]);
  const [activeModal, setActiveModal] = React.useState<
    "publish" | "share" | null
  >(null);
  const showPublishModal = activeModal === "publish";
  const [keepPublishModalOpen, setKeepPublishModalOpen] = React.useState(false);
  const [mergeModalContext, setMergeModalContext] = React.useState<
    MergeModalContext | undefined
  >(undefined);
  const showShareModal = activeModal === "share";
  const [showCloneProjectModal, setShowCloneProjectModal] =
    React.useState(false);
  const [showProjectNameModal, setShowProjectNameModal] = React.useState(false);
  const [showHostModal, setShowHostModal] = React.useState(false);
  const [showUiConfigModal, setShowUiConfigModal] = React.useState(false);
  const [showLocalizationModal, setShowLocalizationModal] =
    React.useState(false);
  const [
    shouldShowRegenerateSecretTokenModal,
    setShouldShowRegenerateSecretTokenModal,
  ] = React.useState(false);
  const didShowRegenerateSecretTokenModal = React.useCallback(
    () => setShouldShowRegenerateSecretTokenModal(false),
    [setShouldShowRegenerateSecretTokenModal],
  );
  const [showUpsellForm, setShowUpsellForm] = React.useState<
    TopBarPromptBillingArgs | undefined
  >(undefined);
  const [showAppAuthModal, setShowAppAuthModal] = React.useState(false);
  const [studioModalOpen, setStudioModalOpen] = React.useState(false);
  const [localAiContext, setLocalAiContext] = React.useState<LocalAiContext>();
  const [aiPanelOpen, setAiPanelOpen] = React.useState(false);

  React.useEffect(() => setAiPanelOpen(false), [project?.id]);

  const [activatedBranch, setActivatedBranch] = React.useState<
    ApiBranch | undefined
  >();
  const [isLocalizationEnabled, setIsLocalizationEnabled] =
    React.useState(false);
  const [localizationScheme, setLocalizationScheme] = React.useState<
    LocalizationConfig | undefined
  >(undefined);
  const [dataSourcePicker, setDataSourcePicker] = React.useState<{
    args: Parameters<TopFrameApi["pickDataSource"]>[0];
    resolve: (
      result: Awaited<ReturnType<TopFrameApi["pickDataSource"]>>,
    ) => void;
  }>();
  const [defaultPageRoleId, setDefaultPageRoleId] = React.useState<
    string | null | undefined
  >();

  const [onboardingTour, setOnboardingTour] = React.useState<TopFrameTourState>(
    {
      run: false,
      tour: "",
      stepIndex: 0,
    },
  );

  const topFrameApi = React.useMemo<TopFrameApi>(
    () => ({
      openDesktopBrowser,
      openDesktopPreview,
      pushLocation(path, query, hash) {
        validateNewLocation(path, history.location);
        // history@5 doesn't resolve missing parts like history@4 did:
        // a missing pathname means "stay here", missing search/hash clear.
        history.push({
          pathname: path ?? history.location.pathname,
          search: query ?? "",
          hash: hash ?? "",
        });
        forceUpdate();
      },
      replaceLocation(path, query, hash) {
        validateNewLocation(path, history.location);
        history.replace({
          pathname: path ?? history.location.pathname,
          search: query ?? "",
          hash: hash ?? "",
        });
        forceUpdate();
      },
      registerLocationListener: (listener) => {
        const unregister = history.listen(listener);

        // replace host's initial location
        listener({ location: history.location, action: Action.Replace });

        return unregister;
      },

      setStudioReady: asyncWrapper(() => setStudioReady(true)),
      openDesktopDrafts: async (userId, projectId, branchId) => {
        assert(projectId === project?.id && userId === appCtx.selfInfo?.id, "Invalid draft scope");
        return desktopDraftBridge()?.open(userId, projectId, branchId) ?? null;
      },
      readDesktopDraft: async (handle, id) => ensure(desktopDraftBridge(), "Desktop drafts unavailable").read(handle, id),
      writeDesktopDraft: async (handle, draft) => ensure(desktopDraftBridge(), "Desktop drafts unavailable").write(handle, draft),
      removeDesktopDraft: async (handle, id, sequence) => ensure(desktopDraftBridge(), "Desktop drafts unavailable").remove(handle, id, sequence),
      copyDesktopDraft: async (handle, id) => {
        const draft = ensure(await ensure(desktopDraftBridge(), "Desktop drafts unavailable").read(handle, id), "Local draft not found");
        const { projectId } = await appCtx.api.importProject(JSON.stringify({
          format: "plasmic/project", version: 1, name: translate(getUiLocale(), "{name} (Local draft)", { name: draft.projectName }),
          bundles: [...draft.dependencies.map(dep => [dep.id, dep.model]), [draft.projectId, draft.bundle]],
        }), { workspaceId: project?.workspaceId ?? undefined });
        return projectId;
      },
      getSavedEditorView: async (projectId: string) => {
        const desktop = (
          window as Window & {
            desktopEnvironment?: {
              getSavedEditorView(
                projectId: string,
              ): Promise<
                | import("@/wab/client/frame-ctx/top-frame-api").SavedEditorView
                | null
              >;
            };
          }
        ).desktopEnvironment;
        return desktop ? desktop.getSavedEditorView(projectId) : null;
      },
      setDocumentTitle: async (val: string) => {
        document.title = val;
      },
      setDesktopTitleBarDragRegions: asyncWrapper(setDesktopTitleBarDragRegions),
      setPrimitiveValues: async (vals) => {
        setRevisionNum(vals.revisionNum);
        setIsLocalizationEnabled(vals.isLocalizationEnabled);
        setLocalizationScheme(vals.localizationScheme);
        setDefaultPageRoleId(vals.defaultPageRoleId);
      },
      setLatestPublishedVersionData: asyncWrapper(
        setLatestPublishedVersionData,
      ),
      setActivatedBranch: asyncWrapper((x) => {
        setActivatedBranch(x);
      }),
      setMergeModalContext: asyncWrapper(setMergeModalContext),
      setShowPublishModal: asyncWrapper((open: boolean) =>
        setActiveModal((current) =>
          open ? "publish" : current === "publish" ? null : current,
        ),
      ),
      setKeepPublishModalOpen: asyncWrapper(setKeepPublishModalOpen),
      setShowShareModal: asyncWrapper((open: boolean) =>
        setActiveModal((current) =>
          open ? "share" : current === "share" ? null : current,
        ),
      ),
      setShowProjectNameModal: asyncWrapper(setShowProjectNameModal),
      setShowCloneProjectModal: asyncWrapper(setShowCloneProjectModal),
      setShowHostModal: asyncWrapper(setShowHostModal),
      setShowLocalizationModal: asyncWrapper(setShowLocalizationModal),
      setShowUiConfigModal: asyncWrapper(setShowUiConfigModal),
      showRegenerateSecretTokenModal: async () =>
        setShouldShowRegenerateSecretTokenModal(true),
      setShowUpsellForm: asyncWrapper(setShowUpsellForm),
      setShowAppAuthModal: asyncWrapper(setShowAppAuthModal),
      setStudioModalOpen: asyncWrapper(setStudioModalOpen),
      setAiPanelOpen: asyncWrapper(setAiPanelOpen),
      subscribeAiSession: async (projectId, listener) => {
        assert(
          projectId === project?.id,
          "AI session belongs to the current project",
        );
        const session = getLocalEditSession(projectId);
        const publish = () => listener(snapshotAiSession(session));
        const dispose = session.subscribe(publish);
        publish();
        return Comlink.proxy(dispose);
      },
      updateAiSession: async (projectId, action) => {
        assert(
          projectId === project?.id,
          "AI session belongs to the current project",
        );
        await applyAiSessionAction(getLocalEditSession(projectId), action);
      },
      downloadAiAttachment: async (projectId, fileId, name) => {
        assert(
          projectId === project?.id,
          "AI attachment belongs to the current project",
        );
        const link = document.createElement("a");
        link.href = `/api/v1/projects/${encodeURIComponent(projectId)}/ai/chat/attachments/${encodeURIComponent(fileId)}`;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        link.remove();
      },
      getLocalAiStatus: async (projectId) => {
        assert(
          projectId === project?.id,
          "AI session belongs to the current project",
        );
        return localAiFetch(projectId, "status");
      },
      setLocalAiContext: asyncWrapper(setLocalAiContext),
      onFrameInteraction: asyncWrapper((event) =>
        dispatchFrameInteraction(document, event),
      ),
      onFileDragEventInHost: asyncWrapper((event) =>
        fileDragMonitor.onRemoteEvent(event),
      ),
      setOnboardingTour: asyncWrapper(setOnboardingTour),
      pickDataSource: async (opts) => {
        return new Promise((resolve) => {
          setDataSourcePicker({ args: opts, resolve });
        }).finally(() =>
          setDataSourcePicker(undefined),
        ) as TopFrameApiReturnType<"pickDataSource">;
      },
      getCurrentTeam: async () => {
        if (!project) {
          return undefined;
        }
        return appCtx.getAllTeams().find((team) => team.id === project.teamId);
      },
      canEditProjectUiConfig: async () => {
        const team = appCtx.getAllTeams().find((t) => t.id === project?.teamId);
        if (!team || !project) {
          return false;
        }
        return canEditUiConfig(
          team,
          { type: "project", resource: project },
          appCtx.selfInfo,
          appCtx.perms,
        );
      },
      promptBilling: async () => {
        const team = appCtx.getAllTeams().find((t) => t.id === project?.teamId);
        if (!team || !project) {
          return;
        }
        await promptTeamUpgrade(appCtx, team);
      },
    }),
    [appCtx, project],
  );

  return {
    studioReady,
    topFrameApi,
    latestPublishedVersionData,
    revisionNum,
    desktopTitleBarDragRegions,
    activatedBranch,
    isLocalizationEnabled,
    localizationScheme,
    dataSourcePicker,
    showPublishModal,
    keepPublishModalOpen,
    mergeModalContext,
    showShareModal,
    showProjectNameModal,
    showCloneProjectModal,
    showHostModal,
    showLocalizationModal,
    showUiConfigModal,
    showUpsellForm,
    setShowUpsellForm,
    showAppAuthModal,
    studioModalOpen,
    aiPanelOpen,
    localAiContext,
    defaultPageRoleId,
    setDefaultPageRoleId,
    onboardingTour,
    shouldShowRegenerateSecretTokenModal,
    didShowRegenerateSecretTokenModal,
  };
}

function validateNewLocation(
  path: string | undefined,
  previousLocation: Location,
) {
  if (!path) {
    return; // query / hash changes only are okay
  }

  assert(isPlasmicPath(path), `${path} is not Plasmic`);

  // https://app.shortcut.com/plasmic/story/20746/improve-isolation-to-support-arbitrary-code
  if (APP_ROUTES.projectPresentation.parse(previousLocation.pathname, false)) {
    assert(
      APP_ROUTES.projectPresentation.parse(path, false),
      `Cannot navigate from full preview mode to outside of it, from ${previousLocation.pathname} to ${path}`,
    );
  } else {
    assert(
      !APP_ROUTES.projectPresentation.parse(path, false),
      `Cannot navigate from studio to full preview mode, from ${previousLocation.pathname} to ${path}`,
    );
  }
}
