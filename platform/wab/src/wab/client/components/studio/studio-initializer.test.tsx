import { createStore } from "zustand/vanilla";
import {
  fakeAppCtx,
  fakeStudioCtx,
} from "@/wab/client/__testonly__/fake-init-ctx";
import { AntdConfigProvider } from "@/wab/client/antd-theme";
import { syncCodeComponentsAndHandleErrors } from "@/wab/client/code-components/code-components";
import { StudioChrome } from "@/wab/client/components/studio/StudioChrome";
import { StudioInitializer } from "@/wab/client/components/studio/studio-initializer";
import * as studioBundles from "@/wab/client/components/studio/studio-bundles";
import { providesAppCtx } from "@/wab/client/contexts/AppContexts";
import { LoadingAnimationContext } from "@/wab/client/contexts/LoadingAnimationContext";
import { FrameCtxProvider } from "@/wab/client/frame-ctx/frame-ctx";
import { HostFrameCtx } from "@/wab/client/frame-ctx/host-frame-ctx";
import { initStudioCtx } from "@/wab/client/init-view-ctx";
import { HistoryProvider } from "@/wab/client/route/HistoryProvider";
import { ensure } from "@/wab/shared/common";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import { ProjectId } from "@/wab/shared/ApiSchema";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import * as React from "react";
import { mock } from "vitest-mock-extended";

vi.mock("@/wab/client/cli-routes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/wab/client/cli-routes")>()),
  isHostFrame: () => true,
  ensureIsHostFrame: vi.fn(),
}));
vi.mock("@/wab/client/init-view-ctx", () => ({ initStudioCtx: vi.fn() }));
vi.mock(
  "@/wab/client/code-components/code-components",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/wab/client/code-components/code-components")
    >()),
    syncCodeComponentsAndHandleErrors: vi.fn(),
  }),
);
vi.mock("@/wab/client/screenshot-util", () => ({
  initializePlasmicExtension: vi.fn(),
}));
vi.mock("@/wab/client/frame-ctx/windows", () => ({
  checkRootSubHostVersion: vi.fn(),
}));
vi.mock("@/wab/client/react-global-hook/globalHook", () => ({}));
vi.mock("@/wab/client/route/Switch", () => ({
  Switch: () => null,
  switchCase: (x: unknown) => x,
  switchDefault: (x: unknown) => x,
}));
vi.mock("@/wab/client/components/live/PreviewCtx", () => ({
  PreviewCtx: class {
    store = createStore<{ isLive: boolean; previewData: { full: boolean } | undefined }>(() => ({ isLive: false, previewData: undefined }));
    constructor(_host: unknown, studio: { previewCtx?: unknown }) { studio.previewCtx = this; }
    get full() { return !!this.store.getState().previewData?.full; }
    get isLive() { return this.store.getState().isLive; }
    dispose() {}
  },
  providesPreviewCtx: () => (children: React.ReactNode) => children,
}));
vi.mock("@/wab/client/components/studio/studio", () => ({
  Studio: ({
    studioCtx,
    children,
  }: {
    studioCtx: { siteInfo: { name: string } };
    children: React.ReactNode;
  }) => {
    const [open, setOpen] = React.useState(false);
    return (
      <div data-testid="editor-shell">
        <button onClick={() => setOpen(!open)}>
          {studioCtx.siteInfo.name}
        </button>
        {open && <span>Project menu open</span>}
        {children}
      </div>
    );
  },
}));
vi.mock("@/wab/client/components/studio/view-editor", () => ({
  ViewEditor: ({ canvasLoading }: { canvasLoading: boolean }) => (
    <div data-testid="canvas">
      {canvasLoading ? "Loading canvas" : "Canvas ready"}
    </div>
  ),
}));

afterEach(cleanup);
it("restores local loading when retrying after initialization revealed an error", async () => {
  const { appCtx } = fakeAppCtx();
  const reveal = vi.fn();
  vi.mocked(initStudioCtx).mockClear();
  vi.mocked(initStudioCtx)
    .mockRejectedValueOnce(new Error("Project initialization failed"))
    .mockReturnValue(new Promise(() => undefined));
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("No animation asset in jsdom"));
  function Harness() {
    const [revealed, setRevealed] = React.useState(false);
    const [host] = React.useState(() => mock<HostFrameCtx>({
      revealStudio: async () => { reveal(); setRevealed(true); },
    }));
    return <FrameCtxProvider value={host}>{providesAppCtx(appCtx)(
      <LoadingAnimationContext.Provider value={revealed}>
        <HistoryProvider history={appCtx.history}>
          <AntdConfigProvider productUI>
            <StudioInitializer projectId={"ProjectId123" as ProjectId} appCtx={appCtx} hostFrameCtx={host} onRefreshUi={() => undefined} />
          </AntdConfigProvider>
        </HistoryProvider>
      </LoadingAnimationContext.Provider>,
    )}</FrameCtxProvider>;
  }
  const { container } = render(<Harness />);
  expect(fetch).not.toHaveBeenCalled();
  await screen.findByRole("alert");
  expect(reveal).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await screen.findByRole("status", { name: "Loading project…" });
  expect(initStudioCtx).toHaveBeenCalledTimes(2);
  expect(fetch).toHaveBeenCalledOnce();
  expect(container.querySelectorAll("[data-scaffold] [clip-path] path")).toHaveLength(44);
});

