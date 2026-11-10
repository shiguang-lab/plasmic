import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { getCommentThreadWithModelMetadata } from "@/wab/client/components/comments/utils";
import { toOpaque } from "@/wab/commons/types";
import { type CommentId, type CommentThreadId, type ThreadHistoryId } from "@/wab/shared/ApiSchema";
import { assert, ensure, mkShortUuid, mkUuid } from "@/wab/shared/common";
import { COMMENT_TOOL_META as meta } from "@/wab/shared/copilot/comment-tools";
import { defineCopilotTool } from "@/wab/shared/copilot/copilot-tool-types";
import { allComponentVariants } from "@/wab/shared/core/components";
import { allGlobalVariants } from "@/wab/shared/core/sites";
import { flattenTpls, isTplNamable } from "@/wab/shared/core/tpls";

function scope(studio: StudioCtx, signal?: AbortSignal) {
  const api = studio.appCtx.api;
  const projectId = studio.commentsCtx.projectId();
  const branchId = studio.commentsCtx.branchId();
  const check = () => {
    signal?.throwIfAborted();
    assert(studio.commentsCtx.projectId() === projectId && studio.commentsCtx.branchId() === branchId, "Comment project/branch changed; read the current comments before retrying");
  };
  const read = async () => {
    check();
    const response = await api.getComments(projectId, branchId);
    check();
    return { ...response, threads: response.threads.filter(thread => !thread.deletedAt) };
  };
  const refresh = async () => {
    // The server also broadcasts commentsUpdate; keep the open native panel fresh.
    // This refresh uses Studio's own error handling and never reports a committed write as failed.
    if (studio.commentsCtx.projectId() === projectId && studio.commentsCtx.branchId() === branchId) {
      await studio.commentsCtx.refreshComments();
    }
  };
  return { api, projectId, branchId, check, read, refresh, receipt: { projectId, branchId: branchId ?? null } };
}

function component(studio: StudioCtx, uuid: string) {
  return ensure(studio.site.components.find(candidate => candidate.uuid === uuid), `Local comment component ${uuid} not found`);
}
const date = (value: Date | string) => new Date(value).toISOString();
const identity = (value: { createdAt: Date | string; updatedAt: Date | string; createdById: string | null }) => ({ createdAt: date(value.createdAt), updatedAt: date(value.updatedAt), authorId: value.createdById });

