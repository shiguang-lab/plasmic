import type { JsonValue } from "@/wab/shared/core/lang";
import { tokenTypes } from "@/wab/commons/StyleToken";
import {
  interactionActionSchema,
  NORMAL_STATE_VARIABLE_TYPES,
} from "@/wab/shared/core/states";
import {
  outputResultSchema,
  readResultSchema,
} from "@/wab/shared/web-exporter/schema";
import { z } from "zod";

const jsonValue: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonValue),
    z.record(jsonValue),
  ]),
);
const uuid = z.string().min(1);
const resources = outputResultSchema(readResultSchema());
const element = { componentUuid: uuid, elementUuid: uuid };

/** Wire contracts shared by the browser bridge and host-frame implementations. */
export const PROTOTYPE_TOOL_META = {
  identify: {
    toolName: "identify",
    title: "Identify AI session",
    description:
      "Start a prototype session; returns project identity and edit permissions. Call before other tools.",
    inputSchema: z
      .object({
        model: uuid,
        client: uuid,
        skill: uuid,
        outputFormat: z.enum(["json", "xml"]).default("json"),
      })
      .strict(),
    outputSchema: z.object({
      projectId: uuid,
      projectName: z.string(),
      canEdit: z.boolean(),
      model: uuid,
      client: uuid,
      skill: uuid,
      outputFormat: z.enum(["json", "xml"]),
    }),
  },
  read: {
    toolName: "read",
    title: "Read project resources",
    description:
      "Discover installed components, exact component names/UUIDs, props, slots, tokens and screen breakpoints. Defaults to project overview. Request component UUIDs for full prop contracts and editable HTML, or elements for subtrees. Imported components can be read but not edited.",
    inputSchema: z
      .object({
        componentUuids: z.array(uuid).max(30).optional(),
        elements: z.array(z.object(element).strict()).max(30).optional(),
      })
      .strict(),
    outputSchema: resources,
  },
  createComponent: {
    toolName: "createComponent",
    title: "Create page or reusable component",
    description:
      "Create an editable empty page/component. Then insertHtml into its root. Names and page paths must be unique; existing designs are never overwritten.",
    inputSchema: z
      .object({
        name: uuid,
        type: z.enum(["page", "component"]).default("page"),
        path: z
          .string()
          .regex(/^\/(?!\/)/)
          .optional(),
      })
      .strict(),
    outputSchema: resources,
  },
  insertHtml: {
    toolName: "insertHtml",
    title: "Insert editable prototype markup",
    description:
      'Convert HTML/CSS and <plasmic-component data-plasmic-component="exact registered name" data-plasmic-project="imported project ID" data-props=\'JSON\'> into editable canvas elements. Use <slot name="children">...</slot> for component slots. Read contracts first. CSS @media must match existing breakpoints. Defaults to append to root; replace requires an explicit elementUuid. Any import error rolls back the entire call.',
    inputSchema: z
      .object({
        componentUuid: uuid,
        elementUuid: uuid.optional(),
        html: z.string().min(1).max(200000),
        location: z
          .enum(["before", "after", "prepend", "append", "replace"])
          .default("append"),
      })
      .strict(),
    outputSchema: resources,
  },
  changeElement: {
    toolName: "changeElement",
    title: "Change component props or layout",
    description:
      "Modify an existing element in a local page/component. Props are validated against its registered contract. styles uses CSS property names (null removes a style); variantUuids selects existing component/global variants. Rejected props roll back the entire call. For text or slot content use insertHtml replace on that text element or its slot child.",
    inputSchema: z
      .object({
        ...element,
        props: z.record(jsonValue).optional(),
        styles: z.record(z.string().nullable()).optional(),
        variantUuids: z.array(uuid).optional(),
      })
      .strict(),
    outputSchema: resources,
  },
  deleteElement: {
    toolName: "deleteElement",
    title: "Delete an element",
    description:
      "Remove an element from a local component using Studio's reference checks. Root elements cannot be deleted. Changes are undoable.",
    inputSchema: z.object(element).strict(),
    outputSchema: resources,
  },
  createState: {
    toolName: "createState",
    title: "Create prototype state",
    description:
      "Add private page/component state for interactive prototypes. Bind props with {{ $state.name }} and use createInteraction to change it. Returns the component including state contracts.",
    inputSchema: z
      .object({
        componentUuid: uuid,
        name: uuid,
        variableType: z.enum(NORMAL_STATE_VARIABLE_TYPES),
        initialValue: jsonValue.optional(),
      })
      .strict(),
    outputSchema: resources,
  },
  createInteraction: {
    toolName: "createInteraction",
    title: "Add a prototype interaction",
    description:
      "Append an action to a DOM/component event using validated event names and state references. Supports updateVariable, updateVariant and customFunction. For navigation prefer the registered href prop. Read the element and component contract first.",
    inputSchema: z
      .object({
        ...element,
        eventName: uuid,
        name: uuid,
        action: interactionActionSchema(),
      })
      .strict(),
    outputSchema: resources,
  },
  createStyleToken: {
    toolName: "createStyleToken",
    title: "Create a design token",
    description:
      "Create a reusable CSS design token. Use its returned UUID in var(--token-UUID).",
    inputSchema: z
      .object({ name: uuid, type: z.enum(tokenTypes), value: uuid })
      .strict(),
    outputSchema: resources,
  },
  navigate: {
    toolName: "navigate",
    title: "Show a page/component on the canvas",
    description:
      "Open the local component's arena for visual review and screenshots.",
    inputSchema: z.object({ componentUuid: uuid }).strict(),
    outputSchema: resources,
  },
  validate: {
    toolName: "validate",
    title: "Validate prototype structure",
    description:
      "Check model invariants and return prototype metrics and warnings. This checks structural validity, not visual quality; review screenshots at desktop and mobile widths as well.",
    inputSchema: z
      .object({ componentUuids: z.array(uuid).optional() })
      .strict(),
    outputSchema: z.object({
      valid: z.boolean(),
      errors: z.array(z.string()),
      warnings: z.array(z.string()),
      pages: z.number(),
      components: z.number(),
      codeComponentInstances: z.number(),
      antDesign6Instances: z.number(),
    }),
  },
  save: {
    toolName: "save",
    title: "Save prototype",
    description:
      "Validate invariants, save the current project revision, and confirm no changes remain unsaved. Returns the persisted revision. Does not publish or deploy the prototype.",
    inputSchema: z.object({}).strict(),
    outputSchema: z.object({
      projectId: uuid,
      revision: z.number(),
      saved: z.literal(true),
    }),
  },
  undo: {
    toolName: "undo",
    title: "Undo the last editor change",
    description:
      "Undo one editor transaction. Read the changed page and save afterwards if the result is desired.",
    inputSchema: z.object({}).strict(),
    outputSchema: z.object({ undone: z.boolean() }),
  },
};
