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
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import { mock } from "vitest-mock-extended";

const frame = vi.hoisted(() => ({
  hostFrameApiReady: false,
  studioReady: false,
  studioModalOpen: false,
}));
vi.mock("@/wab/client/frame-ctx/top-frame-ctx", () => ({
  TopFrameCtxProvider: ({ children }: { children: React.ReactNode }) =>
    children,
  useTopFrameCtx: () => frame,
  handleIframeLoad: vi.fn(),
}));
vi.mock("@/wab/client/components/TopFrame/TopFrameChrome", () => ({
  TopFrameChrome: () => null,
  useTopFrameState: () => ({
    topFrameApi: {},
    studioReady: frame.studioReady,
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

afterEach(cleanup);

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
  appCtx.history.replace("/projects/project?branch=feature");
  api.listBranchesForProject.mockResolvedValue({ branches: [] });
  const project = mock<ApiProject>({
    id: "project" as ProjectId,
    name: "Project",
    defaultAccessLevel: "viewer",
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
  const skeleton = screen.getByRole("status");
  const firstInput = skeleton.querySelector(".ant-skeleton-input");
  await act(async () => releaseProject());
  expect(rendered.container.querySelector("iframe")).toBeTruthy();
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
});

beforeEach(() => registerPresentationProject("0123456789", "project" as import("@/wab/shared/ApiSchema").ProjectId));
