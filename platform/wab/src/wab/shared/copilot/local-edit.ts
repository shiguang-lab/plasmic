import { z } from "zod";

export const localAiAttachmentSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("text"),
      name: z.string().min(1).max(255),
      text: z.string().min(1).max(100000),
    })
    .strict(),
  z
    .object({
      type: z.literal("file"),
      name: z.string().min(1).max(255),
      mediaType: z.enum([
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/webp",
      ]),
      data: z
        .string()
        .min(4)
        .max(14000000)
        .regex(
          /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,
        ),
    })
    .strict(),
]);
export type LocalAiAttachment = z.infer<typeof localAiAttachmentSchema>;
export const LOCAL_AI_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const localAiAttachmentsSchema = z
  .array(localAiAttachmentSchema)
  .max(5)
  .refine(
    (attachments) =>
      attachments.reduce(
        (size, attachment) =>
          size +
          (attachment.type === "file"
            ? (attachment.data.length * 3) / 4 -
              (attachment.data.endsWith("==")
                ? 2
                : attachment.data.endsWith("=")
                  ? 1
                  : 0)
            : new TextEncoder().encode(attachment.text).length),
        0,
      ) <= LOCAL_AI_ATTACHMENT_MAX_BYTES,
  );

export const localAiStatusSchema = z.object({
  configured: z.boolean(),
  model: z.string().nullable(),
  models: z.array(z.string().min(1).max(200)),
  pageGenerationEnabled: z.boolean(),
});
export type LocalAiStatus = z.infer<typeof localAiStatusSchema>;

export const localAiIntentRequestSchema = z
  .object({
    prompt: z.string().trim().min(1).max(10000),
    hasCurrentPage: z.boolean(),
    model: z.string().min(1).max(200).optional(),
  })
  .strict();
export const localAiIntentSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("edit") }).strict(),
  z
    .object({
      mode: z.literal("page"),
      name: z
        .string()
        .max(100)
        .regex(/^[A-Z][A-Za-z0-9]*$/),
      path: z
        .string()
        .max(200)
        .regex(/^\/[A-Za-z0-9/_-]*$/),
    })
    .strict(),
]);
export type LocalAiIntent = z.infer<typeof localAiIntentSchema>;
export type LocalAiIntentRequest = z.infer<typeof localAiIntentRequestSchema>;

export const localEditBindingSchema = z
  .object({
    projectId: z.string().min(1),
    branchId: z.string().nullable(),
    sessionId: z.string().min(1),
    changeCounter: z.number().int().nonnegative(),
    componentUuid: z.string().min(1).nullable(),
    mode: z.enum(["page"]).optional(),
    frameUuid: z.string().nullable().optional(),
    elementUuids: z.array(z.string().min(1)).max(30),
  })
  .strict();
export type LocalEditBinding = z.infer<typeof localEditBindingSchema>;
export const localEditToolNames = [
  "read",
  "queryElements",
  "getEditorContext",
  "selectElement",
  "scrollElementIntoView",
  "changeElement",
  "insertHtml",
  "deleteElement",
  "copyElement",
  "moveElement",
  "createInteraction",
  "updateInteraction",
  "deleteInteraction",
  "executeBatch",
  "createState",
  "updateState",
  "deleteState",
  "setPageViewport",
] as const;
export const componentEditToolNames = [
  "createState",
  "updateState",
  "deleteState",
  "setPageViewport",
] as const;
export function localEditTools(binding: LocalEditBinding) {
  return localEditToolNames.filter(
    (name) =>
      !binding.elementUuids.length ||
      !componentEditToolNames.some((componentTool) => componentTool === name),
  );
}
export function localEditLimits(binding: LocalEditBinding) {
  return binding.elementUuids.length
    ? { steps: 12, taskMs: 180000 }
    : { steps: 48, taskMs: 720000 };
}
export const localEditCallSchema = z
  .object({
    id: z.string().min(1),
    name: z.enum(localEditToolNames),
    input: z.record(z.unknown()),
    thoughtSignature: z.string().optional(),
    retryOf: z.string().min(1).optional(),
  })
  .strict();
export type LocalEditCall = z.infer<typeof localEditCallSchema>;
export const localEditStepSchema = z
  .object({
    text: z.string().max(30000),
    reasoning: z.string().max(30000).optional(),
    calls: z.array(localEditCallSchema).max(10),
    results: z
      .array(
        z.object({ id: z.string(), output: z.string().max(600000) }).strict(),
      )
      .max(10),
  })
  .strict();
export type LocalEditStep = z.infer<typeof localEditStepSchema>;
export const localEditRequestSchema = z
  .object({
    binding: localEditBindingSchema,
    prompt: z.string().trim().min(1).max(10000),
    resources: z.string().max(600000),
    model: z.string().min(1).max(200).optional(),
    history: z.array(localEditStepSchema).max(48),
    attachments: localAiAttachmentsSchema.optional(),
  })
  .strict();
export type LocalEditRequest = z.infer<typeof localEditRequestSchema>;
export type LocalEditResponse = {
  text: string;
  reasoning?: string;
  calls: LocalEditCall[];
};
export type LocalAiStreamPart = {
  type: "markdown" | "reasoning";
  text: string;
  complete: boolean;
};
export type LocalEditToolResult = {
  result: string;
  binding: LocalEditBinding;
  changed: boolean;
  before?: string;
  after?: string;
};

/** One unsent request shared by the canvas entry and assistant panel. */
export interface LocalAiDraft {
  prompt: string;
  attachments: LocalAiAttachment[];
}

/** Editor-owned selection context; AI input state stays in the top frame. */
export interface LocalAiContext {
  scope?: string;
  binding?: LocalEditBinding;
}
