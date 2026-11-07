import { toOpaque } from "@/wab/commons/types";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { waitFor } from "@testing-library/react";
import {
  PreviewCtx,
  getUrlsForLiveMode,
} from "@/wab/client/components/live/PreviewCtx";
import { HostFrameCtx } from "@/wab/client/frame-ctx/host-frame-ctx";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { mkComponentVariantGroup, mkVariant } from "@/wab/shared/Variants";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { mkParam } from "@/wab/shared/core/lang";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import type { ChangeSummary } from "@/wab/shared/model/model-change-util";
import { typeFactory } from "@/wab/shared/model/model-util";
import { createMemoryHistory } from "history";

vi.mock("@/wab/client/components/canvas/studio-canvas-util", () => ({
  showCanvasPageNavigationNotification: vi.fn(),
}));

async function setup(hash = "") {
  const history = createMemoryHistory({
    initialEntries: [
      `/projects/project/preview${hash.replace(/^#/, "?")}#/groups`,
    ],
  });
  const { studioCtx: studio } = fakeStudioCtx({ siteInfo: { id: toOpaque("project") } });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  studio.appCtx.history = history;
  vi.spyOn(studio, "closeEditorPanels").mockImplementation(() => undefined);
  const ctx = new PreviewCtx({ history } as unknown as HostFrameCtx, studio);
  vi.spyOn(ctx, "getLocation").mockImplementation(async () => history.location);
  return { ctx, history };
}

test("ordinary preview defaults to desktop without carrying artboard dimensions", async () => {
  const { ctx, history } = await setup("#width=1440&height=848");
  await ctx.parseRoute();
  expect(ctx.viewport).toBe("desktop");
  await ctx.pushViewport({ viewport: "desktop", width: 1600, height: 872 });
  expect(history.location.search).toBe("");
  expect(history.location.hash).toBe("#/groups");
});

test("Preview operations await the host history bridge before reporting their state", async () => {
  const { ctx, history } = await setup();
  await ctx.parseRoute();
  const host = createMemoryHistory({
    initialEntries: ["/projects/project/preview#/groups"],
  });
  ctx.hostFrameCtx = { history: host } as unknown as HostFrameCtx;
  vi.spyOn(ctx, "getLocation").mockImplementation(async () => host.location);
  const push = vi.spyOn(history, "push").mockImplementation((location) => {
    setTimeout(() => host.push(location), 20);
  });
  let done = false;
  const pending = ctx
    .pushViewport({ viewport: "custom", width: 1440, height: 720 })
    .then(() => {
      done = true;
    });
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
    const { ctx, history } = await setup();
    await ctx.parseRoute();
    await ctx.pushViewport({ viewport, width: 844, height: 390 });
    await ctx.parseRoute();
    await ctx.handleNavigation("/details");
    expect(history.location.hash).toBe("#/details");
    const reopened = await setup(history.location.search);
    await reopened.ctx.parseRoute();
    expect(reopened.ctx.viewport).toBe(viewport);
    expect([reopened.ctx.width, reopened.ctx.height]).toEqual([844, 390]);
  },
);

test("invalid dimensions fall back to the selected device, never NaN or a fractional viewport", async () => {
  const { ctx } = await setup("#viewport=phone&width=NaN&height=300.5");
  await ctx.parseRoute();
  expect([ctx.width, ctx.height]).toEqual([390, 844]);
});

test("native navigation keeps business paths and encoded context inside Preview history", async () => {
  const { ctx, history } = await setup();
  await ctx.parseRoute();
  await ctx.pushViewport({ viewport: "custom", width: 1440, height: 720 });
  await ctx.handleNavigation(
    "/req-075/regular?role=%E8%BF%90%E8%90%A5&recordId=42#sql",
  );
  expect(history.location.hash).toBe(
    "#/req-075/regular?role=%E8%BF%90%E8%90%A5&recordId=42#sql",
  );
  expect(ctx.pageQuery).toEqual({ role: "运营", recordId: "42" });
  expect(ctx.pageHash).toBe("#sql");
  expect([ctx.width, ctx.height]).toEqual([1440, 720]);
  await ctx.handleNavigation("/req-075/groups?role=%E8%BF%90%E8%90%A5&page=3");
  expect(history.location.hash).toBe(
    "#/req-075/groups?role=%E8%BF%90%E8%90%A5&page=3",
  );
  expect(ctx.pageQuery).toEqual({ role: "运营", page: "3" });
  expect(ctx.pageHash).toBe("");
});

