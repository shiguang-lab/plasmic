import { DesktopDraftController } from "@/wab/client/studio-ctx/desktop-drafts";
import type { DesktopDraft, DesktopDraftSession } from "@/wab/shared/desktop-drafts";
import { observable, runInAction } from "mobx";

function fixture(drafts: DesktopDraft[] = []) {
  const state = observable({ sequence: 0, revision: 10, dirty: false, text: "remote" });
  const content = vi.fn(() => ({ projectId: "project", projectName: "项目", branchId: null,
    baseRevision: state.revision, sequence: state.sequence, modelVersion: 1, hostlessDataVersion: 1,
    bundle: { root: "site", map: { site: { __type: "Site", name: state.text } }, deps: [], version: "1" }, dependencies: [] }));
  const files = new Map(drafts.map(draft => [draft.id, draft]));
  const api = {
    openDesktopDrafts: vi.fn(async (): Promise<DesktopDraftSession | null> => ({ handle: "handle", drafts })),
    readDesktopDraft: vi.fn(async (_handle: string, id: string) => files.get(id) ?? null),
    writeDesktopDraft: vi.fn(async (_handle: string, draft: DesktopDraft) => { files.set(draft.id, draft); }),
    removeDesktopDraft: vi.fn(async (_handle: string, id: string, sequence: number) => {
      if ((files.get(id)?.sequence ?? Infinity) > sequence) {return false;}
      files.delete(id); return true;
    }),
  };
  const restore = vi.fn(async (draft: DesktopDraft) => {
    runInAction(() => { state.text = String(draft.bundle.map.site.name); state.dirty = true; state.sequence++; });
  });
  const controller = new DesktopDraftController(api, content, () => state.dirty, () => state.sequence, () => state.revision, restore);
  const edit = () => { runInAction(() => { state.dirty = true; state.sequence++; state.text += " edit"; }); controller.changed(); };
  return { controller, state, content, files, api, restore, edit };
}
const pendingDraft = (overrides: Partial<DesktopDraft> = {}): DesktopDraft => ({
  format: 1, id: "old", projectId: "project", projectName: "项目", branchId: null,
  baseRevision: 10, sequence: 3, savedAt: 100, modelVersion: 1, hostlessDataVersion: 1,
  bundle: { root: "site", map: { site: { __type: "Site", name: "local" } }, deps: [], version: "1" }, dependencies: [], ...overrides,
});
afterEach(() => vi.useRealTimers());

it("does no snapshotting or persistence on Web", async () => {
  const f = fixture();
  f.api.openDesktopDrafts.mockResolvedValueOnce(null);
  await f.controller.initialize("user", "project", null);
  f.edit(); await f.controller.flush();
  expect(f.controller.status).toBeNull();
  expect(f.api.writeDesktopDraft).not.toHaveBeenCalled();
  expect(f.content).not.toHaveBeenCalled();
  f.controller.dispose();
});

it("reuses the recovered draft with increasing sequence numbers across repeated reopenings", async () => {
  const first = fixture([pendingDraft()]);
  await first.controller.initialize("user", "project", null);
  await first.controller.flush();
  expect([...first.files.values()].map(draft => [draft.id, draft.sequence])).toEqual([["old", 4]]);
  first.edit(); await first.controller.flush(); first.controller.dispose();
  const reopened = fixture([...first.files.values()]);
  await reopened.controller.initialize("user", "project", null);
  expect(reopened.restore).toHaveBeenCalledTimes(1);
  await reopened.controller.flush();
  expect([...reopened.files.values()].map(draft => [draft.id, draft.sequence])).toEqual([["old", 6]]);
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
  expect(f.controller.status?.state).toBe("local");
  const token = f.controller.saveToken();
  runInAction(() => { f.state.dirty = false; });
  await f.controller.acknowledged(token);
  expect(f.files.size).toBe(0);
  f.controller.dispose();
});

