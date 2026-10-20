import { z } from "zod";

const fullReadFields = [
  "__type", "uuid", "name", "type", "componentUuid", "rootElementUuid",
  "tag", "registeredComponentUuid", "description", "pageMeta", "fromProject",
  "codeComponent", "refActions", "props", "variants", "variantGroups", "states",
  "dataQueries", "legacyDataQueries", "baseVariantTplTree", "variantSettings",
  "interactions", "id", "components", "canvases", "pageFrames", "devicePresets",
  "screenBreakpoints", "tokens", "dataTokens", "globalVariantGroups", "importedProjects", "dataQueryFunctions",
] as const;
export const readFields = z.enum([...fullReadFields, "tree", "children", "slots", "editable", "source", "properties", "styles", "attributes", "text"]);
export const modelReadOptions = {
  view: z.enum(["tree", "properties", "contract", "context", "full"]).default("tree"),
  depth: z.union([z.number().int().nonnegative(), z.literal("all")]).optional(),
  fields: z.array(readFields).min(1).optional(),
  propNames: z.array(z.string().min(1)).min(1).optional().describe("Instance property names to read; requires view:properties. Omitted properties are not empty."),
};
export type ModelReadOptions = {
  view: "tree" | "properties" | "contract" | "context" | "full";
  depth?: number | "all";
  fields?: z.infer<typeof readFields>[];
  propNames?: string[];
};
export function selectedReadFields(options: ModelReadOptions) {
  if (options.fields) {
    return options.fields;
  }
  const identity = ["__type", "uuid", "name", "type", "componentUuid", "rootElementUuid"];
  switch (options.view) {
    case "full": return [...fullReadFields];
    case "tree": return [...identity, "tag", "registeredComponentUuid", "tree", "children", "slots", "editable", "source"];
    case "properties": return [...identity, "tag", "registeredComponentUuid", "properties", ...(options.propNames ? [] : ["styles", "attributes", "text"]), "editable", "source"];
    case "contract": return [...identity.filter((field) => field !== "rootElementUuid"), "description", "fromProject", "props", "refActions", "variants", "variantGroups"];
    case "context": return [...identity, "pageMeta", "states", "interactions", "dataQueries", "legacyDataQueries", "variantSettings"];
  }
}
export function readDepth(options: ModelReadOptions) {
  return options.depth === "all" || (options.depth === undefined && options.view === "full")
    ? Infinity : options.depth ?? 0;
}
export function projectReadFields(resource: Record<string, unknown>, options: ModelReadOptions) {
  const selected = Object.fromEntries(selectedReadFields(options)
    .filter((field) => field in resource)
    .map((field) => [field, resource[field]]));
  if (options.view === "contract" && Array.isArray(selected.props)) {
    selected.props = selected.props.map(({ uuid, __type, ...contract }) => contract);
  }
  if (options.view === "context" && Array.isArray(selected.legacyDataQueries)) {
    selected.legacyDataQueries = selected.legacyDataQueries.map(({ migratable, migrationBlockers, ...query }) => query);
  }
  return selected;
}

export const modelReadResultSchema = z.object({
  __type: z.literal("OutputResult"),
  results: z.array(z.record(z.unknown())),
  // A partial model must never be mistaken for evidence of absent content.
  read: z.object({ fields: z.array(z.string()), depth: z.union([z.number(), z.literal("all")]),
    propNames: z.array(z.string()).optional(),
    itemFields: z.array(z.string()).optional(), itemDepth: z.union([z.number(), z.literal("all")]).optional() }),
  total: z.number().optional(),
  nextOffset: z.number().optional(),
});

export const projectCollections = z.enum(["components", "canvases", "pageFrames", "devicePresets", "screenBreakpoints", "tokens", "dataTokens", "globalVariantGroups", "importedProjects"]);
