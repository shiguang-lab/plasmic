import { PreviewCtx } from "@/wab/client/components/live/PreviewCtx";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { HostFrameCtx } from "@/wab/client/frame-ctx/host-frame-ctx";
import { createMemoryHistory } from "history";

vi.mock("@/wab/client/components/canvas/studio-canvas-util", () => ({
  showCanvasPageNavigationNotification: vi.fn(),
}));

function setup(hash = "") {
  const history = createMemoryHistory({
    initialEntries: [`/projects/project/preview/groups${hash}`],
  });
  const ctx = Object.create(PreviewCtx.prototype) as PreviewCtx;
  ctx.hostFrameCtx = { history } as unknown as HostFrameCtx;
  ctx.studioCtx = {
    siteInfo: { id: "project" },
    site: { components: [] },
    appCtx: { history },
  } as unknown as StudioCtx;
  vi.spyOn(ctx, "getLocation").mockImplementation(async () => history.location);
  return { ctx, history };
}

test("ordinary preview defaults to desktop without carrying artboard dimensions", async () => {
  const { ctx, history } = setup("#width=1440&height=848");
  await ctx.parseRoute();
  expect(ctx.viewport).toBe("desktop");
  await ctx.pushViewport({ viewport: "desktop", width: 1600, height: 872 });
  expect(history.location.hash).toBe("");
});

test("Preview operations await the host history bridge before reporting their state", async () => {
  const { ctx, history } = setup();
  await ctx.parseRoute();
  const host = createMemoryHistory({ initialEntries: ["/projects/project/preview/groups"] });
  ctx.hostFrameCtx = { history: host } as unknown as HostFrameCtx;
  vi.spyOn(ctx, "getLocation").mockImplementation(async () => host.location);
  const push = vi.spyOn(history, "push").mockImplementation((location) => {
    setTimeout(() => host.push(location), 20);
  });
  let done = false;
  const pending = ctx.pushViewport({ viewport: "custom", width: 1440, height: 720 }).then(() => { done = true; });
  await new Promise((r) => setTimeout(r, 0));
  expect(done).toBe(false);
  await pending;
  expect([ctx.width, ctx.height]).toEqual([1440, 720]);
  expect(ctx.isLive).toBe(true);
  await ctx.stopLiveMode();
  expect(ctx.isLive).toBe(false);
  push.mockRestore();
});

test.each(["phone", "tablet", "custom"] as const)(
  "%s viewport survives page navigation and route rereading",
  async (viewport) => {
    const { ctx, history } = setup();
    await ctx.parseRoute();
    await ctx.pushViewport({ viewport, width: 844, height: 390 });
    await ctx.parseRoute();
    await ctx.handleNavigation("/details");
    expect(history.location.pathname).toBe("/projects/project/preview/details");
    const reopened = setup(history.location.hash);
    await reopened.ctx.parseRoute();
    expect(reopened.ctx.viewport).toBe(viewport);
    expect([reopened.ctx.width, reopened.ctx.height]).toEqual([844, 390]);
  },
);

test("invalid dimensions fall back to the selected device, never NaN or a fractional viewport", async () => {
  const { ctx } = setup("#viewport=phone&width=NaN&height=300.5");
  await ctx.parseRoute();
  expect([ctx.width, ctx.height]).toEqual([390, 844]);
});

test("parsing a popup location keeps the current editor outside live mode", async () => {
  const { ctx, history } = setup();
  history.push("/projects/project");
  ctx.popup = {} as Window;
  vi.spyOn(ctx, "getLocation").mockResolvedValue({ ...history.location, pathname: "/projects/project/preview/groups" });
  await ctx.parseRoute();
  expect(ctx.isLive).toBe(false);
  expect(ctx.previewPath).toBe("groups");
});
