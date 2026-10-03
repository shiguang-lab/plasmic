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
const EDIT_TOOL_META = {
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
  installLibrary: {
    toolName: "installLibrary",
    title: "Install a published component library",
    description: "Install a library through Studio dependency operations and load its component registrations. Requires full edit permission. Save separately and read the installed contracts before inserting components.",
    inputSchema: z.object({ projectId: uuid }).strict(),
    outputSchema: z.object({ projectId: uuid, version: uuid, installed: z.boolean() }),
  },
  upgradeLibrary: {
    toolName: "upgradeLibrary",
    title: "Upgrade an installed component library",
    description: "Upgrade an already installed library to its latest published package through Studio dependency operations. Keeps local pages and rewrites their references. Requires an editable project; save separately and read the new component contracts before use.",
    inputSchema: z.object({ projectId: uuid }).strict(),
    outputSchema: z.object({ projectId: uuid, previousVersion: uuid, version: uuid, upgraded: z.boolean() }),
  },
  queryElements: {
    toolName: "queryElements",
    title: "Find editable elements by their contract",
    description:
      "Search a component subtree by element name, native tag or registered component UUID. Returns editable subtree resources with stable UUIDs; no private model scripting is required.",
    inputSchema: z
      .object({
        componentUuid: uuid,
        elementUuid: uuid.optional(),
        nameContains: uuid.optional(),
        tag: z
          .string()
          .regex(/^[a-z][a-z0-9-]*$/)
          .optional(),
        registeredComponentUuid: uuid.optional(),
        limit: z.number().int().min(1).max(50).default(20),
      })
      .strict(),
    outputSchema: resources,
  },
  createCanvas: {
    toolName: "createCanvas",
    title: "Create a freeform canvas",
    description:
      "Create a native mixed arena for arranging multiple component/page artboards. The unique canvas name is its native identity.",
    inputSchema: z.object({ name: uuid }).strict(),
    outputSchema: resources,
  },
  createArtboard: {
    toolName: "createArtboard",
    title: "Place an artboard on a freeform canvas",
    description:
      "Add an existing local page/component at a viewport size. Defaults to non-overlapping placement; x/y supply explicit canvas coordinates. Studio normalizes all artboards to a nonnegative origin; read returned canvas positions after insertion.",
    inputSchema: z
      .object({
        canvasName: uuid,
        componentUuid: uuid,
        width: z.number().int().min(320).max(4096),
        height: z.number().int().min(1).max(16384),
        x: z.number().min(-100000).max(100000).optional(),
        y: z.number().min(-100000).max(100000).optional(),
      })
      .strict(),
    outputSchema: resources,
  },
  findEmptySpace: {
    toolName: "findEmptySpace",
    title: "Find a non-overlapping artboard position",
    description:
      "Find a rectangle in native mixed-canvas coordinates. Optional frameUuid anchors placement in one of four directions; padding maintains separation. Use returned x/y with createArtboard.",
    inputSchema: z
      .object({
        canvasName: uuid,
        width: z.number().int().min(1).max(4096),
        height: z.number().int().min(1).max(16384),
        direction: z.enum(["top", "right", "bottom", "left"]).default("right"),
        padding: z.number().min(0).max(4096).default(80),
        frameUuid: uuid.optional(),
      })
      .strict(),
    outputSchema: z.object({ canvasName: uuid, x: z.number(), y: z.number() }),
  },
  navigateCanvas: {
    toolName: "navigateCanvas",
    title: "Open a freeform canvas",
    description:
      "Open a native mixed canvas and optionally focus an artboard. Use screenshot width to select an existing viewport; omit componentUuid to keep this canvas active.",
    inputSchema: z
      .object({ canvasName: uuid, frameUuid: uuid.optional() })
      .strict(),
    outputSchema: resources,
  },
  readVector: {
    toolName: "readVector",
    title: "Read SVG source geometry",
    description:
      "Read the sanitized SVG source and local asset identity for an SVG-backed image/icon element. Ordinary raster images are rejected.",
    inputSchema: z.object(element).strict(),
    outputSchema: z.object({
      elementUuid: uuid,
      assetUuid: uuid,
      svg: z.string(),
      width: z.number().nullable(),
      height: z.number().nullable(),
    }),
  },
  updateVector: {
    toolName: "updateVector",
    title: "Update SVG source geometry",
    description:
      "Replace the sanitized SVG source of an existing local SVG asset, preserving element and asset UUIDs. All instances referencing that asset update together. ReadVector returns its source for path/fill/stroke editing. Imported assets and raster images are rejected.",
    inputSchema: z
      .object({ ...element, svg: z.string().min(1).max(200000) })
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
      "Modify an existing element in a local page/component. Props are validated against its registered contract. styles uses CSS property names (null removes a style); visibleIf and repeat.collection use {{ JS }} bindings (null clears); variantUuids selects existing component/global variants. Rejected props roll back the entire call. For text or slot content use insertHtml replace on that text element or its slot child.",
    inputSchema: z
      .object({
        ...element,
        props: z.record(jsonValue).optional(),
        styles: z.record(z.string().nullable()).optional(),
        variantUuids: z.array(uuid).optional(),
        visibleIf: z.string().min(1).nullable().optional(),
        repeat: z
          .object({
            collection: z.string().min(1),
            itemName: uuid.optional(),
            indexName: uuid.optional(),
          })
          .strict()
          .nullable()
          .optional(),
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
  copyElement: {
    toolName: "copyElement",
    title: "Copy an editable subtree",
    description:
      "Copy a subtree with new UUIDs into the same component. Preserves styles, props, slots and interactions. Returns the updated component; read it to discover the copy UUIDs.",
    inputSchema: z
      .object({
        ...element,
        targetUuid: uuid,
        location: z
          .enum(["before", "after", "prepend", "append"])
          .default("after"),
      })
      .strict(),
    outputSchema: resources,
  },
  moveElement: {
    toolName: "moveElement",
    title: "Move an editable subtree",
    description:
      "Reparent or reorder a subtree within its component, keeping UUIDs. Root moves, self-targeting and ancestor cycles are rejected.",
    inputSchema: z
      .object({
        ...element,
        targetUuid: uuid,
        location: z.enum(["before", "after", "prepend", "append"]),
      })
      .strict(),
    outputSchema: resources,
  },
  updateState: {
    toolName: "updateState",
    title: "Update a typed state variable",
    description:
      "Rename a state, update its type or initial literal value. Studio rewrites state references when renaming and validates defaults against the type.",
    inputSchema: z
      .object({
        componentUuid: uuid,
        stateUuid: uuid,
        name: uuid.optional(),
        variableType: z.enum(NORMAL_STATE_VARIABLE_TYPES).optional(),
        initialValue: jsonValue.optional(),
      })
      .strict(),
    outputSchema: resources,
  },
  deleteState: {
    toolName: "deleteState",
    title: "Remove an unused state variable",
    description:
      "Delete a local user state. Referenced, implicit and variant-backed states are rejected with no changes.",
    inputSchema: z.object({ componentUuid: uuid, stateUuid: uuid }).strict(),
    outputSchema: resources,
  },
  updateStyleToken: {
    toolName: "updateStyleToken",
    title: "Update a design token or themed value",
    description:
      "Rename a local token or set its base/global-variant value. null removes a themed override; base value cannot be null. Read global variant UUIDs first.",
    inputSchema: z
      .object({
        tokenUuid: uuid,
        name: uuid.optional(),
        value: z.string().min(1).nullable().optional(),
        variantUuids: z.array(uuid).optional(),
      })
      .strict(),
    outputSchema: resources,
  },
  deleteStyleToken: {
    toolName: "deleteStyleToken",
    title: "Remove a local design token",
    description:
      "Delete a local token and inline its current value at all references, preserving styles. Imported and registered tokens cannot be deleted.",
    inputSchema: z.object({ tokenUuid: uuid }).strict(),
    outputSchema: resources,
  },
  createVariantGroup: {
    toolName: "createVariantGroup",
    title: "Create component variants",
    description:
      "Create a local component variant group. Standalone creates an implicit boolean variant; singleChoice and multiChoice accept createVariant options. Read the returned variant contract.",
    inputSchema: z
      .object({
        componentUuid: uuid,
        name: uuid,
        optionsType: z.enum(["standalone", "singleChoice", "multiChoice"]),
      })
      .strict(),
    outputSchema: resources,
  },
  createVariant: {
    toolName: "createVariant",
    title: "Add a component variant option",
    description:
      "Add an option to an existing single/multi-choice component variant group. Use changeElement variantUuids for its styling and props.",
    inputSchema: z
      .object({ componentUuid: uuid, groupUuid: uuid, name: uuid })
      .strict(),
    outputSchema: resources,
  },
  createGlobalVariantGroup: {
    toolName: "createGlobalVariantGroup",
    title: "Create a project theme group",
    description:
      "Create a global variant group for project-wide themes. Returns its group UUID for createGlobalVariant.",
    inputSchema: z.object({ name: uuid }).strict(),
    outputSchema: resources,
  },
  createGlobalVariant: {
    toolName: "createGlobalVariant",
    title: "Create a project theme option",
    description:
      "Add a global variant to a local user theme group. Apply themed values with updateStyleToken and element overrides with changeElement.",
    inputSchema: z.object({ groupUuid: uuid, name: uuid }).strict(),
    outputSchema: resources,
  },
  createBreakpoint: {
    toolName: "createBreakpoint",
    title: "Create a responsive breakpoint",
    description:
      "Create a named min/max-width screen variant and its Studio artboards. At least one bound is required. Read the returned screen variant UUID before editing responsive overrides.",
    inputSchema: z
      .object({
        name: uuid,
        minWidth: z.number().int().min(0).max(10000).optional(),
        maxWidth: z.number().int().min(1).max(10000).optional(),
      })
      .strict(),
    outputSchema: resources,
  },
  deleteComponent: {
    toolName: "deleteComponent",
    title: "Delete an unused local page/component",
    description:
      "Remove a local page/reusable component with Studio reference checks. Referenced components, sub-components and the default wrapper are protected. Deletion is undoable.",
    inputSchema: z.object({ componentUuid: uuid }).strict(),
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

export const prototypeMutationSchema = z.discriminatedUnion("name", [
  z
    .object({
      name: z.literal("createCanvas"),
      input: EDIT_TOOL_META.createCanvas.inputSchema,
    })
    .strict(),
  z
    .object({
      name: z.literal("createArtboard"),
      input: EDIT_TOOL_META.createArtboard.inputSchema,
    })
    .strict(),
  z
    .object({
      name: z.literal("updateVector"),
      input: EDIT_TOOL_META.updateVector.inputSchema,
    })
    .strict(),
  z
    .object({
      name: z.literal("createComponent"),
      input: EDIT_TOOL_META.createComponent.inputSchema,
    })
    .strict(),
  z
    .object({
      name: z.literal("insertHtml"),
      input: EDIT_TOOL_META.insertHtml.inputSchema,
    })
    .strict(),
  z
    .object({
      name: z.literal("changeElement"),
      input: EDIT_TOOL_META.changeElement.inputSchema,
    })
    .strict(),
  z
    .object({
      name: z.literal("deleteElement"),
      input: EDIT_TOOL_META.deleteElement.inputSchema,
    })
    .strict(),
  z
    .object({
      name: z.literal("createState"),
      input: EDIT_TOOL_META.createState.inputSchema,
    })
    .strict(),
  z
    .object({
      name: z.literal("createInteraction"),
      input: EDIT_TOOL_META.createInteraction.inputSchema,
    })
    .strict(),
  z
    .object({
      name: z.literal("createStyleToken"),
      input: EDIT_TOOL_META.createStyleToken.inputSchema,
    })
    .strict(),
  z
    .object({
      name: z.literal("copyElement"),
      input: EDIT_TOOL_META.copyElement.inputSchema,
    })
    .strict(),
  z
    .object({
      name: z.literal("moveElement"),
      input: EDIT_TOOL_META.moveElement.inputSchema,
    })
    .strict(),
  z
    .object({
      name: z.literal("updateState"),
      input: EDIT_TOOL_META.updateState.inputSchema,
    })
    .strict(),
  z
    .object({
      name: z.literal("deleteState"),
      input: EDIT_TOOL_META.deleteState.inputSchema,
    })
    .strict(),
  z
    .object({
      name: z.literal("updateStyleToken"),
      input: EDIT_TOOL_META.updateStyleToken.inputSchema,
    })
    .strict(),
  z
    .object({
      name: z.literal("deleteStyleToken"),
      input: EDIT_TOOL_META.deleteStyleToken.inputSchema,
    })
    .strict(),
  z
    .object({
      name: z.literal("createVariantGroup"),
      input: EDIT_TOOL_META.createVariantGroup.inputSchema,
    })
    .strict(),
  z
    .object({
      name: z.literal("createVariant"),
      input: EDIT_TOOL_META.createVariant.inputSchema,
    })
    .strict(),
  z
    .object({
      name: z.literal("createGlobalVariantGroup"),
      input: EDIT_TOOL_META.createGlobalVariantGroup.inputSchema,
    })
    .strict(),
  z
    .object({
      name: z.literal("createGlobalVariant"),
      input: EDIT_TOOL_META.createGlobalVariant.inputSchema,
    })
    .strict(),
  z
    .object({
      name: z.literal("createBreakpoint"),
      input: EDIT_TOOL_META.createBreakpoint.inputSchema,
    })
    .strict(),
  z
    .object({
      name: z.literal("deleteComponent"),
      input: EDIT_TOOL_META.deleteComponent.inputSchema,
    })
    .strict(),
]);
export type PrototypeMutation = z.infer<typeof prototypeMutationSchema>;
export const PROTOTYPE_TOOL_META = {
  ...EDIT_TOOL_META,
  executeBatch: {
    toolName: "executeBatch",
    title: "Apply one atomic edit transaction",
    description:
      "Apply 1–30 mutations in order as one undoable Studio transaction. Any failure rolls back every edit. UUID targets must exist before the call; read newly created IDs in a subsequent call. Save separately.",
    inputSchema: z
      .object({ operations: z.array(prototypeMutationSchema).min(1).max(30) })
      .strict(),
    outputSchema: z.object({ results: z.array(resources) }),
  },
};