test("a standalone presentation reads the hash route and retains its short code", async () => {
  const { ctx, history } = await setup();
  history.replace("/d/0123456789?branch=design#/groups?tag=a&tag=b#rules");
  await ctx.parseRoute();
  expect(ctx.full).toBe(true);
  expect(ctx.previewData?.presentationCode).toBe("0123456789");
  expect(ctx.pageQuery).toEqual({ tag: ["a", "b"] });
  await ctx.handleNavigation("/details/42");
  expect(history.location.pathname).toBe("/d/0123456789");
  expect(history.location.hash).toBe("#/details/42");
});

test("explicit addresses for another presentation stay outside the current draft route", async () => {
  const { ctx, history } = await setup();
  history.replace("/d/0123456789#/groups?tag=a");
  await ctx.parseRoute();
  expect(ctx.hrefForNavigation("/d/abcdefghij#/details/7")).toBeUndefined();
  expect(ctx.hrefForNavigation("/d/0123456789#/details/7")).toContain(
    "/d/0123456789#/details/7",
  );
  expect(ctx.hrefForNavigation("http://[")).toBeUndefined();
  expect(history.location.hash).toBe("#/groups?tag=a");
});

test("modified links carry the same variant settings as ordinary business navigation", async () => {
  const { ctx, history } = await setup();
  await ctx.parseRoute();
  const variant = mkVariant({ name: "compact" });
  mkComponentVariantGroup({
    param: mkParam({
      name: "size",
      type: typeFactory.text(),
      paramType: "state",
    }),
    variants: [variant],
  });
  if (!ctx.previewData) {
    throw new Error("Expected preview data");
  }
  ctx.previewData = { ...ctx.previewData, allVariants: [variant] };
  const samePage = new URL(ctx.hrefForNavigation("?tab=next") as string);
  expect(new URLSearchParams(samePage.search).get("variants")).toBe(
    '{"size":"compact"}',
  );
  const nextPage = new URL(ctx.hrefForNavigation("/details") as string);
  expect(new URLSearchParams(nextPage.search).has("variants")).toBe(false);
  await ctx.handleNavigation("/details");
  expect(nextPage.search).toBe(history.location.search);
});

test("a malformed authority-like hash cannot crash draft presentation parsing", async () => {
  const { ctx, history } = await setup();
  history.replace("/d/0123456789#//");
  await ctx.parseRoute();
  expect(ctx.isLive).toBe(true);
  expect(ctx.previewPath).toBe("//");
  expect(ctx.component).toBeUndefined();
});

async function navigationSetup() {
  const history = createMemoryHistory({
    initialEntries: ["/projects/project"],
  });
  const { studioCtx: studio } = fakeStudioCtx({ siteInfo: { id: toOpaque("project") } });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  studio.appCtx.history = history;
  vi.spyOn(studio, "closeEditorPanels").mockImplementation(() => undefined);
  const ctx = new PreviewCtx({ history } as unknown as HostFrameCtx, studio);
  history.push("/projects/project/preview#/groups");
  return { ctx, history };
}

