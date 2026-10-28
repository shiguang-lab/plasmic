import { mockDeepAuto } from "@/wab/__testonly__/mock";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { COPILOT_TOOLS } from "@/wab/client/copilot";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import {
  getArenaFrames,
  getFrameHeight,
  updateAutoDerivedFrameHeight,
} from "@/wab/shared/Arenas";
import { ensure } from "@/wab/shared/common";

async function fixture() {
  const { studioCtx } = fakeStudioCtx();
  const call = async (name: string, input: Record<string, unknown>) =>
    JSON.parse(
      await ensure(COPILOT_TOOLS[name], "Tool missing").execute(
        studioCtx,
        input,
      ),
    );
  const created = await call("createComponent", {
    name: "Long list",
    type: "page",
    path: "/long-list",
  });
  const page = ensure(
    studioCtx.site.components.find((c) => c.uuid === created.created[0].uuid),
    "Page missing",
  );
  await call("navigate", { componentUuid: page.uuid });
  const frame = ensure(
    getArenaFrames(studioCtx.currentArena)[0],
    "Frame missing",
  );
  const vc = mockDeepAuto<ViewCtx>();
  vc.awaitSync.mockResolvedValue(undefined);
  vc.arenaFrame.mockReturnValue(frame);
  // Replace the fake environment's canvas, which never finishes rendering.
  studioCtx.viewCtxs.replace([vc]);
  const store = vi.spyOn(studioCtx.appCtx.api, "addStorageItem");
  store.mockResolvedValue(undefined);
  // Other editor preferences (e.g. focus mode) share the same storage API.
  const pageHeightWrites = () =>
    store.mock.calls
      .filter(([key]) => key.startsWith("plasmic.full-page-height."))
      .map(([, value]) => value);
  studioCtx.copilotActivity.dispose();
  return { studioCtx, call, vc, frame, store, pageHeightWrites };
}

afterEach(() => {
  vi.restoreAllMocks();
});

it("shows full page height for the session, waits for artboards to settle and restores without touching the user preference", async () => {
  const f = await fixture();
  const authored = f.frame.height;
  // The artboard grows a little later, like the debounced canvas measurement.
  setTimeout(() => updateAutoDerivedFrameHeight(f.frame, 2400), 150);
  const opened = await f.call("setCanvasPageHeight", { mode: "full" });
  expect(opened).toEqual({
    previous: "viewport",
    current: "full",
    settled: true,
    frames: [{ frameUuid: f.frame.uuid, height: 2400 }],
  });
  expect(f.studioCtx.fullPageHeight).toBe(true);
  // Code components read the view through a render evaluation.
  expect(f.vc.scheduleSync).toHaveBeenCalledWith({
    eval: true,
    styles: false,
    asap: true,
  });
  expect(f.vc.awaitSync).toHaveBeenCalled();

  setTimeout(() => updateAutoDerivedFrameHeight(f.frame, authored), 150);
  const restored = await f.call("setCanvasPageHeight", {
    mode: opened.previous,
  });
  expect(restored).toMatchObject({ previous: "full", current: "viewport" });
  expect(f.studioCtx.fullPageHeight).toBe(false);
  expect(getFrameHeight(f.frame)).toBe(authored);
  expect(f.pageHeightWrites()).toEqual([]);
});

it("keeps the user's own toggle as the persisted preference and lets it replace an AI override", async () => {
  const f = await fixture();
  await f.call("setCanvasPageHeight", { mode: "full" });
  // The user turns the view off while an AI override is active.
  f.studioCtx.toggleFullPageHeight();
  expect(f.studioCtx.fullPageHeight).toBe(false);
  expect(f.store).toHaveBeenLastCalledWith(
    expect.stringMatching(/^plasmic\.full-page-height\./),
    "false",
  );
  f.studioCtx.toggleFullPageHeight();
  expect(f.studioCtx.fullPageHeight).toBe(true);
  expect(f.store).toHaveBeenLastCalledWith(
    expect.stringMatching(/^plasmic\.full-page-height\./),
    "true",
  );
  // An AI viewport capture is temporary; restoring returns to the user's view.
  const viewport = await f.call("setCanvasPageHeight", { mode: "viewport" });
  expect(viewport.previous).toBe("full");
  expect(f.studioCtx.fullPageHeight).toBe(false);
  await f.call("setCanvasPageHeight", { mode: viewport.previous });
  expect(f.studioCtx.fullPageHeight).toBe(true);
  // Only the two user toggles were stored.
  expect(f.pageHeightWrites()).toEqual(["false", "true"]);
});

it("reports artboards that never stop resizing", async () => {
  const f = await fixture();
  let height = f.frame.height;
  const timer = setInterval(
    () => updateAutoDerivedFrameHeight(f.frame, (height += 50)),
    100,
  );
  try {
    vi.useFakeTimers({ toFake: ["Date"], shouldAdvanceTime: true });
    const pending = f.call("setCanvasPageHeight", { mode: "full" });
    // Jump past the settle deadline without waiting in real time.
    vi.setSystemTime(Date.now() + 9000);
    expect((await pending).settled).toBe(false);
  } finally {
    clearInterval(timer);
    vi.useRealTimers();
  }
});
