import { z } from "zod";
import { getLocalAiConfig } from "@/wab/server/copilot/local-edit";
import type { Request, Response } from "express-serve-static-core";
import { attachmentContent, claimTool, createRun, events, getRun, history, patchTask, receipt, heartbeatTool, reconcileRun, prepareUndo } from "@/wab/server/copilot/ai-store";
import { getUser, userDbMgr } from "@/wab/server/routes/util";
import { BadRequestError, ForbiddenError } from "@/wab/shared/ApiErrors/errors";
import { aiClaimSchema, aiReceiptSchema, aiSendSchema, aiHeartbeatSchema, aiReconcileSchema } from "@/wab/shared/copilot/ai-chat";
import { aiThreadPatchSchema } from "@/wab/shared/copilot/ai-chat";
import { getThread, listThreads, patchThread } from "@/wab/server/copilot/ai-threads";

async function authorize(req: Request, edit = false) {
  const user = getUser(req);
  if (!req.devflags.enableLocalAiEditing) { throw new ForbiddenError("Local AI editing is disabled."); }
  await userDbMgr(req).checkProjectPerms(req.params.projectId,edit ? "editor" : "viewer",edit ? "edit with AI" : "read AI history");
  return user.id;
}
export async function aiChatHistory(req: Request,res: Response) {
  await authorize(req);
  const before = req.query.before;
  if (before !== undefined && (!z.string().uuid().safeParse(before).success)) { throw new BadRequestError("Invalid history cursor."); }
  const threadId = req.query.threadId;
  if (threadId !== undefined && !z.string().uuid().safeParse(threadId).success) { throw new BadRequestError("Invalid conversation."); }
  res.json(await history(req.params.projectId,typeof before === "string" ? before : undefined, typeof threadId === "string" ? threadId : undefined));
}
export async function aiChatThreads(req: Request, res: Response) {
  await authorize(req);
  const parsed = z.object({branchId:z.string().max(200).optional(),archived:z.enum(["0","1"]).optional(),query:z.string().max(200).optional(),before:z.string().min(1).max(500).optional()}).strict().safeParse(req.query);
  if (!parsed.success) { throw new BadRequestError("Invalid conversation query."); }
  res.json(await listThreads(req.params.projectId, parsed.data.branchId || null, parsed.data.archived === "1", parsed.data.query, parsed.data.before));
}
export async function aiChatThread(req: Request, res: Response) {
  await authorize(req);
  if (!z.string().uuid().safeParse(req.params.threadId).success) { throw new BadRequestError("Invalid conversation."); }
  res.json(await getThread(req.params.projectId, req.params.threadId));
}
export async function aiChatPatchThread(req: Request, res: Response) {
  await authorize(req, true);
  const parsed = aiThreadPatchSchema.safeParse(req.body);
  if (!parsed.success || !z.string().uuid().safeParse(req.params.threadId).success) { throw new BadRequestError("Invalid conversation update."); }
  res.json(await patchThread(req.params.projectId, req.params.threadId, parsed.data));
}
export async function aiChatRunSnapshot(req: Request,res: Response) {
  await authorize(req);
  const run = await getRun(req.params.runId);
  if (run.projectId !== req.params.projectId) { throw new ForbiddenError("Run is not accessible."); }
  res.json(run.task);
}
export async function aiChatEvents(req: Request,res: Response) {
  await authorize(req);
  const after = Number(req.query.afterSeq ?? 0);
  if (!Number.isSafeInteger(after) || after < 0) { throw new BadRequestError("Invalid event cursor."); }
  res.json(await events(req.params.projectId,after));
}
export async function aiChatSend(req: Request,res: Response) {
  const author = await authorize(req,true);
  const parsed = aiSendSchema.safeParse(req.body);
  if (!parsed.success || parsed.data.binding.projectId !== req.params.projectId) { throw new BadRequestError("Invalid AI request."); }
  if (parsed.data.target && !req.devflags.enableLocalAiPageGeneration) { throw new ForbiddenError("AI page generation is disabled."); }
  res.json(await createRun(req.params.projectId,author,{ ...parsed.data, model: parsed.data.model ?? getLocalAiConfig()?.model },getUser(req).displayName));
}
export async function aiChatClaim(req: Request,res: Response) {
  const author = await authorize(req,true);
  const parsed = aiClaimSchema.safeParse(req.body);
  if (!parsed.success) { throw new BadRequestError("Invalid editor session."); }
  res.json({ call: await claimTool(req.params.projectId,author,parsed.data.sessionId) });
}
export async function aiChatReceipt(req: Request,res: Response) {
  const author = await authorize(req,true);
  const parsed = aiReceiptSchema.safeParse(req.body);
  if (!parsed.success) { throw new BadRequestError("Invalid tool receipt."); }
  res.json(await receipt(req.params.projectId,author,req.params.operationId,parsed.data));
}
export async function aiChatHeartbeat(req: Request,res: Response) {
  const author = await authorize(req,true);
  const parsed = aiHeartbeatSchema.safeParse(req.body);
  if (!parsed.success) { throw new BadRequestError("Invalid execution lease."); }
  await heartbeatTool(req.params.projectId,author,req.params.operationId,parsed.data);
  res.json({});
}
export async function aiChatStop(req: Request,res: Response) {
  const author = await authorize(req,true);
  const run = await getRun(req.params.runId);
  if (run.projectId !== req.params.projectId || run.authorId !== author) { throw new ForbiddenError("Only the run initiator can stop it."); }
  const [unknown] = await req.con.query(`SELECT id FROM ai_tool_call WHERE "runId"=$1 AND (call->>'uncertain'='true' OR (call->>'status'='executing' AND call->>'name' NOT IN ('read','queryElements','getEditorContext','selectElement','scrollElementIntoView','navigate','validate','save'))) LIMIT 1`,[run.id]);
  res.json(await patchTask(run.id,{ status: "stopped", phase: "Stopped",needsReconciliation:run.task.needsReconciliation || !!unknown }));
}
export async function aiChatReconcile(req: Request,res: Response) {
  const author = await authorize(req,true);
  const parsed = aiReconcileSchema.safeParse(req.body);
  if (!parsed.success) { throw new BadRequestError("Invalid design verification."); }
  res.json(await reconcileRun(req.params.projectId,author,req.params.runId,parsed.data.binding,parsed.data.revision));
}
export async function aiChatUndo(req: Request,res: Response) {
  const author = await authorize(req,true);
  const parsed = z.object({recordId:z.string().min(1),clientRequestId:z.string().uuid()}).strict().safeParse(req.body);
  if (!parsed.success) { throw new BadRequestError("Invalid undo request."); }
  res.json(await prepareUndo(req.params.projectId,author,req.params.runId,parsed.data.recordId,parsed.data.clientRequestId));
}
export async function aiChatAttachment(req: Request,res: Response) {
  await authorize(req);
  const { metadata,content } = await attachmentContent(req.params.projectId,req.params.attachmentId,req.query.preview === "1");
  res.setHeader("Cache-Control","private, no-store");
  res.setHeader("X-Content-Type-Options","nosniff");
  res.setHeader("Content-Type",metadata.mediaType);
  res.setHeader("Content-Disposition",`${metadata.mediaType.startsWith("image/") ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(metadata.name)}`);
  res.send(content);
}
