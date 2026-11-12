import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { useShallow } from "zustand/react/shallow";
import { useStudioSelection } from "@/wab/client/studio-ctx/selection-state";
import { plexusKey, storageViewAsKey } from "@/wab/client/LocalStorageKey";
import { AppCtx } from "@/wab/client/app-ctx";
import { isHostFrame } from "@/wab/client/cli-routes";
import { syncCodeComponentsAndHandleErrors } from "@/wab/client/code-components/code-components";
import { preloadAiMarkdown } from "@/wab/client/components/copilot/AiMarkdown";
import importAndRetry from "@/wab/client/components/dynamic-import";
import {
  PreviewCtx,
  providesPreviewCtx,
} from "@/wab/client/components/live/PreviewCtx";
import { StudioChrome } from "@/wab/client/components/studio/StudioChrome";
import { Studio } from "@/wab/client/components/studio/studio";
import { prefetchCanvasResources } from "@/wab/client/components/studio/studio-bundles";
import { ViewEditor } from "@/wab/client/components/studio/view-editor";
import * as widgets from "@/wab/client/components/widgets";
import { LoadingError } from "@/wab/client/components/widgets/LoadingError";
import { AlertSpec } from "@/wab/client/components/widgets/plasmic/AlertBanner";
import {
  providesStudioCtx,
  providesViewCtx,
} from "@/wab/client/contexts/StudioContexts";
import {
  HostFrameCtx,
  useHostFrameCtx,
} from "@/wab/client/frame-ctx/host-frame-ctx";
import { checkRootSubHostVersion } from "@/wab/client/frame-ctx/windows";
import { getUiLocale } from "@/wab/client/i18n";
import { translate } from "@/wab/client/i18n/locales";
import { initStudioCtx } from "@/wab/client/init-view-ctx";
import "@/wab/client/moment-config";
import "@/wab/client/react-global-hook/globalHook"; // Run once studio loads to inject our hook
import {
  clearIdleCallback,
  requestIdleCallback,
} from "@/wab/client/requestidlecallback";
import { Switch, switchCase, switchDefault } from "@/wab/client/route/Switch";
import { initializePlasmicExtension } from "@/wab/client/screenshot-util";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { StudioLoadTimings } from "@/wab/client/studio-ctx/studio-load-timings";
import { ProjectId } from "@/wab/shared/ApiSchema";
import { isUnownedProject } from "@/wab/shared/EntUtil";
import { spawn } from "@/wab/shared/common";
import { isHostLessPackage } from "@/wab/shared/core/sites";
import { initBuiltinActions } from "@/wab/shared/core/states";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import { notification } from "antd";
import React from "react";
import { Helmet } from "react-helmet-async";

