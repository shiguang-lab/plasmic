import type { StartupProjectModel } from "@/wab/client/frame-ctx/project-model-transfer";
import { filteredApi } from "@/wab/client/api";
import { ensureIsTopFrame, parseProjectLocation } from "@/wab/client/cli-routes";
import { useAppCtx } from "@/wab/client/contexts/AppContexts";
import {
  FrameCtxProvider,
  useFrameCtx,
  useFrameCtxMaybe,
} from "@/wab/client/frame-ctx/frame-ctx";
import { FrameMessage } from "@/wab/client/frame-ctx/frame-message-types";
import { HostFrameApi } from "@/wab/client/frame-ctx/host-frame-api";
import {
  TopFrameApi,
  TopFrameFullApi,
} from "@/wab/client/frame-ctx/top-frame-api";
import { getUiLocale, subscribeUiLocale } from "@/wab/client/i18n";
import { getUiAppearance, subscribeUiAppearance } from "@/wab/client/ui-theme";
import { PromisifyMethods } from "@/wab/commons/promisify-methods";
import { bindMethods } from "@/wab/commons/proxies";
import { BranchId, GetProjectResponse } from "@/wab/shared/ApiSchema";
import { assert, spawn } from "@/wab/shared/common";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import * as Comlink from "comlink";
import type { History } from "history";
import { pick } from "lodash";
import * as React from "react";

export interface TopFrameCtx {
  hostFrameApi: PromisifyMethods<HostFrameApi>;
  hostFrameApiReady: boolean;
  hostConnected: boolean;
}

export interface TopFrameCtxProviderProps {
  children: React.ReactNode;
  projectId: string;
  topFrameApi: TopFrameApi;
  initialBranchId?: BranchId;
  publishedSiteInfo?: GetProjectResponse;
}

type TopFrameWireApi = Omit<TopFrameFullApi, "getSiteInfo"> & {
  getSiteInfo(...args: Parameters<TopFrameFullApi["getSiteInfo"]>): Promise<GetProjectResponse | StartupProjectModel>;
};

// An administrator's published host receives only capabilities needed to
// display the pinned model, interact with the canvas and run local Preview.
export function restrictPublishedTemplateFrameApi(
  api: TopFrameWireApi,
  history: History,
  projectId: string,
) {
  const restrictNavigation = (navigate: TopFrameApi["pushLocation"]) =>
    (path?: string, query?: string, hash?: string) => {
      const target = {
        ...history.location,
        pathname: path ?? history.location.pathname,
        search: query ?? "",
        hash: hash ?? "",
      };
      const location = parseProjectLocation(target);
      assert(
        APP_ROUTES.templateCenter.parse(target.pathname) ||
          (location?.publishedTemplate && location.projectId === projectId),
        "Published template navigation must stay in the published view.",
      );
      return navigate(path, query, hash);
    };
  return {
    ...pick(api, [
      "exposeHostFrameApi", "registerLocationListener", "registerUiLocaleListener",
      "registerUiAppearanceListener", "getStudioUrl", "setStudioReady", "setStudioError",
      "setDocumentTitle", "setDesktopTitleBarDragRegions", "setEditorViewMenuState",
      "setStudioModalOpen", "onFrameInteraction",
      "getCurrentTeam", "canEditProjectUiConfig", "getAppConfig", "getSelfInfo",
      "getLastBundleVersion", "getSiteInfo", "getHostlessLibraryRelease",
      "getHostlessLibraryCanvas", "getStorageItem", "addStorageItem", "removeStorageItem",
      "addStorageListener", "addEventListener", "removeEventListener",
    ]),
    pushLocation: restrictNavigation(api.pushLocation),
    replaceLocation: restrictNavigation(api.replaceLocation),
  };
}

/** Transfers ownership of the one-shot bootstrap request to the host session. */
function takeInitialProjectModel(appCtx: ReturnType<typeof useAppCtx>) {
  const prefetched = appCtx.initialProjectModel;
  appCtx.initialProjectModel = undefined;
  return prefetched;
}

