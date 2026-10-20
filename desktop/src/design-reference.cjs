const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
const { encodeImagePreview } = require("./image-preview.cjs");

const REFERENCE_FIELDS = ["id", "name", "type", "layout", "width", "height", "padding", "gap", "justifyContent", "alignItems", "layoutPosition", "fill", "stroke", "cornerRadius", "fontFamily", "fontSize", "fontWeight", "lineHeight", "content"];
class DesignReference {
  constructor(profile) { this.profile = profile; }
  async connect() {
    if (this.connection) return this.connection;
    this.connection = (async () => {
      let config;
      try { config = JSON.parse(await fs.readFile(path.join(this.profile, "design-reference.json"), "utf8")); }
      catch (error) { if (error.code !== "ENOENT") throw error; }
      if (!config && process.platform === "darwin") {
        const command = `/Applications/Pen.app/Contents/Resources/app.asar.unpacked/out/mcp-server-darwin-${process.arch}`;
        await fs.access(command);
        config = { command, args: ["--app", "desktop", "--agent", "plasmic-reference"] };
      }
      if (!config || typeof config.command !== "string" || !path.isAbsolute(config.command) || !Array.isArray(config.args) || config.args.some((a) => typeof a !== "string")) throw new Error("Configure the installed Pen MCP command/args in Desktop user-data/design-reference.json");
      const transport = new StdioClientTransport({ command: config.command, args: config.args, stderr: "pipe" });
      transport.stderr?.on("data", () => {});
      const client = new Client({ name: "plasmic-reference-reader", version: "1.0.0" });
      client.onclose = () => { if (this.client === client) { this.client = undefined; this.connection = undefined; } };
      try {
        await client.connect(transport);
        transport.stderr?.resume();
        const list = await client.listTools();
        const execute = list.tools.find((t) => t.name === "execute");
        if (!execute?.inputSchema?.properties?.filePath || !execute.inputSchema.properties.input) throw new Error("Installed Pen MCP does not expose the required execute(filePath,input) contract");
        this.client = client;
        return client;
      } catch (error) { await client.close().catch(() => {}); throw error; }
    })().catch((error) => { this.connection = undefined; throw error; });
    return this.connection;
  }
  async read(input) {
    if (!["index", "read", "screenshot"].includes(input.action)) throw new Error("Unsupported design_reference action");
    if (!path.isAbsolute(input.filePath) || path.extname(input.filePath).toLowerCase() !== ".pen") throw new Error("Provide an absolute .pen reference path; references are read through Pen MCP only");
    input = { ...input, filePath: path.resolve(input.filePath) };
    const offset = input.offset ?? 0, limit = input.limit ?? 30, depth = input.depth ?? 1;
    const fields = input.fields || REFERENCE_FIELDS;
    if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 50 || !Number.isInteger(depth) || depth < 0 || depth > 3) throw new Error("Reference reads require bounded integer depth/pagination");
    if (!Array.isArray(fields) || !fields.length || fields.some((key) => !REFERENCE_FIELDS.includes(key))) throw new Error("Unsupported reference field");
    if (input.action !== "index" && (typeof input.nodeId !== "string" || !/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(input.nodeId))) throw new Error("A native Pen node ID/path is required");
    const client = await this.connect();
    const exportDirectory = input.action === "screenshot" && input.fullResolution === true
      ? await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-reference-")) : undefined;
    let code;
    if (input.action === "screenshot") code = `Get(${JSON.stringify(input.nodeId)},(n,c)=>Print("PLASMIC_REF:"+JSON.stringify({width:c.bounds.width,height:c.bounds.height})),{depth:0}); ` +
      (exportDirectory ? `Export([${JSON.stringify(input.nodeId)}],"png",${JSON.stringify(exportDirectory)},{scale:1});` : `TakeScreenshot([${JSON.stringify(input.nodeId)}])`);
    else if (input.action === "index") code = `const rows=[]; Get((n,c)=>{ if(c.depth===0) rows.push({id:n.id,name:n.name,type:n.type,width:c.bounds.width,height:c.bounds.height}); },{depth:0}); Print("PLASMIC_REF:"+JSON.stringify({items:rows.slice(${offset},${offset + limit}),total:rows.length}));`;
    else if (input.action === "read") code = `const rows=[]; Get(${JSON.stringify(input.nodeId)},(n,c)=>{ const item={}; for(const key of ${JSON.stringify(fields)}) if(n[key]!==undefined) item[key]=n[key]; rows.push({...item,depth:c.depth,bounds:c.bounds,children:Array.isArray(n.children)?n.children.map(child=>child.id):[]}); },{depth:${depth},resolveVariables:true,resolveInstances:true}); Print("PLASMIC_REF:"+JSON.stringify({items:rows.slice(${offset},${offset + limit}),total:rows.length}));`;
    else throw new Error("Unsupported design_reference action");
    try {
    const result = await client.callTool({ name: "execute", arguments: { filePath: input.filePath, description: `Read-only Plasmic reference ${input.action}`, input: code } }, undefined, { timeout: 90000 });
    const texts = result.content.filter((c) => c.type === "text").map((c) => c.text).join("\n");
    if (result.isError) throw new Error(`Pen reference read failed: ${texts.slice(0, 1000)}`);
    const source = { provider: "pen-mcp", tool: "execute", filePath: input.filePath, ...(input.nodeId ? { nodeId: input.nodeId } : {}) };
    if (input.action === "screenshot") {
      const boundsLine = texts.split("\n").find((line) => line.startsWith("PLASMIC_REF:"));
      const sourceFrameSize = boundsLine && JSON.parse(boundsLine.slice("PLASMIC_REF:".length));
      if (!sourceFrameSize || ![sourceFrameSize.width, sourceFrameSize.height].every((v) => Number.isFinite(v) && v > 0)) throw new Error("Pen returned no reference frame dimensions");
      let bytes;
      if (exportDirectory) {
        const files = (await fs.readdir(exportDirectory, { recursive: true })).filter((file) => file.endsWith(".png"));
        if (files.length !== 1) throw new Error("Pen must export exactly one reference frame image");
        bytes = await fs.readFile(path.join(exportDirectory, files[0]));
      } else {
        const images = result.content.filter((c) => c.type === "image");
        if (images.length !== 1) throw new Error("Pen must return exactly one reference frame image");
        bytes = Buffer.from(images[0].data, "base64");
      }
      const image = await encodeImagePreview(bytes, { lossless: input.fullResolution === true });
      const scale = { x: image.width / sourceFrameSize.width, y: image.height / sourceFrameSize.height };
      if (exportDirectory && (image.width < Math.floor(sourceFrameSize.width) || image.height < Math.floor(sourceFrameSize.height))) throw new Error("Pen export did not provide source-resolution pixels");
      return { source: { ...source, capture: exportDirectory ? "Export" : "TakeScreenshot" }, sourceFrameSize, scale, ...image };
    }
    const line = texts.split("\n").find((line) => line.startsWith("PLASMIC_REF:"));
    if (!line) throw new Error("Pen returned no structured reference read; verify its execute contract");
    const data = JSON.parse(line.slice("PLASMIC_REF:".length));
    if (!Array.isArray(data.items) || !Number.isInteger(data.total)) throw new Error("Invalid Pen reference read");
    return { source, read: { fields: input.action === "index" ? ["id", "name", "type", "width", "height"] : fields, depth: input.action === "index" ? 0 : depth, offset, limit }, ...data,
      ...(offset + data.items.length < data.total ? { nextOffset: offset + data.items.length } : {}) };
    } finally {
      if (exportDirectory) await fs.rm(exportDirectory, { recursive: true, force: true });
    }
  }
  async close() { await this.client?.close(); this.connection = undefined; this.client = undefined; }
}
module.exports = { DesignReference, REFERENCE_FIELDS };
