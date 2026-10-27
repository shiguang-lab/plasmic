import { useErrorMessage } from "@/wab/client/hooks/useErrorMessage";
import { showError } from "@/wab/client/ErrorNotifications";
import { useGetDomainsForProject } from "@/wab/client/api-hooks";
import { AppCtx } from "@/wab/client/app-ctx";
import PreviewPublishSection, {
  PreviewPublishSectionProps,
} from "@/wab/client/components/TopFrame/TopBar/PreviewPublishSection";
import {
  SetupPlasmicHosting,
  StatusPlasmicHosting,
} from "@/wab/client/components/TopFrame/TopBar/SubsectionPlasmicHosting";
import SubsectionPushDeploy, {
  SetupPushDeploy,
  StatusPushDeploy,
} from "@/wab/client/components/TopFrame/TopBar/SubsectionPushDeploy";
import SubsectionSaveVersion, {
  SetupSaveVersion,
  StatusSaveVersion,
} from "@/wab/client/components/TopFrame/TopBar/SubsectionSaveVersion";
import SubsectionWebhooks, {
  SetupWebhooks,
  StatusWebhooks,
} from "@/wab/client/components/TopFrame/TopBar/SubsectionWebhooks";
import { topFrameTourSignals } from "@/wab/client/components/TopFrame/TopFrameChrome";
import {
  SiteDiffs,
  SplitStatusUpdateSummarySection,
} from "@/wab/client/components/modals/SiteDiffs";
import WebhooksHistory from "@/wab/client/components/webhooks/WebhooksHistory";
import { useTopFrameCtx } from "@/wab/client/frame-ctx/top-frame-ctx";
import {
  useAsyncFnStrict,
  useAsyncStrict,
} from "@/wab/client/hooks/useAsyncStrict";
import { useI18n } from "@/wab/client/i18n";
import {
  DefaultPublishFlowDialogProps,
  PlasmicPublishFlowDialog,
  PlasmicPublishFlowDialog__VariantMembers,
} from "@/wab/client/plasmic/plasmic_kit_continuous_deployment/PlasmicPublishFlowDialog";
import { TutorialEventsType } from "@/wab/client/tours/tutorials/tutorials-events";
import { ApiBranch, ApiProject } from "@/wab/shared/ApiSchema";
import { spawn } from "@/wab/shared/common";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { prodUrlForProject } from "@/wab/shared/project-urls";
import type {
  ChangeLogEntry,
  SemVerReleaseType,
} from "@/wab/shared/site-diffs";
import { filterUsefulDiffs } from "@/wab/shared/site-diffs/filter-useful-diffs";
import { PlusOutlined } from "@ant-design/icons";
import { Button, Skeleton } from "antd";
import { createStyles } from "antd-style";
import * as React from "react";

const usePublishActionStyles = createStyles(({ token }) => ({
  options: { display: "flex", flexDirection: "column", gap: 16 },
  heading: {
    margin: 0,
    textAlign: "center",
    color: token.colorTextSecondary,
    fontSize: token.fontSize,
    fontWeight: 600,
  },
  cards: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 8,
    "@media (max-width: 600px)": { gridTemplateColumns: "minmax(0, 1fr)" },
  },
  card: {
    minWidth: 0,
    padding: 8,
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadiusSM,
    "& > button": { background: token.colorFillTertiary, fontWeight: 600 },
    "& > p": { margin: "8px 0 0", color: token.colorText },
  },
}));

export interface VisibleEnableBlockReadOnly {
  visible: boolean;
  enable: boolean;
  block: boolean;
}
export interface VisibleEnableBlock extends VisibleEnableBlockReadOnly {
  setVisibleEnableBlock: (v: boolean, e: boolean, b: boolean) => void;
}

