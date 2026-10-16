import { PublishModal } from "@/wab/client/components/TopFrame/TopBar/PublishModal";
import { ensureWebsiteVersionSaved } from "@/wab/client/components/TopFrame/TopBar/publish-website";
import { useI18n } from "@/wab/client/i18n";

/** @format */

import { apiKey } from "@/wab/client/api";
import { AppCtx } from "@/wab/client/app-ctx";
import PublishFlowDialog, {
  SubsectionMeta,
  VisibleEnableBlockReadOnly,
} from "@/wab/client/components/TopFrame/TopBar/PublishFlowDialog";
import PublishWizard from "@/wab/client/components/TopFrame/TopBar/PublishWizard";
import { StatusPlasmicHosting } from "@/wab/client/components/TopFrame/TopBar/SubsectionPlasmicHosting";
import {
  StatusPushDeploy,
  mkPushDeployPublishState,
} from "@/wab/client/components/TopFrame/TopBar/SubsectionPushDeploy";
import {
  StatusSaveVersion,
  mkSaveVersionPublishState,
} from "@/wab/client/components/TopFrame/TopBar/SubsectionSaveVersion";
import {
  StatusWebhooks,
  mkWebhooksPublishState,
} from "@/wab/client/components/TopFrame/TopBar/SubsectionWebhooks";
import { TopBarModal } from "@/wab/client/components/TopFrame/TopBar/TopBarModal";
import { topFrameTourSignals } from "@/wab/client/components/TopFrame/TopFrameChrome";
import { ToggleWebhook } from "@/wab/client/components/webhooks/WebhooksItem";
import { personalProjectPaywallMessage } from "@/wab/client/components/widgets/plasmic/ShareDialogContent";
import { useAppCtx } from "@/wab/client/contexts/AppContexts";
import { useTopFrameCtx } from "@/wab/client/frame-ctx/top-frame-ctx";
import {
  useAsyncFnStrict,
  useAsyncStrict,
} from "@/wab/client/hooks/useAsyncStrict";
import { PlasmicPublishFlowDialog__VariantMembers } from "@/wab/client/plasmic/plasmic_kit_continuous_deployment/PlasmicPublishFlowDialog";
import { TutorialEventsType } from "@/wab/client/tours/tutorials/tutorials-events";
import { trackEvent } from "@/wab/client/tracking";
import {
  ApiBranch,
  ApiProject,
  ApiProjectWebhook,
  GitActionParams,
  GitWorkflowJobStep,
} from "@/wab/shared/ApiSchema";
import { spawn, waitUntil } from "@/wab/shared/common";
import { notification } from "antd";
import L from "lodash";
import { observer } from "mobx-react";
import * as React from "react";
import { useInterval } from "react-use";
import useSWR from "swr";

/**
 * When `useInterval()` is passed `null`, the polling loop is paused.
 */
export const DELAY_PAUSED = null;

/**
 * Delay used while waiting for GitHub to create the first workflow run.
 * This is still throttled so that we never hammer the server.
 */
export const DELAY_FAST_POLL = 50;

/**
 * Delay used when a workflow job is in the `in_progress` state.
 */
export const DELAY_MEDIUM_POLL = 1000;

/**
 * Delay used for other non-critical polling states (e.g. queued).
 */
export const DELAY_SLOW_POLL = 3000;

export type Delay =
  | typeof DELAY_PAUSED
  | typeof DELAY_FAST_POLL
  | typeof DELAY_MEDIUM_POLL
  | typeof DELAY_SLOW_POLL;

export type PublishState = undefined | "publishing" | "success" | "failure";

function mkPublishState(
  saveVersion: StatusSaveVersion | undefined,
  pushDeploy: StatusPushDeploy | undefined,
  webhooks: StatusWebhooks | undefined,
): PublishState {
  const states = [
    mkSaveVersionPublishState(saveVersion),
    mkPushDeployPublishState(pushDeploy),
    mkWebhooksPublishState(webhooks),
  ];

  for (const state of ["publishing", "failure", "success"] as PublishState[]) {
    if (states.includes(state as PublishState)) {
      return state as PublishState;
    }
  }

  return undefined;
}

