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

const ctx = vi.hoisted(() => ({
  saveStatus: "saved",
  canEditProject: vi.fn(),
  canSave: vi.fn(),
  save: vi.fn(),
}));
vi.mock("@/wab/client/studio-ctx/StudioCtx", () => ({
  useStudioCtx: () => ctx,
}));
afterEach(cleanup);
beforeEach(() => {
  ctx.saveStatus = "saved";
  ctx.canEditProject.mockReturnValue(true);
  ctx.canSave.mockReturnValue(true);
  ctx.save.mockClear();
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
