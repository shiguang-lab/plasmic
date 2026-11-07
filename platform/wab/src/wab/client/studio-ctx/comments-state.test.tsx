import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import {
  getCommentFrameKey,
  getSubjectVariantsKey,
} from "@/wab/client/components/comments/utils";
import { reportError } from "@/wab/client/ErrorNotifications";
import { CommentsCtx } from "@/wab/client/studio-ctx/comments-ctx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { toOpaque } from "@/wab/commons/types";
import {
  ApiBranch,
  ApiCommentThread,
  ApiUser,
  GetCommentsResponse,
} from "@/wab/shared/ApiSchema";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { isTplNamable, isTplTag } from "@/wab/shared/core/tpls";
import { mkVariant } from "@/wab/shared/Variants";
import { act, cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";
import { useStore } from "zustand";

vi.mock("@/wab/client/ErrorNotifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/wab/client/ErrorNotifications")>()),
  reportError: vi.fn(),
  showError: vi.fn(),
}));

afterEach(cleanup);

async function fixture() {
  const result = fakeStudioCtx();
  const { studioCtx: sc, appCtx, api } = result;
  await vi.waitFor(() => expect(sc.initialRouteReady).toBe(true));
  appCtx.selfInfo = mock<ApiUser>({
    id: toOpaque("self"),
    email: "self@example.com",
  });
  vi.spyOn(sc, "showComments").mockReturnValue(true);
  const page = await sc.changeUnsafe(() =>
    sc.addComponent("Comments", { type: ComponentType.Page }),
  );
  const subject = page.tplTree;
  if (!isTplNamable(subject)) {
    throw new Error("Expected namable page root");
  }
  sc.bundler().bundle(sc.site, sc.siteInfo.id, appCtx.lastBundleVersion);
  const addr = ensure(sc.bundler().addrOf(subject), "Root address");
  const date = new Date(2026, 10, 1).toISOString();
  const common = {
    createdAt: date,
    updatedAt: date,
    deletedAt: null,
    createdById: "self",
    updatedById: "self",
    deletedById: null,
  };
  const thread = (id: string): ApiCommentThread => ({
    ...common,
    id: toOpaque(id),
    resolved: false,
    location: { subject: addr, variants: [] },
    comments: [
      {
        ...common,
        id: toOpaque(`comment-${id}`),
        commentThreadId: toOpaque(id),
        body: `Body ${id}`,
      },
    ],
    commentThreadHistories: [],
  });
  const response: GetCommentsResponse = {
    threads: [thread("one"), thread("two")],
    users: [appCtx.selfInfo],
    reactions: [],
    selfNotificationSettings: { notifyAbout: "all" },
  };
  api.getComments.mockResolvedValue(response);
  await sc.commentsCtx.fetchComments();
  sc.createViewStateUndoRecord();
  return { ...result, ctx: sc.commentsCtx, page, subject, response };
}

it("retains equal snapshots and isolates dialogs, filters, authors, reactions and unrelated threads", async () => {
  const { ctx, api, response } = await fixture();
  const data = ctx.store.getState();
  const publish = vi.fn();
  const stop = ctx.store.subscribe(publish);
  for (let i = 0; i < 20; i++) {
    await ctx.fetchComments();
  }
  expect(ctx.store.getState()).toBe(data);
  expect(publish).not.toHaveBeenCalled();
  const commits = vi.fn();
  function Thread() {
    const thread = useStore(ctx.store, (state) =>
      state.threadsById.get(toOpaque("two")),
    );
    return (
      <React.Profiler id="thread" onRender={commits}>
        <output>{thread?.comments[0].body}</output>
      </React.Profiler>
    );
  }
  render(<Thread />);
  commits.mockClear();
  await act(() => {
    ctx.setCommentsFilter({ ...ctx.commentsFilter(), scope: "project" });
    ctx.handleOpenCommentThreadDialog(toOpaque("one"));
    ctx.editComment(toOpaque("comment-one"), "Changed");
    ctx.addReactionToComment(toOpaque("comment-one"), { emojiName: "1f44d" });
  });
  expect(screen.getByRole("status").textContent).toBe("Body two");
  expect(commits).not.toHaveBeenCalled();
  expect(ctx.store.getState().threadsById.get(toOpaque("two"))).toBe(
    data.threadsById.get(toOpaque("two")),
  );
  expect(ctx.store.getState().usersMap).toBe(data.usersMap);
  expect(ctx.store.getState().commentStatsBySubject).toBe(
    data.commentStatsBySubject,
  );
  expect(
    ctx.store.getState().reactionsByCommentId.get(toOpaque("comment-one")),
  ).toHaveLength(1);
  expect(api.editComment).toHaveBeenCalledWith(
    expect.any(String),
    undefined,
    "comment-one",
    { body: "Changed" },
  );
  expect(response.threads[0].comments[0].body).toBe("Body one");
  stop();
});

