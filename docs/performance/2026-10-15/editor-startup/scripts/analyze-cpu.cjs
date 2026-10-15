const fs = require("fs"),
  path = require("path"),
  { createRequire } = require("module");
const req = createRequire(path.join(process.env.PROBE_REPO, "package.json"));
const { TraceMap, originalPositionFor } = req("@jridgewell/trace-mapping");
const base = process.env.PROBE_OUTPUT_ROOT;
const summaries = [];
for (const mode of ["before", "after"]) {
  const trace = JSON.parse(
    fs.readFileSync(`${base}/desktop-${mode}-cpu/startup.trace.json`),
  );
  const groups = new Map();
  for (const e of trace.traceEvents.filter((e) => e.name === "ProfileChunk")) {
    const key = e.pid + ":" + e.tid + ":" + e.id;
    let g = groups.get(key);
    if (!g)
      groups.set(
        key,
        (g = { pid: e.pid, tid: e.tid, nodes: new Map(), chunks: [] }),
      );
    const d = e.args.data;
    for (const n of d.cpuProfile?.nodes || []) g.nodes.set(n.id, n);
    g.chunks.push(d);
  }
  const mapCache = new Map();
  const locate = (frame) => {
    let url = frame.url || "",
      original;
    try {
      if (url.startsWith("https://studio.plasmic.shiguanglab.com/")) {
        let f = base + "/" + mode + "/build" + new URL(url).pathname + ".map";
        let map = mapCache.get(f);
        if (map === undefined) {
          map = fs.existsSync(f)
            ? new TraceMap(JSON.parse(fs.readFileSync(f)))
            : null;
          mapCache.set(f, map);
        }
        if (map)
          original = originalPositionFor(map, {
            line: (frame.lineNumber || 0) + 1,
            column: Math.max(0, frame.columnNumber || 0),
          });
      }
    } catch {}
    return original?.source
      ? {
          source: original.source,
          name: original.name || frame.functionName,
          line: original.line,
        }
      : {
          source: url || "(anonymous/eval)",
          name: frame.functionName || "(anonymous)",
          line: frame.lineNumber,
        };
  };
  for (const g of groups.values()) {
    const totals = new Map(),
      functions = new Map();
    let idle = 0,
      active = 0;
    for (const d of g.chunks) {
      const samples = d.cpuProfile?.samples || [];
      for (let i = 0; i < samples.length; i++) {
        const node = g.nodes.get(samples[i]);
        if (!node) continue;
        const duration = (d.timeDeltas?.[i] || 0) / 1000;
        if (["(idle)", "(root)"].includes(node.callFrame.functionName)) {
          idle += duration;
          continue;
        }
        active += duration;
        const f = locate(node.callFrame),
          key = f.source,
          fn = f.source + ":" + f.line + ":" + f.name;
        totals.set(key, (totals.get(key) || 0) + duration);
        functions.set(fn, (functions.get(fn) || 0) + duration);
      }
    }
    summaries.push({
      mode,
      pid: g.pid,
      tid: g.tid,
      activeSampleMs: active,
      idleSampleMs: idle,
      topSources: [...totals]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 25)
        .map(([source, selfMs]) => ({ source, selfMs })),
      topFunctions: [...functions]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30)
        .map(([fn, selfMs]) => ({ function: fn, selfMs })),
    });
  }
}
fs.writeFileSync(
  base + "/cpu-analysis.json",
  JSON.stringify(summaries, null, 2),
);
for (const s of summaries)
  console.log(
    s.mode,
    s.pid,
    s.activeSampleMs.toFixed(1),
    s.topSources.slice(0, 10),
  );