type StudioInitializerProps = {
  loadTimings?: StudioLoadTimings;
  projectId: ProjectId;
  hostFrameCtx: HostFrameCtx;
  appCtx: AppCtx;
  onRefreshUi: () => void;
};
type StudioInitializerState = {
  studioCtx: StudioCtx | undefined;
  previewCtx: PreviewCtx | undefined;
};
class StudioInitialization {
  private _cleanups: (() => void)[] = [];
  private stopPageListeners: (() => void) | undefined;
  private _disposed = false;
  private attempt = 0;
  readonly store = createStore<StudioInitializerState>(() => ({ studioCtx: undefined, previewCtx: undefined }));
  constructor(private props: StudioInitializerProps) {}
  updateProps(props: StudioInitializerProps) { this.props = props; }
  mount() {
    this._disposed = false;
    this.attempt += 1;
    this.store.setState({ studioCtx: undefined, previewCtx: undefined }, true);

    window.addEventListener("pagehide", this.cleanup);
    window.addEventListener("unload", this.cleanup);
    this.stopPageListeners = () => {
      window.removeEventListener("pagehide", this.cleanup);
      window.removeEventListener("unload", this.cleanup);
    };

  }
  cleanup = () => {
    if (this._disposed) { return; }
    this._disposed = true;
    this.attempt += 1;
    this.releaseAttempt();
    this.stopPageListeners?.(); this.stopPageListeners = undefined;
  };
  private releaseAttempt() {
    const {studioCtx, previewCtx} = this.store.getState();
    if (previewCtx) {
      try { previewCtx.dispose(); } catch (error) { console.warn("Failed to dispose previewCtx:", error); }
    }
    if (studioCtx) {
      try { studioCtx.dispose(); } catch (error) { console.warn("Failed to dispose studioCtx:", error); }
    }
    this._cleanups.splice(0).forEach((cleanup) => {
      try { cleanup(); } catch (error) { console.warn("Error running cleanup:", error); }
    });
    if (studioCtx || previewCtx) { this.store.setState({studioCtx: undefined, previewCtx: undefined}, true); }
  }
init = async () => {
    this.releaseAttempt();
    const attempt = ++this.attempt;
    const loadTimings = this.props.loadTimings ?? new StudioLoadTimings();
    const preferencesDone = loadTimings.begin("startup-preferences");
    initializePlasmicExtension();
    const { hostFrameCtx, appCtx, onRefreshUi, projectId } = this.props;
    prefetchCanvasResources();

    const plexusStorageKey = plexusKey(projectId);
    const plexusInStorage = await appCtx.api.getStorageItem(plexusStorageKey);
    if (plexusInStorage) {
      // The user has already opted into/out of Plexus
      appCtx.appConfig.plexus = plexusInStorage === "true";
    } else if (appCtx.appConfig.plexus) {
      // The user wants to opt into Plexus either because:
      // 1. Plasmic core team member
      // 2. plexus=true in query param

      // Store preference in local storage
      spawn(
        appCtx.api.addStorageItem(plexusStorageKey, appCtx.appConfig.plexus),
      );
    }

    preferencesDone();
    const studioCtx = await initStudioCtx(
      appCtx,
      projectId,
      onRefreshUi,
      loadTimings,
    );
    const previewCtx = new PreviewCtx(hostFrameCtx, studioCtx);
    if (this._disposed || attempt !== this.attempt) {
      previewCtx.dispose();
      studioCtx.dispose();
      return { studioCtx, previewCtx };
    }

    spawn(studioCtx.startListeningForSocketEvents());

    if (!appCtx.selfInfo && isUnownedProject(studioCtx.siteInfo)) {
      studioCtx.alertBannerState.set(AlertSpec.WelcomeGuest);
    } else if (!appCtx.selfInfo) {
      studioCtx.alertBannerState.set(AlertSpec.Unlogged);
      studioCtx.setBlockChanges(true);
    } else if (!studioCtx.canEditProject()) {
      studioCtx.alertBannerState.set(AlertSpec.ReadOnly);
      studioCtx.setBlockChanges(true);
    } else if (!studioCtx.canEditBranch()) {
      studioCtx.alertBannerState.set(AlertSpec.ProtectedMainBranch);
      studioCtx.setBlockChanges(true);
    }

    initBuiltinActions({
      projectId: studioCtx.siteInfo.id,
      platform: "react",
      projectFlags: studioCtx.projectFlags(),
      inStudio: true,
    });

    this.store.setState({ studioCtx, previewCtx });

    const listener = (e: BeforeUnloadEvent) => {
      if (
        studioCtx.needsSaving() &&
        !studioCtx.desktopDraft?.hasCurrentBackup
      ) {
        e.preventDefault();
        e.returnValue = "Changes you made may not be saved.";
      }
    };
    window.addEventListener("beforeunload", listener);
    this._cleanups.push(() =>
      window.removeEventListener("beforeunload", listener),
    );

    studioCtx.finishedLoading();
    studioCtx.runAfterInitialCanvasReady(async () => {
      if (this._disposed || attempt !== this.attempt) { return; }
      const request = requestIdleCallback(() => {
        // A failed speculative load is retried by the message's Loadable.
        void preloadAiMarkdown().catch(() => undefined);
      });
      this._cleanups.push(() => clearIdleCallback(request));
    });

    if (!appCtx.appConfig.ccStubs && !isHostLessPackage(studioCtx.site)) {
      // Version metadata and insertable templates are not needed to paint the
      // current page. Component sync awaits Plume only for missing defaults.
      studioCtx.runAfterInitialCanvasReady(() =>
        studioCtx.projectDependencyManager.refreshDeps(),
      );
      const syncDone = studioCtx.loadTimings.begin("code-component-sync");
      await syncCodeComponentsAndHandleErrors(studioCtx);
      syncDone();
    }

    if (this._disposed || attempt !== this.attempt) { return {studioCtx, previewCtx}; }
    spawn(studioCtx.maybeShowGlobalContextNotificationForStarters());
    checkRootSubHostVersion();

    const appUserDone = studioCtx.loadTimings.begin("app-user-init");
    if (studioCtx.siteInfo.hasAppAuth) {
      const lastLoggedInAppUser = await appCtx.api.getStorageItem(
        storageViewAsKey(studioCtx.siteInfo.id),
      );

      if (this._disposed || attempt !== this.attempt) { return {studioCtx, previewCtx}; }
      if (lastLoggedInAppUser) {
        const parsedLoggedInUser = JSON.parse(lastLoggedInAppUser);
        if (parsedLoggedInUser) {
          const { studioAppUser } = parsedLoggedInUser;
          await studioCtx.logAsAppUser(studioAppUser);
        }
      } else {
        // Wrap in try/catch to avoid triggering error in studio initialization
        // and blocking the user from using the studio.
        try {
          const { initialUser } = await appCtx.api.getInitialUserToViewAs(
            studioCtx.siteInfo.id,
          );
          if (this._disposed || attempt !== this.attempt) { return {studioCtx, previewCtx}; }
          if (initialUser) {
            // Save the user in local storage so that we don't have to ask the server again
            // if the user reloads the page.
            await appCtx.api.addStorageItem(
              storageViewAsKey(studioCtx.siteInfo.id),
              JSON.stringify({
                studioAppUser: initialUser,
              }),
            );
            if (this._disposed || attempt !== this.attempt) { return {studioCtx, previewCtx}; }
            await studioCtx.logAsAppUser(initialUser);
          } else {
            // Saving null here will block the request to the server next time the user loads the page,
            // but that may be unintended behavior, as it means that currently there is no registered
            // email in the access list. So we only save something to localStorage if we have a user
            // email in the access list or if at any point the user intentionally logged in as a user.
          }
        } catch (e) {
          reportError(e);
        }
      }
    }

    appUserDone();
    studioCtx.loadTimings.mark("initializer-ready");
    return { studioCtx, previewCtx };
  };
}

