import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { COPILOT_TOOLS } from "@/wab/client/copilot";
import { ensure } from "@/wab/shared/common";

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
