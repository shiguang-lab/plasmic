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

test("native navigation keeps business paths and encoded context inside Preview history", async () => {
  const { ctx, history } = setup();
  await ctx.parseRoute();
  await ctx.pushViewport({ viewport: "custom", width: 1440, height: 720 });
  await ctx.handleNavigation("/req-075/regular?role=%E8%BF%90%E8%90%A5&recordId=42#sql");
  expect(history.location.pathname).toBe("/projects/project/preview/req-075/regular");
  expect(ctx.pageQuery).toEqual({ role: "运营", recordId: "42" });
  expect(ctx.pageHash).toBe("#sql");
  expect([ctx.width, ctx.height]).toEqual([1440, 720]);
  await ctx.handleNavigation("/req-075/groups?role=%E8%BF%90%E8%90%A5&page=3");
  expect(history.location.pathname).toBe("/projects/project/preview/req-075/groups");
  expect(ctx.pageQuery).toEqual({ role: "运营", page: "3" });
  expect(ctx.pageHash).toBe("");
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

function navigationSetup() {
  const history = createMemoryHistory({ initialEntries: ["/projects/project"] });
  const studio = {
    siteInfo: { id: "project" }, site: { components: [] },
    appCtx: { history }, closeEditorPanels: vi.fn(),
  } as unknown as StudioCtx;
  const ctx = new PreviewCtx({ history } as unknown as HostFrameCtx, studio);
  history.push("/projects/project/preview/groups");
  return { ctx, history };
}

test("Preview back/forward stay within business page history, preserving viewport and editor exit", async () => {
  const { ctx, history } = navigationSetup();
  try {
    await ctx.parseRoute();
    const go = vi.spyOn(history, "go");
    expect([ctx.canGoBack, ctx.canGoForward]).toEqual([false, false]);
    await ctx.goBack();
    expect(history.location.pathname).toBe("/projects/project/preview/groups");
    await ctx.pushViewport({ viewport: "phone", width: 390, height: 844 });
    expect(ctx.canGoBack).toBe(false);
    await ctx.handleNavigation("/details?record=42#sql");
    expect([ctx.canGoBack, ctx.canGoForward]).toEqual([true, false]);
    await ctx.pushViewport({ viewport: "custom", width: 1280, height: 720 });
    await ctx.goBack();
    expect(ctx.previewPath).toBe("groups");
    expect([ctx.width, ctx.height]).toEqual([1280, 720]);
    expect([ctx.canGoBack, ctx.canGoForward]).toEqual([false, true]);
    await ctx.goForward();
    expect(ctx.previewPath).toBe("details");
    expect(ctx.pageQuery).toEqual({ record: "42" });
    expect(ctx.pageHash).toBe("#sql");
    expect([ctx.canGoBack, ctx.canGoForward]).toEqual([true, false]);
    await ctx.goForward();
    expect(go).not.toHaveBeenCalled();
    await ctx.stopLiveMode();
    expect(history.location.pathname).toBe("/projects/project");
    expect([ctx.canGoBack, ctx.canGoForward]).toEqual([false, false]);
    history.push("/projects/project/preview/groups");
    expect([ctx.canGoBack, ctx.canGoForward]).toEqual([false, false]);
  } finally { ctx.dispose(); }
});

test("query/hash navigation and a new destination after back update Preview history; refresh keeps it", async () => {
  const { ctx, history } = navigationSetup();
  try {
    await ctx.parseRoute();
    await ctx.handleNavigation("/groups?page=2");
    await ctx.handleNavigation("#section");
    await ctx.goBack();
    expect(ctx.pageQuery).toEqual({ page: "2" });
    expect(ctx.pageHash).toBe("");
    expect(ctx.canGoForward).toBe(true);
    const location = history.location;
    ctx.refresh();
    expect(ctx.refreshKey).toBe(1);
    expect(history.location).toBe(location);
    expect(ctx.canGoForward).toBe(true);
    await ctx.handleNavigation("/other");
    expect(ctx.canGoForward).toBe(false);
    await ctx.goBack();
    expect(ctx.pageQuery).toEqual({ page: "2" });
  } finally { ctx.dispose(); }
});

test("Preview traversal awaits the host bridge and ignores repeated clicks during navigation", async () => {
  const { ctx, history } = navigationSetup();
  try {
    await ctx.parseRoute();
    await ctx.handleNavigation("/details");
    const appHistory = createMemoryHistory();
    ctx.studioCtx.appCtx.history = appHistory;
    const replace = vi.spyOn(appHistory, "replace").mockImplementation((location) => {
      setTimeout(() => history.replace(location), 20);
    });
    const pending = ctx.goBack();
    await ctx.goBack();
    expect(replace).toHaveBeenCalledTimes(1);
    expect(ctx.previewPath).toBe("details");
    await pending;
    expect(ctx.previewPath).toBe("groups");
    expect([ctx.canGoBack, ctx.canGoForward]).toEqual([false, true]);
    await ctx.goForward();
    expect(ctx.previewPath).toBe("details");
    expect([ctx.canGoBack, ctx.canGoForward]).toEqual([true, false]);
  } finally { ctx.dispose(); }
});
