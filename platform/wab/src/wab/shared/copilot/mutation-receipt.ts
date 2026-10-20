import { assert, ensure } from "@/wab/shared/common";
import { z } from "zod";

export const mutationIdentitySchema = z.object({
  kind: z.string(), uuid: z.string(), name: z.string().optional(),
  componentUuid: z.string().optional(), rootElementUuid: z.string().optional(),
});
export type MutationIdentity = z.infer<typeof mutationIdentitySchema>;
export const mutationReceiptSchema = z.object({
  name: z.string(), as: z.string().optional(),
  created: z.array(mutationIdentitySchema),
  componentUuid: z.string().optional(), elementUuid: z.string().optional(),
  messages: z.array(z.string()).optional(),
});
export type MutationReceipt = z.infer<typeof mutationReceiptSchema>;

/** Resolve explicit identity fields only, never business text, code, HTML or props. */
export function resolveBatchInput(input: Record<string, unknown>, bindings: Map<string, MutationReceipt>) {
  const resolve = (value: unknown): unknown => {
    if (Array.isArray(value)) { return value.map(resolve); }
    if (typeof value !== "string" || !value.startsWith("$")) { return value; }
    const match = /^\$([A-Za-z][A-Za-z0-9_]*)(?:\.(root|\d+))?$/.exec(value);
    assert(match, `Invalid batch reference ${value}`);
    const receipt = ensure(bindings.get(match[1]), `Unknown or forward batch reference ${value}`);
    const identity = ensure(receipt.created[match[2] && match[2] !== "root" ? Number(match[2]) : 0], `No created resource for ${value}`);
    return match[2] === "root" ? ensure(identity.rootElementUuid, `No root element for ${value}`) : identity.uuid;
  };
  const visit = (object: Record<string, unknown>): Record<string, unknown> => Object.fromEntries(
    Object.entries(object).map(([key, value]) => [key,
      /(?:Uuid|Uuids)$/.test(key) || key === "canvasName" ? resolve(value)
      : key === "action" && value && typeof value === "object" && !Array.isArray(value)
        ? visit(value as Record<string, unknown>) : value]),
  );
  return visit(input);
}
