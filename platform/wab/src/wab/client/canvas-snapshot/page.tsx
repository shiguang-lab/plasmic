import { Api, BundlingSiteApi, SiteApi } from "@/wab/client/api";
import { AppCtx, loadStarters } from "@/wab/client/app-ctx";
import {
  overviewLayout,
  previewBounds,
} from "@/wab/client/canvas-snapshot/layout";
import {
  waitForCoverMedia,
  waitForCoverTransitions,
} from "@/wab/client/canvas-snapshot/media";
import { Router } from "@/wab/client/cli-routes";
import { CanvasCtx } from "@/wab/client/components/canvas/canvas-ctx";
import { CanvasFrameHash } from "@/wab/client/components/canvas/canvas-frame-hash-observer";
import { DeviceFrame } from "@/wab/client/components/device-frame/DeviceFrame";
import { getDeviceFrame } from "@/wab/client/components/device-frame/device-frame";
import { App } from "@/wab/client/components/top-view";
import { DbCtx } from "@/wab/client/db";
import { initRootCanvasPkgs } from "@/wab/client/frame-ctx/windows";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewportCtx } from "@/wab/client/studio-ctx/ViewportCtx";
import { promisifyMethods } from "@/wab/commons/promisify-methods";
import { getArenaFrames, getFrameHeight } from "@/wab/shared/Arenas";
import { FastBundler } from "@/wab/shared/bundler";
import type { CanvasSnapshot } from "@/wab/shared/canvas-snapshot";
import { ensure } from "@/wab/shared/common";
import { initBuiltinActions } from "@/wab/shared/core/states";
import { unbundleSite } from "@/wab/shared/core/tagged-unbundle";
import {
  DEVFLAGS,
  applyDevFlagOverrides,
  getProjectFlags,
} from "@/wab/shared/devflags";
import { Box, Pt } from "@/wab/shared/geom";
import { createMemoryHistory } from "history";
import $ from "jquery";
import React from "react";
import { createRoot } from "react-dom/client";

class SnapshotApi extends Api {
  constructor(private readonly snapshot: CanvasSnapshot) {
    super();
  }
  override async req(): Promise<never> {
    throw new Error("Studio API is unavailable during a read-only snapshot");
  }
  override async getHostlessLibraryCanvas(
    name: string,
    release: { pkgId: string; version: string },
  ) {
    return ensure(
      this.snapshot.libraries.find(
        (lib) =>
          lib.name === name &&
          lib.pkgId === release.pkgId &&
          lib.version === release.version,
      ),
      "Missing pinned component library",
    ).source;
  }
}