test("Preview back/forward stay within business page history, preserving viewport and editor exit", async () => {
  const { ctx, history } = await navigationSetup();
  try {
    await ctx.parseRoute();
    const go = vi.spyOn(history, "go");
    expect([ctx.canGoBack, ctx.canGoForward]).toEqual([false, false]);
    await ctx.goBack();
    expect(history.location.hash).toBe("#/groups");
    await ctx.pushViewport({ viewport: "phone", width: 390, height: 844 });
    expect(ctx.canGoBack).toBe(false);
    await ctx.handleNavigation("/details?record=42#sql");
    expect([ctx.canGoBack, ctx.canGoForward]).toEqual([true, false]);
    await ctx.pushViewport({ viewport: "custom", width: 1280, height: 720 });
    await ctx.goBack();
    expect(ctx.previewPath).toBe("/groups");
    expect([ctx.width, ctx.height]).toEqual([1280, 720]);
    expect([ctx.canGoBack, ctx.canGoForward]).toEqual([false, true]);
    await ctx.goForward();
    expect(ctx.previewPath).toBe("/details");
    expect(ctx.pageQuery).toEqual({ record: "42" });
    expect(ctx.pageHash).toBe("#sql");
    expect([ctx.canGoBack, ctx.canGoForward]).toEqual([true, false]);
    await ctx.goForward();
    expect(go).not.toHaveBeenCalled();
    await ctx.stopLiveMode();
    expect(history.location.pathname).toBe("/projects/project");
    expect([ctx.canGoBack, ctx.canGoForward]).toEqual([false, false]);
    history.push("/projects/project/preview#/groups");
    expect([ctx.canGoBack, ctx.canGoForward]).toEqual([false, false]);
  } finally {
    ctx.dispose();
  }
});

test("query/hash navigation and a new destination after back update Preview history; refresh keeps it", async () => {
  const { ctx, history } = await navigationSetup();
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
  } finally {
    ctx.dispose();
  }
});

test("Preview traversal awaits the host bridge and ignores repeated clicks during navigation", async () => {
  const { ctx, history } = await navigationSetup();
  try {
    await ctx.parseRoute();
    await ctx.handleNavigation("/details");
    const appHistory = createMemoryHistory();
    ctx.studioCtx.appCtx.history = appHistory;
    const replace = vi
      .spyOn(appHistory, "replace")
      .mockImplementation((location) => {
        setTimeout(() => history.replace(location), 20);
      });
    const pending = ctx.goBack();
    await ctx.goBack();
    expect(replace).toHaveBeenCalledTimes(1);
    expect(ctx.previewPath).toBe("/details");
    await pending;
    expect(ctx.previewPath).toBe("/groups");
    expect([ctx.canGoBack, ctx.canGoForward]).toEqual([false, true]);
    await ctx.goForward();
    expect(ctx.previewPath).toBe("/details");
    expect([ctx.canGoBack, ctx.canGoForward]).toEqual([true, false]);
  } finally {
    ctx.dispose();
  }
});

test("relative links, query-only links, repeated values and anchors share business resolution", async () => {
  const { ctx, history } = await setup();
  history.replace(
    "/projects/project/preview?branch=design#/coupons/42?tag=a&tag=b",
  );
  await ctx.parseRoute();
  expect(ctx.pageQuery).toEqual({ tag: ["a", "b"] });
  await ctx.handleNavigation("?branch=business&tag=c&tag=d");
  expect(ctx.previewPath).toBe("/coupons/42");
  expect(ctx.previewData?.branchName).toBe("design");
  expect(ctx.pageQuery).toEqual({ branch: "business", tag: ["c", "d"] });
  await ctx.handleNavigation("#rules");
  expect(ctx.pageHash).toBe("#rules");
  await ctx.handleNavigation("../list");
  expect(ctx.previewPath).toBe("/list");
  expect(history.location.hash).toBe("#/list");
});

test("non-page targets stay in presentation context, not business routes", async () => {
  const { ctx, history } = await setup();
  const component = mkComponent({
    name: "Widget",
    type: ComponentType.Plain,
    tplTree: mkTplTagX("div"),
  });
  ctx.studioCtx.site.components.push(component);
  history.replace(`/projects/project/preview?component=${component.uuid}#/`);
  await ctx.parseRoute();
  expect(ctx.component).toBe(component);
  expect(ctx.previewPath).toBe("/");
  await ctx.pushViewport({ viewport: "phone", width: 390, height: 844 });
  expect(new URLSearchParams(history.location.search).get("component")).toBe(
    component.uuid,
  );
  await ctx.handleNavigation("?tab=second");
  expect(ctx.component).toBe(component);
  expect(ctx.pageQuery).toEqual({ tab: "second" });
  expect(new URLSearchParams(history.location.search).get("component")).toBe(
    component.uuid,
  );
  const href = new URL(ctx.hrefForNavigation("#details") as string);
  expect(new URLSearchParams(href.search).get("component")).toBe(
    component.uuid,
  );
  await ctx.handleNavigation("#details");
  expect(ctx.component).toBe(component);
  expect(ctx.pageHash).toBe("#details");
  await ctx.handleNavigation("/missing");
  expect(ctx.component).toBeUndefined();
  expect(new URLSearchParams(history.location.search).has("component")).toBe(
    false,
  );
});

