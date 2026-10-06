const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const {
  StdioServerTransport,
} = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");
const {
  AjvJsonSchemaValidator,
} = require("@modelcontextprotocol/sdk/validation/ajv");
const { requestRpc } = require("./local-rpc.cjs");
const EDITOR_METHODS = [
  "identify",
  "read",
  "upgradeLibrary",
  "installLibrary",
  "queryElements",
  "readVector",
  "createCanvas",
  "deleteCanvas",
  "updateCanvas",
  "updateArtboard",
  "setPageViewport",
  "deleteBreakpoint",
  "createArtboard",
  "findEmptySpace",
  "navigateCanvas",
  "updateVector",
  "createComponent",
  "insertHtml",
  "changeElement",
  "deleteElement",
  "createState",
  "createInteraction",
  "createStyleToken",
  "copyElement",
  "moveElement",
  "updateState",
  "deleteState",
  "updateStyleToken",
  "deleteStyleToken",
  "createVariantGroup",
  "createVariant",
  "createGlobalVariantGroup",
  "createGlobalVariant",
  "createBreakpoint",
  "deleteComponent",
  "executeBatch",
  "getEditorContext",
  "selectElement",
  "navigate",
  "beginCanvasInspection",
  "endCanvasInspection",
  "scrollElementIntoView",
  "validate",
  "save",
  "undo",
];
const object = (properties) => ({
  type: "object",
  properties,
  additionalProperties: false,
});
const tools = [
  {
    name: "get_app_state",
    description:
      "Read the desktop URL, active project, focused artboard, selected elements and editing scope, readiness, build identity, running operations and exact editor tool schemas. Read these contracts before execute.",
    inputSchema: object({}),
  },
  {
    name: "list_projects",
    description:
      "List NAS projects accessible to the signed-in desktop account.",
    inputSchema: object({}),
  },
  {
    name: "open_design",
    description:
      "Open a NAS project and optionally a page/component. Saves the current editable design before switching projects. Requires desktop login.",
    inputSchema: {
      ...object({
        projectId: { type: "string", pattern: "^[A-Za-z0-9_-]+$" },
        componentUuid: { type: "string", minLength: 1 },
      }),
      required: ["projectId"],
    },
  },
  {
    name: "execute",
    description:
      "Call a validated Studio operation. Supports read, createComponent (page/component), insertHtml, changeElement (props/layout), deleteElement, state/interactions/tokens, navigate, scrollElementIntoView (reveal rendered content without changing the design), validate, save and undo. Obtain exact input schemas from get_app_state. Read component props/slot contracts before editing. Save explicitly after design changes.",
    inputSchema: {
      ...object({
        name: { type: "string", enum: EDITOR_METHODS },
        input: { type: "object" },
      }),
      required: ["name", "input"],
    },
  },
  {
    name: "get_screenshot",
    description:
      "Return a clean rendered artboard PNG without editor chrome or slot placeholders. artboardElementUuid selects the whole artboard containing that visible element, useful for same-sized pages in one overview. elementUuid crops a visible node (including repeated instances). frameUuid selects an exact artboard. Otherwise captures the focused artboard; ambiguous canvases require an explicit target. width resizes the selected static rendering. componentUuid renders in a background canvas without changing the active arena or selection. Use mode workspace for the current editor view; rect applies only to workspace and componentUuid is not accepted. Not an interactive preview.",
    inputSchema: object({
      componentUuid: { type: "string", minLength: 1 },
      elementUuid: { type: "string", minLength: 1 },
      artboardElementUuid: { type: "string", minLength: 1 },
      frameUuid: { type: "string", minLength: 1 },
      mode: { type: "string", enum: ["artboard", "workspace"] },
      width: { type: "integer", minimum: 320, maximum: 4096 },
      height: { type: "integer", minimum: 1, maximum: 16384 },
      rect: {
        ...object(
          Object.fromEntries(
            ["x", "y", "width", "height"].map((key) => [
              key,
              { type: "integer", minimum: key === "x" || key === "y" ? 0 : 1 },
            ]),
          ),
        ),
        required: ["x", "y", "width", "height"],
      },
    }),
  },
];
tools.push(
  {
    name: "browser",
    description:
      "Persistent isolated reference browser: load an HTTP(S) page, read styled DOM and PNG, send CDP commands in DOM/Input/Page/Runtime/Emulation/CSS/Accessibility domains, or close. No Studio cookies or preload are shared. Call load_page first. Use returned HTML with insertHtml for editable design import.",
    inputSchema: {
      ...object({
        action: {
          type: "string",
          enum: ["load_page", "capture", "cdp", "close"],
        },
        url: { type: "string", minLength: 1 },
        selector: { type: "string", minLength: 1, maxLength: 500 },
        width: { type: "integer", minimum: 320, maximum: 4096 },
        height: { type: "integer", minimum: 1, maximum: 16384 },
        method: { type: "string", minLength: 1 },
        params: { type: "object" },
      }),
      required: ["action"],
    },
  },
  {
    name: "search_stock_images",
    description:
      "Search Wikimedia Commons raster reference assets with source, license and attribution metadata. Use returned image URLs as design sources; preserve required attribution. Results are not guaranteed to be attribution-free.",
    inputSchema: {
      ...object({
        query: { type: "string", minLength: 1, maxLength: 300 },
        limit: { type: "integer", minimum: 1, maximum: 20 },
      }),
      required: ["query"],
    },
  },
  {
    name: "vectorize_image",
    description:
      "Trace a local raster image to SVG paths with local color quantization; suitable for icons and flat artwork, not lossless photo reconstruction. At most 1 megapixel. Optional new SVG output and insertion as a Studio SVG asset.",
    inputSchema: {
      ...object({
        path: { type: "string", minLength: 1 },
        outputPath: { type: "string", minLength: 1 },
        colors: { type: "integer", minimum: 2, maximum: 32 },
        componentUuid: { type: "string", minLength: 1 },
        elementUuid: { type: "string", minLength: 1 },
        location: {
          type: "string",
          enum: ["before", "after", "prepend", "append", "replace"],
        },
      }),
      required: ["path"],
    },
  },
  {
    name: "generate_image",
    description:
      "Generate, edit, remove or replace an image background using the configured Images service. Writes a new PNG and returns pixels; import_image places it in the design. Requires image-service.json in desktop user data.",
    inputSchema: {
      ...object({
        action: {
          type: "string",
          enum: ["generate", "edit", "remove_background", "replace_background"],
        },
        prompt: { type: "string", minLength: 1, maxLength: 10000 },
        path: { type: "string", minLength: 1 },
        outputPath: { type: "string", minLength: 1 },
        size: {
          type: "string",
          enum: ["auto", "1024x1024", "1536x1024", "1024x1536"],
        },
      }),
      required: ["action", "outputPath"],
    },
  },
  {
    name: "make_vector",
    description:
      "Author SVG paths or apply union/intersection/subtraction/xor to closed path geometry. Returns reusable SVG plus area/bounds. Optionally insert or replace a Studio SVG asset through validated insertHtml; the Studio asset is editable by replacing its SVG source, not a tree of native path nodes.",
    inputSchema: {
      ...object({
        width: { type: "integer", minimum: 1, maximum: 4096 },
        height: { type: "integer", minimum: 1, maximum: 4096 },
        paths: {
          type: "array",
          minItems: 1,
          maxItems: 30,
          items: { type: "string", minLength: 1, maxLength: 20000 },
        },
        operation: {
          type: "string",
          enum: ["unite", "intersect", "subtract", "exclude"],
        },
        fill: { type: "string", minLength: 1, maxLength: 30 },
        componentUuid: { type: "string", minLength: 1 },
        elementUuid: { type: "string", minLength: 1 },
        location: {
          type: "string",
          enum: ["before", "after", "prepend", "append", "replace"],
        },
      }),
      required: ["width", "height", "paths"],
    },
  },
  {
    name: "export_code",
    description:
      "Save the active project and request editable React/TypeScript/CSS from the NAS Plasmic code generator. Writes a new absolute output directory, including the complete codegen bundle for assets/dependencies. Does not install dependencies or publish the prototype.",
    inputSchema: {
      ...object({
        outputPath: { type: "string", minLength: 1 },
        componentUuids: {
          type: "array",
          minItems: 1,
          maxItems: 30,
          items: { type: "string", minLength: 1 },
        },
      }),
      required: ["outputPath"],
    },
  },
  {
    name: "export_pages",
    description:
      "Export 1–30 local pages/components in order into a single PDF, with independently selected viewport sizes. Each page is a clean static artboard. Saves to an absolute new .pdf file; does not overwrite.",
    inputSchema: {
      ...object({
        outputPath: { type: "string", minLength: 1 },
        pages: {
          type: "array",
          minItems: 1,
          maxItems: 30,
          items: {
            ...object({
              componentUuid: { type: "string", minLength: 1 },
              width: { type: "integer", minimum: 320, maximum: 4096 },
              height: { type: "integer", minimum: 1, maximum: 16384 },
            }),
            required: ["componentUuid"],
          },
        },
      }),
      required: ["outputPath", "pages"],
    },
  },
  {
    name: "capture_browser",
    description:
      "Capture an HTTP(S) reference page or CSS-selected node in an isolated browser. Returns a viewport PNG and sanitized markup with computed styles for insertHtml. Does not share Studio cookies, modify the design or execute client-provided JavaScript. Cross-site scripts run only as part of normal browser page loading.",
    inputSchema: {
      ...object({
        url: { type: "string", minLength: 1 },
        selector: { type: "string", minLength: 1 },
        width: { type: "integer", minimum: 320, maximum: 4096 },
        height: { type: "integer", minimum: 200, maximum: 4096 },
      }),
      required: ["url"],
    },
  },
  {
    name: "get_style",
    description:
      "List local design presets or read one palette, typography and spacing guide. Does not mutate the project or assume a component theme contract.",
    inputSchema: object({
      id: { type: "string", enum: ["enterprise", "editorial", "dark"] },
    }),
  },
  {
    name: "import_image",
    description:
      "Import an explicit local raster image file into NAS storage using the signed-in desktop session. Returns its src and dimensions for a registered Image component. Converts to PNG (animation is not retained), up to 10 MiB. Does not insert a node; use execute insertHtml/changeElement with the returned src.",
    inputSchema: {
      ...object({ path: { type: "string", minLength: 1 } }),
      required: ["path"],
    },
  },
  {
    name: "read_skill",
    description:
      "Read the Plasmic MCP editing workflow, component contracts, image and export guidance. Read before designing.",
    inputSchema: object({}),
  },
  {
    name: "execute_batch",
    description:
      "Run 1–30 validated editor operations in order. The whole batch is one atomic, undoable Studio transaction: any failure rolls back every edit. Only mutation operations are allowed; UUID targets must exist before the call. Save separately.",
    inputSchema: {
      ...object({
        operations: {
          type: "array",
          minItems: 1,
          maxItems: 30,
          items: {
            ...object({
              name: {
                type: "string",
                enum: EDITOR_METHODS.filter(
                  (name) =>
                    ![
                      "identify",
                      "read",
                      "upgradeLibrary",
                      "installLibrary",
                      "queryElements",
                      "readVector",
                      "findEmptySpace",
                      "navigateCanvas",
                      "navigate",
                      "getEditorContext",
                      "selectElement",
                      "beginCanvasInspection",
                      "endCanvasInspection",
                      "scrollElementIntoView",
                      "validate",
                      "save",
                      "undo",
                      "executeBatch",
                    ].includes(name),
                ),
              },
              input: { type: "object" },
            }),
            required: ["name", "input"],
          },
        },
      }),
      required: ["operations"],
    },
  },
  {
    name: "read_image",
    description:
      "Read a raster image already used in the active design and return its PNG pixels. Obtain exact src values from snapshot_layout. Supports authenticated NAS uploads; arbitrary URLs are rejected.",
    inputSchema: {
      ...object({ src: { type: "string", minLength: 1 } }),
      required: ["src"],
    },
  },
  {
    name: "snapshot_layout",
    description:
      "Read rendered artboard geometry, visible DOM elements and image sources/load status. componentUuid inspects a background canvas without changing the active arena or selection. Checks horizontal overflow and image loading only; interactions, responsive breakpoints and content overlap require preview testing. Use execute read for editable element UUIDs.",
    inputSchema: object({ componentUuid: { type: "string", minLength: 1 } }),
  },
  {
    name: "export_design",
    description:
      "Export a clean static artboard as PNG, JPEG, WebP, PDF or HTML to an absolute local outputPath. Does not overwrite files. HTML is a rendered snapshot, not editable React code or live interactions. Save the editable project with execute save.",
    inputSchema: {
      ...object({
        componentUuid: { type: "string", minLength: 1 },
        frameUuid: { type: "string", minLength: 1 },
        artboardElementUuid: { type: "string", minLength: 1 },
        format: {
          type: "string",
          enum: ["png", "jpeg", "webp", "pdf", "html"],
        },
        outputPath: { type: "string", minLength: 1 },
        width: { type: "integer", minimum: 320, maximum: 4096 },
        height: { type: "integer", minimum: 1, maximum: 16384 },
        quality: { type: "integer", minimum: 1, maximum: 100 },
      }),
      required: ["format", "outputPath"],
    },
  },
);
const schemaValidator = new AjvJsonSchemaValidator();
const validators = new Map(
  tools.map((tool) => [
    tool.name,
    schemaValidator.getValidator(tool.inputSchema),
  ]),
);
async function serveMcp(profile) {
  const server = new Server(
    { name: "plasmic-desktop", version: require("../package.json").version },
    { capabilities: { tools: {} } },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const validator = validators.get(request.params.name);
      if (!validator) {
        throw new Error("Unknown desktop tool");
      }
      const checked = validator(request.params.arguments || {});
      if (!checked.valid) {
        throw new Error(checked.errorMessage);
      }
      const result =
        request.params.name === "get_style"
          ? require("./design-styles.cjs").getStyle(
              request.params.arguments?.id,
            )
          : request.params.name === "read_skill"
            ? {
                instructions: require("node:fs").readFileSync(
                  require("node:path").join(__dirname, "../mcp-guide.md"),
                  "utf8",
                ),
              }
            : await requestRpc(
                profile,
                request.params.name,
                request.params.arguments || {},
              );
      if (
        ["capture_browser", "generate_image", "browser"].includes(
          request.params.name,
        ) &&
        result.data
      ) {
        const { data, ...metadata } = result;
        return {
          content: [
            { type: "text", text: JSON.stringify(metadata) },
            { type: "image", data, mimeType: "image/png" },
          ],
          structuredContent: metadata,
          isError: false,
        };
      }
      if (["get_screenshot", "read_image"].includes(request.params.name)) {
        return {
          content: [
            { type: "image", data: result.data, mimeType: "image/png" },
          ],
          isError: false,
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: result,
        isError: false,
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: error.message }],
        isError: true,
      };
    }
  });
  await server.connect(new StdioServerTransport());
  return server;
}
module.exports = { serveMcp, EDITOR_METHODS };