it("preserves real optimistic API identifiers and immutable command results for reply, resolve, delete and reactions", async () => {
  const { ctx, api, studioCtx: sc } = await fixture();
  const initial = ctx.store.getState();
  const one = ensure(initial.threadsById.get(toOpaque("one")), "Thread");
  const reply = ctx.postThreadComment(one.id, { body: "Reply" });
  expect(api.postThreadComment).toHaveBeenCalledWith(
    sc.siteInfo.id,
    undefined,
    one.id,
    { id: reply.id, body: "Reply" },
  );
  expect(one.comments).toHaveLength(1);
  expect(ctx.store.getState().threadsById.get(one.id)?.comments).toHaveLength(
    2,
  );
  const history = ctx.editThread(one.id, true);
  expect(api.editThread).toHaveBeenCalledWith(
    sc.siteInfo.id,
    undefined,
    one.id,
    { id: history.id, resolved: true },
  );
  expect(
    ctx.store.getState().resolvedThreads.map((thread) => thread.id),
  ).toEqual([one.id]);
  ctx.deleteComment(reply.id);
  expect(api.deleteComment).toHaveBeenCalledWith(
    sc.siteInfo.id,
    undefined,
    reply.id,
  );
  expect(
    ctx.store.getState().threadsById.get(one.id)?.comments[1].deletedAt,
  ).toBeTruthy();
  const reaction = ctx.addReactionToComment(one.comments[0].id, {
    emojiName: "1f44d",
  });
  expect(api.addReactionToComment).toHaveBeenCalledWith(
    reaction.id,
    sc.siteInfo.id,
    undefined,
    one.comments[0].id,
    { emojiName: "1f44d" },
  );
  ctx.removeReactionFromComment(reaction.id);
  expect(api.removeReactionFromComment).toHaveBeenCalledWith(
    sc.siteInfo.id,
    undefined,
    reaction.id,
  );
  expect(ctx.store.getState().reactionsByCommentId.size).toBe(0);
  const root = ctx.postRootComment({
    body: "New thread",
    location: one.location,
  });
  expect(api.postRootComment).toHaveBeenCalledWith(sc.siteInfo.id, undefined, {
    body: "New thread",
    location: one.location,
    commentThreadId: root.id,
    commentId: root.comments[0].id,
  });
  expect(ctx.store.getState().allThreads[0].id).toBe(root.id);
});

it("synchronizes labels and ownership through real commits, undo and redo without publishing style edits", async () => {
  const { ctx, studioCtx: sc, subject, page } = await fixture();
  const initial = ctx.store.getState();
  await sc.changeUnsafe(() => {
    subject.name = "Review target";
  });
  expect(ctx.store.getState().allThreads[0].label).toBe("Review target");
  expect(ctx.store.getState().commentStatsBySubject).toBe(
    initial.commentStatsBySubject,
  );
  await sc.undo();
  expect(ctx.store.getState().allThreads[0].label).toBe(
    initial.allThreads[0].label,
  );
  await sc.redo();
  expect(ctx.store.getState().allThreads[0].label).toBe("Review target");
  await sc.changeUnsafe(() => {
    page.name = "Renamed page";
  });
  expect(
    ctx.store.getState().allThreads[0].subjectInfo?.ownerComponentName,
  ).toBe("Renamed page");
  const snapshot = ctx.store.getState();
  if (!isTplTag(subject)) {
    throw new Error("Expected tag root");
  }
  await sc.changeUnsafe(() => {
    subject.vsettings[0].rs.values.color = "red";
  });
  expect(ctx.store.getState()).toBe(snapshot);
  await sc.changeUnsafe(() => {
    sc.site.flags = { ...sc.site.flags, unrelatedCommentFlag: true };
  });
  expect(ctx.store.getState()).toBe(snapshot);
});