it("shows shared editor controls before project data, then preserves the project shell while dependencies load", async () => {
  const prefetch = vi.spyOn(studioBundles, "prefetchCanvasResources").mockClear();
  const { studioCtx, appCtx } = fakeStudioCtx({
    devFlagOverrides: { ccStubs: false },
  });
  let releaseDependencies!: () => void;
  const dependencies = new Promise<void>((resolve) => {
    releaseDependencies = resolve;
  });
  let releaseProject!: () => void;
  const projectData = new Promise<typeof studioCtx>((resolve) => {
    releaseProject = () => resolve(studioCtx);
  });
  vi.mocked(initStudioCtx).mockReturnValue(projectData);
  let releaseMetadata!: () => void;
  const metadata = new Promise<void>((resolve) => { releaseMetadata = resolve; });
  vi.spyOn(
    studioCtx.projectDependencyManager,
    "refreshDeps",
  ).mockReturnValue(metadata);
  vi.mocked(syncCodeComponentsAndHandleErrors).mockReturnValue(dependencies);
  vi.spyOn(studioCtx, "startListeningForSocketEvents").mockResolvedValue();
  vi.spyOn(
    studioCtx,
    "maybeShowGlobalContextNotificationForStarters",
  ).mockResolvedValue();
  try {
    render(
      providesAppCtx(appCtx)(
        <HistoryProvider history={appCtx.history}>
          <AntdConfigProvider productUI>
            <StudioInitializer
              projectId={studioCtx.siteInfo.id}
              appCtx={appCtx}
              hostFrameCtx={mock<HostFrameCtx>()}
              onRefreshUi={() => {}}
            />
          </AntdConfigProvider>
        </HistoryProvider>,
      ),
    );
    expect(
      screen.getByRole("link", { name: "Back to dashboard" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Layers" }).hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen.getByRole("button", { name: "Preview" }).hasAttribute("disabled"),
    ).toBe(true);
    expect(screen.getByRole("toolbar", { name: "Canvas view" })).toBeTruthy();
    expect(screen.queryByTestId("editor-shell")).toBeNull();
    await waitFor(() => expect(prefetch).toHaveBeenCalled());
    await act(async () => {
      releaseProject();
      await projectData;
    });
    await screen.findByRole("button", { name: studioCtx.siteInfo.name });
    await waitFor(() =>
      expect(syncCodeComponentsAndHandleErrors).toHaveBeenCalled(),
    );
    expect(screen.getByTestId("canvas").textContent).toBe("Loading canvas");
    const shell = screen.getByTestId("editor-shell");
    fireEvent.click(
      screen.getByRole("button", { name: studioCtx.siteInfo.name }),
    );
    expect(screen.getByText("Project menu open")).toBeTruthy();
    await act(async () => {
      releaseDependencies();
      await dependencies;
    });
    await waitFor(() =>
      expect(screen.getByTestId("canvas").textContent).toBe("Canvas ready"),
    );
    expect(screen.getByTestId("editor-shell")).toBe(shell);
    expect(screen.getByText("Project menu open")).toBeTruthy();
    const preview = ensure(studioCtx.previewCtx, "Initialized native preview owner");
    const full = mock<NonNullable<ReturnType<typeof preview.store.getState>["previewData"]>>({ full: true });
    act(() => preview.store.setState({ isLive: true, previewData: full }));
    expect(screen.queryByTestId("editor-shell")).toBeNull();
    act(() => preview.store.setState({ isLive: false }));
    expect(screen.getByTestId("editor-shell")).toBeTruthy();
    expect(screen.getByTestId("canvas").textContent).toBe("Canvas ready");
  } finally {
    releaseMetadata();
    cleanup();
    studioCtx.dispose();
  }
});

it("keeps dashboard navigation available without constructing a project context", () => {
  const { appCtx, api } = fakeAppCtx();
  appCtx.history.replace("/projects/ProjectId123");
  render(
    providesAppCtx(appCtx)(
      <HistoryProvider history={appCtx.history}>
        <AntdConfigProvider productUI>
          <StudioChrome />
        </AntdConfigProvider>
      </HistoryProvider>,
    ),
  );
  expect(screen.getByRole("status", { name: "Loading project…" }).getAttribute("aria-busy")).toBe("true");
  expect(
    screen.getByRole("button", { name: "Insert" }).hasAttribute("disabled"),
  ).toBe(true);
  expect(
    screen
      .getByRole("button", { name: "Published versions" })
      .hasAttribute("disabled"),
  ).toBe(true);
  expect(
    screen
      .getByRole("button", { name: "Project menu" })
      .hasAttribute("disabled"),
  ).toBe(true);
  expect(screen.queryByRole("button", { name: "Share project" })).toBeNull();
  fireEvent.click(screen.getByRole("link", { name: "Back to dashboard" }));
  expect(appCtx.history.location.pathname).toBe(APP_ROUTES.allProjects.fill({}));
  expect(api.getProjects).not.toHaveBeenCalled();
});

it("disposes a context that finishes initializing after its host has left", async () => {
  const { studioCtx, appCtx } = fakeStudioCtx();
  let finish!: (ctx: typeof studioCtx) => void;
  const pending = new Promise<typeof studioCtx>((resolve) => { finish = resolve; });
  vi.mocked(initStudioCtx).mockReturnValue(pending);
  const dispose = vi.spyOn(studioCtx, "dispose");
  const startListening = vi.spyOn(studioCtx, "startListeningForSocketEvents").mockResolvedValue();
  const mounted = render(
    providesAppCtx(appCtx)(
      <HistoryProvider history={appCtx.history}>
        <AntdConfigProvider productUI>
          <StudioInitializer
            projectId={studioCtx.siteInfo.id}
            appCtx={appCtx}
            hostFrameCtx={mock<HostFrameCtx>()}
            onRefreshUi={() => {}}
          />
        </AntdConfigProvider>
      </HistoryProvider>,
    ),
  );
  await waitFor(() => expect(initStudioCtx).toHaveBeenCalled());
  fireEvent(window, new Event("pagehide"));
  mounted.unmount();
  await act(async () => { finish(studioCtx); await pending; });
  expect(dispose).toHaveBeenCalledOnce();
  expect(startListening).not.toHaveBeenCalled();
});

it("retires the progressively published context before retrying a failed dependency load", async () => {
  const first = fakeStudioCtx({ devFlagOverrides: { ccStubs: false } });
  const second = fakeStudioCtx({ devFlagOverrides: { ccStubs: false } });
  const disposedFirst = vi.spyOn(first.studioCtx, "dispose");
  for (const studio of [first.studioCtx, second.studioCtx]) {
    vi.spyOn(studio, "startListeningForSocketEvents").mockResolvedValue();
    vi.spyOn(studio.projectDependencyManager, "refreshDeps").mockResolvedValue();
    vi.spyOn(studio, "maybeShowGlobalContextNotificationForStarters").mockResolvedValue();
  }
  vi.mocked(initStudioCtx).mockResolvedValueOnce(first.studioCtx).mockResolvedValueOnce(second.studioCtx);
  vi.mocked(syncCodeComponentsAndHandleErrors).mockRejectedValueOnce(new Error("Dependency load failed")).mockResolvedValue(undefined);
  const host = mock<HostFrameCtx>({ revealStudio: async () => undefined });
  const mounted = render(<FrameCtxProvider value={host}>{providesAppCtx(first.appCtx)(<HistoryProvider history={first.appCtx.history}><AntdConfigProvider productUI><StudioInitializer projectId={first.studioCtx.siteInfo.id} appCtx={first.appCtx} hostFrameCtx={host} onRefreshUi={() => undefined} /></AntdConfigProvider></HistoryProvider>)}</FrameCtxProvider>);
  try {
    await screen.findByRole("alert");
    const preview = ensure(first.studioCtx.previewCtx, "Published preview owner");
    const disposedPreview = vi.spyOn(preview, "dispose");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByTestId("canvas").textContent).toBe("Canvas ready"));
    expect(disposedFirst).toHaveBeenCalledOnce();
    expect(disposedPreview).toHaveBeenCalledOnce();
    expect(initStudioCtx).toHaveBeenLastCalledWith(first.appCtx, first.studioCtx.siteInfo.id, expect.any(Function), expect.anything());
  } finally { mounted.unmount(); first.studioCtx.dispose(); second.studioCtx.dispose(); }
});