export function StudioInitializer(props: StudioInitializerProps) {
  const [initialization] = React.useState(() => new StudioInitialization(props));
  React.useLayoutEffect(() => { initialization.updateProps(props); }, [initialization, props]);
  React.useLayoutEffect(() => { initialization.mount(); return initialization.cleanup; }, [initialization]);
  const { studioCtx: loadingStudioCtx, previewCtx: loadingPreviewCtx } = useStore(initialization.store);
  const validHost = isHostFrame();
  React.useEffect(() => { if (!validHost) { notification.error({ message: translate(getUiLocale(), "Unknown URL"), description: translate(getUiLocale(), "Please make sure you are accessing a valid URL"), duration: 0 }); } }, [validHost]);
  if (!validHost) { return null; }
  return <widgets.Loadable loader={initialization.init}
    contents={({studioCtx, previewCtx}: {studioCtx: StudioCtx; previewCtx: PreviewCtx}) => <LoadedStudio studioCtx={studioCtx} previewCtx={previewCtx} />}
    failureContents={(retry) => <StudioInitializationError retry={retry} />}
    loadingContents={() => loadingStudioCtx && loadingPreviewCtx ? <LoadedStudio studioCtx={loadingStudioCtx} previewCtx={loadingPreviewCtx} canvasLoading /> : <StudioChrome />}
  />;
}
function loadDocsPortal() { return importAndRetry(() => import("@/wab/client/components/docs/DocsPortal")).then(({default: DocsPortal}) => DocsPortal); }
function loadPreview() { return importAndRetry(() => import("@/wab/client/components/live/Preview")).then(({default: Preview}) => Preview); }
function LoadedStudio({studioCtx, previewCtx, canvasLoading = false}: {studioCtx: StudioCtx; previewCtx: PreviewCtx; canvasLoading?: boolean}) {
      const viewCtx = useStudioSelection(studioCtx, (state) => state.view);
      const {isLive, full} = useStore(previewCtx.store, useShallow((state) => ({ isLive: state.isLive, full: state.previewData?.full })));
      const isFullPreviewMode = full && isLive;
      return providesStudioCtx(studioCtx)(
        providesViewCtx(viewCtx)(
          providesPreviewCtx(previewCtx)(
            <>
              {!isFullPreviewMode && (
                <Studio studioCtx={studioCtx} hiddenForPreview={isLive}>
                  <ViewEditor
                    viewCtx={viewCtx}
                    studioCtx={studioCtx}
                    previewCtx={previewCtx}
                    canvasLoading={canvasLoading}
                  />
                </Studio>
              )}
              <Switch
                cases={[
                  switchCase<{}>({
                    exact: true,
                    route: [APP_ROUTES.project, APP_ROUTES.projectSlug],
                    render: () => {
                      return (
                        <Helmet>
                          <body className="no-text-select" />
                        </Helmet>
                      );
                    },
                  }),
                  switchCase({
                    route: APP_ROUTES.projectDocs,
                    render: () => (
                      <>
                        {<style>{`.studio { visibility: hidden; }`}</style>}
                        <widgets.Loadable
                          loader={() =>
                            loadDocsPortal()
                          }
                          contents={(DocsPortal) => (
                            <DocsPortal
                              hostFrameCtx={previewCtx.hostFrameCtx}
                              studioCtx={studioCtx}
                            />
                          )}
                        />
                      </>
                    ),
                  }),
                  switchCase<{}>({
                    route: [
                      APP_ROUTES.projectPreview,
                      APP_ROUTES.projectPresentation,
                    ],
                    render: () => {
                      return (
                        <widgets.Loadable
                          loader={() => loadPreview()}
                          contents={(Preview) => (
                            <Preview studioCtx={studioCtx} />
                          )}
                        />
                      );
                    },
                  }),
                  switchDefault({ render: () => null }),
                ]}
              />
            </>,
          ),
        ),
      );
}


function StudioInitializationError({ retry }: { retry: () => void }) {
  const { revealStudio } = useHostFrameCtx();
  React.useEffect(() => {
    spawn(revealStudio());
  }, [revealStudio]);
  return (
    <StudioChrome>
      <LoadingError onRetry={retry} />
    </StudioChrome>
  );
}
