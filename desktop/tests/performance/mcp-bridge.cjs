// Fresh, isolated bridge processes; no live Desktop or project is accessed.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const { gzipSync } = require("node:zlib");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
const { startRpc } = require("../../src/local-rpc.cjs");

const [baseline, output] = process.argv.slice(2);
assert.equal(process.platform, "darwin", "Physical footprint measurement requires macOS");
assert.ok(baseline && output, "Usage: node mcp-bridge.cjs <baseline-helper> <output.json>");
const current = path.resolve(__dirname, "../../mcp-bin/darwin-" + process.arch + "/plasmic-mcp");

function memory(pid) {
  const summary = execFileSync("/usr/bin/vmmap", ["-summary", String(pid)], { encoding: "utf8" });
  const footprint = summary.match(/^Physical footprint:\s+([\d.]+)([KMG])/m);
  assert.ok(footprint, "vmmap must report physical footprint");
  return {
    rssKiB: Number(execFileSync("ps", ["-p", String(pid), "-o", "rss="], { encoding: "utf8" }).trim()),
    footprintMiB: Number(footprint[1]) * ({ K: 1 / 1024, M: 1, G: 1024 }[footprint[2]]),
  };
}

(async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-mcp-footprint-"));
  const stop = await startRpc(profile, async () => ({ ready: true }));
  const samples = [];
  try {
    const binaries = {};
    for (const [label, command] of [["baseline", baseline], ["current", current]]) {
      const bytes = await fs.readFile(command);
      binaries[label] = {
        command: path.resolve(command),
        sha256: createHash("sha256").update(bytes).digest("hex"),
        binaryBytes: bytes.length,
        gzipBytes: gzipSync(bytes, { level: 9 }).length,
        version: JSON.parse(execFileSync(command, ["--version"], { encoding: "utf8" })),
      };
    }
    for (const label of Array.from({ length: 5 }, () => ["baseline", "current", "current", "baseline"]).flat()) {
      const client = new Client({ name: "memory-benchmark", version: "1" });
      const transport = new StdioClientTransport({ command: binaries[label].command,
        env: { ...process.env, PLASMIC_DESKTOP_PROFILE: profile }, stderr: "pipe" });
      try {
        const start = performance.now();
        await client.connect(transport);
        await client.listTools();
        const discoveryMs = performance.now() - start;
        const initialized = memory(transport.pid);
        const callStart = performance.now();
        const result = await client.callTool({ name: "get_app_state", arguments: {} });
        const firstCallMs = performance.now() - callStart;
        assert.equal(result.isError, false, JSON.stringify(result));
        assert.deepEqual(JSON.parse(result.content[0].text), { ready: true });
        samples.push({ label, discoveryMs, firstCallMs, initialized, afterFirstCall: memory(transport.pid) });
      } finally { await client.close(); }
    }
    const concurrent = [];
    for (const label of ["baseline", "current"]) {
      const clients = [], transports = [];
      try {
        for (let i = 0; i < 11; i++) {
          const client = new Client({ name: "concurrent-benchmark", version: "1" });
          clients.push(client);
          const transport = new StdioClientTransport({ command: binaries[label].command,
            env: { ...process.env, PLASMIC_DESKTOP_PROFILE: profile }, stderr: "pipe" });
          transports.push(transport);
          await client.connect(transport);
          assert.equal((await client.callTool({ name: "get_app_state", arguments: {} })).isError, false);
        }
        const until = Date.now() + 30000, calls = [0, 0];
        await Promise.all(clients.slice(0, 2).map(async (client, i) => {
          while (Date.now() < until) {
            const result = await client.callTool({ name: "execute", arguments: { name: "read", input: { collection: "components" } } });
            assert.equal(result.isError, false, JSON.stringify(result)); calls[i]++;
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }));
        const processes = transports.map((transport, index) => ({ role: index < 2 ? "active" : "idle", ...memory(transport.pid) }));
        concurrent.push({ label, durationMs: 30000, connections: 11, activeConnections: 2, activeCalls: calls,
          footprintSumMiB: processes.reduce((sum, process) => sum + process.footprintMiB, 0), processes });
      } finally { await Promise.all(clients.map(client => client.close())); }
    }
    const summarize = values => {
      const sorted = [...values].sort((a, b) => a - b);
      return { mean: values.reduce((a, b) => a + b, 0) / values.length,
        median: (sorted[4] + sorted[5]) / 2, p95: sorted[Math.ceil(values.length * 0.95) - 1] };
    };
    const summary = Object.fromEntries(["baseline", "current"].map(label => {
      const rows = samples.filter(sample => sample.label === label);
      return [label, { discoveryMs: summarize(rows.map(row => row.discoveryMs)), firstCallMs: summarize(rows.map(row => row.firstCallMs)),
        initializedFootprintMiB: summarize(rows.map(row => row.initialized.footprintMiB)),
        afterFirstCallFootprintMiB: summarize(rows.map(row => row.afterFirstCall.footprintMiB)) }];
    }));
    const report = { binaries, samples, summary, concurrent,
      limitation: "Ten fresh processes per binary with warm OS file caches; one fixture tool plus 30 seconds of 11 connections (9 idle, 2 reading). Footprint sums are per-process measurements, not whole-system memory. Binary/gzip sizes cover the bridge, not the full Electron installer. No live design workload or forced GC." };
    await fs.writeFile(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report));
  } finally { await stop(); await fs.rm(profile, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
