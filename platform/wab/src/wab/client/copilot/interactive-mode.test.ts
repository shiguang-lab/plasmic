import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { COPILOT_TOOLS } from "@/wab/client/copilot";
import { ensure } from "@/wab/shared/common";
import { ensureKnownTplTag } from "@/wab/shared/model/classes";

async function fixture() {
  const { studioCtx } = fakeStudioCtx();
  const call = async (name: string, input: Record<string, unknown>) =>
    JSON.parse(
      await ensure(COPILOT_TOOLS[name], "Tool missing").execute(studioCtx, {
        ...("reviewContext" in
        ensure(COPILOT_TOOLS[name], "Missing tool").inputSchema.shape
          ? {
              reviewContext: {
                purpose:
                  "Switch between editor interaction and editing modes while preserving the design, canvas and saved state.",
              },
            }
          : {}),
        ...input,
      }),
    );
  const created = await call("createComponent", {
    name: "Page",
    type: "page",
    path: "/page",
  });
  await call("navigate", { componentUuid: created.created[0].uuid });
  const ready = vi
    .spyOn(studioCtx, "awaitStudioReady")
    .mockResolvedValue(undefined);
  studioCtx.copilotActivity.dispose();
  return { studioCtx, call, ready };
}

afterEach(() => vi.restoreAllMocks());

it("sets interaction idempotently in both directions without changing the design or arena", async () => {
  const f = await fixture();
  try {
    const arena = f.studioCtx.currentArena;
    const counter = f.studioCtx._changeCounter;
    const before = f.studioCtx.appCtx.bundler.bundle(
      f.studioCtx.site,
      f.studioCtx.siteInfo.id,
      f.studioCtx.appCtx.lastBundleVersion,
    );
    expect(await f.call("setInteractiveMode", { enabled: true })).toEqual({
      previous: false,
      current: true,
    });
    expect(f.studioCtx.isInteractiveMode).toBe(true);
    expect(await f.call("setInteractiveMode", { enabled: true })).toEqual({
      previous: true,
      current: true,
    });
    expect(f.ready).toHaveBeenCalledTimes(1);
    expect(await f.call("setInteractiveMode", { enabled: false })).toEqual({
      previous: true,
      current: false,
    });
    expect(f.studioCtx.isInteractiveMode).toBe(false);
    expect(f.studioCtx._changeCounter).toBe(counter);
    expect(f.studioCtx.currentArena).toBe(arena);
    expect(
      f.studioCtx.appCtx.bundler.bundle(
        f.studioCtx.site,
        f.studioCtx.siteInfo.id,
        f.studioCtx.appCtx.lastBundleVersion,
      ),
    ).toEqual(before);
  } finally {
    f.studioCtx.dispose();
  }
});

it("rejects native Preview without changing either mode", async () => {
  const f = await fixture();
  try {
    vi.spyOn(f.studioCtx, "isLiveMode", "get").mockReturnValue(true);
    await expect(
      f.call("setInteractiveMode", { enabled: true }),
    ).rejects.toThrow("Close native Preview");
    expect(f.studioCtx.isInteractiveMode).toBe(false);
    expect(f.ready).not.toHaveBeenCalled();
  } finally {
    f.studioCtx.dispose();
  }
});

it("rejects enabling an empty canvas but always permits disabling", async () => {
  const f = await fixture();
  try {
    vi.spyOn(f.studioCtx, "currentArenaEmpty", "get").mockReturnValue(true);
    await expect(
      f.call("setInteractiveMode", { enabled: true }),
    ).rejects.toThrow("nonempty canvas");
    expect(await f.call("setInteractiveMode", { enabled: false })).toEqual({
      previous: false,
      current: false,
    });
  } finally {
    f.studioCtx.dispose();
  }
});

it("reads, edits, batches, undoes and saves without leaving canvas interaction", async () => {
  const f = await fixture();
  try {
    const page = ensure(f.studioCtx.site.components.find(c => c.name === "Page"), "Page missing");
    const root = ensureKnownTplTag(page.tplTree);
    const name = root.name;
    const input = { componentUuid: page.uuid, elementUuid: page.tplTree.uuid };
    const arena = f.studioCtx.currentArena;
    await f.call("setInteractiveMode", { enabled: true });
    expect(await f.call("getEditorContext", {})).toMatchObject({ mode: "preview", previewKind: "interactive", canEdit: true });
    expect(await f.call("identify", { model: "test", client: "test", skill: "plasmic", outputFormat: "json" })).toMatchObject({ canEdit: true });
    await f.call("read", { elements: [input] });
    await f.call("queryElements", { componentUuid: page.uuid });
    expect(await f.call("validate", {})).toMatchObject({ valid: true });
    await f.call("changeElement", { ...input, name: "Updated" });
    expect(root.name).toBe("Updated");
    expect(await f.call("undo", {})).toEqual({ undone: true });
    expect(root.name).toBe(name);
    await f.call("executeBatch", { operations: [
      { name: "changeElement", input: { ...input, name: "BatchUpdated" } },
    ] });
    expect(root.name).toBe("BatchUpdated");
    const save = vi.spyOn(f.studioCtx, "save").mockResolvedValue(undefined);
    f.studioCtx.dbCtx().revisionNum = 1;
    vi.spyOn(f.studioCtx, "hasUnsavedChanges").mockReturnValue(false);
    expect(await f.call("save", {})).toMatchObject({ saved: true });
    expect(save).toHaveBeenCalledExactlyOnceWith({ noErrorNotification: true });
    expect(f.studioCtx.isInteractiveMode).toBe(true);
    expect(f.studioCtx.currentArena).toBe(arena);
  } finally {
    f.studioCtx.dispose();
  }
});

it.each(["blocked", "stale", "readOnly", "protectedMain", "nativePreview"])(
  "keeps the %s write guard while interacting",
  async state => {
    const f = await fixture();
    try {
      await f.call("setInteractiveMode", { enabled: true });
      if (state === "blocked") f.studioCtx.setBlockChanges(true);
      if (state === "stale") f.studioCtx.isAtTip = false;
      if (state === "readOnly") vi.spyOn(f.studioCtx, "canEditProject").mockReturnValue(false);
      if (state === "protectedMain") f.studioCtx.siteInfo.isMainBranchProtected = true;
      if (state === "nativePreview") vi.spyOn(f.studioCtx, "isLiveMode", "get").mockReturnValue(true);
      expect(await f.call("getEditorContext", {})).toMatchObject({ canEdit: false });
      await expect(f.call("createComponent", { name: "Unauthorized" })).rejects.toThrow();
      expect(f.studioCtx.site.components.some(c => c.name === "Unauthorized")).toBe(false);
      expect(f.studioCtx.isInteractiveMode).toBe(true);
    } finally {
      f.studioCtx.dispose();
    }
  },
);
