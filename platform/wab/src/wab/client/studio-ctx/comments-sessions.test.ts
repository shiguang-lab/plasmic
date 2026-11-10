import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { createSite } from "@/wab/shared/core/sites";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { toOpaque } from "@/wab/commons/types";
import { mkMixedArena } from "@/wab/shared/Arenas";
import { ensure } from "@/wab/shared/common";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { mock } from "vitest-mock-extended";

async function fixture() {
  const result = fakeStudioCtx();
  await vi.waitFor(() => expect(result.studioCtx.initialRouteReady).toBe(true));
  return { ...result, ctx: result.studioCtx.commentsCtx };
}

it("installs a complete session before notification and preserves opaque model, view identities", async () => {
  const { ctx, studioCtx, history } = await fixture();
  const view = mock<ViewCtx>();
  const tpl = mkTplTagX("div");
  const beforeRoute = history.location;
  const notify = vi.fn(() => expect(ctx.openedNewThread()?.tpl).toBe(tpl));
  const stop = ctx.dialogStore.subscribe(notify);
  ctx.deferPublication(() => {
    ctx.openNewCommentDialog(view, tpl);
    const session = ensure(ctx.dialogStore.getState().newThread, "New comment session");
    expect(Object.isFrozen(ctx.dialogStore.getState())).toBe(true);
    expect(Object.isFrozen(session)).toBe(true);
    expect(session.viewCtx).toBe(view);
    expect(session.tpl).toBe(tpl);
    expect(notify).not.toHaveBeenCalled();
  });
  expect(notify).toHaveBeenCalledOnce();
  expect(studioCtx.showCommentsPanel).toBe(true);
  expect(history.location).toBe(beforeRoute);
  stop();
  studioCtx.dispose();
});

it("opens the existing right panel for thread commands and deep-linked selections", async () => {
  const { ctx, studioCtx, history } = await fixture();
  const push = vi.spyOn(history, "push").mockImplementation(() => undefined);
  ctx.openCommentThreadDialog("one", true);
  expect(studioCtx.showCommentsPanel).toBe(true);
  expect(push).toHaveBeenCalledWith({ search: "comment=one" });
  expect(ctx.getAndResetSkipZoomOnFocus()).toBe(true);
  studioCtx.toggleCommentsPanel();
  ctx.handleOpenCommentThreadDialog(toOpaque("one"));
  expect(studioCtx.showCommentsPanel).toBe(true);
  const original = ctx.openedThread();
  studioCtx.toggleCommentsPanel();
  ctx.handleOpenCommentThreadDialog(toOpaque("one"));
  expect(studioCtx.showCommentsPanel).toBe(true);
  expect(ctx.openedThread()).toBe(original);
  ctx.handleCloseThreadDialog();
  expect(ctx.openedThread()).toBeUndefined();
  expect(studioCtx.showCommentsPanel).toBe(true);
  studioCtx.dispose();
});

it("restores the same session and arena draft after a failed nested owner transition", async () => {
  const { ctx, studioCtx } = await fixture();
  const view = mock<ViewCtx>();
  const tpl = mkTplTagX("div");
  const arena = mkMixedArena("Draft");
  ctx.setArenaDraft(arena, "Unsent draft");
  ctx.openNewCommentDialog(view, tpl);
  const original = ctx.dialogStore.getState();
  const session = ensure(ctx.openedNewThread(), "New comment session");
  const notify = vi.fn();
  const stop = ctx.dialogStore.subscribe(notify);
  expect(() => ctx.deferPublication(() => ctx.transaction(() => {
    ctx.transaction(() => ctx.resetViewSessions([view]));
    expect(ctx.openedNewThread()).toBeUndefined();
    throw new Error("Abort arena transition");
  }))).toThrow("Abort arena transition");
  expect(ctx.dialogStore.getState()).toBe(original);
  expect(ctx.openedNewThread()).toBe(session);
  expect(ctx.getArenaDraft(arena)).toBe("Unsent draft");
  expect(notify).not.toHaveBeenCalled();
  ctx.deferPublication(() => ctx.transaction(() => {
    ctx.resetViewSessions([view]);
    expect(ctx.openedNewThread()).toBeUndefined();
    expect(notify).not.toHaveBeenCalled();
  }));
  expect(notify).toHaveBeenCalledOnce();
  expect(ctx.getArenaDraft(arena)).toBe("Unsent draft");
  stop();
  studioCtx.dispose();
});