function retainSessionListener(disposers: Set<() => void>, stop: () => void) {
  function dispose() {
    disposers.delete(dispose);
    stop();
  }
  disposers.add(dispose);
  return dispose;
}

export function TopFrameCtxProvider({
  children,
  projectId,
  topFrameApi,
  initialBranchId,
  publishedSiteInfo,
}: TopFrameCtxProviderProps) {
  ensureIsTopFrame();

  const appCtx = useAppCtx();

  const [topFrameCtx, setTopFrameCtx] = React.useState<TopFrameCtx>({
    hostConnected: false,
    hostFrameApiReady: false,
    hostFrameApi: new Proxy({} as Comlink.Remote<HostFrameApi>, {
      get(_target, property) {
        if (property === Symbol.toStringTag) {
          return "HostFrameApi";
        }
        throw new Error(`HostFrameApi not ready`);
      },
    }),
  });

  React.useEffect(() => {
    const api = filteredApi(
      projectId,
      bindMethods(appCtx.api),
      appCtx.appConfig,
    );
    // Fetch the model while the trusted host boots, instead of starting this
    // request only after its scripts and frame bridge have initialized.
    const prefetched = takeInitialProjectModel(appCtx);
    let initialSiteInfo: Promise<GetProjectResponse | StartupProjectModel> | undefined;
    if (!publishedSiteInfo) {
      initialSiteInfo = prefetched?.projectId === projectId && prefetched.branchId === initialBranchId
        ? prefetched.data
        : api.getSiteInfo(projectId, { branchId: initialBranchId });
    }
    void initialSiteInfo?.catch(() => undefined);
    let disposed = false;
    let remoteHostApi: Comlink.Remote<HostFrameApi> | undefined;
    const sessionDisposers = new Set<() => void>();
    let comlinkState:
      | undefined
      | {
          hostFrameEndpoint: Comlink.Endpoint;
          listener: EventListenerOrEventListenerObject;
        } = undefined;
    console.log("[TopFrame] Listening for PLASMIC_HOST_REGISTERED message");
    const listener = (ev: MessageEvent) => {
      if (ev.data?.type !== FrameMessage.PlasmicHostRegister) {
        return;
      }

      window.removeEventListener("message", listener);

      // Comlink needs to know who to expose to, but we don't have a direct
      // reference to the nested iframe, only the immediate child iframe here.
      // We thus first listen for a message from the nested iframe, which lets
      // us determine the source. Ideally Comlink could have a mode where it
      // responds to whoever sent the message.
      //
      // It's important that we synchronously run `expose`, which starts
      // listening for messages, since we may have already received another
      // message that's waiting for us in the event queue. The child frame
      // does not wait for a response to the registration before it starts
      // making RPCs.
      const hostFrame = ev.source;
      if (!hostFrame || !("postMessage" in hostFrame)) {
        throw new Error("Missing HostFrame");
      }
      const hostFrameEndpoint = Comlink.windowEndpoint(hostFrame as Window);

      console.log(
        "[TopFrame] Received PLASMIC_HOST_REGISTER message, exposing API to HostFrame",
      );
      const topFrameCtxApi = {
        exposeHostFrameApi: (hostFrameApi: Comlink.Remote<HostFrameApi>) => {
          if (disposed) {
            hostFrameApi[Comlink.releaseProxy]();
            return;
          }
          remoteHostApi = hostFrameApi;
          setTopFrameCtx((prev) => ({
            ...prev,
            hostFrameApi,
            hostFrameApiReady: true,
          }));
        },
        ...api,
        ...topFrameApi,

        // The parent owns the socket. A removed host cannot finish an RPC
        // cleanup, and its late requests must not touch a subsequent session.
        listenSocket: (eventNames) =>
          disposed ? Promise.resolve(undefined) : api.listenSocket(eventNames),
        closeSocket: () =>
          disposed ? Promise.resolve() : api.closeSocket(),

        getSiteInfo: (siteId: string, opts: Parameters<TopFrameFullApi["getSiteInfo"]>[1]) => {
          if (publishedSiteInfo) {
            assert(siteId === projectId, "Published template access is limited to the current snapshot.");
            return Promise.resolve(publishedSiteInfo);
          }
          if (
            initialSiteInfo &&
            siteId === projectId &&
            opts?.branchId === initialBranchId &&
            !opts?.publishedTemplate &&
            opts?.revisionId === undefined &&
            opts?.revisionNum === undefined &&
            opts?.dontMigrateProject === undefined
          ) {
            const request = initialSiteInfo;
            initialSiteInfo = undefined;
            return request;
          }
          return api.getSiteInfo(siteId, opts);
        },

        // Override some methods to hide Comlink implementation details.
        async registerUiLocaleListener(localeListener): Promise<() => void> {
          if (disposed) {
            return Comlink.proxy(() => { /* A disposed session registers no listener, so cleanup has nothing to release. */ });
          }
          const dispose = retainSessionListener(sessionDisposers, subscribeUiLocale(() =>
            localeListener(getUiLocale()),
          ));
          // The callback crosses a MessagePort, while registration returns on
          // the window endpoint. Await it so the host mounts in the right locale.
          await localeListener(getUiLocale());
          return Comlink.proxy(dispose);
        },
        async registerUiAppearanceListener(
          appearanceListener,
        ): Promise<() => void> {
          if (disposed) {
            return Comlink.proxy(() => { /* A disposed session registers no listener, so cleanup has nothing to release. */ });
          }
          const dispose = retainSessionListener(sessionDisposers, subscribeUiAppearance(() =>
            appearanceListener(getUiAppearance()),
          ));
          await appearanceListener(getUiAppearance());
          return Comlink.proxy(dispose);
        },
        registerLocationListener(locationListener): () => void {
          if (disposed) {
            return Comlink.proxy(() => { /* A disposed session registers no listener, so cleanup has nothing to release. */ });
          }
          return Comlink.proxy(retainSessionListener(sessionDisposers,
            topFrameApi.registerLocationListener(locationListener)));
        },
      } as TopFrameWireApi;
      const exposedApi = publishedSiteInfo
        ? restrictPublishedTemplateFrameApi(topFrameCtxApi, appCtx.history, projectId)
        : topFrameCtxApi;
      Comlink.expose(exposedApi, {
        ...hostFrameEndpoint,
        addEventListener(
          type: string,
          _listener: EventListenerOrEventListenerObject,
          options?: {},
        ) {
          if (type === "message") {
            assert(
              comlinkState === undefined,
              () => "Unexpected registering multiple message event listeners",
            );
            comlinkState = {
              hostFrameEndpoint: hostFrameEndpoint,
              listener: _listener,
            };
          }
          return hostFrameEndpoint.addEventListener(type, _listener, options);
        },
      });

      setTopFrameCtx((prev) => ({
        ...prev,
        hostConnected: true,
      }));
    };
    window.addEventListener("message", listener);
    return () => {
      disposed = true;
      // Resolve pending pulls locally before removing the bridge. The pending
      // Comlink response otherwise keeps the entire old Host Window alive.
      spawn(api.closeSocket());
      remoteHostApi?.[Comlink.releaseProxy]();
      sessionDisposers.forEach((dispose) => dispose());
      sessionDisposers.clear();
      initialSiteInfo = undefined;
      window.removeEventListener("message", listener);
      if (comlinkState) {
        comlinkState.hostFrameEndpoint.removeEventListener(
          "message",
          comlinkState.listener,
        );
      }
    };
  }, []);

  return <FrameCtxProvider value={topFrameCtx}>{children}</FrameCtxProvider>;
}

/**
 * Returns TopFrameCtx.
 * @throws if not top frame
 * @throws if TopFrameCtx not provided
 */
export function useTopFrameCtx(): TopFrameCtx {
  ensureIsTopFrame();
  return useFrameCtx();
}

/** Returns TopFrameCtx if TopFrameCtx provided, undefined otherwise. */
export function useTopFrameCtxMaybe(): TopFrameCtx | undefined {
  return useFrameCtxMaybe();
}

export function handleIframeLoad() {
  setTimeout(() => {
    window.postMessage({
      type: FrameMessage.StudioFrameLoaded,
    });
  }, 2000);
}
