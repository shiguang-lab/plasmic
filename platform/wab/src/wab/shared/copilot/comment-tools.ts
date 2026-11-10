import { z } from "zod";

const id = z.string().min(1);
const body = z.string().trim().min(1);
const addr = z.object({ uuid: id, iid: id });
const receipt = z.object({ projectId: id, branchId: id.nullable(), threadId: id, commentId: id.optional() });
const identity = { createdAt: z.string(), updatedAt: z.string(), authorId: z.string().nullable() };

/** Comments use the existing server persistence/permissions, outside design undo. */
export const COMMENT_TOOL_META = {
  readComments: {
    toolName: "readComments", title: "Read comment threads",
    description: "Read persisted comments in the current project and branch, including resolved threads and deleted-comment markers. Filter by threadId, resolved or a local component/element UUID. componentUuid includes comments on all its nodes; elementUuid requires componentUuid. Follow nextOffset. Returned node UUIDs can be used by addComment; location retains Studio's native model addresses. Requires existing comment access; does not select, navigate, save or change comment filters.",
    inputSchema: z.object({ threadId: id.optional(), componentUuid: id.optional(), elementUuid: id.optional(), resolved: z.boolean().optional(), offset: z.number().int().nonnegative().default(0), limit: z.number().int().min(1).max(100).default(30) }).strict(),
    outputSchema: z.object({ projectId: id, branchId: id.nullable(), authors: z.array(z.object({ id, displayName: z.string() })), total: z.number().int(), nextOffset: z.number().int().optional(), threads: z.array(z.object({ id, resolved: z.boolean(), ...identity, location: z.object({ subject: addr, variants: z.array(addr) }), target: z.object({ componentUuid: id, elementUuid: id, variantUuids: z.array(id).nullable() }).nullable(), comments: z.array(z.object({ id, body: z.string(), ...identity, deleted: z.boolean() })) })) }),
  },
  addComment: {
    toolName: "addComment", title: "Add a comment thread",
    description: "Post a new persisted comment on a local component/element in the current project and branch as the signed-in Studio user. elementUuid defaults to the component root; variantUuids defaults to the base view (no pinned variants). Uses Studio's native location addresses; if the new subject/variants have no saved address, saves the current design first, like Studio's comment composer. Does not navigate or select. Returns IDs only after server success; no separate save is required for comments. Existing commenter permissions apply. Not part of execute_batch or design undo.",
    inputSchema: z.object({ componentUuid: id, elementUuid: id.optional(), variantUuids: z.array(id).default([]), body }).strict(), outputSchema: receipt,
  },
  replyToComment: {
    toolName: "replyToComment", title: "Reply to a comment thread",
    description: "Post a persisted reply to threadId in the current project and branch as the signed-in Studio user. Read thread IDs with readComments. Awaits server persistence; existing comment permissions apply. Does not change the thread's resolved state or design; not part of execute_batch.",
    inputSchema: z.object({ threadId: id, body }).strict(), outputSchema: receipt,
  },
  editComment: {
    toolName: "editComment", title: "Edit a comment",
    description: "Edit the body of an existing non-deleted comment in the current project and branch. Read commentId with readComments. Awaits the existing Studio API and enforces server author/project permissions. Does not edit a design or belong to execute_batch.",
    inputSchema: z.object({ commentId: id, body }).strict(), outputSchema: receipt,
  },
  deleteComment: {
    toolName: "deleteComment", title: "Delete a comment",
    description: "Delete a single non-deleted comment in the current project and branch through Studio's API. Existing ownership/editor permissions and soft-deletion behavior apply. Deleting the last remaining comment also removes its thread. Awaits server success; this is outside design undo and execute_batch.",
    inputSchema: z.object({ commentId: id }).strict(), outputSchema: receipt,
  },
  deleteCommentThread: {
    toolName: "deleteCommentThread", title: "Delete a comment thread",
    description: "Delete an entire comment thread in the current project and branch through Studio's existing API, with its ownership/editor permissions. Awaits server success; outside design undo and execute_batch.",
    inputSchema: z.object({ threadId: id }).strict(), outputSchema: receipt,
  },
  setCommentThreadResolved: {
    toolName: "setCommentThreadResolved", title: "Resolve or reopen a comment thread",
    description: "Set resolved:true to resolve a thread or resolved:false to reopen it in the current project and branch. Uses Studio's existing thread history and server permissions; awaits persistence. Does not change comment bodies, the design, selection or comment filters. Not part of execute_batch.",
    inputSchema: z.object({ threadId: id, resolved: z.boolean() }).strict(), outputSchema: receipt.extend({ resolved: z.boolean() }),
  },
};
