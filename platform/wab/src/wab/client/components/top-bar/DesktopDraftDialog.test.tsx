import { showError } from "@/wab/client/ErrorNotifications";
import { DesktopDraftDialog } from "@/wab/client/components/top-bar/DesktopDraftDialog";
import { downloadBlob } from "@/wab/client/dom-utils";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import {
  DesktopDraftController,
  DesktopDraftState,
  initialDesktopDraftState,
} from "@/wab/client/studio-ctx/desktop-drafts";
import type {
  DesktopDraft,
  DesktopDraftSummary,
} from "@/wab/shared/desktop-drafts";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";
import { createStore } from "zustand/vanilla";

vi.mock("@/wab/client/ErrorNotifications", () => ({ showError: vi.fn() }));
vi.mock("@/wab/client/dom-utils", () => ({ downloadBlob: vi.fn() }));
vi.mock("@/wab/client/components/widgets/Modal", () => ({
  Modal: ({
    open,
    children,
    footer,
  }: {
    open: boolean;
    children: React.ReactNode;
    footer: React.ReactNode;
  }) =>
    open ? (
      <section role="dialog">
        {children}
        {footer}
      </section>
    ) : null,
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function fixture() {
  const draft: DesktopDraftSummary = {
    id: "draft-1",
    projectId: "project-1",
    projectName: "本地/草稿",
    branchId: null,
    baseRevision: 1,
    sequence: 2,
    savedAt: 100,
  };
  const state = createStore<DesktopDraftState>(() => ({
    ...initialDesktopDraftState,
    enabled: true,
    dialogOpen: true,
    drafts: [draft],
  }));
  const controller = mock<DesktopDraftController>({
    store: state,
    session: { handle: "owner-handle", drafts: [draft] },
    setDialogOpen: (open) => state.setState({ dialogOpen: open }),
  });
  controller.isCurrentDraft.mockReturnValue(false);
  controller.discard.mockResolvedValue(undefined);
  const restoreRemoteVersion = vi.fn().mockResolvedValue(undefined);
  const pushLocation = vi.fn();
  const copyDesktopDraft = vi.fn().mockResolvedValue("new-project");
  const owner = createStore<DesktopDraftController | undefined>(
    () => controller,
  );
  const studioCtx = mock<StudioCtx>({
    desktopDraftStore: owner,
    restoreRemoteVersion,
    appCtx: mock<StudioCtx["appCtx"]>({
      topFrameApi: mock({ copyDesktopDraft, pushLocation }),
    }),
  });
  return {
    controller,
    state,
    studioCtx,
    draft,
    owner,
    restoreRemoteVersion,
    pushLocation,
    copyDesktopDraft,
  };
}

it("copies the current controller's draft before discarding and opening the new project", async () => {
  const f = fixture();
  render(<DesktopDraftDialog studioCtx={f.studioCtx} />);
  fireEvent.click(screen.getByRole("button", { name: "Open as copy" }));
  await waitFor(() =>
    expect(f.pushLocation).toHaveBeenCalledWith("/projects/new-project"),
  );
  expect(f.copyDesktopDraft).toHaveBeenCalledWith("owner-handle", "draft-1");
  expect(f.controller.discard).toHaveBeenCalledWith(f.draft);
  expect(f.restoreRemoteVersion).not.toHaveBeenCalled();
});

it("preserves the current unsynced draft when opening its copy", async () => {
  const f = fixture();
  f.controller.isCurrentDraft.mockReturnValue(true);
  render(<DesktopDraftDialog studioCtx={f.studioCtx} />);
  fireEvent.click(screen.getByRole("button", { name: "Open as copy" }));
  await waitFor(() => expect(f.pushLocation).toHaveBeenCalled());
  expect(f.controller.discard).not.toHaveBeenCalled();
});

it("retains the dialog and restores the controls on remote failure, then closes after retry", async () => {
  const f = fixture();
  const failure = new Error("Remote unavailable");
  f.restoreRemoteVersion.mockRejectedValueOnce(failure);
  render(<DesktopDraftDialog studioCtx={f.studioCtx} />);
  const button = screen.getByRole("button", {
    name: "Continue with remote version",
  });
  fireEvent.click(button);
  await waitFor(() => expect(showError).toHaveBeenCalledWith(failure));
  await waitFor(() => expect(button.hasAttribute("disabled")).toBe(false));
  expect(screen.getByRole("dialog")).toBeTruthy();
  fireEvent.click(button);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(f.restoreRemoteVersion).toHaveBeenCalledTimes(2);
});

it("exports the native project format including dependencies and reports read failures", async () => {
  const f = fixture();
  const failure = new Error("Draft missing");
  const content: DesktopDraft = {
    ...f.draft,
    format: 1,
    modelVersion: 1,
    hostlessDataVersion: 1,
    bundle: { root: "root", map: {}, deps: [], version: "1" },
    dependencies: [
      {
        id: "dependency-1",
        model: { root: "dep-root", map: {}, deps: [], version: "1" },
      },
    ],
  };
  f.controller.read
    .mockRejectedValueOnce(failure)
    .mockResolvedValueOnce(content);
  render(<DesktopDraftDialog studioCtx={f.studioCtx} />);
  const button = screen.getByRole("button", { name: "Export .plasmic" });
  fireEvent.click(button);
  await waitFor(() => expect(showError).toHaveBeenCalledWith(failure));
  await waitFor(() => expect(button.hasAttribute("disabled")).toBe(false));
  fireEvent.click(button);
  await waitFor(() => expect(downloadBlob).toHaveBeenCalledOnce());
  const [blob, name] = vi.mocked(downloadBlob).mock.calls[0];
  expect(name).toBe("本地_草稿.plasmic");
  const reader = new FileReader();
  const read = new Promise<string>((resolve) => {
    reader.onload = () => resolve(String(reader.result));
  });
  reader.readAsText(blob);
  expect(JSON.parse(await read)).toEqual({
    format: "plasmic/project",
    version: 1,
    name: content.projectName,
    bundles: [
      ["dependency-1", content.dependencies[0].model],
      ["project-1", content.bundle],
    ],
  });
  expect(f.controller.discard).not.toHaveBeenCalled();
});

it("receives a replacement controller and releases the closed owner without a parent rerender", () => {
  const f = fixture();
  render(<DesktopDraftDialog studioCtx={f.studioCtx} />);
  expect(screen.getByRole("dialog")).toBeTruthy();
  act(() => f.owner.setState(undefined, true));
  expect(screen.queryByRole("dialog")).toBeNull();
  const next = fixture();
  act(() => f.owner.setState(next.controller, true));
  expect(screen.getByRole("dialog")).toBeTruthy();
  act(() => next.state.setState({ dialogOpen: false }));
  expect(screen.queryByRole("dialog")).toBeNull();
});

it.each([false, true])(
  "discards the current draft only after restoring the remote version (failure: %s)",
  async (failure) => {
    const f = fixture();
    f.controller.isCurrentDraft.mockReturnValue(true);
    const error = new Error("Remote reload failed");
    if (failure) {
      f.restoreRemoteVersion.mockRejectedValueOnce(error);
    }
    render(<DesktopDraftDialog studioCtx={f.studioCtx} />);
    fireEvent.click(screen.getByRole("button", { name: "Discard draft" }));
    fireEvent.click(await screen.findByRole("button", { name: "OK" }));
    await waitFor(() => expect(f.restoreRemoteVersion).toHaveBeenCalledOnce());
    if (failure) {
      await waitFor(() => expect(showError).toHaveBeenCalledWith(error));
      expect(f.controller.discard).not.toHaveBeenCalled();
      expect(screen.getByRole("dialog")).toBeTruthy();
    } else {
      await waitFor(() =>
        expect(f.controller.discard).toHaveBeenCalledWith(f.draft),
      );
      expect(f.restoreRemoteVersion.mock.invocationCallOrder[0]).toBeLessThan(
        f.controller.discard.mock.invocationCallOrder[0],
      );
    }
  },
);