export interface SubsectionMeta {
  saveVersion: VisibleEnableBlock & {
    setup: SetupSaveVersion;
    status?: StatusSaveVersion;
  };
  plasmicHosting: VisibleEnableBlock & {
    setup: SetupPlasmicHosting;
    status?: StatusPlasmicHosting;
  };
  pushDeploy: VisibleEnableBlock & {
    setup: SetupPushDeploy;
    status?: StatusPushDeploy;
  };
  webhooks: VisibleEnableBlock & {
    setup: SetupWebhooks;
    status?: StatusWebhooks;
  };
}

interface PublishFlowDialogProps extends DefaultPublishFlowDialogProps {
  website?: Omit<
    PreviewPublishSectionProps,
    | "publish"
    | "close"
    | "success"
    | "current"
    | "loading"
    | "nextVersion"
    | "releaseDetails"
    | "options"
    | "renderDialog"
    | "hasActions"
    | "currentVersion"
    | "saveLabel"
  > & { loading: boolean; retry: () => void };
  renderDialog: PreviewPublishSectionProps["renderDialog"];
  revisionNum?: number;
  latestPublishedVersionData:
    { revisionId: string; version: string } | undefined;
  appCtx: AppCtx;
  project: ApiProject;
  refreshProjectAndPerms: () => void;
  activatedBranch: ApiBranch | undefined;
  closeDialog: () => void;
  subsectionMeta: SubsectionMeta;
  setView: (
    view: PlasmicPublishFlowDialog__VariantMembers["view"] | undefined,
  ) => void;
  publish: () => void;
  resetStatus: () => void;
}

