import { z } from "zod";

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
  "executeBatch",
] as const;
export const pageEditToolNames = [
  ...localEditToolNames,
  "createState",
  "updateState",
  "deleteState",
  "createInteraction",
  "copyElement",
  "moveElement",
  "setPageViewport",
] as const;
export function localEditLimits(binding: LocalEditBinding) {
  return binding.mode === "page"
    ? { steps: 48, taskMs: 720000 }
    : { steps: 12, taskMs: 180000 };
}
export const localEditCallSchema = z
  .object({
    id: z.string().min(1),
    name: z.enum(pageEditToolNames),
    input: z.record(z.unknown()),
  })
  .strict();
export type LocalEditCall = z.infer<typeof localEditCallSchema>;
export const localEditStepSchema = z
  .object({
    text: z.string().max(30000),
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
    history: z.array(localEditStepSchema).max(48),
  })
  .strict();
export type LocalEditRequest = z.infer<typeof localEditRequestSchema>;
export type LocalEditResponse = { text: string; calls: LocalEditCall[] };
export type LocalEditToolResult = {
  result: string;
  binding: LocalEditBinding;
  changed: boolean;
  before?: string;
  after?: string;
};
