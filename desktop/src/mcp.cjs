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
const { requestRpc, connectRpcSession, MCP_REGISTER_CALLER } = require("./local-rpc.cjs");
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
  "listLibraries",
  "getLibrary",
  "searchLibraryComponents",
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
  "setCanvasPageHeight",
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
    name: "report_task",
    description: "Report the actual current task and execution stage to Desktop Dynamic Island. Requires the current ready project. Start with running and a stable taskId, then monotonically increase sequence for stage/result updates. Status blocked requires a real blocker; completed/failed ends the task. Supply stageIndex and stageCount together only for an explicit, known plan, never inferred from tool calls. This is ephemeral UI metadata: it neither edits nor saves designs. Native MCP read/write/Preview activity is displayed automatically even without task reports.",
    inputSchema: { ...object({
      taskId: { type: "string", minLength: 1, maxLength: 240 },
      projectId: resourceId,
      sequence: { type: "integer", minimum: 0 },
      title: { type: "string", minLength: 1, maxLength: 240 },
      stage: { type: "string", maxLength: 240 },
      status: { enum: ["running", "blocked", "completed", "failed"] },
      stageIndex: { type: "integer", minimum: 1 },
      stageCount: { type: "integer", minimum: 1 },
      error: { type: "string", maxLength: 1600 },
    }), required: ["taskId", "projectId", "sequence", "title", "status"],
      dependencies: { stageIndex: ["stageCount"], stageCount: ["stageIndex"] } },
  },
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
      "Read readiness, current project/session/model identity, selection and active operations. context reports surface, mode, previewKind, project/session, canvas identity and effective canEdit; ready is editor-model availability, not iframe rendering approval. view:tools lists callable native editor operations; toolNames selects only those contracts for execute. Top-level MCP tools (including this tool, get_screenshot, snapshot_layout and execute_batch) already have contracts in tools/list; never request them in toolNames. executeBatch points to execute_batch; read constituent contracts. schemaView:full adds complete output schemas and native batch inputs. Context mismatches include required/actual and explicit recovery calls; ordinary reads/writes never switch modes or projects. Reuse contracts only within the same buildId/session. Build provenance, image-service status and editor viewport have separate read tools.",
    inputSchema: object({
      view: { type: "string", enum: ["status", "tools"] },
      toolNames: {
        type: "array",
        description: "Native editor operation names from availableEditorTools, not top-level MCP tool names. Omit for readiness; use view:tools for discovery.",
        items: { type: "string", enum: EDITOR_METHODS },
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
    name: "get_workspace",
    description:
      "Resolve an accessible workspace by workspaceId. Returns workspace id/name and parent team id/name only. Requires login; does not navigate or save.",
    inputSchema: { ...object({ workspaceId: resourceId }), required: ["workspaceId"] },
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
    name: "get_project",
    description:
      "Resolve an accessible project by projectId. Returns project identity and parent workspace/team IDs and names only. Does not read design content, navigate or save.",
    inputSchema: { ...object({ projectId: resourceId }), required: ["projectId"] },
  },
  {
    name: "rename_project",
    description:
      "Rename a project using the platform's existing permissions. Returns updated project identity. If this project is open, saves it before renaming and reloads the editor after success; a failed save blocks the rename. Other projects do not navigate or save the active design.",
    inputSchema: { ...object({ projectId: resourceId, name: resourceName }), required: ["projectId", "name"] },
  },
  {
    name: "move_project",
    description:
      "Move a project to an explicit destination workspaceId, including the personal workspace's actual ID. The platform checks source/destination permissions, transfer restrictions and plan limits. Returns updated project identity; plan restrictions are errors. If this project is open, saves it before moving and reloads the editor after success; a failed save blocks the move. Other projects do not navigate or save the active design.",
    inputSchema: { ...object({ projectId: resourceId, workspaceId: resourceId }), required: ["projectId", "workspaceId"] },
  },
  {
    name: "clone_project",
    description:
      "Copy a project's saved main branch into a new project, with optional name and destination workspaceId (omitting it uses the personal workspace). Returns the new project identity. Saves the source first if it is open and editable; a failed save blocks copying. Does not open the copy or change the active editor. Requires platform read access to the source and create access at the destination.",
    inputSchema: { ...object({ projectId: resourceId, name: resourceName, workspaceId: resourceId }), required: ["projectId"] },
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
      "Call only a native editor operation from availableEditorTools; never put top-level list_orgs, list_projects, create_project, open_design or preview here. Use an envelope {name, input}, where input holds that operation's own parameters. Component libraries: listLibraries lists/searches the catalog and installed versions; getLibrary reads latest publication/components and update availability; searchLibraryComponents finds providers before installation; installLibrary/upgradeLibrary use the returned projectId. Supports read, createComponent (page/component), insertHtml, changeElement (props/layout), deleteElement, state/interactions/tokens, navigate, scrollElementIntoView (reveal rendered content without changing the design), setCanvasPageHeight (session-only full page height view when screenshots stay incomplete; restore the returned previous mode), validate, save and undo. Parameterless operations (save, undo, validate) take no parameters, so input may be omitted. Reading specific element properties with propNames requires view: 'properties'. Targeting elementUuid in changeElement/selectElement requires its defining componentUuid, not the host page. deleteCanvas and deleteElement return standard mutation receipts with created: [] and messages confirming deletion. Obtain exact input schemas from get_app_state. Read component props/slot contracts before editing. Native schemas describe complete values; MCP may return ResultReference for large results or SVG source, retrievable through read_result. Save explicitly after design changes.",
    inputSchema: {
      ...object({
        name: { type: "string", enum: EDITOR_METHODS.filter((name) => !["preview", "executeBatch"].includes(name)) },
        input: { type: "object" },
      }),
      required: ["name"],
    },
  },
  {
    name: "get_screenshot",
    description:
      "Return a clean rendered artboard as a WebP preview (quality 85, long edge at most 2048; fullResolution requests original-size lossless WebP) without editor chrome or slot placeholders. For content review use fullContent:true to expand nested scroll regions in the isolated copy and capture a long image, defaulting to original-size lossless pixels. This covers rendered DOM only; unmounted virtualized items and unloaded content require Preview scrolling. If the image is still incomplete, call execute setCanvasPageHeight {mode:'full'}, capture again, then restore the returned previous mode. Keep a normal viewport capture for layout acceptance. Prefer componentUuid for a Page; frameUuid pins an exact artboard, including an offscreen Page or overview frame. componentUuid/frameUuid isolate a single component or single artboard by rendering it on a background canvas without changing the active arena or selection; when combined the frame must belong to the component. This background re-render always runs even when the target is already on the visible canvas, so it stays clean and leaves the viewport untouched, but it can be slow and may time out on heavy multi-artboard canvases (freeform mixed canvases, overview/summary pages). For those, do not pin a target: first bring the artboard into view with execute navigate (componentUuid) to open its arena, then capture with mode workspace to grab the live current viewport in milliseconds (optionally with rect). artboardElementUuid selects the whole artboard containing that visible element; elementUuid crops a visible node (including repeated instances). Without a component/frame target captures the focused rendered artboard; ambiguous canvases require an explicit target. width resizes the selected static rendering. Use mode workspace for the current editor view; rect applies only to workspace and componentUuid/frameUuid are not accepted. Not an interactive preview.",
    inputSchema: object({
      fullContent: { type: "boolean", description: "Artboard only: expand nested horizontal/vertical scroll regions in an isolated static copy and capture the full rendered DOM as a long image. Does not change the live canvas or saved design. Defaults to original-size lossless pixels unless fullResolution:false. Reports scroll regions and rendered-dom coverage; unmounted virtualized items and unloaded content are not included. Maximum 16383 pixels per side and 20 megapixels; use elementUuid for a smaller region." },
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
      "Before design inspection, creation, revision or codegen, read these workflow bootstrap instructions unless resources and required references are already resolved and read for the current task and mode. Pass the current client's Plasmic skillPath when known, including non-shared installations; otherwise checks the shared agents skill directory. Honors that skill's local source, or resolves published resources if none is configured. Follow the returned resolver and mustRead files before design work; tool availability alone does not load the design rules.",
    inputSchema: object({ skillPath: { type: "string", minLength: 1, description: "Absolute path of the current client's installed Plasmic SKILL.md; use the loaded skill path, do not guess another client's directory." } }),
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
                      "listLibraries",
                      "getLibrary",
                      "searchLibraryComponents",
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
                      "setCanvasPageHeight",
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
      "Read rendered layout. Default summary returns frame dimensions/counts and paginated problems. elements defaults to identity/geometry; request text/classes through fields. images/problems are paginated; full retains complete acceptance evidence. read.fields declares projections; omissions are not empty. Prefer componentUuid for a Page; frameUuid pins an exact artboard even when offscreen. componentUuid/frameUuid inspect a single component or single artboard on a background canvas without changing selection; when combined the frame must belong to the component. This background re-render runs even when the target is already on the visible canvas and may be slow or time out on heavy multi-artboard canvases; for those, navigate the artboard into view with execute navigate (componentUuid) and read get_screenshot mode workspace instead of pinning a target. elementUuid filters that rendering; follow nextOffset per frame. Checks horizontal overflow, sticky Table-cell control containment (including native padding) and image loading; interactions, breakpoints and other overlap require Preview. Get editable IDs through execute read.",
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
const toolNames = new Set(tools.map((tool) => tool.name));
function assertToolRouting(method, input = {}) {
  let message, recovery;
  if (method === "execute" && toolNames.has(input.name)) {
    message = `Call top-level ${input.name} directly, not as an execute editor operation. Use the parameters from execute.input; management tools do not require editor context.`;
    recovery = [{ tool: input.name, arguments: input.input || {} }];
  } else if (!toolNames.has(method) && EDITOR_METHODS.includes(method)) {
    const tool = method === "executeBatch" ? "execute_batch" : "execute";
    message = `${method} is a native editor operation. Call ${tool} instead.`;
    recovery = [{ tool, arguments: tool === "execute" ? { name: method, input } : input }];
  } else if (method === "get_app_state" && Array.isArray(input.toolNames)) {
    const misplaced = input.toolNames.filter((name) => toolNames.has(name));
    if (misplaced.length) {
      message = `${misplaced.join(", ")} are top-level Desktop tools. Their schemas come from MCP tools/list; get_app_state.toolNames accepts only native editor operations from availableEditorTools.`;
      recovery = misplaced.map((name) => ({ tool: name, requiresInput: tools.find((tool) => tool.name === name).inputSchema.required || [] }));
    }
  }
  if (message) throw Object.assign(new Error(message), { context: {
    code: "INVALID_TOOL_ROUTE", operationExecuted: false, recovery,
  } });
}
const schemaValidator = new AjvJsonSchemaValidator();
const validators = new Map(
  tools.map((tool) => [
    tool.name,
    schemaValidator.getValidator(tool.inputSchema),
  ]),
);
async function serveMcp(profile) {
  const session = await connectRpcSession(profile);
  const results = new McpResults();
  const server = new Server(
    { name: "plasmic-desktop", version: require("../package.json").version },
    { capabilities: { tools: {} }, instructions: "Before design inspection, creation, revision or codegen, call read_skill with the current Plasmic skillPath when known and follow its resolver and mustRead files unless already resolved and read for the current task and mode. This applies even when the client has no installed Plasmic skill. Call top-level tools such as list_orgs, list_projects, create_project, open_design and preview directly. Only native editor operations such as read and save belong in execute {name,input}; discover them with get_app_state view:tools. Management and open_design work without an existing editor. Failed tool calls return isError:true and JSON {msg,detail}. Show msg to the user; inspect detail for the original message, stack, error code, execution status, context and recovery steps. If detail is a ResultReference, use read_result before recovery or retry. Do not replay mutations unless detail.operationExecuted is false or readback confirms the outcome." },
  );
  const requireDesktop = () => {
    if (session.destroyed) throw new Error("Start Plasmic before connecting MCP");
  };
  let callerReady;
  const registerCaller = () => callerReady ??= requestRpc(
    profile, MCP_REGISTER_CALLER, { clientInfo: server.getClientVersion() }, session.callerId,
  );
  server.oninitialized = () => { void registerCaller().catch(() => server.close()); };
  server.onclose = () => session.destroy();
  session.once("close", () => { void server.close(); });
  server.setRequestHandler(ListToolsRequestSchema, async () => { requireDesktop(); await registerCaller(); return { tools }; });
  server.setRequestHandler(CallToolRequestSchema, async (request, { signal }) => {
    const started = Date.now();
    try {
      requireDesktop();
      await registerCaller();
      assertToolRouting(request.params.name, request.params.arguments || {});
      const validator = validators.get(request.params.name);
      if (!validator) {
        throw new Error("Unknown desktop tool");
      }
      // execute accepts an optional input envelope: parameterless operations
      // (save/undo/validate) may omit it, and an empty object can be dropped in
      // transit. Normalize to {} so downstream native schemas see an object and
      // report missing fields precisely instead of failing on undefined.
      if (request.params.name === "execute" && request.params.arguments) {
        request.params.arguments.input = request.params.arguments.input ?? {};
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
            ? await require("./skill-bootstrap.cjs").readSkillBootstrap(undefined, request.params.arguments?.skillPath)
            : await requestRpc(
                profile,
                request.params.name,
                request.params.arguments || {},
                session.callerId,
                signal,
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
      const detail = errorPayload(error);
      const msg = detail.code === "INVALID_TOOL_ROUTE" ? detail.message
        : detail.code === "CONTEXT_MISMATCH" ? "Switch to the required editor context."
        : detail.code === "PREVIEW_TARGET_BLOCKED" ? "The target is covered by another element."
        : detail.code === "PREVIEW_TIMEOUT" ? "Preview timed out."
        : detail.code?.startsWith("PREVIEW_") ? "Preview operation failed."
        : "Tool call failed.";
      return transportResult(request, results.error(msg, detail), started);
    }
  });
  try {
    await server.connect(new StdioServerTransport());
    requireDesktop();
  } catch (error) {
    session.destroy();
    await server.close();
    throw error;
  }
  return server;
}
module.exports = { serveMcp, EDITOR_METHODS, assertToolRouting };
