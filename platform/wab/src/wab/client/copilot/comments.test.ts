import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { COPILOT_TOOLS } from "@/wab/client/copilot";
import { toOpaque } from "@/wab/commons/types";
import { ApiCommentThread, GetCommentsResponse } from "@/wab/shared/ApiSchema";
import { ensure } from "@/wab/shared/common";
import { COMMENT_TOOL_META } from "@/wab/shared/copilot/comment-tools";
import { ComponentType } from "@/wab/shared/core/components";

async function fixture() {
  const f = fakeStudioCtx();
  const sc = f.studioCtx;
  await vi.waitFor(() => expect(sc.initialRouteReady).toBe(true));
  const page = await sc.changeUnsafe(() => sc.addComponent("Comments", { type: ComponentType.Page }));
  sc.bundler().bundle(sc.site, sc.siteInfo.id, f.appCtx.lastBundleVersion);
  const addr = ensure(sc.bundler().addrOf(page.tplTree), "Subject address");
  const common = { createdAt: "2026-11-10T00:00:00.000Z", updatedAt: "2026-11-10T00:00:00.000Z", deletedAt: null, createdById: "self", updatedById: "self", deletedById: null };
  const thread: ApiCommentThread = { ...common, id: toOpaque("thread"), location: { subject: addr, variants: [] }, resolved: false, comments: [{ ...common, id: toOpaque("comment"), commentThreadId: toOpaque("thread"), body: "Original" }], commentThreadHistories: [] };
  const response: GetCommentsResponse = { threads: [thread], users: [{ id: toOpaque("self"), displayName: "Reviewer", email: "self@example.com", emailVerified: true, loginName: "reviewer", state: "active" }], reactions: [] };
  f.api.getComments.mockImplementation(async () => response);
  f.api.postRootComment.mockImplementation(async (_project, _branch, data) => {
    response.threads.unshift({ ...common, id: data.commentThreadId, location: data.location, resolved: false, comments: [{ ...common, id: data.commentId, commentThreadId: data.commentThreadId, body: data.body }], commentThreadHistories: [] });
    return {};
  });
  f.api.postThreadComment.mockImplementation(async (_project, _branch, id, data) => {
    ensure(response.threads.find(t => t.id === id), "Thread").comments.push({ ...common, id: data.id, commentThreadId: id, body: data.body }); return {};
  });
  f.api.editComment.mockImplementation(async (_project, _branch, id, data) => { ensure(response.threads.flatMap(t => t.comments).find(c => c.id === id), "Comment").body = data.body; return {}; });
  f.api.deleteComment.mockImplementation(async (_project, _branch, id) => { const comment = ensure(response.threads.flatMap(t => t.comments).find(c => c.id === id), "Comment"); comment.deletedAt = common.createdAt; return {}; });
  f.api.deleteThread.mockImplementation(async (_project, _branch, id) => { response.threads = response.threads.filter(t => t.id !== id); return {}; });
  f.api.editThread.mockImplementation(async (_project, _branch, id, data) => { ensure(response.threads.find(t => t.id === id), "Thread").resolved = data.resolved; return {}; });
  vi.spyOn(sc, "showComments").mockReturnValue(true);
  await sc.commentsCtx.fetchComments();
  const call = async (name: keyof typeof COMMENT_TOOL_META, input: Record<string, unknown> = {}, signal?: AbortSignal) => JSON.parse(await ensure(COPILOT_TOOLS[name], "Registered tool").execute(sc, input, { outputFormat: "json", signal }));
  return { ...f, sc, page, thread, response, call };
}

afterEach(() => vi.restoreAllMocks());

it("persists the whole comment lifecycle through registered tools and updates the native panel without changing the design/view", async () => {
  const f = await fixture();
  const arena = f.sc.currentArena, selection = f.sc.focusedViewCtx();
  const model = f.sc.bundler().bundle(f.sc.site, f.sc.siteInfo.id, f.appCtx.lastBundleVersion);
  const added = await f.call("addComment", { componentUuid: f.page.uuid, body: "  Review this  " });
  expect(f.api.postRootComment).toHaveBeenCalledWith(f.sc.siteInfo.id, undefined, expect.objectContaining({ body: "Review this", location: { subject: f.thread.location.subject, variants: [] } }));
  const reply = await f.call("replyToComment", { threadId: added.threadId, body: "Reply" });
  await f.call("editComment", { commentId: reply.commentId, body: "Changed reply" });
  expect((await f.call("readComments", { threadId: added.threadId })).threads[0].comments[1].body).toBe("Changed reply");
  expect(f.sc.commentsCtx.store.getState().threadsById.get(added.threadId)?.comments[1].body).toBe("Changed reply");
  for (const resolved of [true, false]) {
    expect(await f.call("setCommentThreadResolved", { threadId: added.threadId, resolved })).toMatchObject({ threadId: added.threadId, resolved });
    expect((await f.call("readComments", { resolved })).threads.some((t: any) => t.id === added.threadId)).toBe(true);
  }
  await f.call("deleteComment", { commentId: reply.commentId });
  expect((await f.call("readComments", { threadId: added.threadId })).threads[0].comments[1].deleted).toBe(true);
  await f.call("deleteCommentThread", { threadId: added.threadId });
  expect((await f.call("readComments", { threadId: added.threadId })).total).toBe(0);
  expect(f.sc.currentArena).toBe(arena); expect(f.sc.focusedViewCtx()).toBe(selection);
  expect(f.sc.bundler().bundle(f.sc.site, f.sc.siteInfo.id, f.appCtx.lastBundleVersion)).toEqual(model);
  f.sc.dispose();
});

