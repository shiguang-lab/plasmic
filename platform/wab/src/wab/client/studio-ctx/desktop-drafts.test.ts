import { DesktopDraftController } from "@/wab/client/studio-ctx/desktop-drafts";
import { useDesktopDraftSelector } from "@/wab/client/studio-ctx/desktop-drafts-react";
import type {
  DesktopDraft,
  DesktopDraftSession,
} from "@/wab/shared/desktop-drafts";
import { act, cleanup, render, screen } from "@testing-library/react";
import * as React from "react";

function fixture(drafts: DesktopDraft[] = []) {
  const state = { sequence: 0, revision: 10, dirty: false, text: "remote" };
  const content = vi.fn(() => ({
    projectId: "project",
    projectName: "项目",
    branchId: null,
    baseRevision: state.revision,
    sequence: state.sequence,
    modelVersion: 1,
    hostlessDataVersion: 1,
    bundle: {
      root: "site",
      map: { site: { __type: "Site", name: state.text } },
      deps: [],
      version: "1",
    },
    dependencies: [],
  }));
  const files = new Map(drafts.map((draft) => [draft.id, draft]));
  const api = {
    openDesktopDrafts: vi.fn(async (): Promise<DesktopDraftSession | null> => ({
      handle: "handle",
      drafts,
    })),
    readDesktopDraft: vi.fn(
      async (_handle: string, id: string) => files.get(id) ?? null,
    ),
    writeDesktopDraft: vi.fn(async (_handle: string, draftJson: string) => {
      const draft: DesktopDraft = JSON.parse(draftJson);
      files.set(draft.id, draft);
    }),
    removeDesktopDraft: vi.fn(
      async (_handle: string, id: string, sequence: number) => {
        if ((files.get(id)?.sequence ?? Infinity) > sequence) {
          return false;
        }
        files.delete(id);
        return true;
      },
    ),
  };
  const restore = vi.fn(async (draft: DesktopDraft) => {
    state.text = String(draft.bundle.map.site.name);
    state.dirty = true;
    state.sequence++;
  });
  const controller = new DesktopDraftController(
    api,
    content,
    () => state.dirty,
    () => state.sequence,
    () => state.revision,
    restore,
  );
  const edit = () => {
    state.dirty = true;
    state.sequence++;
    state.text += " edit";
    controller.changed();
  };
  return { controller, state, content, files, api, restore, edit };
}
const pendingDraft = (overrides: Partial<DesktopDraft> = {}): DesktopDraft => ({
  format: 1,
  id: "old",
  projectId: "project",
  projectName: "项目",
  branchId: null,
  baseRevision: 10,
  sequence: 3,
  savedAt: 100,
  modelVersion: 1,
  hostlessDataVersion: 1,
  bundle: {
    root: "site",
    map: { site: { __type: "Site", name: "local" } },
    deps: [],
    version: "1",
  },
  dependencies: [],
  ...overrides,
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("does no snapshotting or persistence on Web", async () => {
  const f = fixture();
  f.api.openDesktopDrafts.mockResolvedValueOnce(null);
  await f.controller.initialize("user", "project", null);
  f.edit();
  await f.controller.flush();
  expect(f.controller.store.getState().status).toBeNull();
  expect(f.api.writeDesktopDraft).not.toHaveBeenCalled();
  expect(f.content).not.toHaveBeenCalled();
  f.controller.dispose();
});

it("skips startup snapshotting without saved drafts and backs up the first edit", async () => {
  const f = fixture();
  await f.controller.initialize("user", "project", null);
  expect(f.controller.store.getState().enabled).toBe(true);
  expect(f.controller.store.getState().initializing).toBe(false);
  expect(f.content).not.toHaveBeenCalled();
  expect(f.api.readDesktopDraft).not.toHaveBeenCalled();
  expect(f.api.writeDesktopDraft).not.toHaveBeenCalled();
  f.edit();
  expect(await f.controller.flush()).toBe(true);
  expect(f.content).toHaveBeenCalledOnce();
  expect(f.api.writeDesktopDraft).toHaveBeenCalledOnce();
  expect(f.controller.hasCurrentBackup).toBe(true);
  f.controller.dispose();
});

it("reuses the recovered draft with increasing sequence numbers across repeated reopenings", async () => {
  const first = fixture([pendingDraft()]);
  await first.controller.initialize("user", "project", null);
  await first.controller.flush();
  expect(
    [...first.files.values()].map((draft) => [draft.id, draft.sequence]),
  ).toEqual([["old", 4]]);
  first.edit();
  await first.controller.flush();
  first.controller.dispose();
  const reopened = fixture([...first.files.values()]);
  await reopened.controller.initialize("user", "project", null);
  expect(reopened.restore).toHaveBeenCalledTimes(1);
  await reopened.controller.flush();
  expect(
    [...reopened.files.values()].map((draft) => [draft.id, draft.sequence]),
  ).toEqual([["old", 6]]);
  reopened.controller.dispose();
});

it("restores unsynced edits when the remote base revision is equal", async () => {
  const f = fixture([pendingDraft()]);
  await f.controller.initialize("user", "project", null);
  expect(f.restore).toHaveBeenCalledTimes(1);
  expect(f.state.text).toBe("local");
  expect(f.state.dirty).toBe(true);
  expect(f.files.has("old")).toBe(true);
  await f.controller.flush();
  expect(f.controller.store.getState().status?.state).toBe("local");
  const token = f.controller.saveToken();
  f.state.dirty = false;
  await f.controller.acknowledged(token);
  expect(f.files.size).toBe(0);
  f.controller.dispose();
});

it.each([11, 9])(
  "keeps both versions when the remote revision is %s",
  async (revision) => {
    const f = fixture([pendingDraft()]);
    f.state.revision = revision;
    await f.controller.initialize("user", "project", null);
    expect(f.restore).not.toHaveBeenCalled();
    expect(f.state.text).toBe("remote");
    expect(f.controller.store.getState().status?.state).toBe("conflict");
    expect(f.controller.store.getState().dialogOpen).toBe(true);
    expect(f.files.get("old")?.needsAttention).toBe(true);
    f.controller.dispose();
  },
);

it("cleans up a committed draft only when the actual remote content matches", async () => {
  const f = fixture([pendingDraft()]);
  f.state.revision = 11;
  f.state.text = "local";
  await f.controller.initialize("user", "project", null);
  expect(f.files.size).toBe(0);
  expect(f.restore).not.toHaveBeenCalled();
  f.controller.dispose();
});

it("preserves incompatible and multiple drafts without automatically picking the newest", async () => {
  for (const drafts of [
    [pendingDraft({ modelVersion: 2 })],
    [pendingDraft(), pendingDraft({ id: "second", savedAt: 200 })],
  ]) {
    const f = fixture(drafts);
    await f.controller.initialize("user", "project", null);
    expect(f.restore).not.toHaveBeenCalled();
    expect(f.controller.store.getState().drafts.length).toBe(drafts.length);
    expect(f.files.size).toBe(drafts.length);
    f.controller.dispose();
  }
});

it("does not claim local protection before a successful write and retries storage errors", async () => {
  const f = fixture();
  await f.controller.initialize("user", "project", null);
  f.edit();
  f.api.writeDesktopDraft.mockRejectedValueOnce(new Error("disk full"));
  expect(await f.controller.flush()).toBe(false);
  expect(f.controller.store.getState().status?.state).toBe("error");
  expect(f.controller.hasCurrentBackup).toBe(false);
  expect(await f.controller.flush()).toBe(true);
  expect(f.controller.store.getState().status?.state).toBe("local");
  const writes = f.api.writeDesktopDraft.mock.calls.length;
  await f.controller.flush();
  expect(f.api.writeDesktopDraft).toHaveBeenCalledTimes(writes);
  f.controller.dispose();
});

it("an in-flight save acknowledgement leaves edits made during that save backed up", async () => {
  const f = fixture();
  await f.controller.initialize("user", "project", null);
  f.edit();
  await f.controller.flush();
  const token = f.controller.saveToken();
  f.edit();
  await f.controller.flush();
  await f.controller.acknowledged(token);
  expect([...f.files.values()].map((draft) => draft.sequence)).toEqual([2]);
  expect(f.controller.hasCurrentBackup).toBe(true);
  f.controller.dispose();
});

it("a checkpoint rebased onto a newer revision is not removed by an older acknowledgement", async () => {
  const f = fixture();
  await f.controller.initialize("user", "project", null);
  f.edit();
  await f.controller.flush();
  const token = f.controller.saveToken();
  f.state.revision++;
  await f.controller.flush();
  await f.controller.acknowledged(token);
  expect(
    [...f.files.values()].map((draft) => [draft.sequence, draft.baseRevision]),
  ).toEqual([[2, 11]]);
  f.controller.dispose();
});

it("does not report a safe close when a new edit arrives during the disk write", async () => {
  const f = fixture();
  await f.controller.initialize("user", "project", null);
  let finish: () => void = () => {
    throw new Error("Disk write has not started");
  };
  const writing = new Promise<void>((resolve) => {
    finish = resolve;
  });
  f.api.writeDesktopDraft.mockImplementationOnce(async (_handle, draftJson) => {
    const draft: DesktopDraft = JSON.parse(draftJson);
    await writing;
    f.files.set(draft.id, draft);
  });
  f.edit();
  const flushing = f.controller.flush();
  await vi.waitFor(() =>
    expect(f.api.writeDesktopDraft).toHaveBeenCalledTimes(1),
  );
  f.edit();
  finish();
  expect(await flushing).toBe(false);
  expect(f.controller.hasCurrentBackup).toBe(false);
  expect(await f.controller.flush()).toBe(true);
  expect([...f.files.values()].map((draft) => draft.sequence)).toEqual([2]);
  f.controller.dispose();
});

it("a reload after a failed model merge preserves the last valid checkpoint", async () => {
  const f = fixture();
  await f.controller.initialize("user", "project", null);
  f.edit();
  await f.controller.flush();
  const before = [...f.files.values()][0];
  f.state.text = "partially corrupted merge";
  await f.controller.protect(true);
  expect(f.controller.store.getState().drafts.length).toBe(1);
  expect(f.files.get(before.id)?.bundle.map.site.name).toBe(
    before.bundle.map.site.name,
  );
  expect(f.files.get(before.id)?.needsAttention).toBe(true);
  f.controller.dispose();
});

it("publishes one pending transition for repeated edits and does no eager model serialization", async () => {
  vi.useFakeTimers();
  const f = fixture();
  await f.controller.initialize("user", "project", null);
  const changed = vi.fn();
  const unsubscribe = f.controller.store.subscribe(changed);
  f.edit();
  const pending = f.controller.store.getState();
  for (let i = 0; i < 100; i++) {
    f.edit();
  }
  expect(f.controller.store.getState()).toBe(pending);
  expect(changed).toHaveBeenCalledOnce();
  expect(f.content).not.toHaveBeenCalled();
  expect(f.api.writeDesktopDraft).not.toHaveBeenCalled();
  f.controller.setDialogOpen(false);
  expect(changed).toHaveBeenCalledOnce();
  await f.controller.flush();
  expect(f.content).toHaveBeenCalledOnce();
  expect(changed.mock.calls.map(([state]) => state.status?.state)).toEqual([
    "pending",
    "saving",
    "local",
  ]);
  const backedUp = f.controller.store.getState();
  await f.controller.flush();
  expect(f.controller.store.getState()).toBe(backedUp);
  expect(changed).toHaveBeenCalledTimes(3);
  unsubscribe();
  f.controller.dispose();
});

it("coalesces concurrent flushes of the same revision before serializing the model", async () => {
  const f = fixture();
  await f.controller.initialize("user", "project", null);
  let finish: () => void = vi.fn();
  const waiting = new Promise<void>((resolve) => {
    finish = resolve;
  });
  f.api.writeDesktopDraft.mockImplementationOnce(async (_handle, json) => {
    await waiting;
    const draft: DesktopDraft = JSON.parse(json);
    f.files.set(draft.id, draft);
  });
  f.edit();
  const first = f.controller.flush();
  const second = f.controller.flush();
  const third = f.controller.flush();
  await Promise.resolve();
  expect(f.content).toHaveBeenCalledOnce();
  await vi.waitFor(() =>
    expect(f.api.writeDesktopDraft).toHaveBeenCalledOnce(),
  );
  finish();
  expect(await Promise.all([first, second, third])).toEqual([true, true, true]);
  expect(f.api.writeDesktopDraft).toHaveBeenCalledOnce();
  f.controller.dispose();
});

it("keeps only the latest requested checkpoint behind a blocked write", async () => {
  const f = fixture();
  await f.controller.initialize("user", "project", null);
  let finish = () => undefined as void;
  const waiting = new Promise<void>((resolve) => { finish = resolve; });
  f.api.writeDesktopDraft.mockImplementationOnce(async () => waiting);
  f.edit();
  const first = f.controller.flush();
  await vi.waitFor(() => expect(f.api.writeDesktopDraft).toHaveBeenCalledOnce());

  const newer = Array.from({ length: 11 }, () => {
    f.edit();
    return f.controller.flush();
  });
  const queuedSnapshots = f.content.mock.calls.length;
  finish();
  expect(await Promise.all([first, ...newer])).toEqual(Array(12).fill(true));
  expect(queuedSnapshots).toBe(1);
  expect(f.content).toHaveBeenCalledTimes(2);
  expect(f.api.writeDesktopDraft.mock.calls.map(([, json]) => JSON.parse(json).sequence)).toEqual([1, 12]);
  expect(f.controller.hasCurrentBackup).toBe(true);
  f.controller.dispose();
});

it("drops a queued capture when a failed merge needs the last valid checkpoint", async () => {
  const f = fixture();
  await f.controller.initialize("user", "project", null);
  let finish: () => void = () => undefined;
  const waiting = new Promise<void>((resolve) => { finish = resolve; });
  f.api.writeDesktopDraft.mockImplementationOnce(async () => waiting);
  f.edit();
  const validText = f.state.text;
  const first = f.controller.flush();
  await vi.waitFor(() => expect(f.api.writeDesktopDraft).toHaveBeenCalledOnce());
  f.edit();
  const queued = f.controller.flush();
  f.state.text = "partially merged model";
  const recovery = f.controller.protect(true);
  expect(await f.controller.flush()).toBe(false);
  finish();
  await Promise.all([first, queued, recovery]);
  expect(f.content).toHaveBeenCalledOnce();
  expect([...f.files.values()]).toMatchObject([{
    sequence: 1, needsAttention: true, bundle: { map: { site: { name: validText } } },
  }]);
  f.controller.dispose();
});

it("preserves immutable conflict snapshots and leaves other editor stores untouched", async () => {
  const f = fixture([
    pendingDraft({ needsAttention: true }),
    pendingDraft({ id: "other", needsAttention: true }),
  ]);
  const other = fixture();
  await f.controller.initialize("user", "project", null);
  await other.controller.initialize("user", "project", null);
  const snapshot = f.controller.store.getState();
  const otherSnapshot = other.controller.store.getState();
  const otherListener = vi.fn();
  const off = other.controller.store.subscribe(otherListener);
  await f.controller.discard(snapshot.drafts[0]);
  expect(snapshot.drafts.map((d) => d.id)).toEqual(["old", "other"]);
  expect(f.controller.store.getState().drafts).toEqual([snapshot.drafts[1]]);
  expect(f.controller.store.getState().drafts[0]).toBe(snapshot.drafts[1]);
  expect(other.controller.store.getState()).toBe(otherSnapshot);
  expect(otherListener).not.toHaveBeenCalled();
  off();
  f.controller.dispose();
  other.controller.dispose();
});

it("commits only changed selections and releases subscriptions when the controller or editor changes", async () => {
  const f = fixture();
  const other = fixture();
  await f.controller.initialize("user", "project", null);
  await other.controller.initialize("user", "project", null);
  const statusCommits = vi.fn();
  const dialogCommits = vi.fn();
  let active = 0;
  const subscribe = f.controller.store.subscribe;
  vi.spyOn(f.controller.store, "subscribe").mockImplementation((listener) => {
    active++;
    const off = subscribe(listener);
    return () => {
      active--;
      off();
    };
  });
  function Status({
    controller,
  }: {
    controller: DesktopDraftController | undefined;
  }) {
    const status = useDesktopDraftSelector(
      controller,
      (state) => state.status?.state,
    );
    return React.createElement(
      "output",
      { "data-testid": "draft-status" },
      status ?? "web",
    );
  }
  function Dialog({
    controller,
  }: {
    controller: DesktopDraftController | undefined;
  }) {
    const open = useDesktopDraftSelector(
      controller,
      (state) => state.dialogOpen,
    );
    return React.createElement(
      "output",
      { "data-testid": "draft-dialog" },
      String(open),
    );
  }
  const tree = (controller: DesktopDraftController | undefined) =>
    React.createElement(
      React.StrictMode,
      {},
      React.createElement(
        React.Profiler,
        { id: "status", onRender: statusCommits },
        React.createElement(Status, { controller }),
      ),
      React.createElement(
        React.Profiler,
        { id: "dialog", onRender: dialogCommits },
        React.createElement(Dialog, { controller }),
      ),
    );
  const view = render(tree(f.controller));
  expect(active).toBe(2);
  statusCommits.mockClear();
  dialogCommits.mockClear();
  const status = f.controller.store.getState().status;
  act(() => f.controller.setDialogOpen(true));
  expect(f.controller.store.getState().status).toBe(status);
  expect(statusCommits).not.toHaveBeenCalled();
  expect(dialogCommits).toHaveBeenCalledOnce();
  act(() => f.edit());
  expect(statusCommits).toHaveBeenCalledOnce();
  expect(screen.getByTestId("draft-status").textContent).toBe("pending");
  statusCommits.mockClear();
  dialogCommits.mockClear();
  act(() => {
    for (let i = 0; i < 100; i++) {
      f.edit();
    }
  });
  expect(statusCommits).not.toHaveBeenCalled();
  expect(dialogCommits).not.toHaveBeenCalled();
  view.rerender(tree(other.controller));
  expect(active).toBe(0);
  expect(screen.getByTestId("draft-status").textContent).toBe("synced");
  act(() => f.controller.setDialogOpen(false));
  expect(screen.getByTestId("draft-dialog").textContent).toBe("false");
  view.rerender(tree(undefined));
  expect(screen.getByTestId("draft-status").textContent).toBe("web");
  view.unmount();
  f.controller.dispose();
  other.controller.dispose();
});

it("cancels delayed backups and does not publish in-flight completion after disposal", async () => {
  vi.useFakeTimers();
  const f = fixture();
  await f.controller.initialize("user", "project", null);
  f.edit();
  f.controller.dispose();
  await vi.runAllTimersAsync();
  expect(f.api.writeDesktopDraft).not.toHaveBeenCalled();
  const active = fixture();
  await active.controller.initialize("user", "project", null);
  let finish: () => void = vi.fn();
  const waiting = new Promise<void>((resolve) => {
    finish = resolve;
  });
  active.api.writeDesktopDraft.mockImplementationOnce(async () => waiting);
  active.edit();
  const pending = active.controller.flush();
  await Promise.resolve();
  active.controller.dispose();
  const listener = vi.fn();
  const off = active.controller.store.subscribe(listener);
  finish();
  await pending;
  expect(listener).not.toHaveBeenCalled();
  off();
});
