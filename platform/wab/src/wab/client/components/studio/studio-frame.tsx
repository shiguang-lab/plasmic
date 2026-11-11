import { LoadingError } from "@/wab/client/components/widgets/LoadingError";
import { reportError } from "@/wab/client/ErrorNotifications";
import {
  getLoginRouteWithContinuation,
  parseProjectLocation,
} from "@/wab/client/cli-routes";
import HostUrlInput from "@/wab/client/components/HostUrlInput";
import { PublicLink } from "@/wab/client/components/PublicLink";
import { HostLoadTimeoutPrompt } from "@/wab/client/components/TopFrame/HostLoadTimeoutPrompt";
import {
  TopFrameChrome,
  useTopFrameState,
  useProjectAiSession,
} from "@/wab/client/components/TopFrame/TopFrameChrome";
import { useStudioStartup } from "@/wab/client/components/studio/StudioChrome";
import { TopFrameCopilotToolsBridge } from "@/wab/client/components/studio/TopFrameCopilotToolsBridge";
import { useAppCtx } from "@/wab/client/contexts/AppContexts";
import { buildPlasmicStudioArgsHash } from "@/wab/client/frame-ctx/plasmic-studio-args";
import {
  TopFrameCtxProvider,
  handleIframeLoad,
} from "@/wab/client/frame-ctx/top-frame-ctx";
import { usePreventDefaultBrowserPinchToZoomBehavior } from "@/wab/client/hooks/usePreventDefaultBrowserPinchToZoomBehavior";
import { getUiLocale, useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import { translate } from "@/wab/client/i18n/locales";
import { useLocation } from "@/wab/client/route/HistoryProvider";
import { useForceUpdate } from "@/wab/client/useForceUpdate";
import { getHostUrl, getStudioFrameUrl } from "@/wab/client/utils/app-hosting-utils";
import { useBrowserNotification } from "@/wab/client/utils/useBrowserNotification";
import { ForbiddenError } from "@/wab/shared/ApiErrors/errors";
import {
  ApiBranch,
  ApiPermission,
  ApiProject,
  MainBranchId,
  ProjectId,
} from "@/wab/shared/ApiSchema";
import { accessLevelRank, isUnownedProject } from "@/wab/shared/EntUtil";
import { maybeOne, spawn } from "@/wab/shared/common";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { getAccessLevelToResource } from "@/wab/shared/perms";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import { notification } from "antd";
import Modal from "antd/lib/modal/Modal";
import { Location } from "history";
import moize from "moize";
import * as React from "react";
import { useEffect } from "react";

const whitelistedHosts = [
  "https://studio.plasmic.app",
  "https://plasmic.app",
  "https://host.plasmicdev.com",
];

export function StudioFrame({
  projectId,
  refreshStudio,
}: {
  projectId: ProjectId;
  refreshStudio: () => Promise<void>;
}) {
  const { t: uiT } = useI18n();
  const appCtx = useAppCtx();
  const currentLocation = useLocation();
  // Keep the startup snapshot stable; live theme changes use the frame bridge
  // and must not navigate/reload the host by changing its hash.
  const studioArgsHash = React.useMemo(
    () => buildPlasmicStudioArgsHash(appCtx.appConfigOverrides),
    [appCtx.appConfigOverrides],
  );
  const forceUpdate = useForceUpdate();
  const [project, setProject] = React.useState<ApiProject>();
  const [branch, setBranch] = React.useState<ApiBranch>();
  const [editorPerm, setEditorPerm] = React.useState(false);
  const [untrustedHost, setUntrustedHost] = React.useState(false);
  const [perms, setPerms] = React.useState<ApiPermission[]>([]);
  const [fetchProjectCount, setFetchProjectCount] = React.useState(0);
  const [isRefreshingProjectData, setIsRefreshingProjectData] =
    React.useState(false);
  const refreshProjectAndPerms = React.useCallback(
    () => setFetchProjectCount(fetchProjectCount + 1),
    [fetchProjectCount],
  );
  const fetchBranches = React.useMemo(
    () => moize(
      async () => (await appCtx.api.listBranchesForProject(projectId)).branches,
      {
        isPromise: true,
        maxAge: 5 * 60 * 1000,
        maxArgs: 0,
      },
    ),
    [appCtx, projectId],
  );

  const refreshBranchData = React.useCallback(
    () => [...fetchBranches.keys()].forEach((key) => fetchBranches.remove(key)),
    [fetchBranches],
  );

  const previousLocation = React.useRef<Location>(appCtx.history.location);
  React.useEffect(() => {
    const dispose = appCtx.history.listen(({ location: newLocation }) => {
      const oldBranchName = parseProjectLocation(
        previousLocation.current,
      )?.branchName;
      const newBranchName = parseProjectLocation(newLocation)?.branchName;
      if (project && oldBranchName !== newBranchName) {
        spawn(
          (async () => {
            const branches = await fetchBranches();
            const oldBranch = branches.find((b) => b.name === oldBranchName);
            const newBranch = branches.find((b) => b.name === newBranchName);
            if (
              new URL(getHostUrl(project, oldBranch, appCtx.appConfig)).href !==
              new URL(getHostUrl(project, newBranch, appCtx.appConfig)).href
            ) {
              await refreshStudio();
            }
          })(),
        );
      }
      previousLocation.current = newLocation;
    });
    return dispose;
  }, [appCtx, refreshStudio, project]);

  usePreventDefaultBrowserPinchToZoomBehavior();

  useEffect(() => {
    const fetchProject = async () => {
      return await (async () => {
        setIsRefreshingProjectData(true);
        const branchName = parseProjectLocation(
          appCtx.history.location,
        )?.branchName;
        const initial = appCtx.takeInitialProjectInfo();
        const [{ projects, perms: permissions }, { trustedHosts }, branches] =
          initial?.projectId === projectId && initial.branchName === branchName
          ? [initial.projectData, initial.hosts, initial.branches]
          : await Promise.all([
            appCtx.api.getProjects({
              query: "byIds",
              projectIds: [projectId],
            }),
            appCtx.api.getTrustedHostsList(),
            branchName && branchName !== MainBranchId ? fetchBranches() : [],
          ]);
        const proj = maybeOne(projects);
        if (!proj) {
          throw new ForbiddenError("Project not found");
        }
        let maybeBranch: ApiBranch | undefined = undefined;
        if (branchName && branchName !== MainBranchId) {
          maybeBranch = branches.find(
            (b) => b.name === branchName,
          );
        }
        const hostUrl = getHostUrl(proj, maybeBranch, appCtx.appConfig);
        const configuredHostUrl = appCtx.appConfig.ccStubs
          ? hostUrl
          : DEVFLAGS.hostUrl || maybeBranch?.hostUrl || proj.hostUrl || appCtx.appConfig.defaultHostUrl;
        setBranch(maybeBranch);
        const urlsOrDomains = [
          ...trustedHosts.map((i) => i.hostUrl),
          ...whitelistedHosts,
          ...appCtx.appConfig.globalTrustedHosts,
        ];
        if (
          (proj.hostUrl || DEVFLAGS.hostUrl) &&
          !urlsOrDomains.includes(configuredHostUrl) &&
          !urlsOrDomains.includes(new URL(hostUrl).origin)
        ) {
          setUntrustedHost(true);
        }
        const userAccessLevel = appCtx.selfInfo
          ? getAccessLevelToResource(
              { type: "project", resource: proj },
              appCtx.selfInfo,
              permissions,
            )
          : "blocked";
        setPerms(permissions);
        const accessLevel =
          accessLevelRank(userAccessLevel) >
          accessLevelRank(proj.defaultAccessLevel)
            ? userAccessLevel
            : proj.defaultAccessLevel;
        // An unowned project is editable by anyone, matching the server's permission check.
        setEditorPerm(
          accessLevelRank(accessLevel) >= accessLevelRank("content") ||
            isUnownedProject(proj),
        );
        setProject(proj);
        if (appCtx.appConfig.defaultHostUrl !== DEVFLAGS.defaultHostUrl) {
          const message = `Mismatching host URLs! appConfig defaults to ${appCtx.appConfig.defaultHostUrl} while devflags points to ${DEVFLAGS.defaultHostUrl}`;
          console.error(message);
          reportError(new Error(message));
        }
        setIsRefreshingProjectData(false);
      })().catch(async (e) => {
        setIsRefreshingProjectData(false);
        if (!appCtx.selfInfo) {
          // User is not logged and project is not public.
          await appCtx.history.replace(getLoginRouteWithContinuation());
          return;
        }
        if (e.statusCode === 403) {
          notification.error({
            message: translate(getUiLocale(), "Could not open project"),
            description: translate(
              getUiLocale(),
              "This project does not exist or you do not have access to it.",
            ),
          });
          return;
        }
        throw e;
      });
    };
    spawn(fetchProject());
  }, [projectId, setProject, fetchProjectCount]);

  const { topFrameApi, studioReady, studioError, ...topFrameChromeProps } = useTopFrameState(
    {
      appCtx,
      project,
      forceUpdate,
    },
  );

  const projectLocation = parseProjectLocation(currentLocation);
  const editorRoute = !projectLocation?.isPreview &&
    !APP_ROUTES.projectDocs.parse(currentLocation.pathname, false);
  const showComposer = editorRoute && (!project || editorPerm) &&
    !topFrameChromeProps.aiPanelOpen;
  const openAiChat = React.useRef<(() => Promise<void>) | undefined>(undefined);
  const onOpenChatChange = React.useCallback((open: (() => Promise<void>) | undefined) => {
    openAiChat.current = open;
  }, []);
  useProjectAiSession({
    projectId,
    userId: appCtx.selfInfo?.id,
    branchId: topFrameChromeProps.activatedBranch?.id ?? branch?.id ?? null,
    enabled: !!project && appCtx.appConfig.enableLocalAiEditing,
    panelOpen: topFrameChromeProps.aiPanelOpen,
  });

  const updateStartup = useStudioStartup();
  React.useLayoutEffect(() => {
    if (studioError) {
      performance.mark("studio-load-error");
    } else if (studioReady) {
      performance.mark("studio-ready");
    }
  }, [studioReady, studioError]);
  React.useLayoutEffect(() => () => {
    updateStartup({ composer: undefined, ready: false });
  }, [updateStartup]);
  React.useLayoutEffect(() => {
    updateStartup({
      projectName: project?.name,
      ready: studioReady && !studioError,
      failure: studioError ? <LoadingError detail={studioError} onRetry={() => location.reload()} /> : undefined,
      hidden: untrustedHost || topFrameChromeProps.studioModalOpen,
      composer: {
        appCtx,
        visible: showComposer,
        loading: !studioReady || !!studioError,
        context: studioReady && !studioError && editorPerm
          ? topFrameChromeProps.localAiContext
          : undefined,
        onOpen: () => openAiChat.current?.() ?? Promise.resolve(),
      },
    });
  }, [
    updateStartup,
    project?.name,
    studioReady,
    studioError,
    untrustedHost,
    topFrameChromeProps.studioModalOpen,
    appCtx,
    showComposer,
    editorPerm,
    topFrameChromeProps.localAiContext,
  ]);

  useBrowserNotification();

  const src = project
    ? getStudioFrameUrl(getHostUrl(project, branch, appCtx.appConfig), appCtx.appConfig.defaultHostUrl)
    : undefined;

  if (untrustedHost && src && project) {
    const hostOrigin = src.origin;
    return (
      <Modal open footer={null} title={uiT("Project is hosted by another app")}>
        <UiText
          message="The project {name} is hosted by a third-party app. It can show anything on screen, including the Plasmic login screen. Only open projects hosted by domains you trust! {learn}"
          values={{
            name: project.name,
            learn: (
              <a
                href="https://www.plasmic.app/learn/app-hosting/"
                target="_blank"
              >
                <UiText message="Learn more about app hosting" />
              </a>
            ),
          }}
        />
        <br />
        <br />
        <UiText
          message="Enter the domain {domain} to add it to your {trusted}."
          values={{
            domain: <code>{hostOrigin}</code>,
            trusted: (
              <PublicLink href={APP_ROUTES.settings.fill({})}>
                <UiText message="trusted list" />
              </PublicLink>
            ),
          }}
        />
        <HostUrlInput
          className="mv-xlg"
          originOnly
          placeholder={hostOrigin}
          expectedOrigin={hostOrigin}
          onConfirm={async (_url, parsedUrl) => {
            if (appCtx.selfInfo) {
              await appCtx.api.addTrustedHost(parsedUrl.origin);
              location.reload();
            }
          }}
        />
      </Modal>
    );
  }

  // We send the params via a hash parameter so that the host server cannot see them.
  if (src) {
    src.hash = studioArgsHash;
  }

  return (
    <>
      {project && src && <TopFrameCtxProvider
      key={projectId}
      projectId={projectId}
      topFrameApi={topFrameApi}
      initialBranchId={branch?.id}
    >
      <>
        {!untrustedHost && (
          <HostLoadTimeoutPrompt
            project={project}
            editorPerm={editorPerm}
            refreshStudio={refreshStudio}
          />
        )}
        <TopFrameChrome
          appCtx={appCtx}
          pathname={currentLocation.pathname}
          project={project}
          refreshProjectAndPerms={refreshProjectAndPerms}
          isRefreshingProjectData={isRefreshingProjectData}
          editorPerm={editorPerm}
          perms={perms}
          refreshStudio={refreshStudio}
          topFrameApi={topFrameApi}
          refreshBranchData={refreshBranchData}
          {...topFrameChromeProps}
        />
        <TopFrameCopilotToolsBridge onOpenChatChange={onOpenChatChange} />
        <iframe
          className={"studio-frame"}
          src={src.toString()}
          allow="clipboard-read *; clipboard-write *"
          onLoad={handleIframeLoad}
        />
      </>
    </TopFrameCtxProvider>}
    </>
  );
}