it("keeps interaction bookkeeping out of immutable dialog snapshots and publishes only actual dialog changes", async () => {
  const { ctx, subject } = await fixture();
  const viewCtx = mock<ViewCtx>();
  ctx.openNewCommentDialog(viewCtx, subject);
  const opened = ensure(ctx.openedNewThread(), "New thread");
  const snapshot = ctx.dialogStore.getState();
  const publish = vi.fn();
  const stop = ctx.dialogStore.subscribe(publish);
  ctx.markDialogInteracted(opened);
  ctx.maybeCloseCommentDialogs();
  expect(ctx.dialogStore.getState()).toBe(snapshot);
  expect(publish).not.toHaveBeenCalled();
  ctx.handleOpenCommentThreadDialog(toOpaque("one"), viewCtx);
  expect(ctx.openedNewThread()).toBeUndefined();
  const thread = ensure(ctx.openedThread(), "Open thread");
  ctx.markDialogInteracted(thread);
  for (let i = 0; i < 100; i++) {
    ctx.handleOpenCommentThreadDialog(toOpaque("one"), viewCtx);
  }
  expect(ctx.openedThread()).toBe(thread);
  expect(ctx.hasDialogInteraction(thread)).toBe(false);
  expect(publish).toHaveBeenCalledOnce();
  stop();
});

it("deduplicates requests and ignores an obsolete branch result and completions after disposal", async () => {
  const { ctx, api, response, studioCtx: sc } = await fixture();
  let finishOld: (response: GetCommentsResponse) => void = () => undefined;
  api.getComments.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishOld = resolve;
      }),
  );
  const old = ctx.fetchComments();
  expect(ctx.fetchComments()).toBe(old);
  const branch = mock<ApiBranch>({ id: toOpaque("branch-next") });
  sc.dbCtx().setSite(sc.site, branch, undefined);
  api.getComments.mockResolvedValueOnce({ ...response, threads: [] });
  await ctx.fetchComments();
  finishOld(response);
  await old;
  expect(ctx.store.getState().allThreads).toEqual([]);
  let finish: (response: GetCommentsResponse) => void = () => undefined;
  api.getComments.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = ctx.fetchComments();
  const snapshot = ctx.store.getState();
  const request = ctx.requestStore.getState();
  ctx.dispose();
  finish(response);
  await pending;
  expect(ctx.store.getState()).toBe(snapshot);
  expect(ctx.requestStore.getState()).toBe(request);
});

it("releases StrictMode subscriptions and replaces the owner without receiving old editor updates", async () => {
  const first = await fixture();
  const second = await fixture();
  const native = first.ctx.store.subscribe;
  const subscribe = vi.spyOn(first.ctx.store, "subscribe");
  let active = 0;
  subscribe.mockImplementation((listener) => {
    active++;
    const stop = native(listener);
    return () => {
      active--;
      stop();
    };
  });
  function Consumer({ ctx }: { ctx: CommentsCtx }) {
    const body = useStore(
      ctx.store,
      (state) => state.threadsById.get(toOpaque("one"))?.comments[0].body,
    );
    return <output>{body}</output>;
  }
  const view = render(
    <React.StrictMode>
      <Consumer ctx={first.ctx} />
    </React.StrictMode>,
  );
  expect(active).toBe(1);
  view.rerender(
    <React.StrictMode>
      <Consumer ctx={second.ctx} />
    </React.StrictMode>,
  );
  expect(active).toBe(0);
  await act(() =>
    first.ctx.editComment(toOpaque("comment-one"), "Obsolete editor"),
  );
  expect(screen.getByRole("status").textContent).toBe("Body one");
  view.unmount();
  expect(active).toBe(0);
});

it("recovers optimistic failures by refetching server data and keeps the error visible to the handler", async () => {
  const { ctx, api } = await fixture();
  const error = new Error("Offline");
  api.editComment.mockRejectedValueOnce(error);
  ctx.editComment(toOpaque("comment-one"), "Optimistic");
  expect(
    ctx.store.getState().threadsById.get(toOpaque("one"))?.comments[0].body,
  ).toBe("Optimistic");
  await vi.waitFor(() =>
    expect(
      ctx.store.getState().threadsById.get(toOpaque("one"))?.comments[0].body,
    ).toBe("Body one"),
  );
  expect(reportError).toHaveBeenCalledWith(error);
});

