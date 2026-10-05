import { PreviewCtx } from "@/wab/client/components/live/PreviewCtx";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { createMemoryHistory } from "history";

vi.mock("@/wab/client/components/canvas/studio-canvas-util", () => ({
  showCanvasPageNavigationNotification: vi.fn(),
}));

function setup(hash = "") {
  const history = createMemoryHistory({
    initialEntries: [`/projects/project/preview/groups${hash}`],
  });
  const ctx = Object.create(PreviewCtx.prototype) as PreviewCtx;
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
