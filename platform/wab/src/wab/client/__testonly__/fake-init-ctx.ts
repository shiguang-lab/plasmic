import { CanvasRegistrations } from "@/wab/client/components/canvas/canvas-registrations";
import { ValState } from "@/wab/shared/eval/val-state";
import { ViewSelection } from "@/wab/client/studio-ctx/view-selection";
import { ViewVariantState } from "@/wab/client/studio-ctx/view-variant-state";
import { RootComponentVariantFrame, GlobalVariantFrame } from "@/wab/shared/component-frame";
import { CanvasContentEditor } from "@/wab/client/studio-ctx/canvas-content-editor";
import type { ModelFieldStore } from "@/wab/client/studio-ctx/model-snapshots";
import { createStore } from "zustand/vanilla";
import { CanvasFrameInfoOwner } from "@/wab/client/components/canvas/canvas-frame-info";
import { mockDeepAuto } from "@/wab/__testonly__/mock";
import { Api } from "@/wab/client/api";
import { AppCtx } from "@/wab/client/app-ctx";
import { CanvasCtx } from "@/wab/client/components/canvas/canvas-ctx";
import { App } from "@/wab/client/components/top-view";
import { DbCtx } from "@/wab/client/db";
import { globalHookCtx } from "@/wab/client/react-global-hook/globalHook";
import { FrameState } from "@/wab/client/react-global-hook/types";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewportCtx } from "@/wab/client/studio-ctx/ViewportCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { PromisifyMethods } from "@/wab/commons/promisify-methods";
import { svgoProcess } from "@/wab/server/svgo";
import { ApiTeam } from "@/wab/shared/ApiSchema";
import { SiteInfo } from "@/wab/shared/SharedApi";
import { FastBundler } from "@/wab/shared/bundler";
import { createSite } from "@/wab/shared/core/sites";
import { DEVFLAGS, DevFlagsType } from "@/wab/shared/devflags";
import { Box, Pt } from "@/wab/shared/geom";
import {
  ArenaFrame,
  Component,
  Site,
  TplNode,
} from "@/wab/shared/model/classes";
import { createMemoryHistory } from "history";
import { mock } from "vitest-mock-extended";

function fakePromisifiedApi() {
  const fakeApi = mock<PromisifyMethods<Api>>();
  fakeApi.getPkgByProjectId.mockImplementation(async (_projectId) => {
    return {};
  });
  fakeApi.processSvg.mockImplementation(async (data) => {
    return svgoProcess(data.svgXml);
  });

  const storage: { [key: string]: string } = {};
  fakeApi.addStorageItem.mockImplementation(async (key, value) => {
    storage[key] = value;
  });
  fakeApi.getStorageItem.mockImplementation(async (key) => {
    return storage[key] ?? null;
  });
  fakeApi.removeStorageItem.mockImplementation(async (key) => {
    delete storage[key];
  });

  return fakeApi;
}

function fakeApp() {
  const app = mockDeepAuto<App>();
  app.withSpinner.mockImplementation(async (task) => {
    return await task;
  });
  return app;
}

export function fakeAppCtx(opts?: {
  devFlagOverrides?: Partial<DevFlagsType>;
  teams?: ApiTeam[];
}) {
  const api = fakePromisifiedApi();
  const app = fakeApp();
  const history = createMemoryHistory();

  // @ts-expect-error
  const appCtx = new AppCtx({
    api,
    app,
    appConfig: { ...DEVFLAGS, ...(opts?.devFlagOverrides || {}) },
    bundler: new FastBundler(),
    history,
    teams: opts?.teams ?? [],
    workspaces: [],
  });

  return {
    appCtx,
    api,
    app,
    history,
  };
}

function fakeDbCtx(opts?: {
  site?: Site;
  devFlagOverrides?: Partial<DevFlagsType>;
  teams?: ApiTeam[];
  siteInfo?: Partial<SiteInfo>;
}) {
  const appCtxDeps = fakeAppCtx({
    devFlagOverrides: opts?.devFlagOverrides,
    teams: opts?.teams,
  });
  // @ts-expect-error
  const dbCtx = new DbCtx({
    app: appCtxDeps.app,
    appCtx: appCtxDeps.appCtx,
    site: opts?.site ?? createSite(),
    siteInfo: {
      id: "ProjectId123",
      name: "Test Site",
      perms: [],
      // There's no logged-in user in tests (appCtx.selfInfo is unset), so make this
      // editable by anonymous users, ownerless and public. Otherwise StudioCtx blocks
      // changes and undoes them async after the test has already asserted on them.
      createdById: null,
      readableByPublic: true,
      ...opts?.siteInfo,
    } as SiteInfo,
  });
  return {
    dbCtx,
    ...appCtxDeps,
  };
}

/**
 * StudioCtxs keep evaluating the canvas in the background, so dispose once tests are
 * done. Otherwise it outlives the test env, and vitest reports its logging.
 */