it.each([11, 9])("keeps both versions when the remote revision is %s", async revision => {
  const f = fixture([pendingDraft()]);
  runInAction(() => { f.state.revision = revision; });
  await f.controller.initialize("user", "project", null);
  expect(f.restore).not.toHaveBeenCalled();
  expect(f.state.text).toBe("remote");
  expect(f.controller.status?.state).toBe("conflict");
  expect(f.controller.dialogOpen).toBe(true);
  expect(f.files.get("old")?.needsAttention).toBe(true);
  f.controller.dispose();
});

it("cleans up a committed draft only when the actual remote content matches", async () => {
  const f = fixture([pendingDraft()]);
  runInAction(() => { f.state.revision = 11; f.state.text = "local"; });
  await f.controller.initialize("user", "project", null);
  expect(f.files.size).toBe(0);
  expect(f.restore).not.toHaveBeenCalled();
  f.controller.dispose();
});

it("preserves incompatible and multiple drafts without automatically picking the newest", async () => {
  for (const drafts of [[pendingDraft({ modelVersion: 2 })], [pendingDraft(), pendingDraft({ id: "second", savedAt: 200 })]]) {
    const f = fixture(drafts);
    await f.controller.initialize("user", "project", null);
    expect(f.restore).not.toHaveBeenCalled();
    expect(f.controller.drafts.length).toBe(drafts.length);
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
  expect(f.controller.status?.state).toBe("error");
  expect(f.controller.hasCurrentBackup).toBe(false);
  expect(await f.controller.flush()).toBe(true);
  expect(f.controller.status?.state).toBe("local");
  const writes = f.api.writeDesktopDraft.mock.calls.length;
  await f.controller.flush();
  expect(f.api.writeDesktopDraft).toHaveBeenCalledTimes(writes);
  f.controller.dispose();
});

it("an in-flight save acknowledgement leaves edits made during that save backed up", async () => {
  const f = fixture();
  await f.controller.initialize("user", "project", null);
  f.edit(); await f.controller.flush();
  const token = f.controller.saveToken();
  f.edit(); await f.controller.flush();
  await f.controller.acknowledged(token);
  expect([...f.files.values()].map(draft => draft.sequence)).toEqual([2]);
  expect(f.controller.hasCurrentBackup).toBe(true);
  f.controller.dispose();
});

it("a checkpoint rebased onto a newer revision is not removed by an older acknowledgement", async () => {
  const f = fixture();
  await f.controller.initialize("user", "project", null);
  f.edit(); await f.controller.flush();
  const token = f.controller.saveToken();
  runInAction(() => { f.state.revision++; });
  await f.controller.flush();
  await f.controller.acknowledged(token);
  expect([...f.files.values()].map(draft => [draft.sequence, draft.baseRevision])).toEqual([[2, 11]]);
  f.controller.dispose();
});

it("does not report a safe close when a new edit arrives during the disk write", async () => {
  const f = fixture();
  await f.controller.initialize("user", "project", null);
  let finish: () => void = () => { throw new Error("Disk write has not started"); };
  const writing = new Promise<void>(resolve => { finish = resolve; });
  f.api.writeDesktopDraft.mockImplementationOnce(async (_handle, draft) => {
    await writing;
    f.files.set(draft.id, draft);
  });
  f.edit();
  const flushing = f.controller.flush();
  await vi.waitFor(() => expect(f.api.writeDesktopDraft).toHaveBeenCalledTimes(1));
  f.edit(); finish();
  expect(await flushing).toBe(false);
  expect(f.controller.hasCurrentBackup).toBe(false);
  expect(await f.controller.flush()).toBe(true);
  expect([...f.files.values()].map(draft => draft.sequence)).toEqual([2]);
  f.controller.dispose();
});

it("a reload after a failed model merge preserves the last valid checkpoint", async () => {
  const f = fixture();
  await f.controller.initialize("user", "project", null);
  f.edit(); await f.controller.flush();
  const before = [...f.files.values()][0];
  runInAction(() => { f.state.text = "partially corrupted merge"; });
  await f.controller.protect(true);
  expect(f.controller.drafts.length).toBe(1);
  expect(f.files.get(before.id)?.bundle.map.site.name).toBe(before.bundle.map.site.name);
  expect(f.files.get(before.id)?.needsAttention).toBe(true);
  f.controller.dispose();
});