it("targets departed views, preserves an unbound global thread and treats unrelated resets as no-ops", async () => {
  const { ctx, studioCtx, history } = await fixture();
  const first = mock<ViewCtx>();
  const second = mock<ViewCtx>();
  const tpl = mkTplTagX("div");
  ctx.handleOpenCommentThreadDialog(toOpaque("global"));
  const globalSession = ctx.openedThread();
  const notify = vi.fn();
  const stop = ctx.dialogStore.subscribe(notify);
  ctx.resetViewSessions([first]);
  expect(ctx.openedThread()).toBe(globalSession);
  expect(notify).not.toHaveBeenCalled();
  ctx.openNewCommentDialog(second, tpl);
  const current = ctx.openedNewThread();
  notify.mockClear();
  ctx.resetViewSessions([first]);
  expect(ctx.openedNewThread()).toBe(current);
  expect(notify).not.toHaveBeenCalled();
  const route = history.location;
  ctx.resetViewSessions([second]);
  expect(ctx.openedNewThread()).toBeUndefined();
  expect(notify).toHaveBeenCalledOnce();
  ctx.resetViewSessions([second]);
  expect(notify).toHaveBeenCalledOnce();
  expect(history.location).toBe(route);
  stop();
  studioCtx.dispose();
});

it("clears view-bound sessions on Site replacement without changing the comment route", async () => {
  const { ctx, studioCtx, history } = await fixture();
  ctx.handleOpenCommentThreadDialog(toOpaque("existing"), mock<ViewCtx>());
  const route = history.location;
  ctx.onSiteReplaced();
  expect(ctx.openedThread()).toBeUndefined();
  expect(ctx.openedNewThread()).toBeUndefined();
  expect(history.location).toBe(route);
  studioCtx.dispose();
});

it("lets disposal supersede an abandoned transaction and releases dialog subscribers", async () => {
  const { ctx, studioCtx } = await fixture();
  const view = mock<ViewCtx>();
  const tpl = mkTplTagX("div");
  ctx.openNewCommentDialog(view, tpl);
  const notify = vi.fn();
  ctx.dialogStore.subscribe(notify);
  expect(() => ctx.deferPublication(() => ctx.transaction(() => {
    ctx.resetViewSessions();
    ctx.dispose();
    throw new Error("Owner closed");
  }))).toThrow("Owner closed");
  expect(ctx.openedNewThread()).toBeUndefined();
  expect(notify).toHaveBeenCalledOnce();
  ctx.openNewCommentDialog(view, tpl);
  ctx.handleOpenCommentThreadDialog(toOpaque("late"), view);
  ctx.resetViewSessions();
  expect(notify).toHaveBeenCalledOnce();
  const late = vi.fn();
  const stop = ctx.dialogStore.subscribe(late);
  ctx.dispose();
  expect(late).not.toHaveBeenCalled();
  stop();
  studioCtx.dispose();
});


it("never restores a departed model owner's session when Site installation fails after replacing models", async () => {
  const { ctx, studioCtx } = await fixture();
  ctx.openNewCommentDialog(mock<ViewCtx>(), mkTplTagX("div"));
  const oldSession = ctx.openedNewThread();
  const departed = studioCtx.modelSnapshots;
  const notify = vi.fn(() => expect(ctx.openedNewThread()).toBeUndefined());
  const stop = ctx.dialogStore.subscribe(notify);
  expect(() => ctx.deferPublication(() => ctx.transaction(() => {
    ctx.resetViewSessions();
    // The synchronous owner installation phase used after loadVersion's fetch.
    studioCtx.dbCtx().setSite(createSite(), undefined, undefined);
    departed.dispose();
    studioCtx.modelSnapshots = new ModelSnapshots();
    throw new Error("New Site installation failed");
  }))).toThrow("New Site installation failed");
  expect(studioCtx.modelSnapshots).not.toBe(departed);
  expect(ctx.openedNewThread()).toBeUndefined();
  expect(ctx.dialogStore.getState().newThread).not.toBe(oldSession);
  expect(notify).toHaveBeenCalledOnce();
  stop();
  studioCtx.dispose();
});