const undisposedStudioCtxs: StudioCtx[] = [];
afterAll(() => {
  undisposedStudioCtxs.splice(0).forEach((studioCtx) => studioCtx.dispose());
});

export function fakeStudioCtx(opts?: {
  initialUrl?: string;
  topFrameApi?: AppCtx["topFrameApi"];
  site?: Site;
  devFlagOverrides?: Partial<DevFlagsType>;
  teams?: ApiTeam[];
  siteInfo?: Partial<SiteInfo>;
}) {
  const dbCtxDeps = fakeDbCtx(opts);
  if (opts?.initialUrl) {
    dbCtxDeps.history.replace(opts.initialUrl);
  }
  if (opts?.topFrameApi) {
    dbCtxDeps.appCtx.topFrameApi = opts.topFrameApi;
  }
  const studioCtx = new StudioCtx({
    dbCtx: dbCtxDeps.dbCtx,
    // Tests never persist anything, the timer would just poll the mocked api.
    autoSave: false,
  });
  undisposedStudioCtxs.push(studioCtx);

  studioCtx.tryGetViewCtxForFrame = (frame: ArenaFrame | undefined) => {
    if (!frame) {
      return undefined;
    }

    const existingViewCtx = studioCtx.viewCtxs.find(
      (viewCtx) => viewCtx.arenaFrame() === frame,
    );
    if (existingViewCtx) {
      return existingViewCtx;
    }

    const canvasCtx = mockDeepAuto<CanvasCtx>();
    const registrations = new CanvasRegistrations();
    Object.defineProperty(canvasCtx, "registrations", { value: registrations });
    let frameInputs: CanvasFrameInfoOwner | undefined;
    canvasCtx.frameInfo.mockImplementation((view) => {
      frameInputs ??= new CanvasFrameInfoOwner(view);
      return frameInputs.store;
    });
    canvasCtx.prepareFrameInfo.mockImplementation(() => frameInputs ? frameInputs.prepare() : () => undefined);
    canvasCtx.syncFrameInfo.mockImplementation(() => frameInputs?.sync());
    canvasCtx.setInteractiveMode.mockImplementation(() => undefined);
    // A real hook state, so the frame has no val tree until something sets one
    (canvasCtx as { frameState: FrameState }).frameState =
      globalHookCtx.createFrameState({ uid: frame.uid, objectPrototype: {} });
    const ownedViewport = studioCtx.viewportCtx ? undefined : new ViewportCtx({
      dom: {
        updateCanvasPadding: () => undefined,
        updateArenaSize: () => undefined,
        scaleTo: () => undefined,
        scrollTo: () => undefined,
        scrollBy: () => undefined,
      },
      initialArena: studioCtx.currentArena,
      initialClipperBox: new Box(0, 0, 1000, 800),
      initialClipperScroll: Pt.zero(),
    });
    // Explicit test viewports retain their identity and are owned by the test.
    const viewport = studioCtx.viewportCtx ?? ownedViewport;
    if (!viewport) { throw new Error("Test view requires a viewport"); }
    canvasCtx.dispose.mockImplementation(() => {
      frameInputs?.dispose(); registrations.dispose();
      canvasCtx.frameState.dispose();
      ownedViewport?.dispose();
    });
    const newViewCtx = new ViewCtx({
      studioCtx,
      arenaFrame: frame,
      canvasCtx,
      viewportCtx: viewport,
    });
    // Tests may install their real viewport after the route created a ViewCtx.
    // Match visibility subscriptions to that current native geometry owner.
    Object.defineProperty(newViewCtx, "viewportCtx", {
      get: () => studioCtx.viewportCtx ?? viewport,
    });
    studioCtx["runNativeArenaCommand"](() => {
      // Actual frame inputs exist before any registry subscriber can render it.
      canvasCtx.frameInfo(newViewCtx);
      studioCtx.arenaState.viewRegistry.register(newViewCtx);
    });
    return newViewCtx;
  };

  return { studioCtx, ...dbCtxDeps };
}

/**
 * Stubs studioCtx.withBackgroundViewCtxForComponent to override canvas env per component
 * or Tpl without setting up a full ViewCtx. The fake ViewCtx is never stale and syncs
 * immediately, so waitForCanvasEnvSettled only waits on pending query promises in the env.
 *
 * Pass `noViewCtx: true` to simulate a component with no resolvable arena
 * (the real method returns undefined without calling the callback in that case).
 */
