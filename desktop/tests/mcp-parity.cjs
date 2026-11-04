// Compare the frozen optimized Node executable with the production Go helper.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { spawn } = require("node:child_process");
const { createHash } = require("node:crypto");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
const { startRpc } = require("../src/local-rpc.cjs");
const { mcpLaunch } = require("../src/mcp-launch.cjs");
const [baseline, output] = process.argv.slice(2);
assert.ok(baseline && output, "Usage: node mcp-parity.cjs <optimized-node-helper> <report.json>");
const commands = { node: path.resolve(baseline), go: mcpLaunch({ isPackaged: false }).command };
const decode = result => JSON.parse(result.content[0].text);
function comparable(result) {
  return { ...result, content: result.content.map(content => {
    if (content.type !== "text") return content;
    const value = JSON.parse(content.text);
    if (value.detail?.code === "INVALID_TOOL_ROUTE") {
      assert.ok(value.detail.stack.includes(value.detail.message));
      value.detail.stack = "runtime-specific stack";
    }
    return { ...content, text: value };
  }) };
}

function initialize(command, env, protocolVersion) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [], { env, stdio: ["pipe", "pipe", "pipe"] });
    const timer = setTimeout(() => { child.kill(); reject(new Error("Initialize/EOF timed out")); }, 5000);
    let buffer = "", result;
    child.once("error", reject); child.stderr.resume();
    child.stdout.on("data", data => {
      buffer += data;
      if (!result && buffer.includes("\n")) {
        try { result = JSON.parse(buffer.split("\n")[0]).result; child.stdin.end(); }
        catch (error) { child.kill(); reject(error); }
      }
    });
    child.once("exit", code => { clearTimeout(timer); code === 0 && result ? resolve(result) : reject(new Error("Initialize/EOF failed: " + buffer)); });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize",
      params: { protocolVersion, capabilities: {}, clientInfo: { name: "parity-test", version: "1" } } }) + "\n");
  });
}

function unsupportedMethod(command, env, method) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [], { env, stdio: ["pipe", "pipe", "pipe"] });
    let buffer = "", response;
    const timer = setTimeout(() => { child.kill(); reject(new Error("Method probe timed out")); }, 5000);
    child.once("error", reject); child.stderr.resume();
    const send = value => child.stdin.write(JSON.stringify({ jsonrpc: "2.0", ...value }) + "\n");
    child.stdout.on("data", data => {
      buffer += data;
      while (buffer.includes("\n")) {
        const index = buffer.indexOf("\n"), message = JSON.parse(buffer.slice(0, index)); buffer = buffer.slice(index + 1);
        if (message.id === 1) { send({ method: "notifications/initialized" }); send({ id: 2, method, params: {} }); }
        if (message.id === 2) { response = message; child.stdin.end(); }
      }
    });
    child.once("exit", code => { clearTimeout(timer); code === 0 && response ? resolve(response) : reject(new Error("Method probe failed")); });
    send({ id: 1, method: "initialize", params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "parity-test", version: "1" } } });
  });
}

