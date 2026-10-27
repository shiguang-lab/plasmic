import { mutationReceiptSchema } from "@/wab/shared/copilot/mutation-receipt";
import { modelReadOptions, modelReadResultSchema, projectCollections } from "@/wab/shared/copilot/model-read";
import { tokenTypes } from "@/wab/commons/StyleToken";
import {
  localEditBindingSchema,
  localEditToolNames,
} from "@/wab/shared/copilot/local-edit";
import type { JsonValue } from "@/wab/shared/core/lang";
import {
  NORMAL_STATE_VARIABLE_TYPES,
  interactionActionSchema,
  interactionConditionSchema,
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
    }),
  },
  read: {
    toolName: "read",
    title: "Read project resources",
    description:
      "Read native models with batched component/element targets. tree returns structure/Slot IDs without values; depth expands structure. properties reads base-variant values/styles/attributes/text (root for component targets); propNames selects only named values (requires view:properties with targeted components/elements). contract returns registered Props/Slots/defaults/enums/event signatures and globalActions. isContext:true identifies a project-wide global context, not an insertable component; this identity survives fields projections. Read collection:globalContexts for installed instances/settings and use qualified globalActions directly without a page wrapper. full fields provides parameter IDs and implementation metadata. context reads owning states/events/queries/variants. full preserves complete target markup and models. fields projects values; omitted data is not empty. No targets returns project counts; collection/offset/limit pages inventory. Projects list dependency identities/versions; use fromProject to read each dependency's resources. Inherited nodes expose editable:false and source slot identity; imported definitions are read-only.",
    inputSchema: z
      .object({
        ...modelReadOptions,
        collection: projectCollections.optional(),
        fromProject: uuid.optional().describe("Read scope: current project or a reachable native dependency ID, including indirect dependencies. Targets must belong to that project. Imported models remain read-only."),
        nameContains: uuid.optional().describe("Case-insensitive inventory name filter; requires collection. Discover components and their real UUIDs/contracts together with collection:components, view:contract."),
        offset: z.number().int().nonnegative().default(0),
        limit: z.number().int().min(1).max(100).default(50),
        componentUuids: z.array(uuid).max(30).optional().describe("Exact model UUIDs returned by read inventories/contracts, never component names or registration keys. For name-based discovery use collection:components and nameContains, optionally view:contract."),
        elements: z.array(z.object(element).strict()).max(30).optional(),
      })
      .strict(),
    outputSchema: modelReadResultSchema,
  },
  installLibrary: {
    toolName: "installLibrary",
    title: "Install a published component library",
    description:
      "Install a library through Studio dependency operations and load its component registrations. Requires full edit permission. Save separately and read the installed contracts before inserting components.",
    inputSchema: z.object({ projectId: uuid }).strict(),
    outputSchema: z.object({
      projectId: uuid,
      version: uuid,
      installed: z.boolean(),
    }),
  },
  upgradeLibrary: {
    toolName: "upgradeLibrary",
    title: "Upgrade an installed component library",
    description:
      "Upgrade an already installed library to its latest published package through Studio dependency operations. projectId is the library project ID. Atomically aligns its already installed dependencies to the exact versions required by that publication. Keeps local pages and rewrites their references. Requires an editable project; save separately and read the new component contracts before use.",
    inputSchema: z.object({ projectId: uuid }).strict(),
    outputSchema: z.object({
      projectId: uuid,
      previousVersion: uuid,
      version: uuid,
      upgraded: z.boolean(),
    }),
  },
  queryElements: {
    toolName: "queryElements",
    title: "Find editable elements by their contract",
    description:
      "Search a component subtree by element name, native tag or registered component UUID. Returns shallow native nodes, with the same depth/view/fields projection as read. total and nextOffset make pagination explicit.",
    inputSchema: z
      .object({
        ...modelReadOptions,
        offset: z.number().int().nonnegative().default(0),
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
    outputSchema: modelReadResultSchema,
  },
  createCanvas: {
    toolName: "createCanvas",
    title: "Create a freeform canvas",
    description:
      "Create a native mixed arena for arranging multiple component/page artboards. The unique canvas name is its native identity.",
    inputSchema: z.object({ name: uuid }).strict(),
    outputSchema: mutationReceiptSchema,
  },
  deleteCanvas: {
    toolName: "deleteCanvas",
    title: "Delete a freeform canvas",
    description:
      "Remove a mixed arena and its preview frames; referenced pages and named components remain. Returns standard mutation receipt with created: [] and confirmation messages. Undo is supported.",
    inputSchema: z.object({ canvasName: uuid }).strict(),
    outputSchema: mutationReceiptSchema,
  },
  updateCanvas: {
    toolName: "updateCanvas",
    title: "Rename a freeform canvas",
    description:
      "Rename an existing mixed arena without recreating its frames.",
    inputSchema: z.object({ canvasName: uuid, name: uuid }).strict(),
    outputSchema: mutationReceiptSchema,
  },
  updateArtboard: {
    toolName: "updateArtboard",
    title: "Resize and arrange a preview artboard",
    description:
      "Update viewport dimensions, position, or view mode (stretch to fill the canvas or centered with default padding) of an existing mixed-canvas frame, preserving its component reference.",
    inputSchema: z
      .object({
        canvasName: uuid,
        frameUuid: uuid,
        width: z.number().int().min(320).max(4096).optional(),
        height: z.number().int().min(1).max(16384).optional(),
        x: z.number().min(0).max(100000).optional(),
        y: z.number().min(0).max(100000).optional(),
        viewMode: z.enum(["stretch", "centered"]).optional(),
      })
      .strict(),
    outputSchema: mutationReceiptSchema,
  },
  setPageViewport: {
    toolName: "setPageViewport",
    title: "Set page preview device preset",
    description:
      "Set Page arena columns to a single Studio device preset (Desktop by default), removing other device columns. Supply componentUuid to change only that page; omission changes all pages. Keeps page definitions and variant rows. Custom variant frames use the same size. Does not change page CSS; update fixed root constraints separately.",
    inputSchema: z
      .object({
        preset: uuid.default("Desktop"),
        componentUuid: uuid.optional(),
      })
      .strict(),
    outputSchema: mutationReceiptSchema,
  },
  deleteBreakpoint: {
    toolName: "deleteBreakpoint",
    title: "Remove a screen breakpoint",
    description:
      "Remove an active screen variant through native variant operations, including its style overrides and frame references. Read affected content first; undo is supported.",
    inputSchema: z.object({ variantUuid: uuid }).strict(),
    outputSchema: mutationReceiptSchema,
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
    outputSchema: mutationReceiptSchema,
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
    outputSchema: z.object({ canvasName: uuid, frameUuid: uuid.optional(), componentUuid: uuid.optional() }),
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
    outputSchema: mutationReceiptSchema,
  },
  createComponent: {
    toolName: "createComponent",
    title: "Create page or reusable component",
    description:
      "Create an editable empty page/component. A page starts with one device column using the live Studio preset (Desktop by default) and is referenced in the shared Pages overview canvas. Then insertHtml into its root. Names and page paths must be unique.",
    inputSchema: z
      .object({
        name: uuid,
        type: z.enum(["page", "component"]).default("page"),
        preset: uuid.default("Desktop").describe("Native device preset for a new page; ignored for reusable components"),
        path: z
          .string()
          .regex(/^\/(?!\/)/)
          .optional(),
      })
      .strict(),
    outputSchema: mutationReceiptSchema,
  },
  importWebPage: {
    toolName: "importWebPage",
    title: "Import a captured web page",
    description:
      "Import static captured HTML into an independent editable artboard in one undoable transaction. Uses the current mixed canvas or the source page's associated canvas. Does not create a routed page or reusable component. Returns the destination canvas, artboard, inserted element UUIDs and warnings. Captured content cannot define executable bindings or component registrations.",
    inputSchema: z
      .object({
        html: z.string().min(1).max(200000),
        sourceArena: z
          .object({
            id: uuid,
            type: z.enum(["custom", "page", "component"]),
          })
          .strict()
          .optional(),
        name: z
          .string()
          .regex(/^[A-Z][A-Za-z0-9]*$/)
          .default("ImportedPage"),
        width: z.number().int().min(1).max(4096).default(1440),
        height: z.number().int().min(1).max(16384).optional(),
        projectId: uuid,
      })
      .strict(),
    outputSchema: z.object({
      canvasName: z.string(),
      frameUuid: uuid,
      componentUuid: uuid,
      elementUuids: z.array(uuid),
      warnings: z.array(z.string()),
    }),
  },
  insertHtml: {
    toolName: "insertHtml",
    title: "Insert editable prototype markup",
    description:
      'Convert HTML/CSS and <plasmic-component data-plasmic-component="exact registered name" data-plasmic-project="imported project ID" data-props=\'JSON\'> into editable canvas elements. Read contract.props before composition: type:slot uses <slot name="EXACT_PROP_NAME">...</slot>, other props use data-props. The same prop name can have different types on different components. data-plasmic-component uses the discovered registration name, not its UUID. CSS @media must match existing breakpoints. Defaults to append to root; replace requires an explicit elementUuid. Safely discarded styles, unknown props and invalid optional literal props are reported in successful result messages. Missing components and invalid required props, slots or bindings reject the whole call. For a missing component, read installed names/contracts, correct the reference and retry; do not drop the component or abandon the design task.',
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
    outputSchema: mutationReceiptSchema,
  },
  changeElement: {
    toolName: "changeElement",
    title: "Change element name, props or layout",
    description:
      "Modify an existing element in a local page/component. text updates plain native text without replacing its identity; rich or bound text requires its existing editing contract. name renames a native element or component instance using Studio's reference updates; read back the applied name because conflicts are disambiguated. Props are validated against its registered contract. resetProps removes explicit prop overrides, including empty slot overrides, to restore component defaults; remove nonempty slot content first. styles uses CSS property names (null removes a style); visibleIf and repeat.collection use {{ JS }} bindings (null clears); variantUuids selects existing component/global variants. Unsupported styles, unknown props and invalid optional literal props are ignored with successful result messages; existing valid values are preserved. Invalid required props, slots or bindings reject the whole call. For text or slot content use insertHtml replace on that text element or its slot child.",
    inputSchema: z
      .object({
        ...element,
        name: z.string().trim().min(1).optional(),
        text: z.string().max(100000).optional(),
        props: z.record(jsonValue).optional(),
        resetProps: z.array(uuid).min(1).optional(),
        styles: z
          .record(z.string().nullable())
          .describe(
            "CSS declarations only. Use actual CSS property names or custom --variables; do not put metadata such as reason in styles. null removes an existing declaration.",
          )
          .optional(),
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
    outputSchema: mutationReceiptSchema,
  },
  deleteElement: {
    toolName: "deleteElement",
    title: "Delete an element",
    description:
      "Remove an element from a local component using Studio's reference checks. Root elements cannot be deleted. Changes are undoable.",
    inputSchema: z.object(element).strict(),
    outputSchema: mutationReceiptSchema,
  },
  createState: {
    toolName: "createState",
    title: "Create prototype state",
    description:
      "Add private page/component state for interactive prototypes. Bind props with {{ $state.name }} and use createInteraction to change it. Returns a compact receipt with created state identity; read context explicitly when needed.",
    inputSchema: z
      .object({
        componentUuid: uuid,
        name: uuid,
        variableType: z.enum(NORMAL_STATE_VARIABLE_TYPES),
        initialValue: jsonValue.optional(),
      })
      .strict(),
    outputSchema: mutationReceiptSchema,
  },
  createInteraction: {
    toolName: "createInteraction",
    title: "Add a prototype interaction",
    description:
      "Append an action to a DOM/component event using validated event names and state references. Supports updateVariable, updateVariant, customFunction and navigation. condition gates any action, including navigation, with event arguments or page state. Prefer href for direct links; use navigation on a Form's validated onFinish event when submission must pass validation first. Read the element and component contract first.",
    inputSchema: z
      .object({
        ...element,
        eventName: uuid,
        name: uuid,
        action: interactionActionSchema(),
        condition: interactionConditionSchema.optional(),
      })
      .strict(),
    outputSchema: mutationReceiptSchema,
  },
  updateInteraction: {
    toolName: "updateInteraction",
    title: "Update a prototype interaction",
    description:
      "Update an existing event step by its interaction UUID from read. Preserves the step identity, event signature and sibling steps. Renaming rewrites $steps references; action replaces the existing action instead of appending a duplicate. condition changes the run condition; omitted preserves it, true removes it, false disables the step. Unsupported action replacements are rejected.",
    inputSchema: z
      .object({
        ...element,
        interactionUuid: uuid,
        name: uuid.optional(),
        action: interactionActionSchema().optional(),
        condition: interactionConditionSchema.optional(),
      })
      .strict(),
    outputSchema: mutationReceiptSchema,
  },
  deleteInteraction: {
    toolName: "deleteInteraction",
    title: "Delete a prototype interaction",
    description:
      "Remove an event step by its interaction UUID from read. Rejects deletion when sibling steps reference its result. Removes the event handler when its last step is deleted. Undo restores the step and handler.",
    inputSchema: z.object({ ...element, interactionUuid: uuid }).strict(),
    outputSchema: mutationReceiptSchema,
  },
  createStyleToken: {
    toolName: "createStyleToken",
    title: "Create a design token",
    description:
      "Create a reusable CSS design token. Use its returned UUID in var(--token-UUID).",
    inputSchema: z
      .object({ name: uuid, type: z.enum(tokenTypes), value: uuid })
      .strict(),
    outputSchema: mutationReceiptSchema,
  },
  copyElement: {
    toolName: "copyElement",
    title: "Copy an editable subtree",
    description:
      "Copy a subtree with new UUIDs into the same component. Preserves styles, props, slots and interactions. Returns copied root identities in created; use the receipt or a batch binding for subsequent edits.",
    inputSchema: z
      .object({
        ...element,
        targetUuid: uuid,
        location: z
          .enum(["before", "after", "prepend", "append"])
          .default("after"),
      })
      .strict(),
    outputSchema: mutationReceiptSchema,
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
    outputSchema: mutationReceiptSchema,
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
    outputSchema: mutationReceiptSchema,
  },
  deleteState: {
    toolName: "deleteState",
    title: "Remove an unused state variable",
    description:
      "Delete a local user state. Referenced, implicit and variant-backed states are rejected with no changes.",
    inputSchema: z.object({ componentUuid: uuid, stateUuid: uuid }).strict(),
    outputSchema: mutationReceiptSchema,
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
    outputSchema: mutationReceiptSchema,
  },
  deleteStyleToken: {
    toolName: "deleteStyleToken",
    title: "Remove a local design token",
    description:
      "Delete a local token and inline its current value at all references, preserving styles. Imported and registered tokens cannot be deleted.",
    inputSchema: z.object({ tokenUuid: uuid }).strict(),
    outputSchema: mutationReceiptSchema,
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
    outputSchema: mutationReceiptSchema,
  },
  createVariant: {
    toolName: "createVariant",
    title: "Add a component variant option",
    description:
      "Add an option to an existing single/multi-choice component variant group. Use changeElement variantUuids for its styling and props.",
    inputSchema: z
      .object({ componentUuid: uuid, groupUuid: uuid, name: uuid })
      .strict(),
    outputSchema: mutationReceiptSchema,
  },
  createGlobalVariantGroup: {
    toolName: "createGlobalVariantGroup",
    title: "Create a project theme group",
    description:
      "Create a global variant group for project-wide themes. Returns its group UUID for createGlobalVariant.",
    inputSchema: z.object({ name: uuid }).strict(),
    outputSchema: mutationReceiptSchema,
  },
  createGlobalVariant: {
    toolName: "createGlobalVariant",
    title: "Create a project theme option",
    description:
      "Add a global variant to a local user theme group. Apply themed values with updateStyleToken and element overrides with changeElement.",
    inputSchema: z.object({ groupUuid: uuid, name: uuid }).strict(),
    outputSchema: mutationReceiptSchema,
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
    outputSchema: mutationReceiptSchema,
  },
  deleteComponent: {
    toolName: "deleteComponent",
    title: "Delete an unused local page/component",
    description:
      "Remove a local page/reusable component with Studio reference checks. Referenced components, sub-components and the default wrapper are protected. Deletion is undoable.",
    inputSchema: z.object({ componentUuid: uuid }).strict(),
    outputSchema: mutationReceiptSchema,
  },
  preview: {
    toolName: "preview",
    title: "Control native Preview",
    description:
      "Open the authenticated in-app Preview or return to the original editor canvas, artboard, zoom and pan without saving or changing the design. close is idempotent and waits for the restored editor canvas, without requiring a working Preview iframe. open optionally selects a local Page (Pages only, not ordinary components; use get_screenshot to inspect component rendering) and a Custom CSS viewport (width and height together); this does not add device columns. back/forward traverse only the Preview page history and do nothing at its boundaries; refresh remounts only the runtime iframe. Returns route/viewport state and canGoBack/canGoForward, not rendering or behavior approval. Desktop runtime interactions use the top-level preview tool. The reference browser cannot substitute for native Preview.",
    inputSchema: z.object({
      action: z.enum(["open", "close", "back", "forward", "refresh"]),
      componentUuid: uuid.optional().describe("Page component UUID to open in Preview (local Pages only)"),
      width: z.number().int().min(240).max(7680).optional(),
      height: z.number().int().min(240).max(7680).optional(),
    }).strict(),
    outputSchema: z.object({
      mode: z.enum(["edit", "preview"]),
      componentUuid: uuid.nullable(),
      path: z.string().nullable(),
      width: z.number().nullable(),
      height: z.number().nullable(),
      canGoBack: z.boolean(),
      canGoForward: z.boolean(),
    }),
  },
  getEditorContext: {
    toolName: "getEditorContext",
    title: "Read the current editing context",
    description:
      "Read the focused artboard, selected elements and editing path, including shared/repeated templates and selected slots. previewContext identifies the active preview page and viewport separately from the retained editing context. Does not change selection or the design.",
    inputSchema: z.object({}).strict(),
    outputSchema: z.object({
      projectName: z.string(),
      projectSummary: z.object({ pages: z.number().int().nonnegative(), components: z.number().int().nonnegative() }),
      saveStatus: z.enum(["saved", "pending", "saving", "error", "blocked", "unlogged"]),
      canvasName: z.string().nullable(),
      projectId: uuid,
      branchId: uuid.nullable(),
      sessionId: uuid,
      revision: z.number().int().nonnegative().optional(),
      componentName: z.string().nullable().optional(),
      changeCounter: z.number().int().nonnegative(),
      browserImportCanvasName: z.string(),
      componentUuid: uuid.nullable(),
      frameUuid: uuid.nullable(),
      selectedElementUuids: z.array(uuid),
      instanceIndex: z.number().int().nullable(),
      mode: z.enum(["edit", "preview"]),
      canEdit: z.boolean(),
      previewKind: z.enum(["in-app", "external", "interactive"]).nullable(),
      editorView: z
        .object({
          arenaId: uuid,
          arenaType: z.enum(["custom", "page", "component"]),
          frameUuid: uuid.nullable(),
          scale: z.number().positive().finite(),
          scroll: z.object({ x: z.number().finite(), y: z.number().finite() }),
        })
        .nullable(),
      selectedSlot: z
        .object({ elementUuid: uuid, slotName: z.string() })
        .nullable(),
      previewContext: z
        .object({
          componentUuid: uuid.nullable(),
          componentName: z.string().nullable(),
          path: z.string().nullable(),
          width: z.number(),
          height: z.number(),
          canGoBack: z.boolean().optional(),
          canGoForward: z.boolean().optional(),
        })
        .nullable(),
      path: z.array(
        z.object({
          elementUuid: uuid,
          label: z.string(),
          repeated: z.boolean(),
          slotName: z.string().nullable(),
          scope: z.enum([
            "element",
            "slot",
            "shared-template",
            "component-instance",
          ]),
        }),
      ),
    }),
  },
  restoreEditorView: {
    toolName: "restoreEditorView",
    title: "Restore a local editor view",
    description:
      "Restore the arena, focused artboard, zoom and pan from get_editor_view.view. Does not change project or business props. Missing arenas or frames are rejected.",
    inputSchema: z
      .object({
        arenaId: uuid,
        arenaType: z.enum(["custom", "page", "component"]),
        frameUuid: uuid.nullable(),
        scale: z.number().positive().finite(),
        scroll: z.object({ x: z.number().finite(), y: z.number().finite() }),
      })
      .strict(),
    outputSchema: z.object({ restored: z.boolean() }),
  },
  selectElement: {
    toolName: "selectElement",
    title: "Select a rendered element",
    description:
      "Select an element in the current canvas without changing the design. componentUuid must be the component defining elementUuid (nested elements belong to their defining component, not the host page). frameUuid disambiguates artboards and instanceIndex selects a repeated instance. Navigate to the page first. Requires edit mode.",
    inputSchema: z
      .object({
        ...element,
        frameUuid: uuid.optional(),
        instanceIndex: z.number().int().min(0).default(0),
      })
      .strict(),
    outputSchema: z.object({
      ...element,
      frameUuid: uuid,
      instanceIndex: z.number().int().min(0),
    }),
  },
  navigate: {
    toolName: "navigate",
    title: "Show a page/component on the canvas",
    description:
      "Open the local component's arena for visual review and screenshots.",
    inputSchema: z.object({ componentUuid: uuid }).strict(),
    outputSchema: z.object({ componentUuid: uuid, rootElementUuid: uuid }),
  },
  beginCanvasInspection: {
    toolName: "beginCanvasInspection",
    title: "Prepare a background canvas read",
    description:
      "Pin a rendered component or exact frame for a desktop inspection without changing the visible arena, selection or viewport. forExport temporarily suppresses editing-only content reveals. Use the returned inspectionId to find the marked canvas DOM. Always call endCanvasInspection, including after failures; the lease expires after two minutes.",
    inputSchema: z
      .object({
        componentUuid: uuid.optional(),
        frameUuid: uuid.optional(),
        forExport: z.boolean().optional(),
      })
      .strict(),
    outputSchema: z.object({
      inspectionId: uuid,
      componentUuid: uuid,
      frameUuid: uuid,
    }),
  },
  endCanvasInspection: {
    toolName: "endCanvasInspection",
    title: "Release a background canvas read",
    description:
      "Release the background canvas pinned by beginCanvasInspection. Leaves the user's editor context unchanged.",
    inputSchema: z.object({ inspectionId: uuid }).strict(),
    outputSchema: z.object({ released: z.boolean() }),
  },
  scrollElementIntoView: {
    toolName: "scrollElementIntoView",
    title: "Scroll a rendered element into view",
    description:
      "Reveal an element in the current canvas by minimally scrolling its nested content containers. Navigate to its page first and wait for rendering. Preserves selection, editor mode, Studio pan/zoom and design properties. Specify frameUuid for an artboard; instanceIndex selects a repeated rendered instance (zero-based). Hidden/unrendered targets fail; visible=false means clipping still prevents visibility. Bounds are in artboard CSS pixels. Use a workspace screenshot to inspect the resulting editor position.",
    inputSchema: z
      .object({
        ...element,
        frameUuid: uuid.optional(),
        instanceIndex: z.number().int().min(0).default(0),
      })
      .strict(),
    outputSchema: z.object({
      ...element,
      frameUuid: uuid,
      instanceIndex: z.number().int().min(0),
      visible: z.boolean(),
      bounds: z.object({
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
      }),
    }),
  },
  validate: {
    toolName: "validate",
    title: "Validate prototype structure",
    description:
      "Check model invariants and return errors, structural warnings and checked component counts. Does not enforce a component-library preference or verify business behavior/visual quality; verify Preview at required devices and viewport sizes.",
    inputSchema: z
      .object({ componentUuids: z.array(uuid).optional() })
      .strict(),
    outputSchema: z.object({
      check: z.literal("model"),
      notChecked: z.array(z.string()),
      valid: z.boolean(),
      errors: z.array(z.string()),
      warnings: z.array(z.string()),
      pages: z.number(),
      components: z.number(),
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
      as: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/).optional(),
      name: z.literal("deleteCanvas"),
      input: EDIT_TOOL_META.deleteCanvas.inputSchema,
    })
    .strict(),
  z
    .object({
      as: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/).optional(),
      name: z.literal("updateCanvas"),
      input: EDIT_TOOL_META.updateCanvas.inputSchema,
    })
    .strict(),
  z
    .object({
      as: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/).optional(),
      name: z.literal("updateArtboard"),
      input: EDIT_TOOL_META.updateArtboard.inputSchema,
    })
    .strict(),
  z
    .object({
      as: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/).optional(),
      name: z.literal("setPageViewport"),
      input: EDIT_TOOL_META.setPageViewport.inputSchema,
    })
    .strict(),
  z
    .object({
      as: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/).optional(),
      name: z.literal("deleteBreakpoint"),
      input: EDIT_TOOL_META.deleteBreakpoint.inputSchema,
    })
    .strict(),
  z
    .object({
      as: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/).optional(),
      name: z.literal("createCanvas"),
      input: EDIT_TOOL_META.createCanvas.inputSchema,
    })
    .strict(),
  z
    .object({
      as: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/).optional(),
      name: z.literal("createArtboard"),
      input: EDIT_TOOL_META.createArtboard.inputSchema,
    })
    .strict(),
  z
    .object({
      as: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/).optional(),
      name: z.literal("updateVector"),
      input: EDIT_TOOL_META.updateVector.inputSchema,
    })
    .strict(),
  z
    .object({
      as: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/).optional(),
      name: z.literal("createComponent"),
      input: EDIT_TOOL_META.createComponent.inputSchema,
    })
    .strict(),
  z
    .object({
      as: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/).optional(),
      name: z.literal("insertHtml"),
      input: EDIT_TOOL_META.insertHtml.inputSchema,
    })
    .strict(),
  z
    .object({
      as: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/).optional(),
      name: z.literal("changeElement"),
      input: EDIT_TOOL_META.changeElement.inputSchema,
    })
    .strict(),
  z
    .object({
      as: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/).optional(),
      name: z.literal("deleteElement"),
      input: EDIT_TOOL_META.deleteElement.inputSchema,
    })
    .strict(),
  z
    .object({
      as: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/).optional(),
      name: z.literal("createState"),
      input: EDIT_TOOL_META.createState.inputSchema,
    })
    .strict(),
  z
    .object({
      as: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/).optional(),
      name: z.literal("createInteraction"),
      input: EDIT_TOOL_META.createInteraction.inputSchema,
    })
    .strict(),
  z
    .object({
      as: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/).optional(),
      name: z.literal("createStyleToken"),
      input: EDIT_TOOL_META.createStyleToken.inputSchema,
    })
    .strict(),
  z
    .object({
      as: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/).optional(),
      name: z.literal("updateInteraction"),
      input: EDIT_TOOL_META.updateInteraction.inputSchema,
    })
    .strict(),
  z
    .object({
      as: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/).optional(),
      name: z.literal("deleteInteraction"),
      input: EDIT_TOOL_META.deleteInteraction.inputSchema,
    })
    .strict(),
  z
    .object({
      as: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/).optional(),
      name: z.literal("copyElement"),
      input: EDIT_TOOL_META.copyElement.inputSchema,
    })
    .strict(),
  z
    .object({
      as: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/).optional(),
      name: z.literal("moveElement"),
      input: EDIT_TOOL_META.moveElement.inputSchema,
    })
    .strict(),
  z
    .object({
      as: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/).optional(),
      name: z.literal("updateState"),
      input: EDIT_TOOL_META.updateState.inputSchema,
    })
    .strict(),
  z
    .object({
      as: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/).optional(),
      name: z.literal("deleteState"),
      input: EDIT_TOOL_META.deleteState.inputSchema,
    })
    .strict(),
  z
    .object({
      as: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/).optional(),
      name: z.literal("updateStyleToken"),
      input: EDIT_TOOL_META.updateStyleToken.inputSchema,
    })
    .strict(),
  z
    .object({
      as: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/).optional(),
      name: z.literal("deleteStyleToken"),
      input: EDIT_TOOL_META.deleteStyleToken.inputSchema,
    })
    .strict(),
  z
    .object({
      as: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/).optional(),
      name: z.literal("createVariantGroup"),
      input: EDIT_TOOL_META.createVariantGroup.inputSchema,
    })
    .strict(),
  z
    .object({
      as: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/).optional(),
      name: z.literal("createVariant"),
      input: EDIT_TOOL_META.createVariant.inputSchema,
    })
    .strict(),
  z
    .object({
      as: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/).optional(),
      name: z.literal("createGlobalVariantGroup"),
      input: EDIT_TOOL_META.createGlobalVariantGroup.inputSchema,
    })
    .strict(),
  z
    .object({
      as: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/).optional(),
      name: z.literal("createGlobalVariant"),
      input: EDIT_TOOL_META.createGlobalVariant.inputSchema,
    })
    .strict(),
  z
    .object({
      as: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/).optional(),
      name: z.literal("createBreakpoint"),
      input: EDIT_TOOL_META.createBreakpoint.inputSchema,
    })
    .strict(),
  z
    .object({
      as: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/).optional(),
      name: z.literal("deleteComponent"),
      input: EDIT_TOOL_META.deleteComponent.inputSchema,
    })
    .strict(),
]);
export type PrototypeMutation = z.infer<typeof prototypeMutationSchema>;
export const PROTOTYPE_TOOL_META = {
  ...EDIT_TOOL_META,
  executeLocalEdit: {
    toolName: "executeLocalEdit",
    title: "Execute a canvas AI operation",
    description:
      "Execute an existing Studio tool in the bound page or mixed canvas. Selection is context; reject edits outside that page/canvas, stale designs and imported component mutations. New-page generation targets the created page.",
    inputSchema: z
      .object({
        binding: localEditBindingSchema,
        execution: z
          .object({
            operationId: z.string().min(1),
            fence: z.number().int().positive(),
          })
          .strict()
          .optional(),
        name: z.enum([
          ...localEditToolNames,
          "createComponent",
          "validate",
          "save",
          "undo",
        ]),
        input: z.record(z.unknown()),
      })
      .strict(),
    outputSchema: z.object({
      result: z.string(),
      binding: localEditBindingSchema,
      changed: z.boolean(),
      before: z.string().optional(),
      after: z.string().optional(),
    }),
  },
  executeBatch: {
    toolName: "executeBatch",
    title: "Apply one atomic edit transaction",
    description:
      "Apply 1–30 native mutations as one undoable transaction. Any failure rolls back every edit. Name an operation with as; later UUID fields can use $name (first created ID), $name.root (component root), or $name.1 (second created ID). References are call-local and backward-only. Returns compact identities and diagnostics, never implicit full models. Read explicitly for verification. Save separately.",
    inputSchema: z
      .object({ operations: z.array(prototypeMutationSchema).min(1).max(30) })
      .strict(),
    outputSchema: z.object({ operations: z.array(mutationReceiptSchema) }),
  },
};
