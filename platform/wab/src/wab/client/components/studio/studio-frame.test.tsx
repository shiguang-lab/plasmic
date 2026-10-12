import { fakeAppCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { AntdConfigProvider } from "@/wab/client/antd-theme";
import { StudioStartupBoundary } from "@/wab/client/components/studio/StudioChrome";
import { StudioFrame } from "@/wab/client/components/studio/studio-frame";
import { providesAppCtx } from "@/wab/client/contexts/AppContexts";
import { HistoryProvider } from "@/wab/client/route/HistoryProvider";
import { getHostUrl } from "@/wab/client/utils/app-hosting-utils";
import { ApiProject, ApiTrustedHost, ProjectId } from "@/wab/shared/ApiSchema";
import { act, cleanup, render, screen } from "@testing-library/react";
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

it("preserves the visible skeleton through metadata, host registration and dialogs until the canvas is ready", async () => {
  const { appCtx, api } = fakeAppCtx();
  appCtx.appConfigOverrides = {};
  appCtx.history.replace("/projects/project");
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