(async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-mcp-parity-"));
  const env = { ...process.env, PLASMIC_DESKTOP_PROFILE: profile, DSH_AGENTS_HOME: path.join(profile, "agents") };
  const calls = [];
  const text = "😀业务<&>\u0000\n\"".repeat(20000);
  const receipt = { text, nested: { "10": "ten", "2": "two", z: "first", a: "last" } };
  const stop = await startRpc(profile, async (method, input) => {
    calls.push({ method, input });
    if (method === "execute" && input.name === "read") return receipt;
    if (method === "execute" && input.name === "validate") throw Object.assign(new Error("Preview blocked"), {
      stack: "Error: Preview blocked\n    at fixture", context: { code: "CONTEXT_MISMATCH", operationExecuted: false, actual: { mode: "preview" } },
    });
    if (method === "export_code") return { files: Array.from({ length: 120 }, (_, i) => "Component" + i + ".tsx"), outputPath: input.outputPath };
    if (method === "get_screenshot") return { data: "d2VicA==", mimeType: "image/webp", width: 1, height: 1 };
    if (method === "reference_browser") return { visible: true, url: "https://example.org", privateHistory: "hidden", selection: { selector: "#target", ancestors: [{ tag: "div" }], privateData: true } };
    return { ready: true };
  });
  const report = { binaries: {}, protocols: [], unsupportedMethods: [], cases: [] };
  try {
    for (const [label, command] of Object.entries(commands)) report.binaries[label] = { command, sha256: createHash("sha256").update(await fs.readFile(command)).digest("hex") };
    for (const version of ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05", "2024-10-07", "unsupported"]) {
      const a = await initialize(commands.node, env, version), b = await initialize(commands.go, env, version);
      assert.deepEqual(b, a); report.protocols.push({ requested: version, negotiated: b.protocolVersion });
    }
    for (const method of ["resources/list", "prompts/list", "logging/setLevel", "server/discover", "unknown-method"]) {
      const a = await unsupportedMethod(commands.node, env, method), b = await unsupportedMethod(commands.go, env, method);
      assert.ok(b.error, method + " must remain unavailable");
      assert.equal(b.jsonrpc, a.jsonrpc); assert.equal(b.id, a.id); assert.equal(b.error.code, a.error.code);
      assert.equal(typeof b.error.message, "string");
      report.unsupportedMethods.push({ method, code: b.error.code, nodeMessage: a.error.message, goMessage: b.error.message });
    }
    let expected;
    for (const [label, command] of Object.entries(commands)) {
      const client = new Client({ name: "parity-test", version: "1" });
      try {
        await client.connect(new StdioClientTransport({ command, env, stderr: "pipe" }));
        const tools = (await client.listTools()).tools;
        const actual = { tools, propertyOrder: tools.map(tool => Object.keys(tool.inputSchema.properties || {})), instructions: client.getInstructions(), cases: [] };
        const call = async (name, args) => client.callTool({ name, arguments: args });
        for (const [name, args] of [["get_style", {}], ["get_style", { id: "enterprise" }], ["read_skill", {}],
          ["reference_browser", { action: "get_state" }], ["get_screenshot", {}], ["execute", { name: "save" }],
          ["execute", { name: "validate" }], ["execute", { name: "list_projects", input: {} }], ["get_app_state", { toolNames: ["get_app_state"] }]]) {
          actual.cases.push(comparable(await call(name, args)));
        }
        const before = calls.length;
        const ref = decode(await call("execute", { name: "read", input: {} }));
        let recovered = "", offset = 0, pages = 0;
        const continuations = [];
        do {
          const response = await call("read_result", { resultId: ref.resultId, path: ["text"], offset, limit: 16000 });
          assert.ok(Buffer.byteLength(JSON.stringify(response)) <= 64 * 1024);
          const page = decode(response); recovered += page.text; offset = page.nextOffset; pages++;
          continuations.push(offset ?? null);
        } while (offset !== undefined);
        assert.equal(recovered, text); assert.equal(calls.length - before, 1);
        if (report.cases.length) assert.deepEqual(continuations, report.cases[0].continuations);
        const ordered = decode(await call("read_result", { resultId: ref.resultId, path: ["nested"], offset: 2, limit: 1 }));
        assert.equal(ordered.entries[0].key, "z");
        assert.equal(ordered.nextOffset, 3);
        const exported = decode(await call("export_code", { outputPath: "/tmp/parity-export" }));
        assert.equal(exported.fileCount, 120);
        const files = []; offset = 0;
        do { const page = decode(await call("read_result", { resultId: exported.files.resultId, offset })); files.push(...page.entries.map(e => e.value)); offset = page.nextOffset; } while (offset !== undefined);
        assert.equal(files.at(-1), "Component119.tsx");
        if (expected) assert.deepEqual(actual, expected); else expected = actual;
        report.cases.push({ label, toolCount: actual.tools.length, comparedCalls: actual.cases.length, unicodePages: pages, continuations, exportFiles: files.length, orderedPagination: true });
      } finally { await client.close(); }
    }
    report.passed = true;
    report.comparison = "JSON values compared independently of object key order. Bridge-local stack frames and SDK method-not-found wording differ by runtime; error codes/request IDs and remote diagnostic stacks are compared exactly.";
    await fs.writeFile(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report));
  } finally { await stop(); await fs.rm(profile, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
