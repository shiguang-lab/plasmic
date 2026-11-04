import { z } from "zod";

/** Tool feedback about the live editor, never part of a saved design. */
export const toolPresentationSchema = z.object({
  componentUuid: z.string(),
  elementUuid: z.string(),
  frameUuid: z.string().optional(),
  phase: z.enum(["before", "after"]).optional(),
  visible: z.boolean(),
  reason: z.string(),
  message: z.string(),
});

export type ToolPresentation = z.infer<typeof toolPresentationSchema>;
