import { z } from "zod";

export const componentReviewContextSchema = z.object({
  purpose: z.string().min(1).max(500).regex(/\S/).describe("The user-facing purpose of this entire edit or batch, including required behavior and explicit constraints in natural language. Prefer concise English functional wording for retrieval against English component contracts; preserve UI labels and user quotes. Good: 'Switch customer information panels on the same page, keeping selection and content synchronized without route navigation'. Bad: 'Update UI', 'Add divs', 'Use Tabs'. For visual-only edits, describe the existing region and visual change. Do not invent requirements or provide code, IDs, operation mappings or reasoning."),
  customOnly: z.boolean().optional().describe("Pass true only when the user explicitly requires implementing this functionality yourself without existing registered components; otherwise pass false. For a batch, this must apply to all affected functionality. Omission means false."),
}).strict().describe("Required for design mutations, including visual-only edits. Provide one purpose for the whole call; the editor derives affected regions from actual operations and receipts. Component suggestions are advisory; custom UI remains allowed.");
export type ComponentReviewContext = z.infer<typeof componentReviewContextSchema>;

export const componentSuggestionSchema = z.object({
  componentUuid: z.string(), elementUuid: z.string(), intent: z.string(),
  candidates: z.array(z.object({
    componentUuid: z.string(), name: z.string(), fromProject: z.string(), version: z.string(),
    description: z.string(), score: z.number(), matchedBy: z.array(z.enum(["keyword", "embedding"])),
    keywordCoverage: z.number().min(0).max(1), matchedTerms: z.array(z.string()).max(10),
    contract: z.object({ props: z.array(z.string()), slots: z.array(z.string()), events: z.array(z.string()), parent: z.string().optional() }),
    unknowns: z.array(z.string()),
  })).min(1).max(3),
  guidance: z.string(),
});
export const componentReviewResultSchema = z.object({
  status: z.enum(["completed", "partial", "timeout", "unavailable", "skipped", "cancelled"]),
  indexed: z.number().int().nonnegative(), total: z.number().int().nonnegative(), elapsedMs: z.number().nonnegative(),
  suggestions: z.array(componentSuggestionSchema).max(5),
  skippedRegions: z.array(z.object({ componentUuid: z.string().optional(), elementUuid: z.string().optional(), reason: z.enum(["user-choice-agent-reported", "component-owned-or-presentation", "already-reviewed", "target-unresolved"]) })).max(5).optional(),
});
export type ComponentReviewResult = z.infer<typeof componentReviewResultSchema>;

export interface ReviewComponentDocument {
  componentUuid: string; name: string; fromProject: string; version: string;
  description: string; sections: string[];
  props: string[]; slots: string[]; events: string[]; parent?: string;
}

/** Canonical retrieval text, shared with the build-time public-library vector seeds. */
export function describeReviewRegistration(meta: { name: string; displayName?: string; description?: string; parentComponentName?: string; props: Record<string, unknown> }) {
  const props: string[] = []; const slots: string[] = []; const events: string[] = []; const lines: string[] = [];
  for (const name of Object.keys(meta.props).sort()) {
    if (["className", "style", "ref", "key"].includes(name)) continue;
    const value = meta.props[name];
    const control = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const kind = typeof value === "string" ? value : typeof control.type === "string" ? control.type : "prop";
    (kind === "slot" ? slots : kind === "eventHandler" ? events : props).push(name);
    lines.push(`${name}: ${kind}${typeof control.description === "string" ? " — " + control.description : ""}`);
    if (Array.isArray(control.argTypes)) lines.push("Event arguments: " + control.argTypes.map(arg => `${arg.name}: ${typeof arg.type === "string" ? arg.type : arg.type?.type ?? "value"}`).join(", "));
    if (Array.isArray(control.allowedComponents)) lines.push("Allowed children: " + control.allowedComponents.filter(item => typeof item === "string").join(", "));
  }
  return { description: meta.description ?? "", props, slots, events,
    ...(meta.parentComponentName ? { parent: meta.parentComponentName } : {}),
    sections: [[meta.displayName ?? meta.name, meta.description, meta.parentComponentName ? "Requires parent: " + meta.parentComponentName : ""].filter(Boolean).join("\n"), lines.join("\n")].filter(Boolean) };
}
export interface ReviewRegion {
  componentUuid: string; elementUuid: string; intent: string;
  usedComponentUuids: string[]; facts: string[];
}

export type ComponentReuseCommand =
  | { command: "status" }
  | { command: "sync"; projectId: string; documents: ReviewComponentDocument[]; unavailable: number }
  | { command: "review"; projectId: string; id: string; regions: ReviewRegion[] }
  | { command: "cancel"; id: string }
  | { command: "activity" }
  | { command: "release"; projectId: string };
