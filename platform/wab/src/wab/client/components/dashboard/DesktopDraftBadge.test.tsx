import { DesktopDraftBadge } from "@/wab/client/components/dashboard/DesktopDraftBadge";
import type { DesktopDraftBridge, DesktopDraftSummary } from "@/wab/shared/desktop-drafts";
import { mkUuid } from "@/wab/shared/common";
import type { ProjectId } from "@/wab/shared/ApiSchema";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { SWRConfig } from "swr";
import { mock } from "vitest-mock-extended";

const mocks = vi.hoisted(() => ({ userId: "user", push: vi.fn(), branches: vi.fn() }));
vi.mock("@/wab/client/contexts/AppContexts", () => ({
  useAppCtx: () => ({ selfInfo: { id: mocks.userId }, api: { listBranchesForProject: mocks.branches } }),
}));
vi.mock("@/wab/client/route/HistoryProvider", () => ({ useHistory: () => ({ push: mocks.push }) }));
const projectId = mkUuid<ProjectId>();
const summary: DesktopDraftSummary = { id: "draft", projectId, projectName: "项目", branchId: null, sequence: 3, baseRevision: 10, savedAt: 100 };
const renderBadge = () => render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}><DesktopDraftBadge projectId={projectId} /></SWRConfig>);
afterEach(() => { cleanup(); Reflect.deleteProperty(window, "desktopDrafts"); vi.clearAllMocks(); });

it("has no local draft UI or persistence on Web", () => {
  const ui = renderBadge();
  expect(ui.container.textContent).toBe("");
});

it("shows only this project's draft and explains its device scope on hover", async () => {
  const bridge = mock<DesktopDraftBridge>();
  bridge.list.mockResolvedValue([summary, { ...summary, projectId: "another-project" }]);
  Object.defineProperty(window, "desktopDrafts", { configurable: true, value: bridge });
  renderBadge();
  const badge = await screen.findByRole("button", { name: "Local draft" });
  fireEvent.mouseEnter(badge);
  expect((await screen.findByRole("tooltip")).textContent).toContain("only on this device and account");
  fireEvent.click(badge);
  await vi.waitFor(() => expect(mocks.push).toHaveBeenCalledWith(`/projects/${projectId}`));
  expect(bridge.list).toHaveBeenCalledWith("user");
});

it("opens the branch owning a retained draft and shows its attention marker", async () => {
  const bridge = mock<DesktopDraftBridge>();
  bridge.list.mockResolvedValue([{ ...summary, branchId: "feature-id", needsAttention: true }]);
  mocks.branches.mockResolvedValue({ branches: [{ id: "feature-id", name: "feature/name" }] });
  Object.defineProperty(window, "desktopDrafts", { configurable: true, value: bridge });
  renderBadge();
  fireEvent.click(await screen.findByRole("button", { name: "Drafts need attention" }));
  await vi.waitFor(() => expect(mocks.push).toHaveBeenCalledWith(`/projects/${projectId}?branch=feature%2Fname`));
});
