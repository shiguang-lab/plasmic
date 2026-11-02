import { registerPresentationProject } from "@/wab/client/route/presentation-projects";
import { fakeAppCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { AntdConfigProvider } from "@/wab/client/antd-theme";
import { StudioStartupBoundary } from "@/wab/client/components/studio/StudioChrome";
import { StudioFrame } from "@/wab/client/components/studio/studio-frame";
import { providesAppCtx } from "@/wab/client/contexts/AppContexts";
import { HistoryProvider } from "@/wab/client/route/HistoryProvider";
import { getHostUrl } from "@/wab/client/utils/app-hosting-utils";
import { ForbiddenError } from "@/wab/shared/ApiErrors/errors";
import { ApiProject, ApiTrustedHost, ProjectId } from "@/wab/shared/ApiSchema";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import { mock } from "vitest-mock-extended";

const frame = vi.hoisted(() => ({
  hostFrameApiReady: false,
  studioReady: false,
  studioError: undefined as string | undefined,
  studioModalOpen: false,
  status: vi.fn(() => ({ data: undefined })),
}));
vi.mock("@/wab/client/frame-ctx/top-frame-ctx", () => ({
  TopFrameCtxProvider: ({ children }: { children: React.ReactNode }) =>
    children,
  useTopFrameCtx: () => frame,
  handleIframeLoad: vi.fn(),
}));
vi.mock("@/wab/client/components/TopFrame/TopFrameChrome", () => ({
  TopFrameChrome: () => null,
  useProjectAiSession: () => undefined,
  useTopFrameState: () => ({
    topFrameApi: {},
    studioReady: frame.studioReady,
    studioError: frame.studioError,
    studioModalOpen: frame.studioModalOpen,
  }),
}));
vi.mock("@/wab/client/components/TopFrame/HostLoadTimeoutPrompt", () => ({
  HostLoadTimeoutPrompt: () => null,
}));
vi.mock("@/wab/client/components/studio/TopFrameCopilotToolsBridge", () => ({
  TopFrameCopilotToolsBridge: () => null,
}));
vi.mock("@/wab/client/utils/useBrowserNotification", () => ({
  useBrowserNotification: () => undefined,
}));

vi.mock("@/wab/client/copilot/use-local-ai-status", () => ({
  useLocalAiStatus: frame.status,
}));
afterEach(cleanup);
beforeEach(() => {
  frame.hostFrameApiReady = false;
  frame.studioReady = false;
  frame.studioError = undefined;
  frame.studioModalOpen = false;
  frame.status.mockClear();
});

it("sends an anonymous private-project visitor to sign in with the original preview route", async () => {
  const { appCtx, api } = fakeAppCtx();
  const route = "/d/0123456789?width=1440&branch=main#/customer-groups";
  window.history.replaceState(null, "", route);
  appCtx.history.replace(route);
  appCtx.selfInfo = null;
  appCtx.appConfigOverrides = {};
  api.getProjects.mockRejectedValue(new ForbiddenError("Access denied"));
  api.getTrustedHostsList.mockResolvedValue({ trustedHosts: [] });
  try {
    render(providesAppCtx(appCtx)(
      <HistoryProvider history={appCtx.history}>
        <AntdConfigProvider productUI>
          <StudioStartupBoundary>
            <StudioFrame projectId={"project" as ProjectId} refreshStudio={async () => undefined} />
          </StudioStartupBoundary>
        </AntdConfigProvider>
      </HistoryProvider>,
    ));
    await waitFor(() => expect(appCtx.history.location.pathname).toBe("/login"));
    expect(new URLSearchParams(appCtx.history.location.search).get("continueTo")).toBe(route);
    expect(screen.queryByRole("alert")).toBeNull();
  } finally {
    window.history.replaceState(null, "", "/");
  }
});

it("preserves the visible skeleton through metadata, host registration and dialogs until the canvas is ready", async () => {
  const { appCtx, api } = fakeAppCtx();
  appCtx.appConfigOverrides = {};
  appCtx.appConfig.enableLocalAiEditing = true;
  appCtx.history.replace("/projects/project?branch=feature");
  api.listBranchesForProject.mockResolvedValue({ branches: [] });
  const project = mock<ApiProject>({
    id: "project" as ProjectId,
    name: "Project",
    defaultAccessLevel: "content",
  });
  let releaseProject!: () => void;
  api.getProjects.mockReturnValue(
    new Promise((resolve) => {
      releaseProject = () => resolve({ projects: [project], perms: [] });
    }),
  );
  api.getTrustedHostsList.mockResolvedValue({
    trustedHosts: [
      mock<ApiTrustedHost>({
        hostUrl: getHostUrl(project, undefined, appCtx.appConfig),
      }),
    ],
  });
  const view = () =>
    providesAppCtx(appCtx)(
      <HistoryProvider history={appCtx.history}>
        <AntdConfigProvider productUI>
          <StudioStartupBoundary>
            <StudioFrame
              projectId={project.id}
              refreshStudio={async () => undefined}
            />
          </StudioStartupBoundary>
        </AntdConfigProvider>
      </HistoryProvider>,
    );
  const rendered = render(view());
  // Branch lookup starts while the project metadata request is still pending.
  expect(api.listBranchesForProject).toHaveBeenCalledWith(project.id);
  const input = screen.getByRole("textbox");
  expect(rendered.container.querySelector("iframe")).toBeNull();
  expect(frame.status).toHaveBeenCalledWith("project", true);
  expect((screen.getByRole("button", { name: "Switch conversation" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.input(input, { target: { innerText: "Keep this prompt while the canvas loads" } });
  expect(input.innerText).toContain("Keep this prompt while the canvas loads");
  expect((screen.getByRole("button", { name: "Send AI request" }) as HTMLButtonElement).disabled).toBe(true);
  const skeleton = screen.getByRole("status");
  const firstInput = skeleton.querySelector(".ant-skeleton-input");
  await act(async () => releaseProject());
  expect(rendered.container.querySelector("iframe")).toBeTruthy();
  expect(screen.getByRole("textbox")).toBe(input);
  expect(screen.getByRole("status")).toBe(skeleton);
  expect(skeleton.querySelector(".ant-skeleton-input")).toBe(firstInput);
  frame.hostFrameApiReady = true;
  rendered.rerender(view());
  expect(screen.getByRole("status")).toBe(skeleton);
  frame.studioModalOpen = true;
  rendered.rerender(view());
  expect(getComputedStyle(skeleton).visibility).toBe("hidden");
  expect(skeleton.isConnected).toBe(true);
  frame.studioModalOpen = false;
  rendered.rerender(view());
  expect(screen.getByRole("status")).toBe(skeleton);
  frame.studioReady = true;
  rendered.rerender(view());
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.getByRole("textbox")).toBe(input);
  expect(input.innerText).toContain("Keep this prompt while the canvas loads");
});

beforeEach(() => registerPresentationProject("0123456789", "project" as import("@/wab/shared/ApiSchema").ProjectId));

it.each([
  "/projects/project/preview#/coupons",
  "/d/0123456789#/coupons",
  "/projects/project/docs",
])("removes editor AI controls when navigating to %s without remounting the project", async (destination) => {
  const { appCtx, api } = fakeAppCtx();
  appCtx.appConfigOverrides = {};
  appCtx.appConfig.enableLocalAiEditing = true;
  appCtx.history.replace("/projects/project");
  frame.studioReady = true;
  const project = mock<ApiProject>({
    id: "project" as ProjectId,
    name: "Project",
    defaultAccessLevel: "content",
  });
  api.listBranchesForProject.mockResolvedValue({ branches: [] });
  api.getProjects.mockResolvedValue({ projects: [project], perms: [] });
  api.getTrustedHostsList.mockResolvedValue({ trustedHosts: [
    mock<ApiTrustedHost>({ hostUrl: getHostUrl(project, undefined, appCtx.appConfig) }),
  ] });
  const rendered = render(providesAppCtx(appCtx)(
    <HistoryProvider history={appCtx.history}>
      <AntdConfigProvider productUI>
        <StudioStartupBoundary>
          <StudioFrame projectId={project.id} refreshStudio={async () => undefined} />
        </StudioStartupBoundary>
      </AntdConfigProvider>
    </HistoryProvider>,
  ));
  await waitFor(() => expect(rendered.container.querySelector("iframe")).toBeTruthy());
  expect(screen.getByRole("group", { name: "AI canvas editing" })).toBeTruthy();

  await act(() => appCtx.history.push(destination));
  expect(screen.queryByRole("group", { name: "AI canvas editing" })).toBeNull();
  expect(frame.status).toHaveBeenLastCalledWith("project", false);

  await act(() => appCtx.history.back());
  expect(screen.getByRole("group", { name: "AI canvas editing" })).toBeTruthy();
  expect(frame.status).toHaveBeenLastCalledWith("project", true);
});

it("replaces the startup mask with an actionable library failure even when the canvas never becomes ready", async () => {
  const { appCtx, api } = fakeAppCtx();
  appCtx.appConfigOverrides = {};
  appCtx.history.replace("/projects/project");
  api.listBranchesForProject.mockResolvedValue({ branches: [] });
  const project = mock<ApiProject>({ id: "project" as ProjectId, name: "Project", defaultAccessLevel: "content" });
  api.getProjects.mockResolvedValue({ projects: [project], perms: [] });
  api.getTrustedHostsList.mockResolvedValue({ trustedHosts: [mock<ApiTrustedHost>({ hostUrl: getHostUrl(project, undefined, appCtx.appConfig) })] });
  const view = () => providesAppCtx(appCtx)(<HistoryProvider history={appCtx.history}><AntdConfigProvider productUI><StudioStartupBoundary><StudioFrame projectId={project.id} refreshStudio={async () => undefined} /></StudioStartupBoundary></AntdConfigProvider></HistoryProvider>);
  const rendered = render(view());
  await waitFor(() => expect(rendered.container.querySelector("iframe")).not.toBeNull());
  frame.studioError = "Unable to load component library antd6: 404";
  rendered.rerender(view());
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByText(frame.studioError)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  expect(screen.queryByRole("status")).toBeNull();
});
