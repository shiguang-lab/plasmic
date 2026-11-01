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
const { tools, assertToolRouting } = require("./mcp-contract.cjs");
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
        : detail.code === "PREVIEW_RUNTIME_ERROR" ? `Preview runtime error: ${detail.message}`
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
module.exports = { serveMcp };