it("updates deleted variant metadata and restores it on undo while preserving the comment API data", async () => {
  const { ctx, studioCtx: sc, page, subject, response, api } = await fixture();
  const variant = mkVariant({ name: "Hover", selectors: ["hover"] });
  await sc.changeUnsafe(() => {
    page.variants.push(variant);
  });
  sc.bundler().bundle(sc.site, sc.siteInfo.id, sc.appCtx.lastBundleVersion);
  const address = ensure(sc.bundler().addrOf(variant), "Variant address");
  const updated = {
    ...response,
    threads: response.threads.map((thread) => ({
      ...thread,
      location: { ...thread.location, variants: [address] },
    })),
  };
  api.getComments.mockResolvedValue(updated);
  await ctx.fetchComments();
  expect(ctx.store.getState().allThreads[0].subjectInfo?.variants).toEqual([
    variant,
  ]);
  const initialKey = getSubjectVariantsKey(subject, [variant]);
  const initialStats = ctx.store.getState().commentStatsByVariant;
  await sc.changeUnsafe(() => {
    variant.selectors = ["focus"];
  });
  const nextKey = getSubjectVariantsKey(subject, [variant]);
  expect(nextKey).not.toBe(initialKey);
  expect(ctx.store.getState().commentStatsByVariant.has(initialKey)).toBe(
    false,
  );
  expect(
    ctx.store.getState().commentStatsByVariant.get(nextKey)?.commentCount,
  ).toBe(2);
  expect(initialStats.has(initialKey)).toBe(true);
  sc.createViewStateUndoRecord();
  await sc.changeUnsafe(() => {
    page.variants.splice(page.variants.indexOf(variant), 1);
  });
  expect(ctx.store.getState().allThreads[0].label).toBe("Deleted variant");
  expect(ctx.store.getState().commentStatsBySubject.size).toBe(0);
  await sc.undo();
  expect(ctx.store.getState().allThreads[0].subjectInfo?.variants).toEqual([
    variant,
  ]);
  expect(ctx.store.getState().commentStatsBySubject.size).toBe(1);
  expect(updated.threads[0].location.variants).toEqual([address]);
});

it("keeps another variant frame idle when a comment is edited, and updates its own replies", async () => {
  const { ctx, studioCtx: sc, page, response, api } = await fixture();
  const variant = mkVariant({ name: "Hover", selectors: ["hover"] });
  await sc.changeUnsafe(() => {
    page.variants.push(variant);
  });
  sc.bundler().bundle(sc.site, sc.siteInfo.id, sc.appCtx.lastBundleVersion);
  const address = ensure(sc.bundler().addrOf(variant), "Variant address");
  api.getComments.mockResolvedValue({
    ...response,
    threads: [
      {
        ...response.threads[0],
        location: { ...response.threads[0].location, variants: [address] },
      },
      response.threads[1],
    ],
  });
  await ctx.fetchComments();
  const key = getCommentFrameKey(page, []);
  const commits = vi.fn();
  function Markers() {
    const threads = useStore(ctx.store, (state) =>
      state.unresolvedThreadsByFrame.get(key),
    );
    return (
      <React.Profiler id="frame" onRender={commits}>
        <output>
          {threads
            ?.map((thread) => `${thread.id}:${thread.comments.length}`)
            .join(",")}
        </output>
      </React.Profiler>
    );
  }
  render(<Markers />);
  commits.mockClear();
  await act(() => ctx.editComment(toOpaque("comment-one"), "Another variant"));
  expect(commits).not.toHaveBeenCalled();
  expect(screen.getByRole("status").textContent).toBe("two:1");
  await act(() =>
    ctx.postThreadComment(toOpaque("two"), { body: "Own frame reply" }),
  );
  expect(commits).toHaveBeenCalledOnce();
  expect(screen.getByRole("status").textContent).toBe("two:2");
});

it("marks deleted owner components as deleted locations and restores their metadata on undo", async () => {
  const { ctx, studioCtx: sc, page } = await fixture();
  const initial = ctx.store.getState();
  await sc.changeUnsafe(() => sc.siteOps().tryRemoveComponent(page));
  expect(ctx.store.getState().allThreads[0].subjectInfo).toBeUndefined();
  expect(ctx.store.getState().allThreads[0].label).toBe("Deleted element");
  expect(ctx.store.getState().commentStatsByComponent.size).toBe(0);
  await sc.undo();
  expect(ctx.store.getState().allThreads[0].subjectInfo?.ownerComponent).toBe(
    page,
  );
  expect(ctx.store.getState().allThreads[0].label).toBe(
    initial.allThreads[0].label,
  );
});