async function render() {
  performance.mark("snapshot:entry");
  const response = await fetch(location.pathname + "/model", {
    credentials: "omit",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Snapshot read failed (" + response.status + ")");
  }
  performance.mark("snapshot:model-headers");
  const snapshot: CanvasSnapshot = await response.json();
  performance.mark("snapshot:model-json");
  const { project, bundle, dependencies, revision, libraries } = snapshot;
  const bundler = new FastBundler();
  const { site } = unbundleSite(bundler, project.id, bundle, dependencies);
  performance.mark("snapshot:unbundled");
  applyDevFlagOverrides({
    defaultHostUrl: location.origin + "/static/host.html",
    hostLessComponents: libraries.map((lib) => ({
      type: "hostless-package",
      name: lib.name,
      codeName: lib.name,
      sectionLabel: lib.name,
      items: [],
      projectId: lib.projectId,
      hasCodeArtifacts: true,
    })),
  });
  const app = new App(),
    history = createMemoryHistory(),
    api = promisifyMethods(new SnapshotApi(snapshot));
  const appConfig = getProjectFlags(site, DEVFLAGS);
  const appCtx = new AppCtx({
    api,
    app,
    history,
    bundler,
    router: new Router(history),
    appConfig,
    selfInfo: null,
    topFrameApi: null,
    teams: [],
    perms: [],
    workspaces: [],
    starters: loadStarters(api, null, appConfig),
    lastBundleVersion: bundle.version,
    ops: null,
    change: (f) => f(),
    reloadAll: async () => {},
    reloadAppCtx: async () => {},
  });
  const dbCtx = new DbCtx({
    app,
    appCtx,
    site,
    revisionNum: revision,
    modelVersion: 0,
    hostlessDataVersion: 0,
    api: new BundlingSiteApi({
      bundler,
      siteApi: new SiteApi({ siteId: project.id, api }),
    }),
    siteInfo: {
      ...project,
      createdById: null,
      updatedById: null,
      deletedAt: null,
      deletedById: null,
      inviteOnly: true,
      hostUrl: null,
      defaultAccessLevel: "viewer",
      projectApiToken: null,
      clonedFromProjectId: null,
      workspaceId: null,
      workspaceName: null,
      teamId: null,
      teamName: null,
      parentTeamId: null,
      featureTier: null,
      uiConfig: null,
      contentCreatorConfig: null,
      extraData: {},
      perms: [],
      owner: undefined,
      latestRevisionSynced: revision,
      hasAppAuth: false,
      readableByPublic: false,
      isMainBranchProtected: true,
      revisions: [],
    },
  });
  performance.mark("snapshot:contexts");
  await initRootCanvasPkgs();
  performance.mark("snapshot:root-packages");
  const studio = new StudioCtx({ dbCtx, autoSave: false });
  studio.setBlockChanges(true);
  initBuiltinActions({
    projectId: project.id,
    projectFlags: studio.projectFlags(),
    platform: "react",
    inStudio: true,
  });
  const free = site.arenas.find((a) => a.children.length);
  const frames = free
    ? free.children.map((frame) => ({ frame, arena: free }))
    : site.pageArenas.flatMap((arena) => {
        const frame = getArenaFrames(arena, true).sort(
          (a, b) => b.width - a.width,
        )[0];
        return frame ? [{ frame, arena }] : [];
      });
  const maxWidth = Math.max(...frames.map(({ frame }) => frame.width)),
    maxHeight = Math.max(...frames.map(({ frame }) => getFrameHeight(frame)));
  const boards = frames.map(({ frame }, i) => ({
    width: frame.width,
    height: getFrameHeight(frame),
    left: free ? (frame.left ?? 0) : (i % 2) * (maxWidth + 80),
    top: free ? (frame.top ?? 0) : Math.floor(i / 2) * (maxHeight + 80),
    deviceFrame: frame.container.component.pageMeta
      ? getDeviceFrame(frame.width, frame.height)
      : undefined,
  }));
  const positions = overviewLayout(boards),
    overview = ensure(document.getElementById("overview"), "Missing overview");
  // The overview owns the fixed transform. The evaluator sees all selected boards in its viewport.
  studio.viewportCtx = new ViewportCtx({
    initialArena: frames[0].arena,
    initialClipperBox: Box.fromRect({
      left: 0,
      top: 0,
      width:
        Math.max(...boards.map((b) => b.left + b.width)) -
        Math.min(...boards.map((b) => b.left)),
      height:
        Math.max(...boards.map((b) => b.top + b.height)) -
        Math.min(...boards.map((b) => b.top)),
    }),
    initialClipperScroll: new Pt(
      Math.min(...boards.map((b) => b.left)),
      Math.min(...boards.map((b) => b.top)),
    ),
    scrollPaddingRatio: 0,
    dom: {
      updateCanvasPadding() {},
      updateArenaSize() {},
      scaleTo() {},
      scrollTo() {},
      scrollBy() {},
    },
  });
  performance.mark("snapshot:studio");
  const views: ReturnType<typeof studio.createViewCtx>[] = [];
  const shells: ReturnType<typeof createRoot>[] = [];
  // The worker requests only misses, one arena at a time. Capture the active
  // arena before switching: Studio may unmount views belonging to the old one.
  async function renderBoards(indices: number[]) {
    views.splice(0).forEach((view) => studio.disposeViewCtx(view));
    shells.splice(0).forEach((shell) => shell.unmount());
    overview.replaceChildren();
    const docs: Document[] = [];
    for (const i of indices) {
      const { frame, arena } = frames[i];
      const mark = (phase: string) =>
        performance.mark(`snapshot:board-${i + 1}:${phase}`);
      mark("start");
      studio.currentArena = arena;
      const board = boards[i],
        bounds = previewBounds(board),
        pos = positions[i],
        scale = pos.width / bounds.width;
      const wrapper = document.createElement("div");
      Object.assign(wrapper.style, {
        position: "absolute",
        left: pos.left + (board.left - bounds.left) * scale + "px",
        top: pos.top + (board.top - bounds.top) * scale + "px",
        width: board.width + "px",
        height: board.height + "px",
        transformOrigin: "0 0",
        transform: "scale(" + scale + ")",
      });
      overview.append(wrapper);
      if (board.deviceFrame) {
        const shell = document.createElement("div");
        wrapper.append(shell);
        const root = createRoot(shell);
        shells.push(root);
        root.render(<DeviceFrame frame={board.deviceFrame} />);
      }
      const iframe = document.createElement("iframe");
      iframe.width = String(board.width);
      iframe.height = String(board.height);
      if (board.deviceFrame)
        iframe.style.borderRadius = board.deviceFrame.viewportRadius + "px";
      const hash = new CanvasFrameHash(
        studio,
        frame,
        studio.arenaState.lifetime(),
        () => {},
      );
      iframe.src = "/static/host.html#" + hash.getHash();
      hash.dispose();
      await new Promise<void>((resolve, reject) => {
        iframe.onload = () => resolve();
        iframe.onerror = () =>
          reject(new Error("Could not load the canvas host"));
        wrapper.append(iframe);
      });
      mark("host-loaded");
      const doc = ensure(iframe.contentDocument, "Canvas document");
      const canvas = new CanvasCtx({ $viewport: $(iframe), name: frame.uuid });
      for await (const state of canvas.initViewPort($(iframe), frame, studio)) {
        mark(state);
      }
      studio.fontManager.installAllUsedFonts([canvas.$head()]);
      const view = studio.createViewCtx(frame, canvas);
      view.scheduleSync({ styles: true, eval: true, asap: true });
      await view.awaitSync();
      if (!view.initialRenderReady || studio.canvasFrameError(frame)) {
        throw new Error(
          studio.canvasFrameError(frame) || "Artboard failed its first render",
        );
      }
      mark("rendered");
      docs.push(doc);
      views.push(view);
    }
    // A transition handler can reveal media, and loading media can start a transition.
    await waitForCoverTransitions(docs);
    const unavailable = await waitForCoverMedia(docs);
    await waitForCoverTransitions(docs);
    const settling = docs.some(
      (doc) =>
        doc.fonts.status !== "loaded" ||
        Array.from(doc.fonts).some((font) => font.status === "error") ||
        doc
          .getAnimations()
          .some((animation) => animation.playState === "running"),
    );
    return { unavailable, settling };
  }
  const snapshotRenderer = {
    revision,
    boards: frames.map(({ frame }, index) => ({
      id: frame.uuid,
      arena: free ? 0 : index,
      ...positions[index],
    })),
    renderBoards,
  };
  Object.assign(window, { canvasSnapshot: snapshotRenderer });
  overview.dataset.state = "ready";
}
render().catch((error) => {
  const overview = ensure(
    document.getElementById("overview"),
    "Missing overview",
  );
  overview.dataset.state = "error";
  overview.dataset.error = String(error);
  console.error(error);
});
