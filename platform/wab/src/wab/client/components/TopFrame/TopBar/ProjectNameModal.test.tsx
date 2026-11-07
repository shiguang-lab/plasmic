import { AntdConfigProvider } from "@/wab/client/antd-theme";
import { ProjectNameModal } from "@/wab/client/components/TopFrame/TopBar/ProjectNameModal";
import { toOpaque } from "@/wab/commons/types";
import { ApiProject } from "@/wab/shared/ApiSchema";
import { ensure } from "@/wab/shared/common";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConfigProvider } from "antd";
import React from "react";
import { mock } from "vitest-mock-extended";

const mocks = vi.hoisted(() => ({
  setSiteInfo: vi.fn(),
  refreshSiteInfo: vi.fn(),
}));

vi.mock("@/wab/client/components/modals/PricingModal", () => ({
  maybeShowPaywall: (_appCtx: unknown, action: () => Promise<unknown>) =>
    action(),
}));
vi.mock("@/wab/client/contexts/AppContexts", () => ({
  useAppCtx: () => ({ api: { setSiteInfo: mocks.setSiteInfo } }),
}));
vi.mock("@/wab/client/frame-ctx/top-frame-ctx", () => ({
  useTopFrameCtx: () => ({
    hostFrameApi: { refreshSiteInfo: mocks.refreshSiteInfo },
  }),
}));

const project = mock<ApiProject>({
  id: toOpaque("project-id"),
  name: "Old name",
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.setSiteInfo.mockResolvedValue(undefined);
  mocks.refreshSiteInfo.mockResolvedValue(undefined);
});
afterEach(cleanup);

it("renames the project, refreshes project data, and closes the modal", async () => {
  const refreshProjectAndPerms = vi.fn();
  const setShowProjectNameModal = vi.fn().mockResolvedValue(undefined);
  render(
    <AntdConfigProvider>
      <ConfigProvider theme={{ token: { motion: false } }}>
        <ProjectNameModal
          project={project}
          refreshProjectAndPerms={refreshProjectAndPerms}
          showProjectNameModal
          setShowProjectNameModal={setShowProjectNameModal}
        />
      </ConfigProvider>
    </AntdConfigProvider>,
  );

  const input = screen.getByRole("textbox", {
    name: "Enter a new project name",
  });
  expect(input).toHaveValue("Old name");
  fireEvent.change(input, { target: { value: "New name" } });
  fireEvent.submit(
    ensure(document.querySelector("form"), "Expected project name form"),
  );

  await waitFor(() =>
    expect(mocks.setSiteInfo).toHaveBeenCalledExactlyOnceWith(project.id, {
      name: "New name",
    }),
  );
  await waitFor(() =>
    expect(setShowProjectNameModal).toHaveBeenCalledExactlyOnceWith(false),
  );
  expect(refreshProjectAndPerms).toHaveBeenCalledOnce();
  expect(mocks.refreshSiteInfo).toHaveBeenCalledOnce();
});