test("opening a presentation preserves the current draft page and separates branch from business query", async () => {
  const { ctx, history } = await setup();
  history.replace(
    "/projects/project/preview?branch=design#/coupons/42?branch=business&tag=a&tag=b#rules",
  );
  await ctx.parseRoute();
  ctx.studioCtx.previewCtx = ctx;
  const create = vi.fn().mockResolvedValue({ code: "0123456789" });
  ctx.studioCtx.appCtx.api.createPresentation = create;
  const location = await getUrlsForLiveMode(ctx.studioCtx, true);
  expect(create).toHaveBeenCalledExactlyOnceWith("project");
  expect(location).toEqual({
    pathname: "/d/0123456789",
    search: "?branch=design",
    hash: "#/coupons/42?branch=business&tag=a&tag=b#rules",
  });
});

test("native route snapshots retain identity for a no-op parse and publish immutable model references", async () => {
  const { ctx, history } = await setup();
  const component = mkComponent({ name: "Widget", type: ComponentType.Plain, tplTree: mkTplTagX("div") });
  ctx.studioCtx.site.components.push(component);
  history.replace(`/projects/project/preview?component=${component.uuid}#/`);
  await ctx.parseRoute();
  const state = ctx.store.getState();
  const changed = vi.fn();
  const stop = ctx.store.subscribe(changed);
  await ctx.parseRoute();
  expect(ctx.store.getState()).toBe(state);
  expect(changed).not.toHaveBeenCalled();
  const route = state.previewData;
  expect(typeof route?.componentPath).toBe("object");
  if (route && typeof route.componentPath !== "string") {
    expect(route.componentPath.component).toEqual({ uid: component.uid, type: "Component" });
    expect(route.componentPath.component).not.toBe(component);
    expect(Object.isFrozen(route.componentPath.component)).toBe(true);
  }
  ctx.dispose();
  ctx.refresh();
  await ctx.parseRoute();
  expect(changed).not.toHaveBeenCalled();
  stop();
});

test("target labels publish after a completed model event and preserve unaffected row identities", async () => {
  const { ctx, history } = await setup();
  ctx.dispose();
  const first = mkComponent({ name: "First", type: ComponentType.Plain, tplTree: mkTplTagX("div") });
  const second = mkComponent({ name: "Second", type: ComponentType.Plain, tplTree: mkTplTagX("div") });
  ctx.studioCtx.site.components.push(first, second);
  const listeners = new Set<Parameters<StudioCtx["subscribeModelChanges"]>[0]>();
  ctx.studioCtx.subscribeModelChanges = (listener) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  };
  const preview = new PreviewCtx({ history } as unknown as HostFrameCtx, ctx.studioCtx);
  await preview.parseRoute();
  const before = preview.store.getState().targets;
  first.name = "Renamed";
  expect(before[0].name).toBe("First");
  const changeNode = { inst: first, field: "name" };
  const summary = { changes: [{ type: "update", changeNode, path: [{ inst: ctx.studioCtx.site, field: "components" }, changeNode], oldValue: "First", newValue: "Renamed" }] } as ChangeSummary;
  listeners.forEach((listener) => listener({ type: "commit", summary }));
  const after = preview.store.getState().targets;
  expect(after[0].name).toBe("Renamed");
  expect(after[1]).toBe(before[1]);
  expect(Object.isFrozen(after[0])).toBe(true);
  preview.dispose();
  expect(listeners.size).toBe(0);
});
