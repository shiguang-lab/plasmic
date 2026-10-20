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
const { McpResults } = require("./mcp-results.cjs");
const { browserOutput } = require("./browser-output.cjs");
const { prototypeTools } = require("./prototype-mcp.cjs");
const fs = require("node:fs/promises");
const { errorPayload } = require("./tool-context.cjs");
async function transportResult(request, response, started) {
  if (process.env.PLASMIC_MCP_METRICS) {
    await fs.appendFile(process.env.PLASMIC_MCP_METRICS, JSON.stringify({
      time: new Date().toISOString(), tool: request.params.name,
      operation: request.params.name === "execute" ? request.params.arguments?.name : undefined,
      inputBytes: Buffer.byteLength(JSON.stringify(request.params.arguments || {})),
      wireBytes: Buffer.byteLength(JSON.stringify(response)),
      textBytes: response.content.filter((c) => c.type === "text").reduce((n, c) => n + Buffer.byteLength(c.text), 0),
      imageBytes: response.content.filter((c) => c.type === "image").reduce((n, c) => n + Buffer.from(c.data, "base64").length, 0),
      ms: Date.now() - started, failed: !!response.isError,
    }) + "\n", { mode: 0o600 }).catch(() => {});
  }
  return response;
}
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
  "importWebPage",
  "changeElement",
  "deleteElement",
  "createState",
  "createInteraction",
  "updateInteraction",
  "deleteInteraction",
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
  "preview",
  "restoreEditorView",
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
const resourceId = { type: "string", pattern: "^[A-Za-z0-9_-]+$" };
const resourceName = { type: "string", pattern: "\\S" };
const tools = [
  {
    name: "read_result",
    description: "Read a retained MCP result without rerunning its operation. Use resultId from ResultReference; path is an array of object keys/array indices. Returns entries with value or reference; append the entry key to path to inspect a reference. Follow nextOffset for every page. Strings use UTF-16 offsets and text chunks (limit up to 16000); collections return at most 50 entries. Retains up to 16 snapshots / 64 MiB in this connection. Omitted data is not empty; never repeat a successful mutation to obtain its result.",
    inputSchema: { ...object({
      resultId: { type: "string", minLength: 1 },
      path: { type: "array", items: { anyOf: [{ type: "string", maxLength: 1024 }, { type: "integer", minimum: 0 }] } },
      offset: { type: "integer", minimum: 0 },
      limit: { type: "integer", minimum: 1, maximum: 16000 },
    }), required: ["resultId"] },
  },
  {
    name: "get_app_state",
    description:
      "Read readiness, current project/session/model identity, selection and active operations. context reports surface, mode, previewKind, project/session, canvas identity and effective canEdit; ready is editor-model availability, not iframe rendering approval. view:tools lists operation names; toolNames selects complete input contracts. executeBatch points to execute_batch; read constituent contracts. schemaView:full adds complete output schemas and native batch inputs. Context mismatches include required/actual and explicit recovery calls; ordinary reads/writes never switch modes or projects. Reuse contracts only within the same buildId/session. Build provenance, image-service status and editor viewport have separate read tools.",
    inputSchema: object({
      view: { type: "string", enum: ["status", "tools"] },
      toolNames: {
        type: "array",
        items: { type: "string", minLength: 1 },
        uniqueItems: true,
      },
      schemaView: { type: "string", enum: ["input", "full"], default: "input" },
    }),
  },
  {
    name: "get_build_info",
    description: "Read the Desktop version, buildId and complete build provenance for diagnostics and verification evidence. Does not open or save a design. Ordinary status/contracts use only buildId.",
    inputSchema: object({}),
  },
  {
    name: "get_image_service_status",
    description: "Read whether the image generation/edit service is configured and its model name. Does not return credentials or generate images.",
    inputSchema: object({}),
  },
  {
    name: "get_editor_view",
    description: "Read project/branch/session identity and the current editor viewport snapshot in view (arena, frame, zoom and pan). Pass view to execute restoreEditorView after checking the project. view is null without an active arena. Does not change design or UI state.",
    inputSchema: object({}),
  },
  {
    name: "get_org",
    description:
      "Resolve an accessible organization by orgId. Returns team id/name only for project selection. Requires login; does not navigate or save.",
    inputSchema: { ...object({ orgId: resourceId }), required: ["orgId"] },
  },
  {
    name: "list_orgs",
    description:
      "List accessible organization identities (teams: id/name). Optional query filters names by case-insensitive substring. Does not navigate or save.",
    inputSchema: object({ query: resourceName }),
  },
  {
    name: "create_org",
    description:
      "Create a NAS organization with the signed-in desktop account. Returns team from the platform Team model. The platform also creates its default workspace. Does not navigate; use open_org to open it.",
    inputSchema: { ...object({ name: resourceName }), required: ["name"] },
  },
  {
    name: "open_org",
    description:
      "Open the organization dashboard at /orgs/:orgId after checking access. Saves the current editable design before leaving it. Requires desktop login; returns opened, orgId and url.",
    inputSchema: { ...object({ orgId: resourceId }), required: ["orgId"] },
  },
  {
    name: "create_workspace",
    description:
      "Create a NAS workspace in orgId with a name and optional description. Requires desktop login and organization permission. Returns workspace; plan restrictions are errors. Does not navigate; use open_workspace to open it.",
    inputSchema: {
      ...object({
        orgId: resourceId,
        name: resourceName,
        description: { type: "string" },
      }),
      required: ["orgId", "name"],
    },
  },
  {
    name: "list_workspaces",
    description:
      "List accessible workspace id/name and parent team id/name, optionally within orgId. Does not return permissions, members or billing/configuration. Does not navigate or save.",
    inputSchema: object({ orgId: resourceId }),
  },
  {
    name: "open_workspace",
    description:
      "Open the workspace dashboard at /workspaces/:workspaceId after checking access. Saves the current editable design before leaving it. Requires desktop login; returns opened, workspaceId and url.",
    inputSchema: {
      ...object({ workspaceId: resourceId }),
      required: ["workspaceId"],
    },
  },
  {
    name: "create_project",
    description:
      "Create an empty private project with a name and optional workspaceId (omitting it uses the personal workspace). Returns project identity and parent IDs. Requires login and platform edit access. Does not navigate or save the active design; use open_design with project.id.",
    inputSchema: {
      ...object({ name: resourceName, workspaceId: resourceId }),
      required: ["name"],
    },
  },
  {
    name: "list_projects",
    description:
      "List accessible project identities and parent workspace/team IDs and names, optionally within workspaceId. Does not return permissions, credentials or platform configuration. Does not navigate or save.",
    inputSchema: object({ workspaceId: resourceId }),
  },
  {
    name: "open_design",
    description:
      "Open a NAS project and optionally a page/component. Saves the current editable design before switching projects. Requires desktop login.",
    inputSchema: {
      ...object({
        projectId: { type: "string", pattern: "^[A-Za-z0-9_-]+$" },
        componentUuid: { type: "string", minLength: 1 },
        reopen: { type: "boolean", description: "Save and reopen this project in a new editor session, including when it is already active." },
      }),
      required: ["projectId"],
    },
  },
  {
    name: "execute",
    description:
      "Call a validated Studio operation. Supports read, createComponent (page/component), insertHtml, changeElement (props/layout), deleteElement, state/interactions/tokens, navigate, scrollElementIntoView (reveal rendered content without changing the design), validate, save and undo. Obtain exact input schemas from get_app_state. Read component props/slot contracts before editing. Native schemas describe complete values; MCP may return ResultReference for large results or SVG source, retrievable through read_result. Save explicitly after design changes.",
    inputSchema: {
      ...object({
        name: { type: "string", enum: EDITOR_METHODS.filter((name) => !["preview", "executeBatch"].includes(name)) },
        input: { type: "object" },
      }),
      required: ["name", "input"],
    },
  },
  {
    name: "get_screenshot",
    description:
      "Return a clean rendered artboard as a WebP preview (quality 85, long edge at most 2048; fullResolution requests original-size lossless WebP) without editor chrome or slot placeholders. artboardElementUuid selects the whole artboard containing that visible element, useful for same-sized pages in one overview. elementUuid crops a visible node (including repeated instances). frameUuid selects an exact artboard. Otherwise captures the focused artboard; ambiguous canvases require an explicit target. width resizes the selected static rendering. componentUuid renders in a background canvas without changing the active arena or selection. Use mode workspace for the current editor view; rect applies only to workspace and componentUuid is not accepted. Not an interactive preview.",
    inputSchema: object({
      fullResolution: { type: "boolean", description: "Return original-size lossless WebP instead of the default compressed preview (long edge at most 2048)." },
      componentUuid: { type: "string", minLength: 1 },
      elementUuid: { type: "string", minLength: 1 },
      artboardElementUuid: { type: "string", minLength: 1 },
      frameUuid: { type: "string", minLength: 1 },
      mode: { type: "string", enum: ["artboard", "workspace"] },
      width: { type: "integer", minimum: 320, maximum: 4096 },
      height: { type: "integer", minimum: 1, maximum: 16383 },
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
tools.push(...prototypeTools);
tools.push(
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
      "Trace a local raster image to SVG paths with local color quantization; suitable for icons and flat artwork, not lossless photo reconstruction. At most 1 megapixel. Optional new SVG output and insertion as a Studio SVG asset; source is returned as a read_result reference.",
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
      "Generate, edit, remove or replace an image background using the configured Images service. Writes a new PNG and returns a lossy WebP preview (quality 85, maximum long edge 2048); path and fileMimeType describe the original file; import_image places it in the design. Requires image-service.json in desktop user data.",
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
      "Author SVG paths or apply union/intersection/subtraction/xor to closed geometry. Returns pathCount, total area, aggregate bounds and an SVG reference; read_result provides complete path source. Optionally insert through validated insertHtml. The asset remains editable by replacing SVG source.",
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
      "Capture an external HTTP(S) reference page or CSS-selected node while a ready, editable Studio project is open in edit mode. Returns a compressed WebP image (fullResolution for original-size lossless pixels) and a read_result reference to sanitized markup with computed styles for insertHtml. Native runtime acceptance belongs to preview; a failed preview leaves that acceptance incomplete. Does not share Studio cookies, modify the design or execute client-provided JavaScript. Cross-site scripts run only as part of normal browser page loading.",
    inputSchema: {
      ...object({
      fullResolution: { type: "boolean", description: "Return original-size lossless WebP instead of the default compressed preview (long edge at most 2048)." },
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
      "Read the bootstrap instructions for the current NAS-hosted Plasmic inspection, prototype and codegen workflows.",
    inputSchema: object({}),
  },
  {
    name: "execute_batch",
    description:
      "Run 1–30 validated editor operations in order. The whole batch is one atomic, undoable Studio transaction: any failure rolls back every edit. Only mutation operations are allowed. Bind a creation with as; later UUID fields accept $name (first created ID), $name.root (component root), or $name.1 (second created ID). Returns ordered compact creation identities and per-operation messages; read models explicitly. Save separately.",
    inputSchema: {
      ...object({
        operations: {
          type: "array",
          minItems: 1,
          maxItems: 30,
          items: {
            ...object({
              as: { type: "string", pattern: "^[A-Za-z][A-Za-z0-9_]*$" },
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
                      "restoreEditorView",
                      "selectElement",
                      "beginCanvasInspection",
                      "endCanvasInspection",
                      "scrollElementIntoView",
                      "validate",
                      "save",
                      "undo",
                      "executeBatch",
                      "preview",
                      "importWebPage",
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
      "Read a raster image already used in the active design and return a lossy WebP preview (quality 85, maximum long edge 2048, no upscaling); sourceImageSize reports original pixel dimensions. Obtain exact src values from snapshot_layout with view images. Supports authenticated NAS uploads; arbitrary URLs are rejected.",
    inputSchema: {
      ...object({ src: { type: "string", minLength: 1 } }),
      required: ["src"],
    },
  },
  {
    name: "snapshot_layout",
    description:
      "Read rendered layout. Default summary returns frame dimensions/counts and paginated problems. elements defaults to identity/geometry; request text/classes through fields. images/problems are paginated; full retains complete acceptance evidence. read.fields declares projections; omissions are not empty. Target frameUuid/elementUuid and follow nextOffset per frame. componentUuid inspects a background canvas without changing selection. Checks horizontal overflow, sticky Table-cell control containment (including native padding) and image loading; interactions, breakpoints and other overlap require Preview. Get editable IDs through execute read.",
    inputSchema: object({
      componentUuid: { type: "string", minLength: 1 },
      frameUuid: { type: "string", minLength: 1 },
      elementUuid: { type: "string", minLength: 1 },
      view: { type: "string", enum: ["summary", "elements", "images", "problems", "full"] },
      fields: { type: "array", minItems: 1, uniqueItems: true, items: { type: "string", enum: ["index", "elementUuid", "tag", "text", "classes", "x", "y", "width", "height", "horizontalOverflow", "src", "alt", "loaded", "type", "bounds", "viewportWidth", "cellContent"] } },
      offset: { type: "integer", minimum: 0 },
      limit: { type: "integer", minimum: 1, maximum: 100 },
    }),
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
  const results = new McpResults();
  const server = new Server(
    { name: "plasmic-desktop", version: require("../package.json").version },
    { capabilities: { tools: {} } },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const started = Date.now();
    try {
      const validator = validators.get(request.params.name);
      if (!validator) {
        throw new Error("Unknown desktop tool");
      }
      const checked = validator(request.params.arguments || {});
      if (!checked.valid) {
        const hint = request.params.name === "execute"
          ? ' Expected envelope: {"name":"read","input":{"collection":"components"}}; native operation fields belong inside input.'
          : request.params.name === "get_app_state"
          ? ' Example: {"toolNames":["read","insertHtml"]}.' : "";
        throw new Error(`${request.params.name}: ${checked.errorMessage}.${hint}`);
      }
      let result =
        request.params.name === "read_result"
          ? results.read(request.params.arguments || {})
          : request.params.name === "get_style"
          ? require("./design-styles.cjs").getStyle(
              request.params.arguments?.id,
            )
          : request.params.name === "read_skill"
            ? {
                instructions:
                  "Run npx -y @plasmickit/cli@latest context resolve --mode inspect for read-only inspection, --mode prototype for design edits, or --mode codegen for native development. Read returned mustRead paths starting with referencePath. Stop dependent work if resolution fails; do not silently use stale references.",
                resourceManifestUrl:
                  require("../desktop.config.json").updateUrl +
                  "/plasmic/latest.json",
              }
            : await requestRpc(
                profile,
                request.params.name,
                request.params.arguments || {},
              );
      if (request.params.name === "reference_browser") result = browserOutput(request.params.arguments?.action, result);
      if (request.params.name === "export_code" && Array.isArray(result.files)) result = { ...result, fileCount: result.files.length, files: results.retain(result.files) };
      const image = ["get_screenshot", "read_image", "capture_browser", "generate_image", "reference_browser", "design_reference", "preview"].includes(request.params.name) && result.data;
      const { data, ...metadata } = image ? result : { ...result };
      // Creation/import results keep geometry/HTML internally. Read it by reference
      // only when required; do not echo artwork or full captured pages by default.
      let output = image ? metadata : result;
      if ((typeof output?.svg === "string" && request.params.name !== "read_result") || typeof output?.html === "string") {
        const field = typeof output.svg === "string" ? "svg" : "html";
        output = { ...output, [field]: results.retain(output[field]) };
      }
      const response = results.output(output);
      if (image) response.content.push({ type: "image", data, mimeType: metadata.mimeType });
      return transportResult(request, response, started);
    } catch (error) {
      const { message, ...details } = errorPayload(error);
      return transportResult(request, { ...results.output({ error: message, ...details }), isError: true }, started);
    }
  });
  await server.connect(new StdioServerTransport());
  return server;
}
module.exports = { serveMcp, EDITOR_METHODS };
