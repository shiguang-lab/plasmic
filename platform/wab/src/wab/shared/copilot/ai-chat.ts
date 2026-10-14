import type {
  LocalEditBinding,
  LocalEditToolResult,
} from "@/wab/shared/copilot/local-edit";
import {
  localAiAttachmentsSchema,
  localEditBindingSchema,
} from "@/wab/shared/copilot/local-edit";
import { z } from "zod";

export type AiAttachment = {
  id: string;
  name: string;
  mediaType: string;
  size: number;
  sha256: string;
};
export type AiMessagePart =
  | {
      type: "markdown";
      channel: "user" | "commentary" | "answer";
      text: string;
      step?: number;
      complete?: boolean;
    }
  | { type: "reasoning"; text: string; step: number; complete: boolean }
  | { type: "attachment"; attachment: AiAttachment }
  | {
      type: "node";
      uuid: string;
      name: string;
      page: string | null;
      branch: string | null;
    }
  | { type: "tool"; operationId: string; name: string; status: string }
  | { type: "change"; operationId: string; name: string }
  | { type: "result"; status: string; text: string; revision?: number };
export type EditRecord = {
  id: string;
  name: string;
  input: Record<string, unknown>;
  before: string;
  after: string;
  binding: LocalEditBinding;
  undoBinding?: LocalEditBinding;
  undone?: boolean;
};
export type AiTask = {
  id: string;
  seq?: number;
  authorId: string;
  authorName?: string;
  createdAt: string;
  designRevision?: number;
  nodes?: {
    uuid: string;
    name: string;
    page: string | null;
    branch: string | null;
  }[];
  prompt: string;
  model?: string;
  files: AiAttachment[];
  parts: AiMessagePart[];
  status: "running" | "completed" | "stopped" | "failed";
  phase: string;
  messages: string[];
  records: EditRecord[];
  binding: LocalEditBinding;
  error?: string;
  savedRevision?: number;
  scopeLabel?: string;
  needsReconciliation?: boolean;
  operations: {
    id: string;
    name: string;
    status: "running" | "completed" | "failed";
    title?: string;
    target?: string;
    retryOf?: string;
    recoveredBy?: string;
    errorSummary?: string;
    error?: string;
  }[];
};
export type AiEventUpdate = {
  baseSeq: number;
  fields: Partial<
    Pick<
      AiTask,
      | "status"
      | "phase"
      | "error"
      | "binding"
      | "savedRevision"
      | "scopeLabel"
      | "needsReconciliation"
    >
  >;
  appendParts: AiMessagePart[];
  textDeltas: { index: number; text: string }[];
  replaceParts: { index: number; part: AiMessagePart }[];
  appendRecords: EditRecord[];
  replaceRecords: EditRecord[];
  operations: AiTask["operations"];
};
export type AiEventPayload = {
  runId: string;
  task?: AiTask;
  update?: AiEventUpdate;
};
export type AiEvent = { projectId: string; seq: number } & AiEventPayload;

/** The event and its read model are one transaction; applying a delta requires its base. */
export function applyAiEvent(
  task: AiTask | undefined,
  event: AiEvent,
): AiTask | undefined {
  if (task && (task.seq ?? 0) >= event.seq) {
    return task;
  }
  if (event.task) {
    return { ...event.task, seq: event.seq };
  }
  const update = event.update;
  if (!task || !update || (task.seq ?? 0) !== update.baseSeq) {
    return undefined;
  }
  const parts = task.parts.map((part) => ({ ...part }));
  for (const delta of update.textDeltas) {
    const part = parts[delta.index];
    if (part?.type !== "markdown" && part?.type !== "reasoning") {
      return undefined;
    }
    part.text += delta.text;
  }
  for (const replacement of update.replaceParts) {
    parts[replacement.index] = replacement.part;
  }
  parts.push(...update.appendParts);
  const records = task.records.map(
    (record) =>
      update.replaceRecords.find((next) => next.id === record.id) ?? record,
  );
  records.push(...update.appendRecords);
  const operations = task.operations.map(
    (operation) =>
      update.operations.find((next) => next.id === operation.id) ?? operation,
  );
  operations.push(
    ...update.operations.filter(
      (next) => !task.operations.some((operation) => operation.id === next.id),
    ),
  );
  return {
    ...task,
    ...update.fields,
    seq: event.seq,
    parts,
    records,
    operations,
    messages: parts
      .filter((part) => part.type === "markdown")
      .map((part) => part.text),
  };
}
export type AiToolCall = {
  id: string;
  runId: string;
  name: string;
  input: Record<string, unknown>;
  binding: LocalEditBinding;
  status: "pending" | "executing" | "completed" | "failed";
  fence: number;
  sessionId?: string;
  result?: LocalEditToolResult;
  error?: string;
  uncertain?: boolean;
};
export const aiContextMetadataSchema = z
  .object({
    revision: z.number().int().nonnegative().optional(),
    componentName: z.string().max(500).nullable().optional(),
    path: z
      .array(
        z
          .object({ elementUuid: z.string(), label: z.string().max(500) })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();
export const aiSendSchema = z
  .object({
    clientRequestId: z.string().uuid(),
    prompt: z.string().trim().min(1).max(10000),
    binding: localEditBindingSchema,
    model: z.string().min(1).max(200).optional(),
    target: z
      .union([
        z.literal("auto"),
        z
          .object({
            name: z.string().min(1).max(100),
            path: z.string().max(200),
          })
          .strict(),
      ])
      .optional(),
    context: z
      .string()
      .max(600000)
      .refine((value) => {
        try {
          return aiContextMetadataSchema.safeParse(JSON.parse(value)).success;
        } catch {
          return false;
        }
      }),
    attachments: localAiAttachmentsSchema.default([]),
  })
  .strict();
export type AiSend = z.infer<typeof aiSendSchema>;
export const aiClaimSchema = z
  .object({ sessionId: z.string().min(1).max(200) })
  .strict();
export const aiHeartbeatSchema = z
  .object({
    sessionId: z.string().min(1).max(200),
    fence: z.number().int().positive(),
  })
  .strict();
export const aiReceiptSchema = z
  .object({
    sessionId: z.string().min(1).max(200),
    fence: z.number().int().positive(),
    result: z
      .object({
        result: z.string().max(600000),
        binding: localEditBindingSchema,
        changed: z.boolean(),
        before: z.string().max(600000).optional(),
        after: z.string().max(600000).optional(),
      })
      .strict()
      .optional(),
    error: z.string().max(2000).optional(),
    uncertain: z.boolean().optional(),
  })
  .strict()
  .refine((r) => !!r.result !== !!r.error);
export const aiReconcileSchema = z
  .object({
    binding: localEditBindingSchema,
    revision: z.number().int().nonnegative(),
  })
  .strict();
