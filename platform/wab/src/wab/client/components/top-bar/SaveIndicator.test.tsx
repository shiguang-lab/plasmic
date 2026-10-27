import SaveIndicator from "@/wab/client/components/top-bar/SaveIndicator";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { observable, runInAction } from "mobx";
import * as React from "react";
import type { DesktopDraftController } from "@/wab/client/studio-ctx/desktop-drafts";
import { mock } from "vitest-mock-extended";

const ctx = vi.hoisted(() => ({
  saveStatus: "saved",
  canEditProject: vi.fn(),
  canSave: vi.fn(),
  save: vi.fn(),
  desktopDraft: undefined as DesktopDraftController | undefined,
}));
vi.mock("@/wab/client/contexts/StudioContexts", () => ({
  useStudioCtx: () => ctx,
}));
afterEach(cleanup);
beforeEach(() => {
  ctx.saveStatus = "saved";
  ctx.canEditProject.mockReturnValue(true);
  ctx.canSave.mockReturnValue(true);
  ctx.save.mockClear();
  ctx.desktopDraft = undefined;
});

it("shows local protection as a warning and explains recovery on hover", async () => {
  ctx.saveStatus = "error";
  ctx.desktopDraft = mock<DesktopDraftController>({ enabled: true, drafts: [], status: { state: "local", savedAt: 100, pendingDrafts: 0 } });
  render(<SaveIndicator />);
  const indicator = screen.getByRole("status", { name: "Saved on this device" });
  expect(indicator.getAttribute("data-save-state")).toBe("local");
  expect(screen.queryByText(/Your edits are backed up/)).toBeNull();
  fireEvent.mouseEnter(indicator);
  expect((await screen.findByRole("tooltip")).textContent).toContain("Your edits are backed up on this device but have not synced to the server.");
  expect((await screen.findByRole("tooltip")).textContent).toContain("Last local backup:");
});

it("opens the retained drafts instead of retrying a conflicting save", () => {
  ctx.desktopDraft = mock<DesktopDraftController>({ enabled: true, drafts: [], status: { state: "conflict", pendingDrafts: 1 }, dialogOpen: false });
  render(<SaveIndicator />);
  fireEvent.click(screen.getByRole("button", { name: "Drafts need attention" }));
  expect(ctx.desktopDraft.dialogOpen).toBe(true);
  expect(ctx.save).not.toHaveBeenCalled();
});

it("never labels failed local storage as backed up", () => {
  ctx.saveStatus = "error";
  ctx.desktopDraft = mock<DesktopDraftController>({ enabled: true, drafts: [], status: { state: "error", error: "disk full", pendingDrafts: 0 } });
  render(<SaveIndicator />);
  expect(screen.getByRole("status", { name: "Edits are not saved" }).getAttribute("data-save-state")).toBe("error");
});

it.each([
  ["saved", "Saved"],
  ["pending", "Pending changes"],
  ["saving", "Saving…"],
  ["error", "Save failed. Click to retry."],
  ["blocked", "Saving blocked. Resolve the issue above."],
  ["unlogged", "Unlogged changes"],
])("shows the actual %s state", (status, label) => {
  ctx.saveStatus = status;
  render(<SaveIndicator />);
  const indicator = screen.getByRole("status", { name: label });
  expect(indicator.getAttribute("data-save-state")).toBe(status);
  expect(indicator.textContent).toBe(label);
});

it("retries errors only when saving is allowed", () => {
  ctx.saveStatus = "error";
  const permission = observable({ allowed: true });
  ctx.canSave.mockImplementation(() => permission.allowed);
  render(<SaveIndicator />);
  fireEvent.click(
    screen.getByRole("button", { name: "Save failed. Click to retry." }),
  );
  expect(ctx.save).toHaveBeenCalledTimes(1);
  act(() =>
    runInAction(() => {
      permission.allowed = false;
    }),
  );
  expect(screen.queryByRole("button")).toBeNull();
});

it("shows read-only instead of retrying a stale error", () => {
  ctx.saveStatus = "error";
  ctx.canEditProject.mockReturnValue(false);
  render(<SaveIndicator />);
  expect(
    screen
      .getByRole("status", { name: "Read-only" })
      .getAttribute("data-save-state"),
  ).toBe("readonly");
  expect(screen.queryByRole("button")).toBeNull();
  expect(ctx.save).not.toHaveBeenCalled();
});
