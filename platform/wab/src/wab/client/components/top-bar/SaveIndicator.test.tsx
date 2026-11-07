import type { MockInstance } from "vitest";
import SaveIndicator from "@/wab/client/components/top-bar/SaveIndicator";
import {
  DesktopDraftController,
  DesktopDraftState,
  initialDesktopDraftState,
} from "@/wab/client/studio-ctx/desktop-drafts";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { EditLockControl } from "@/wab/client/components/studio/EditLockControl";
import { message, notification } from "antd";
import * as React from "react";
import { mock } from "vitest-mock-extended";
import { createStore } from "zustand/vanilla";

let ctx: StudioCtx;
let api: ReturnType<typeof fakeStudioCtx>["api"];
let save: MockInstance<StudioCtx["save"]>;
const pendingSaves: Promise<unknown>[] = [];
const finishSaves: (() => void)[] = [];
afterEach(async () => {
  await act(async () => {
    finishSaves.splice(0).forEach(finish => finish());
    await Promise.all(pendingSaves.splice(0));
    cleanup();
    await ctx.awaitEval();
    ctx.dispose();
    message.destroy(); notification.destroy();
  });
  vi.restoreAllMocks();
});
function renderIndicator() {
  return render(<StudioCtxContext.Provider value={ctx}><SaveIndicator /></StudioCtxContext.Provider>);
}
async function dirty() {
  const arena = await ctx.changeUnsafe(() => ctx.addArena("Save indicator"));
  const bundle = ctx.bundleSite().site;
  ctx.bundler().unbundleAndRecomputeParents(bundle, ctx.siteInfo.id);
  await ctx.changeUnsafe(() => { arena.name = "Unsaved indicator"; });
}
async function failedSave() {
  await dirty();
  api.saveProjectRevChanges.mockRejectedValueOnce(new Error("Bad Gateway"));
  await ctx.save();
  expect(ctx.saveStatus).toBe("error");
}
function draftController(status: DesktopDraftState["status"]) {
  const store = createStore<DesktopDraftState>(() => ({
    ...initialDesktopDraftState,
    enabled: true,
    initializing: false,
    status,
  }));
  return mock<DesktopDraftController>({
    store,
    setDialogOpen: (open) => store.setState({ dialogOpen: open }),
  });
}
beforeEach(async () => {
  ({studioCtx: ctx, api} = fakeStudioCtx({devFlagOverrides:{ccStubs:true}}));
  await waitFor(() => expect(ctx.initialRouteReady).toBe(true));
  vi.spyOn(message, "error").mockReturnValue(mock());
  save = vi.spyOn(ctx, "save");
});

it("shows local protection as a warning and explains recovery on hover", async () => {
  await failedSave();
  ctx.desktopDraft = draftController({ state: "local", savedAt: 100, pendingDrafts: 0 });
  renderIndicator();
  const indicator = screen.getByRole("status", {
    name: "Saved on this device",
  });
  expect(indicator.getAttribute("data-save-state")).toBe("local");
  expect(screen.queryByText(/Your edits are backed up/)).toBeNull();
  fireEvent.mouseEnter(indicator);
  expect((await screen.findByRole("tooltip")).textContent).toContain(
    "Your edits are backed up on this device but have not synced to the server.",
  );
  expect((await screen.findByRole("tooltip")).textContent).toContain(
    "Last local backup:",
  );
});

it("opens the retained drafts instead of retrying a conflicting save", () => {
  ctx.desktopDraft = draftController({ state: "conflict", pendingDrafts: 1 });
  renderIndicator();
  fireEvent.click(
    screen.getByRole("button", { name: "Drafts need attention" }),
  );
  expect(ctx.desktopDraftStore.getState()?.store.getState().dialogOpen).toBe(
    true,
  );
  expect(save).not.toHaveBeenCalled();
});

it("never labels failed local storage as backed up", async () => {
  await failedSave();
  ctx.desktopDraft = draftController({ state: "error", error: "disk full", pendingDrafts: 0 });
  renderIndicator();
  expect(
    screen
      .getByRole("status", { name: "Edits are not saved" })
      .getAttribute("data-save-state"),
  ).toBe("error");
});

it.each([
  ["saved", "Saved"],
  ["pending", "Pending changes"],
  ["saving", "Saving…"],
  ["error", "Save failed. Click to retry."],
  ["blocked", "Saving blocked. Resolve the issue above."],
  ["unlogged", "Unlogged changes"],
])("shows the actual %s state", async (status, label) => {
  if (status === "pending" || status === "saving" || status === "blocked") { await dirty(); }
  if (status === "error") { await failedSave(); }
  if (status === "blocked") { ctx.isAtTip = false; }
  if (status === "unlogged") { ctx.startUnlogged(); }
  if (status === "saving") {
    api.saveProjectRevChanges.mockImplementationOnce(() => new Promise(resolve => {
      finishSaves.push(() => resolve({}));
    }));
    pendingSaves.push(ctx.save());
    await waitFor(() => expect(api.saveProjectRevChanges).toHaveBeenCalledOnce());
  }
  renderIndicator();
  const indicator = screen.getByRole("status", { name: label });
  expect(indicator.getAttribute("data-save-state")).toBe(status);
  expect(indicator.textContent).toBe(label);
});

it("retries errors only when saving is allowed", async () => {
  await failedSave();
  save.mockClear();
  api.saveProjectRevChanges.mockRejectedValueOnce(new Error("Bad Gateway"));
  renderIndicator();
  fireEvent.click(screen.getByRole("button", { name: "Save failed. Click to retry." }));
  expect(save).toHaveBeenCalledTimes(1);
  await act(async () => { await save.mock.results[0].value; });
  act(() => { ctx.isAtTip = false; });
  expect(screen.queryByRole("button")).toBeNull();
});

it("shows read-only instead of retrying a stale error", async () => {
  await failedSave();
  save.mockClear();
  ctx.editMode = false;
  renderIndicator();
  expect(
    screen
      .getByRole("status", { name: "Read-only" })
      .getAttribute("data-save-state"),
  ).toBe("readonly");
  expect(screen.queryByRole("button")).toBeNull();
  expect(save).not.toHaveBeenCalled();
});

it("updates the edit lock from actual tip changes and rebinds to a replacement Studio owner", async () => {
  const other = fakeStudioCtx({devFlagOverrides:{ccStubs:true}}).studioCtx;
  await waitFor(() => expect(other.initialRouteReady).toBe(true));
  const view = render(<StudioCtxContext.Provider value={ctx}><EditLockControl /></StudioCtxContext.Provider>);
  expect(screen.queryByText("Project has been updated.")).toBeNull();
  act(() => { ctx.isAtTip = false; });
  expect(screen.getByText("Project has been updated.")).toBeTruthy();
  view.rerender(<StudioCtxContext.Provider value={other}><EditLockControl /></StudioCtxContext.Provider>);
  expect(screen.queryByText("Project has been updated.")).toBeNull();
  act(() => { ctx.isAtTip = true; });
  expect(screen.queryByText("Project has been updated.")).toBeNull();
  act(() => { other.isAtTip = false; });
  expect(screen.getByText("Project has been updated.")).toBeTruthy();
  view.unmount(); await other.awaitEval(); other.dispose();
});
