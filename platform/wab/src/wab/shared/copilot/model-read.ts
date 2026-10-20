import { z } from "zod";
import { isDynamicValue } from "@/wab/shared/dynamic-bindings";

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

/** Public registration data only; never evaluate metadata callbacks or serialize controls. */
export function registrationContract(value: unknown, seen = new Set<object>()): Record<string, unknown> | undefined {
  if (typeof value === "string") { return { type: value }; }
  if (!value || typeof value !== "object" || seen.has(value)) { return undefined; }
  const meta = value as Record<string, unknown>;
  if (typeof meta.type !== "string") { return undefined; }
  seen.add(value);
  const result: Record<string, unknown> = { type: meta.type };
  for (const key of ["displayName", "description", "required", "min", "max", "step", "editOnly", "uncontrolledProp"]) {
    if (["string", "boolean", "number"].includes(typeof meta[key])) { result[key] = meta[key]; }
  }
  if (Array.isArray(meta.argTypes)) { result.args = meta.argTypes.map((arg) => ({ name: arg.name, ...registrationContract(arg.type, seen) })); }
  else if (Array.isArray(meta.argNames)) { result.args = meta.argNames.map((name) => ({ name, type: "any" })); }
  else if (Array.isArray(meta.renderPropParams)) { result.args = meta.renderPropParams.map((name) => ({ name, type: "any" })); }
  if (meta.fields && typeof meta.fields === "object") { result.fields = Object.fromEntries(Object.entries(meta.fields).map(([name, type]) => [name, registrationContract(type, seen)]).filter(([, type]) => type)); }
  if (meta.itemType) { result.itemType = registrationContract(meta.itemType, seen); }
  if (Array.isArray(meta.allowedComponents)) { result.allowedComponents = meta.allowedComponents; }
  if (typeof meta.options === "function") { result.optionsDynamic = true; }
  else if (Array.isArray(meta.options)) { result.options = meta.options.map((option) => typeof option === "object" && option !== null ? { value: option.value, label: option.label } : option); }
  seen.delete(value);
  return result;
}

export function withRegisteredContracts(props: Record<string, unknown>[], metadata: Record<string, unknown>) {
  return props.map((prop) => {
    prop = { ...prop };
    const registration = registrationContract(metadata[String(prop.name)]);
    if (registration) {
      if (registration.optionsDynamic) { delete prop.options; }
      for (const key of ["description", "args", "options"]) {
        if (registration[key] !== undefined && JSON.stringify(registration[key]) === JSON.stringify(prop[key])) { delete registration[key]; }
      }
      if (prop.options !== undefined && registration.options !== undefined) { delete registration.options; }
    }
    return registration ? { ...prop, registration } : prop;
  });
}

/** Validate only declared registration shapes; never execute component metadata. */
export function validateRegisteredValue(value: unknown, metadata: unknown, path: string): string | undefined {
  const contract = registrationContract(metadata);
  if (!contract || typeof value === "string" && isDynamicValue(value)) { return undefined; }
  if (value === undefined || value === null) { return contract.required ? `${path} is required` : undefined; }
  if (contract.itemType) {
    if (!Array.isArray(value)) { return `${path} expects an array`; }
    for (const [i, item] of value.entries()) {
      const error = validateRegisteredValue(item, contract.itemType, `${path}[${i}]`);
      if (error) { return error; }
    }
  } else if (contract.fields && typeof contract.fields === "object") {
    if (typeof value !== "object" || Array.isArray(value)) { return `${path} expects an object`; }
    for (const [name, field] of Object.entries(contract.fields)) {
      const error = validateRegisteredValue((value as Record<string, unknown>)[name], field, `${path}.${name}`);
      if (error) { return error; }
    }
  } else if (["string", "number", "boolean"].includes(String(contract.type)) && typeof value !== contract.type) {
    return `${path} expects a ${contract.type}`;
  } else if (contract.type === "function" && typeof value !== "function") {
    return `${path} expects a function binding`;
  } else if (contract.type === "choice" && Array.isArray(contract.options)
    && !contract.options.some((option) => (typeof option === "object" && option !== null ? option.value : option) === value)) {
    return `${path} must be one of ${JSON.stringify(contract.options)}`;
  }
  return undefined;
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
