import {
  fakeAppCtx,
  fakeStudioCtx,
} from "@/wab/client/__testonly__/fake-init-ctx";
import { AntdConfigProvider } from "@/wab/client/antd-theme";
import { syncCodeComponentsAndHandleErrors } from "@/wab/client/code-components/code-components";
import { StudioChrome } from "@/wab/client/components/studio/StudioChrome";
import { StudioInitializer } from "@/wab/client/components/studio/studio-initializer";
import { providesAppCtx } from "@/wab/client/contexts/AppContexts";
import { HostFrameCtx } from "@/wab/client/frame-ctx/host-frame-ctx";
import { initStudioCtx } from "@/wab/client/init-view-ctx";
import { HistoryProvider } from "@/wab/client/route/HistoryProvider";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
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
    full = false;
    isLive = false;
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
it("shows shared editor controls before project data, then preserves the project shell while dependencies load", async () => {
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
  vi.spyOn(
    studioCtx.projectDependencyManager,
    "refreshDeps",
  ).mockResolvedValue();
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
  } finally {
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
  expect(screen.getByRole("status").textContent).toBe("Loading project…");
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
      .getByRole("button", { name: "Share project" })
      .hasAttribute("disabled"),
  ).toBe(true);
  fireEvent.click(screen.getByRole("link", { name: "Back to dashboard" }));
  expect(appCtx.history.location.pathname).toBe(APP_ROUTES.dashboard.fill({}));
  expect(api.getProjects).not.toHaveBeenCalled();
});