export function stubBackgroundViewCtxForComponent(
  studioCtx: StudioCtx,
  envProvider: (
    component: Component,
    tpl: TplNode,
  ) => Record<string, unknown> | undefined,
  opts?: { noViewCtx?: boolean },
) {
  studioCtx.withBackgroundViewCtxForComponent = (async (
    component: Component,
    cb: (viewCtx: ViewCtx) => Promise<unknown>,
  ) => {
    if (opts?.noViewCtx) {
      return undefined;
    }
    const fakeViewCtx = {
      getCanvasEnvForTpl: (tpl: TplNode) => envProvider(component, tpl),
      isStale: () => false,
      awaitSync: async () => undefined,
    } as unknown as ViewCtx;
    return cb(fakeViewCtx);
  }) as StudioCtx["withBackgroundViewCtxForComponent"];
}

/** Explicit native registration participant for command-only ViewCtx tests.
 * Actual evaluator/readiness and cache integration tests use real ViewCtxs. */
export function fakeRegistryViewCtx(studioCtx: StudioCtx, frame: ArenaFrame) {
  const previous = studioCtx.arenaState.viewRegistry.forFrame(frame);
  if (previous) { studioCtx.disposeViewCtx(previous.view); }
  const view = mockDeepAuto<ViewCtx>();
  const registrations = new CanvasRegistrations();
  Object.defineProperty(view.canvasCtx, "registrations", { value: registrations });
  const ready = createStore<boolean>(() => false);
  let disposed = false;
  const subscriptions = new Set<() => void>();
  const readySource: ModelFieldStore<boolean> = {
    getState: ready.getState,
    getInitialState: ready.getInitialState,
    subscribe: (listener) => {
      if (disposed) { return () => undefined; }
      const off = ready.subscribe(listener);
      const stop = () => { off(); subscriptions.delete(stop); };
      subscriptions.add(stop); return stop;
    },
  };
  view.arenaFrame.mockReturnValue(frame);
  view.focusedTpls.mockReturnValue([]); view.focusedSelectables.mockReturnValue([]);
  view.focusedCloneKeys.mockReturnValue([]); view.currentComponentCtx.mockReturnValue(null);
  view.focusedSelectable.mockReturnValue(null); view.hoveredSelectable.mockReturnValue(null);
  view.$hoveredDomElt.mockReturnValue(null);
  view.valState.mockReturnValue(new ValState({ sysRoot: undefined, globalRoot: undefined }));
  const frameState = globalHookCtx.createFrameState({ uid: frame.uid, objectPrototype: {} });
  const renderStatus = createStore(() => Object.freeze({ isFirstRenderComplete: false, renderCount: 0 }));
  Object.defineProperty(view.csEvaluator, "renderStatusStore", { value: renderStatus });
  Object.defineProperty(view.canvasCtx, "frameState", { value: frameState });
  const selection = new ViewSelection(() => studioCtx.modelSnapshots);
  const variants = new ViewVariantState(() => studioCtx.modelSnapshots, () => frame, () => studioCtx.site, () => studioCtx.hasPendingModelChanges(), () => false);
  variants.transaction(() => {
    variants.replaceFrames([new RootComponentVariantFrame(frame)]);
    variants.setGlobal(new GlobalVariantFrame(studioCtx.site, frame));
  });
  view.transactionSelectionInputs.mockImplementation((command) => selection.transaction(() => variants.transaction(command)));
  view.styleInputs.deferPublication.mockImplementation((command) => command());
  Object.defineProperties(view, {
    studioCtx: { value: studioCtx },
    site: { get: () => studioCtx.site },
    frameState: { value: frameState },
    isFirstRenderComplete: { value: false }, renderCount: { value: 0 },
    selection: { value: selection }, selectionStore: { value: selection.store },
    variants: { value: variants }, variantStore: { value: variants.store },
    modelLifetime: { value: studioCtx.arenaState.lifetime() },
    component: { get: () => frame.container.component },
    initialRenderReadyStore: { value: readySource },
    initialRenderReady: { get: ready.getState },
    isDisposed: { get: () => disposed },
    canvasExporting: { value: false }, hasValState: { value: false }, focusedComponentPart: { value: undefined },
    contentEditor: { value: new CanvasContentEditor(view) },
  });
  const frameInputs = new CanvasFrameInfoOwner(view);
  view.canvasCtx.frameInfo.mockReturnValue(frameInputs.store);
  view.canvasCtx.prepareFrameInfo.mockImplementation(() => frameInputs.prepare());
  view.canvasCtx.syncFrameInfo.mockImplementation(() => frameInputs.sync());
  // These fixtures exercise command routing, not the evaluator's real caches.
  view.canvasRenderOwner.prepareRenderPolicy.mockReturnValue(() => undefined);
  view.canvasRenderOwner.prepareContentEditor.mockReturnValue(() => undefined);
  view.dispose.mockImplementation(() => {
    if (disposed) { return; }
    disposed = true; for (const stop of subscriptions) { stop(); }
    frameInputs.dispose(); registrations.dispose(); view.contentEditor.dispose(); selection.dispose(); variants.dispose(); frameState.dispose();
  });
  studioCtx["runNativeArenaCommand"](() => studioCtx.arenaState.viewRegistry.register(view));
  return { view, ready };
}