function PublishFlowDialog(props: PublishFlowDialogProps) {
  const { t } = useI18n();
  const { styles: actionStyles } = usePublishActionStyles();
  const {
    appCtx,
    project,
    refreshProjectAndPerms,
    activatedBranch,
    latestPublishedVersionData: latestRelease,
    closeDialog,
    subsectionMeta,
    view,
    setView,
    publish,
    resetStatus,
    website,
    revisionNum,
    publishState,
    renderDialog,
    ...rest
  } = props;
  const { hostFrameApi } = useTopFrameCtx();
  const projectId = project.id;

  // Versions
  const [loadingVersion, setLoadingVersion] = React.useState(true);
  const [versionError, setVersionError] = React.useState(false);
  const [nextVersion, setNextVersion] = React.useState<{
    version: string;
    releaseType?: SemVerReleaseType;
    changeLog: ChangeLogEntry[];
  }>();
  React.useEffect(() => {
    spawn(
      (async () => {
        if (loadingVersion) {
          setVersionError(false);
          try {
            const next = await hostFrameApi.calculateNextPublishVersion();
            setNextVersion(next);
            if (website || view !== "status") {
              if (next) {
                subsectionMeta.saveVersion.setVisibleEnableBlock(
                  true,
                  true,
                  false,
                );
              } else {
                subsectionMeta.saveVersion.setVisibleEnableBlock(
                  true,
                  false,
                  true,
                );
              }
            }
          } catch (error) {
            showError(error, { title: "Failed to load publishing settings" });
            setVersionError(true);
          } finally {
            setLoadingVersion(false);
          }
        }
      })(),
    );
  }, [hostFrameApi, view, loadingVersion]);

  React.useEffect(() => {
    setLoadingVersion(true);
  }, [revisionNum, publishState === "success" || publishState === "failure"]);

  // Webhooks
  const fetchWebhooks = useAsyncFnStrict(async () => {
    if (activatedBranch) {
      return;
    }
    const response = await appCtx.api.getProjectWebhooks(projectId);
    subsectionMeta.webhooks.setup.updateWebhooks(response.webhooks);
    if (view !== "status") {
      if (subsectionMeta.webhooks.block && response.webhooks.length > 0) {
        subsectionMeta.webhooks.setVisibleEnableBlock(true, true, false);
      } else if (response.webhooks.length === 0) {
        subsectionMeta.webhooks.setVisibleEnableBlock(
          subsectionMeta.webhooks.visible,
          false,
          true,
        );
      }
    }
    return response;
  }, [projectId, subsectionMeta, view])[1];
  const webhookEventState = useAsyncStrict(async () => {
    if (view === "webhooksHistory") {
      return await appCtx.api.getProjectWebhookEvents(projectId);
    }
    return undefined;
  }, [view]);

  const diffs = !nextVersion ? null : filterUsefulDiffs(nextVersion.changeLog);

  const {
    data: plasmicHostingDomains,
    isLoading: loadingDomains,
    error: domainsError,
    mutate: retryDomains,
  } = useGetDomainsForProject(projectId);

  useErrorMessage(!website && domainsError, "Failed to load publishing settings");

  if (!website && loadingDomains) {
    return renderDialog(
      <div role="status" aria-label={t("Loading publishing settings…")}>
        <Skeleton active />
      </div>,
      null,
    );
  }

  if (!website && domainsError) {
    return renderDialog(
      <Button
        onClick={() => {
          void retryDomains();
        }}
      >
        {t("Retry")}
      </Button>,
      null,
    );
  }

  const prodUrl = prodUrlForProject(
    DEVFLAGS,
    project,
    plasmicHostingDomains?.domains ?? [],
  );

  if (website) {
    const websiteCurrent =
      !!website.publication?.enabled &&
      !loadingVersion &&
      !nextVersion &&
      website.publication.version === latestRelease?.version &&
      (!website.entryPath ||
        website.entryPath === website.publication.entryPath);
    return (
      <PreviewPublishSection
        {...website}
        renderDialog={(body, footer) =>
          renderDialog(
            <>
              {(versionError || (!!website.error && website.loading)) && (
                <Button
                  onClick={() => {
                    setLoadingVersion(true);
                    website.retry();
                  }}
                >
                  {t("Retry")}
                </Button>
              )}
              {body}
            </>,
            footer,
          )
        }
        busy={website.busy || publishState === "publishing"}
        loading={website.loading || loadingVersion || versionError}
        success={
          publishState === "success" &&
          !nextVersion &&
          (!website.enabled || websiteCurrent)
        }
        hasActions={
          subsectionMeta.saveVersion.enable ||
          subsectionMeta.pushDeploy.enable ||
          subsectionMeta.webhooks.enable
        }
        currentVersion={latestRelease?.version ?? "0.0.1"}
        saveLabel={
          subsectionMeta.pushDeploy.enable || subsectionMeta.webhooks.enable
            ? subsectionMeta.saveVersion.enable
              ? "Save version and run integrations"
              : "Run integrations"
            : "Save version"
        }
        current={
          websiteCurrent &&
          !website.error &&
          publishState !== "failure" &&
          !subsectionMeta.pushDeploy.enable &&
          !subsectionMeta.webhooks.enable
        }
        error={
          website.error ||
          (publishState === "failure"
            ? t("An error occurred when publishing. Please try again!")
            : undefined)
        }
        nextVersion={
          subsectionMeta.saveVersion.enable ? nextVersion?.version : undefined
        }
        publish={publish}
        close={closeDialog}
        releaseDetails={
          <>
            {view === "reviewChanges" && (
              <>
                <Button onClick={() => setView(undefined)}>{t("Back")}</Button>
                <SiteDiffs diffs={diffs ?? []} />
              </>
            )}
            <SubsectionSaveVersion
              project={project}
              closeDialog={closeDialog}
              changesSummary={
                <SplitStatusUpdateSummarySection diffs={diffs ?? []} />
              }
              gotoReviewChanges={() => setView("reviewChanges")}
              loading={loadingVersion}
              version={nextVersion?.version}
              releaseType={nextVersion?.releaseType}
              view={
                website.busy || publishState === "publishing"
                  ? "status"
                  : undefined
              }
              {...subsectionMeta.saveVersion}
            />
          </>
        }
        options={
          <div
            style={!website.canEdit ? { display: "none" } : undefined}
            className={actionStyles.options}
          >
            {view === "webhooksHistory" && (
              <>
                <Button onClick={() => setView(undefined)}>{t("Back")}</Button>
                <WebhooksHistory state={webhookEventState} />
              </>
            )}
            <div hidden={!subsectionMeta.pushDeploy.visible}>
              <SubsectionPushDeploy
                project={project}
                appCtx={appCtx}
                {...subsectionMeta.pushDeploy}
                view={publishState === "publishing" ? "status" : undefined}
              />
            </div>
            <div hidden={!subsectionMeta.webhooks.visible}>
              <SubsectionWebhooks
                appCtx={appCtx}
                project={project}
                {...subsectionMeta.webhooks}
                view={publishState === "publishing" ? "status" : undefined}
                fetchWebhooks={() => spawn(fetchWebhooks())}
                webhookEventState={webhookEventState}
                onViewHistory={() => setView("webhooksHistory")}
              />
            </div>
            {(!subsectionMeta.pushDeploy.visible ||
              !subsectionMeta.webhooks.visible) && (
              <section aria-label={t("Add publish actions")}>
                <h4 className={actionStyles.heading}>
                  {t("Add publish actions")}
                </h4>
                <div className={actionStyles.cards} style={{ marginTop: 8 }}>
                  {!subsectionMeta.pushDeploy.visible && (
                    <div className={actionStyles.card}>
                      <Button
                        block
                        type="text"
                        icon={<PlusOutlined aria-hidden />}
                        onClick={() =>
                          subsectionMeta.pushDeploy.setVisibleEnableBlock(
                            true,
                            false,
                            true,
                          )
                        }
                      >
                        {t("Push to GitHub")}
                      </Button>
                      <p>
                        {t("Generate a new Next.js / Gatsby / React repo.")}
                      </p>
                    </div>
                  )}
                  {!subsectionMeta.webhooks.visible && (
                    <div className={actionStyles.card}>
                      <Button
                        block
                        type="text"
                        icon={<PlusOutlined aria-hidden />}
                        onClick={() =>
                          subsectionMeta.webhooks.setVisibleEnableBlock(
                            true,
                            true,
                            true,
                          )
                        }
                      >
                        {t("Call webhooks")}
                      </Button>
                      <p>
                        {t(
                          "Trigger a build in Vercel, Netlify, Jenkins, or any other CI/CD pipeline.",
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        }
      />
    );
  }

  return renderDialog(
    <>
      {versionError && (
        <Button onClick={() => setLoadingVersion(true)}>
          {t("Retry")}
        </Button>
      )}
      <PlasmicPublishFlowDialog
        {...rest}
        publishState={publishState}
        projectName={project.name}
        view={view}
        currentVersionNumber={!latestRelease ? "v0.0.1" : latestRelease.version}
        destinationSection={{
          render: (ps, Comp) =>
            prodUrl && (
              <Comp {...ps}>
                <a href={prodUrl} target={"_blank"}>
                  {prodUrl.replace(/^https?:\/\//, "")}
                </a>
              </Comp>
            ),
          props: {},
        }}
        root={{
          id: "publish-flow-dialog-root",
          style: {
            maxHeight: "calc(100vh - 240px)",
            maxWidth: `calc(100vw - 32px)`,
          },
        }}
        cancelButton={{
          onClick: closeDialog,
        }}
        dismissButton={{
          render: () => null,
        }}
        backButton={{
          onClick: () => setView(undefined),
        }}
        publishButton={{
          disabled:
            loadingVersion ||
            versionError ||
            (!subsectionMeta.saveVersion.enable &&
              !subsectionMeta.pushDeploy.enable &&
              !subsectionMeta.webhooks.enable),
          onClick: publish,
          id: "publish-flow-dialog-publish-btn",
          children: loadingVersion
            ? t("Loading...")
            : appCtx.appConfig.enablePlasmicHosting &&
                subsectionMeta.plasmicHosting.enable
              ? t(
                  subsectionMeta.saveVersion.enable
                    ? "Save version and publish website"
                    : "Publish website",
                )
              : subsectionMeta.pushDeploy.enable ||
                  subsectionMeta.webhooks.enable
                ? t(
                    subsectionMeta.saveVersion.enable
                      ? "Save version and run integrations"
                      : "Run integrations",
                  )
                : t("Save version"),
        }}
        startOverButton={{
          children: t("Back to publishing settings"),
          onClick: () => {
            subsectionMeta.webhooks.setup.resetWebhookEnabled();
            resetStatus();
            setView(undefined);
            setLoadingVersion(true);
          },
        }}
        subsectionSaveVersion={{
          props: {
            project,
            closeDialog: closeDialog,
            changesSummary: (
              <SplitStatusUpdateSummarySection diffs={diffs ?? []} />
            ),
            gotoReviewChanges: () => setView("reviewChanges"),
            loading: loadingVersion,
            version: nextVersion?.version,
            releaseType: nextVersion?.releaseType,
            ...subsectionMeta.saveVersion,
          },
        }}
        subsectionPushDeploy={{
          props: {
            // Important to render the component, since the component is what
            // kicks off the load.
            style: subsectionMeta.pushDeploy.visible ? {} : { display: "none" },
            project,
            appCtx,
            ...subsectionMeta.pushDeploy,
          },
        }}
        subsectionPlasmicHosting={{
          props: {
            // Important to render the component, since the component is what
            // kicks off the load.
            style: subsectionMeta.plasmicHosting.visible
              ? {}
              : { display: "none" },
            project,
            refreshProjectAndPerms,
            appCtx,
            ...subsectionMeta.plasmicHosting,
          },
        }}
        subsectionWebhooks={{
          props: {
            appCtx,
            project,
            // Important to render the component, since the component is what
            // kicks off the loa.
            style: subsectionMeta.webhooks.visible ? {} : { display: "none" },
            fetchWebhooks: () => spawn(fetchWebhooks()),
            webhookEventState,
            onViewHistory: () => setView("webhooksHistory"),
            ...subsectionMeta.webhooks,
          },
        }}
        webhooksHistory={{
          props: {
            state: webhookEventState,
          },
        }}
        container={{
          render: () =>
            !diffs ? null : (
              <div>
                <SiteDiffs diffs={diffs} />
              </div>
            ),
        }}
        addWebhooksButton={{
          withIcons: "startIcon",
          onClick: () =>
            subsectionMeta.webhooks.setVisibleEnableBlock(true, true, true),
        }}
        webhooksDescription={{
          children: t(
            "Trigger a build in Vercel, Netlify, Jenkins, or any other CI/CD pipeline.",
          ),
        }}
        addWebhooksPanel={{
          wrap: (node) => !subsectionMeta.webhooks.visible && node,
        }}
        addGithubButton={{
          withIcons: "startIcon",
          onClick: () =>
            subsectionMeta.pushDeploy.setVisibleEnableBlock(true, false, true),
        }}
        addGithubPanel={{
          wrap: (node) => !subsectionMeta.pushDeploy.visible && node,
        }}
        addWebsiteButton={{
          id: "publish-flow-dialog-add-website-btn",
          withIcons: "startIcon",
          onClick: () => {
            topFrameTourSignals.dispatch({
              type: TutorialEventsType.AddWebsiteButtonClicked,
            });
            subsectionMeta.plasmicHosting.setVisibleEnableBlock(
              true,
              false, // We don't have any domains set yet, so the action is disabled
              true,
            );
          },
        }}
        addWebsitePanel={{
          wrap: (node) =>
            appCtx.appConfig.enablePlasmicHosting &&
            !subsectionMeta.plasmicHosting.visible &&
            node,
          props: {
            id: "publish-flow-dialog-add-website-panel",
          },
        }}
        addActionsContainer={{
          wrap: (node) =>
            !activatedBranch &&
            (!subsectionMeta.pushDeploy.visible ||
              !subsectionMeta.webhooks.visible ||
              !subsectionMeta.plasmicHosting.visible) &&
            node,
        }}
        statusButton={{
          onClick: () => setView("status"),
        }}
      />
    </>,
    null,
  );
}

export default PublishFlowDialog;