export const COMMENT_TOOLS = {
  readComments: defineCopilotTool(meta.readComments, async (studio, input, _caller, signal) => {
    assert(!input.elementUuid || input.componentUuid, "elementUuid requires componentUuid");
    const ctx = scope(studio, signal);
    const owner = input.componentUuid ? component(studio, input.componentUuid) : undefined;
    const nodes = owner ? flattenTpls(owner.tplTree) : undefined;
    if (input.elementUuid) { assert(nodes?.some(node => node.uuid === input.elementUuid), "Comment element not found in component"); }
    const response = await ctx.read();
    const threads = response.threads.map(thread => getCommentThreadWithModelMetadata(studio, studio.bundler(), thread)).filter(thread =>
      (!input.threadId || thread.id === input.threadId) && (input.resolved === undefined || thread.resolved === input.resolved) &&
      (!owner || thread.subjectInfo?.ownerComponent === owner && (!input.elementUuid || thread.subjectInfo.subject.uuid === input.elementUuid)));
    const page = threads.slice(input.offset, input.offset + input.limit);
    const authors = new Set(page.flatMap(thread => [thread.createdById, ...thread.comments.map(comment => comment.createdById)]));
    return { ...ctx.receipt, authors: response.users.filter(user => authors.has(user.id)).map(user => ({ id: user.id, displayName: user.displayName })), total: threads.length, ...(input.offset + page.length < threads.length ? { nextOffset: input.offset + page.length } : {}), threads: page.map(thread => ({
      id: thread.id, resolved: thread.resolved, ...identity(thread), location: thread.location,
      target: thread.subjectInfo ? { componentUuid: thread.subjectInfo.ownerComponent.uuid, elementUuid: thread.subjectInfo.subject.uuid, variantUuids: thread.subjectInfo.variants?.map(variant => variant.uuid) ?? null } : null,
      comments: thread.comments.map(comment => ({ id: comment.id, body: comment.body, ...identity(comment), deleted: !!comment.deletedAt })),
    })) };
  }),
  addComment: defineCopilotTool(meta.addComment, async (studio, input, _caller, signal) => {
    const ctx = scope(studio, signal);
    await ctx.read(); // Enforce native comment access before any required design save.
    const owner = component(studio, input.componentUuid);
    const subject = input.elementUuid ? ensure(flattenTpls(owner.tplTree).find(node => node.uuid === input.elementUuid), "Comment element not found in component") : owner.tplTree;
    assert(isTplNamable(subject), "Comments require a native element or component instance, not a slot");
    const available = [...allComponentVariants(owner), ...allGlobalVariants(studio.site, { includeDeps: "direct", excludeInactiveScreenVariants: true })];
    const variants = input.variantUuids.map(uuid => ensure(available.find(variant => variant.uuid === uuid), `Comment variant ${uuid} not found`));
    const bundler = studio.bundler();
    if ([subject, ...variants].some(node => !bundler.addrOf(node))) {
      await studio.save({ noErrorNotification: true });
      assert(!studio.hasUnsavedChanges(), "Comment subject could not be saved; no comment was posted");
      ctx.check();
    }
    const location = { subject: ensure(bundler.addrOf(subject), "Comment subject has no saved address"), variants: variants.map(variant => ensure(bundler.addrOf(variant), "Comment variant has no saved address")) };
    const threadId = mkShortUuid<CommentThreadId>();
    const commentId = mkShortUuid<CommentId>();
    ctx.check();
    await ctx.api.postRootComment(ctx.projectId, ctx.branchId, { commentThreadId: threadId, commentId, body: input.body, location });
    await ctx.refresh();
    return { ...ctx.receipt, threadId, commentId };
  }),
  replyToComment: defineCopilotTool(meta.replyToComment, async (studio, input, _caller, signal) => {
    const ctx = scope(studio, signal);
    const thread = ensure((await ctx.read()).threads.find(thread => thread.id === input.threadId), "Comment thread not found in current project/branch");
    const commentId = mkShortUuid<CommentId>();
    ctx.check();
    await ctx.api.postThreadComment(ctx.projectId, ctx.branchId, thread.id, { id: commentId, body: input.body });
    await ctx.refresh();
    return { ...ctx.receipt, threadId: thread.id, commentId };
  }),
  editComment: defineCopilotTool(meta.editComment, async (studio, input, _caller, signal) => {
    const ctx = scope(studio, signal);
    const thread = ensure((await ctx.read()).threads.find(thread => thread.comments.some(comment => comment.id === input.commentId && !comment.deletedAt)), "Comment not found in current project/branch");
    ctx.check();
    await ctx.api.editComment(ctx.projectId, ctx.branchId, toOpaque(input.commentId), { body: input.body });
    await ctx.refresh();
    return { ...ctx.receipt, threadId: thread.id, commentId: input.commentId };
  }),
  deleteComment: defineCopilotTool(meta.deleteComment, async (studio, input, _caller, signal) => {
    const ctx = scope(studio, signal);
    const thread = ensure((await ctx.read()).threads.find(thread => thread.comments.some(comment => comment.id === input.commentId && !comment.deletedAt)), "Comment not found in current project/branch");
    ctx.check();
    await ctx.api.deleteComment(ctx.projectId, ctx.branchId, input.commentId);
    await ctx.refresh();
    return { ...ctx.receipt, threadId: thread.id, commentId: input.commentId };
  }),
  deleteCommentThread: defineCopilotTool(meta.deleteCommentThread, async (studio, input, _caller, signal) => {
    const ctx = scope(studio, signal);
    const thread = ensure((await ctx.read()).threads.find(thread => thread.id === input.threadId), "Comment thread not found in current project/branch");
    ctx.check();
    await ctx.api.deleteThread(ctx.projectId, ctx.branchId, thread.id);
    await ctx.refresh();
    return { ...ctx.receipt, threadId: thread.id };
  }),
  setCommentThreadResolved: defineCopilotTool(meta.setCommentThreadResolved, async (studio, input, _caller, signal) => {
    const ctx = scope(studio, signal);
    const thread = ensure((await ctx.read()).threads.find(thread => thread.id === input.threadId), "Comment thread not found in current project/branch");
    ctx.check();
    await ctx.api.editThread(ctx.projectId, ctx.branchId, thread.id, { id: mkUuid<ThreadHistoryId>(), resolved: input.resolved });
    await ctx.refresh();
    return { ...ctx.receipt, threadId: thread.id, resolved: input.resolved };
  }),
};