it("reads fresh paged branch-scoped data even without a visible comment panel", async () => {
  const f = await fixture();
  vi.mocked(f.sc.showComments).mockReturnValue(false);
  vi.spyOn(f.sc.commentsCtx, "branchId").mockReturnValue(toOpaque("branch"));
  f.response.threads.push({ ...f.thread, id: toOpaque("second"), resolved: true });
  const page = await f.call("readComments", { componentUuid: f.page.uuid, limit: 1 });
  expect(page).toMatchObject({ branchId: "branch", total: 2, nextOffset: 1, authors: [{ id: "self", displayName: "Reviewer" }] });
  expect((await f.call("readComments", { offset: page.nextOffset, limit: 1 })).threads[0].id).toBe("second");
  expect(f.api.getComments).toHaveBeenLastCalledWith(f.sc.siteInfo.id, "branch");
  expect((await f.call("readComments", { componentUuid: f.page.uuid, elementUuid: f.page.tplTree.uuid })).total).toBe(2);
  f.sc.dispose();
});

it("waits for persistence and surfaces native permission errors without optimistic success", async () => {
  const f = await fixture();
  let reject!: (error: Error) => void;
  f.api.editComment.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
  let finished = false;
  const operation = f.call("editComment", { commentId: "comment", body: "Forbidden" }).finally(() => { finished = true; });
  const rejected = expect(operation).rejects.toThrow("Can only do this for self");
  await vi.waitFor(() => expect(f.api.editComment).toHaveBeenCalled());
  expect(finished).toBe(false);
  expect(f.thread.comments[0].body).toBe("Original");
  reject(new Error("Can only do this for self"));
  await rejected;
  f.sc.dispose();
});

it("rejects cross-project/branch IDs, empty bodies, foreign targets and cancellation before sending mutations", async () => {
  const f = await fixture();
  for (const [name, input] of [
    ["editComment", { commentId: "foreign", body: "Changed" }],
    ["deleteComment", { commentId: "foreign" }],
    ["replyToComment", { threadId: "foreign", body: "Reply" }],
    ["setCommentThreadResolved", { threadId: "foreign", resolved: true }],
    ["addComment", { componentUuid: "foreign", body: "New" }],
    ["addComment", { componentUuid: f.page.uuid, body: "   " }],
    ["readComments", { elementUuid: f.page.tplTree.uuid }],
  ] as const) { await expect(f.call(name, input)).rejects.toThrow(); }
  const cancelled = new AbortController(); cancelled.abort();
  await expect(f.call("deleteComment", { commentId: "comment" }, cancelled.signal)).rejects.toThrow();
  for (const api of [f.api.editComment, f.api.deleteComment, f.api.postThreadComment, f.api.editThread, f.api.postRootComment]) { expect(api).not.toHaveBeenCalled(); }
  f.sc.dispose();
});

it("does not post on save failure or after the branch changes during a pending read", async () => {
  const f = await fixture();
  const address = vi.spyOn(f.sc.bundler(), "addrOf").mockReturnValue(undefined);
  const save = vi.spyOn(f.sc, "save").mockRejectedValue(new Error("Save failed"));
  await expect(f.call("addComment", { componentUuid: f.page.uuid, body: "New" })).rejects.toThrow("Save failed");
  expect(f.api.postRootComment).not.toHaveBeenCalled();
  address.mockRestore(); save.mockRestore();
  let release!: (response: GetCommentsResponse) => void;
  f.api.getComments.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  const call = f.call("deleteComment", { commentId: "comment" });
  const rejected = expect(call).rejects.toThrow("project/branch changed");
  await vi.waitFor(() => expect(release).toBeTypeOf("function"));
  vi.spyOn(f.sc.commentsCtx, "branchId").mockReturnValue(toOpaque("another-branch"));
  release(f.response); await rejected;
  expect(f.api.deleteComment).not.toHaveBeenCalled();
  f.sc.dispose();
});

it("refreshes the native panel after a pre-mutation comment read finishes", async () => {
  const f = await fixture();
  let release!: (response: GetCommentsResponse) => void;
  f.api.getComments.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  const pending = f.sc.commentsCtx.fetchComments();
  const old = JSON.parse(JSON.stringify(f.response));
  const operation = f.call("editComment", { commentId: "comment", body: "Persisted" });
  await vi.waitFor(() => expect(f.api.editComment).toHaveBeenCalled());
  release(old); await pending; await operation;
  expect(f.sc.commentsCtx.store.getState().threadsById.get(f.thread.id)?.comments[0].body).toBe("Persisted");
  f.sc.dispose();
});