function shouldShowPublishWizard(project: ApiProject, appCtx: AppCtx): boolean {
  const starterId = project.clonedFromProjectId;
  if (!starterId) {
    return false;
  }

  const starterProjects = L.flatMap(
    appCtx.appConfig.starterSections,
    (section) => section.projects,
  ).filter((p) => p.publishWizard);
  return starterProjects.map((p) => p.projectId).includes(starterId);
}

interface PublishFlowDialogWrapperProps {
  project: ApiProject;
  refreshProjectAndPerms: () => void;
  activatedBranch: ApiBranch | undefined;
  editorPerm: boolean;
  latestPublishedVersionData:
    { revisionId: string; version: string } | undefined;
  revisionNum: number;
  showPublishModal: boolean;
  keepPublishModalOpen: boolean;
  setShowPublishModal: (val: boolean) => Promise<void>;
}

export const PublishFlowDialogWrapper = observer(
  function PublishFlowDialogWrapper({
    project,
    refreshProjectAndPerms,
    activatedBranch,
    editorPerm,
    latestPublishedVersionData,
    revisionNum,
    showPublishModal,
    setShowPublishModal,
    keepPublishModalOpen,
  }: PublishFlowDialogWrapperProps) {
    const { t: studioUiT } = useI18n();

    const appCtx = useAppCtx();
    const { hostFrameApi } = useTopFrameCtx();
    const projectId = project.id;
    const publishModalOpen = showPublishModal || keepPublishModalOpen;
    const [hasOpenedPublishModal, setHasOpenedPublishModal] =
      React.useState(publishModalOpen);
    React.useEffect(() => {
      if (publishModalOpen) {
        setHasOpenedPublishModal(true);
      }
    }, [publishModalOpen]);

    const [previewSucceeded, setPreviewSucceeded] = React.useState(false);
    const [previewEnabled, setPreviewEnabled] = React.useState(true);
    const publishingRef = React.useRef(false);
    const [publishing, setPublishing] = React.useState(false);
    const [unpublishing, setUnpublishing] = React.useState(false);
    const [previewEntryPath, setPreviewEntryPath] = React.useState("");
    const [previewBusy, setPreviewBusy] = React.useState(false);
    const [previewError, setPreviewError] = React.useState<unknown>();
    React.useEffect(() => {
      if (!publishingRef.current) {
        setPreviewSucceeded(false);
        setStatusSaveVersion(undefined);
        setPreviewError(undefined);
      }
    }, [revisionNum]);
    const previewAvailable =
      !!appCtx.appConfig.previewOrigin && !activatedBranch;
    const {
      data: previewResult,
      error: previewLoadError,
      mutate: refreshPreview,
    } = useSWR(
      previewAvailable && (publishModalOpen || hasOpenedPublishModal)
        ? apiKey("getPreviewPublication", projectId)
        : null,
      () => appCtx.api.getPreviewPublication(projectId),
    );
    const previewLoading =
      previewAvailable &&
      showPublishModal &&
      !previewResult &&
      !previewLoadError;
    React.useEffect(() => {
      if (previewResult?.publication) {
        setPreviewEntryPath(previewResult.publication.entryPath);
      }
    }, [previewResult]);
    const {
      data: publishPages,
      error: pagesError,
      mutate: refreshPages,
    } = useSWR(
      previewAvailable && (publishModalOpen || hasOpenedPublishModal)
        ? ["publishPages", projectId, revisionNum]
        : null,
      () => hostFrameApi.getPublishPages(),
    );
    const publishWebsite = async () => {
      setPreviewBusy(true);
      try {
        const result = await appCtx.api.publishPreviewPublication(
          projectId,
          previewEntryPath || undefined,
        );
        await refreshPreview(result, false);
        setPreviewSucceeded(true);
        refreshProjectAndPerms();
      } finally {
        setPreviewBusy(false);
      }
    };
    const unpublishWebsite = async () => {
      if (publishingRef.current || unpublishing || !editorPerm) {
        return;
      }
      setUnpublishing(true);
      setPreviewSucceeded(false);
      setPreviewError(undefined);
      setStatusSaveVersion(undefined);
      setStatusPushDeploy(undefined);
      setStatusWebhooks(undefined);
      setDelay(DELAY_PAUSED);
      try {
        await appCtx.api.unpublishPreviewPublication(projectId);
        await refreshPreview();
        refreshProjectAndPerms();
      } catch (error) {
        setPreviewError(error);
      } finally {
        setUnpublishing(false);
      }
    };

    const [view, setView] = React.useState<
      PlasmicPublishFlowDialog__VariantMembers["view"] | undefined
    >(undefined);
    const [wizard, setWizard] = React.useState(false);
    const [dismissedWizard, setDismissedWizard] = React.useState(false);
    const isWizardDisabled = true;

    const isVisible = wizard || showPublishModal || keepPublishModalOpen;

    const [publishState, setPublishState] =
      React.useState<PublishState>(undefined);

    // Project versioning
    const [vebSaveVersion, setVEBSaveVersion] =
      React.useState<VisibleEnableBlockReadOnly>({
        visible: true,
        enable: false,
        block: true,
      });
    const [versionTags, setVersionTags] = React.useState([] as string[]);
    const [versionDescription, setVersionDescription] = React.useState("");
    const [statusSaveVersion, setStatusSaveVersion] = React.useState<
      StatusSaveVersion | undefined
    >(undefined);
    // Plasmic hosting
    const [vebPlasmicHosting, setVEBPlasmicHosting] =
      React.useState<VisibleEnableBlockReadOnly>({
        visible: false,
        enable: false,
        block: true,
      });
    const [statusPlasmicHosting, setStatusPlasmicHosting] = React.useState<
      StatusPlasmicHosting | undefined
    >(undefined);
    const { data: domainsResult } = useSWR(
      isVisible ? apiKey(`getDomainsForProject`, projectId) : null,
      () =>
        !activatedBranch && appCtx.appConfig.enablePlasmicHosting
          ? appCtx.api.getDomainsForProject(projectId)
          : undefined,
      { revalidateOnMount: true },
    );
    const domains = domainsResult?.domains ?? [];
    // Push and deploy (GitHub integration)
    const [vebPushDeploy, setVEBPushDeploy] =
      React.useState<VisibleEnableBlockReadOnly>({
        visible: false,
        enable: false,
        block: true,
      });
    const [gitActionParams, setGitActionParams] =
      React.useState<GitActionParams>({
        title: "",
        description: "",
        projectId: project.id,
      });
    const [projectRepository, updateProjectRepository] =
      useAsyncFnStrict(async () => {
        if (!editorPerm) {
          return null;
        }
        if (activatedBranch) {
          return null;
        }
        const { projectRepositories } =
          await appCtx.api.getProjectRepositories(projectId);
        return projectRepositories[0] ?? null;
      }, [projectId]);
    React.useEffect(() => {
      if (projectRepository.loading || projectRepository.error) {
        return;
      }
      if (
        !isWizardDisabled &&
        !showPublishModal &&
        !dismissedWizard &&
        projectRepository.value === null &&
        revisionNum <= 2 &&
        shouldShowPublishWizard(project, appCtx)
      ) {
        setWizard(true);
      }
      setGitActionParams({
        ...gitActionParams,
        projectRepositoryId: projectRepository.value?.id,
        action: projectRepository.value?.defaultAction || "pr",
        branch: projectRepository.value?.defaultBranch,
      });
    }, [projectRepository]);
    useAsyncStrict(async () => {
      if (isVisible && view !== "status" && !projectRepository.loading) {
        await updateProjectRepository();
      }
    }, [view, isVisible]);
    const [connectedToGithub, setConnectedToGithub] = React.useState(false);
    const [statusPushDeploy, setStatusPushDeploy] = React.useState<
      StatusPushDeploy | undefined
    >(undefined);
    const [delay, setDelay] = React.useState<Delay>(DELAY_PAUSED);
    const [jobState, jobRun] = useAsyncFnStrict(async () => {
      if (!statusPushDeploy?.projectRepositoryId) {
        return;
      }

      if (!statusPushDeploy?.workflowRunId) {
        const run = await appCtx.api.getGitLatestWorkflowRun(
          statusPushDeploy.projectRepositoryId,
          projectId,
        );
        if (run.state === "running") {
          statusPushDeploy.setWorkflowRunId(run.workflowRunId);
          // Switch to fast-polling mode, but still throttle to at least 50 ms
          setDelay(DELAY_FAST_POLL);
          if (run.workflowJobUrl) {
            statusPushDeploy.setWorkflowJobUrl(run.workflowJobUrl);
          }
        }
        return;
      }

      const { job } = await appCtx.api.getGitWorkflowJob(
        statusPushDeploy.projectRepositoryId,
        project.id,
        statusPushDeploy.workflowRunId,
      );
      if (job) {
        statusPushDeploy.setWorkflowJobUrl(job.html_url ?? undefined);
        statusPushDeploy.setSteps(job.steps ?? []);
        if (job.status === "completed") {
          setDelay(DELAY_PAUSED);
        } else if (job.status === "in_progress") {
          setDelay(DELAY_MEDIUM_POLL);
        } else {
          setDelay(DELAY_SLOW_POLL);
        }
      }
    }, [statusPushDeploy]);
    useInterval(() => {
      if (!jobState.loading) {
        spawn(jobRun());
      }
    }, delay);

    // Webhooks
    const [vebWebhooks, setVEBWebhooks] =
      React.useState<VisibleEnableBlockReadOnly>({
        visible: false,
        enable: false,
        block: true,
      });
    const [webhooks, setWebhooks] = React.useState<ToggleWebhook[]>([]);
    const updateWebhooks = (newWebhooks: ApiProjectWebhook[]) => {
      const disabledIDs = new Set(
        webhooks.filter((w) => !w.enable).map((w) => w.id),
      );
      const ww = newWebhooks.map((w) => {
        return { ...w, enable: !disabledIDs.has(w.id) } as ToggleWebhook;
      });
      setWebhooks(ww);
    };
    const updateWebhook = (webhook: ToggleWebhook) => {
      const ww = [...webhooks];
      for (let i = 0; i < ww.length; i++) {
        if (ww[i].id === webhook.id) {
          ww[i] = webhook;
        }
      }
      setWebhooks(ww);
    };
    const resetWebhookEnabled = () => {
      const ww = [...webhooks];
      ww.forEach((w) => (w.enable = false));
      setWebhooks(ww);
    };
    const [statusWebhooks, setStatusWebhooks] = React.useState<
      StatusWebhooks | undefined
    >(undefined);

    const subsectionMeta: SubsectionMeta = {
      saveVersion: {
        ...vebSaveVersion,
        setVisibleEnableBlock: (v: boolean, e: boolean, b: boolean) => {
          setVEBSaveVersion({ visible: v, enable: e, block: b });
          // We also enable the plasmic hosting subsection, because the user can't choose to not publish due to ISR
          setVEBPlasmicHosting((prev) => ({
            ...prev,
            enable: domains.length > 0 ? e : false,
          }));
        },
        setup: {
          tags: versionTags,
          setTags: setVersionTags,
          description: versionDescription,
          setDescription: setVersionDescription,
        },
        status: statusSaveVersion,
      },
      plasmicHosting: {
        ...vebPlasmicHosting,
        setVisibleEnableBlock: (v: boolean, e: boolean, b: boolean) =>
          setVEBPlasmicHosting({
            visible: v,
            // We only enable the plasmic hosting subsection if the user is also saving a version. Plasmic hosting is unpredictable otherwise.
            enable: e && vebSaveVersion.enable,
            block: b,
          }),
        setup: {
          domains,
        },
        status: statusPlasmicHosting,
      },
      pushDeploy: {
        ...vebPushDeploy,
        setVisibleEnableBlock: (v: boolean, e: boolean, b: boolean) =>
          setVEBPushDeploy({ visible: v, enable: e, block: b }),
        setup: {
          gitActionParams,
          setGitActionParams,
          projectRepository,
          updateProjectRepository,
          connectedToGithub,
          setConnectedToGithub,
        },
        status: statusPushDeploy,
      },
      webhooks: {
        ...vebWebhooks,
        setVisibleEnableBlock: (v: boolean, e: boolean, b: boolean) =>
          setVEBWebhooks({ visible: v, enable: e, block: b }),
        setup: {
          webhooks,
          resetWebhookEnabled,
          updateWebhooks,
          updateWebhook,
        },
        status: statusWebhooks,
      },
    };

    const publish = () => {
      if (
        publishingRef.current ||
        !editorPerm ||
        previewLoading ||
        previewLoadError ||
        (previewAvailable && (!publishPages || pagesError))
      ) {
        return;
      }
      publishingRef.current = true;
      setPublishing(true);
      setPreviewSucceeded(false);
      setPreviewError(undefined);
      spawn(
        (async () => {
          try {
            topFrameTourSignals?.dispatch({
              type: TutorialEventsType.PublishModalButtonClicked,
            });
            setView("status");
            trackEvent("Publish", {
              save: vebSaveVersion.enable,
              plasmicHosting: vebPlasmicHosting.enable,
              github: vebPushDeploy.enable,
              webhooks: vebWebhooks.enable,
            });

            const _statusSaveVersion: StatusSaveVersion = {
              enabled: vebSaveVersion.enable,
            };
            const _statusPlasmicHosting: StatusPlasmicHosting = {
              enabled: vebPlasmicHosting.enable,
              revalidateResult: undefined,
              revalidateResponse: undefined,
            };
            const _statusPushDeploy: StatusPushDeploy = {
              enabled: vebPushDeploy.enable,
              projectRepositoryId: gitActionParams.projectRepositoryId,
              setWorkflowJobUrl: (url: string | undefined) => {
                _statusPushDeploy.workflowJobUrl = url;
                setStatusPushDeploy({ ..._statusPushDeploy });
              },
              setWorkflowRunId: (id: number) => {
                _statusPushDeploy.workflowRunId = id;
                setStatusPushDeploy({ ..._statusPushDeploy });
              },
              steps: [],
              setSteps: (steps: GitWorkflowJobStep[]) => {
                _statusPushDeploy.steps = steps;
                setStatusPushDeploy({ ..._statusPushDeploy });
              },
            };
            const _statusWebhooks: StatusWebhooks = {
              enabled: vebWebhooks.enable,
              enabledWebhooks: webhooks
                .filter((w) => w.enable && !!w.url)
                .map((w) => L.omit(w, "enable")),
            };

            setDelay(DELAY_PAUSED);

            setStatusSaveVersion({ ..._statusSaveVersion });
            setStatusPlasmicHosting({ ..._statusPlasmicHosting });
            setStatusPushDeploy({ ..._statusPushDeploy });
            setStatusWebhooks({ ..._statusWebhooks });

            if (_statusSaveVersion.enabled) {
              let publishResult: Awaited<
                ReturnType<typeof hostFrameApi.publishVersion>
              >;
              try {
                publishResult = await hostFrameApi.publishVersion(
                  versionTags,
                  versionDescription,
                  activatedBranch?.id,
                );
              } catch (error) {
                setStatusSaveVersion({
                  ..._statusSaveVersion,
                  result: "UnknownError",
                });
                throw error;
              }
              _statusSaveVersion.result = publishResult;
              setVersionTags([] as string[]);
              setVersionDescription("");
              setStatusSaveVersion({ ..._statusSaveVersion });

              try {
                ensureWebsiteVersionSaved(publishResult);
              } catch (error) {
                if (previewAvailable) {
                  throw error;
                }
                return;
              }

              const versionId =
                await hostFrameApi.getLatestPublishedVersionId();
              if (versionId && !previewAvailable) {
                await waitUntil(
                  async () => {
                    const { status } =
                      await appCtx.api.getPkgVersionPublishStatus(
                        project.id,
                        versionId,
                      );
                    return status === "ready";
                  },
                  { timeout: 5000 },
                );
              }

              setStatusSaveVersion({
                ..._statusSaveVersion,
                result: "Success",
              });
            }

            if (previewAvailable && previewEnabled) {
              await publishWebsite();
            }

            if (_statusPlasmicHosting.enabled) {
              setStatusPlasmicHosting({
                ..._statusPlasmicHosting,
                revalidateResult: "started",
              });
              const response =
                await appCtx.api.revalidatePlasmicHosting(projectId);
              setStatusPlasmicHosting({
                ..._statusPlasmicHosting,
                revalidateResult: "finished",
                revalidateResponse: response,
              });
              topFrameTourSignals.dispatch({
                type: TutorialEventsType.HostingPublished,
                params: {
                  response,
                },
              });
            }

            if (
              _statusPushDeploy.enabled &&
              gitActionParams.projectRepositoryId
            ) {
              const run = await appCtx.api.fireGitAction(gitActionParams);
              setGitActionParams({
                ...gitActionParams,
                title: "",
                description: "",
              });
              if (run.state === "running") {
                _statusPushDeploy.workflowRunId = run.workflowRunId;
                _statusPushDeploy.workflowJobUrl =
                  run.workflowJobUrl ?? undefined;
                setStatusPushDeploy({ ..._statusPushDeploy });
              }
              setDelay(DELAY_FAST_POLL);
            }

            if (_statusWebhooks.enabled) {
              for (const w of _statusWebhooks.enabledWebhooks) {
                const event = await appCtx.api.triggerProjectWebhook(
                  projectId,
                  w,
                );
                w.event = event;
                setStatusWebhooks({ ..._statusWebhooks });
              }
            }
          } catch (error) {
            if (!previewAvailable) {
              throw error;
            }
            setPreviewError(error);
          } finally {
            publishingRef.current = false;
            setPublishing(false);
          }
        })(),
      );
    };

    const resetStatus = () => {
      setStatusSaveVersion(undefined);
      setStatusPushDeploy(undefined);
      setStatusWebhooks(undefined);
      setPreviewError(undefined);
      setPreviewSucceeded(false);
    };

    React.useEffect(() => {
      setPublishState(
        previewError
          ? "failure"
          : publishing
            ? "publishing"
            : (mkPublishState(
                statusSaveVersion,
                statusPushDeploy,
                statusWebhooks,
              ) ?? (previewSucceeded ? "success" : undefined)),
      );
    }, [
      statusSaveVersion,
      statusPushDeploy,
      statusWebhooks,
      previewError,
      publishing,
      previewSucceeded,
    ]);

    React.useEffect(() => {
      if (publishState === "failure") {
        if (statusSaveVersion?.result === "PaywallError") {
          notification.error({
            message: personalProjectPaywallMessage,
            duration: 0,
          });
        } else {
          notification.warning({
            message: studioUiT("The latest publish failed"),
            description: studioUiT(
              "An error occurred when publishing. Please try again!",
            ),
          });
        }
      }
    }, [publishState]);

    return (
      <>
        {wizard && (
          <TopBarModal onClose={() => setWizard(false)}>
            <PublishWizard
              appCtx={appCtx}
              close={() => {
                setWizard(false);
                setDismissedWizard(true);
              }}
              onGithubConnect={() => {
                setWizard(false);
                setConnectedToGithub(true);
                spawn(setShowPublishModal(true));
              }}
            />
          </TopBarModal>
        )}

        {(publishModalOpen || hasOpenedPublishModal) && (
          <PublishFlowDialog
            renderDialog={(body, footer) => (
              <PublishModal
                open={publishModalOpen}
                compact={previewAvailable}
                busy={
                  publishState === "publishing" || previewBusy || unpublishing
                }
                onClose={() => {
                  void setShowPublishModal(false);
                }}
                footer={footer}
              >
                {body}
              </PublishModal>
            )}
            appCtx={appCtx}
            revisionNum={revisionNum}
            website={
              previewAvailable
                ? {
                    publication: previewResult?.publication,
                    enabled: previewEnabled,
                    setEnabled: setPreviewEnabled,
                    pages: publishPages ?? [],
                    entryPath: previewEntryPath,
                    setEntryPath: setPreviewEntryPath,
                    busy: publishing || unpublishing,
                    phase: unpublishing
                      ? "unpublishing"
                      : previewBusy
                        ? "building"
                        : previewSucceeded
                          ? "integrations"
                          : "saving",
                    loading:
                      previewLoading ||
                      !publishPages ||
                      !!previewLoadError ||
                      !!pagesError,
                    error: previewError || previewLoadError || pagesError,
                    canEdit: editorPerm,
                    unpublish: () => spawn(unpublishWebsite()),
                    retry: () => {
                      void refreshPreview();
                      void refreshPages();
                    },
                  }
                : undefined
            }
            latestPublishedVersionData={latestPublishedVersionData}
            project={project}
            refreshProjectAndPerms={refreshProjectAndPerms}
            activatedBranch={activatedBranch}
            closeDialog={() => setShowPublishModal(false)}
            setView={setView}
            subsectionMeta={subsectionMeta}
            view={view}
            publish={publish}
            resetStatus={resetStatus}
            publishState={publishState}
          />
        )}
      </>
    );
  },
);

export default PublishFlowDialogWrapper;
