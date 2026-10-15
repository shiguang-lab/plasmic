const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict");
const base = process.env.PROBE_OUTPUT_ROOT;
const runs = JSON.parse(fs.readFileSync(base + "/series-results.json"));
const median = (a) => {
  const x = [...a].sort((a, b) => a - b);
  return (
    (x[Math.floor((x.length - 1) / 2)] + x[Math.ceil((x.length - 1) / 2)]) / 2
  );
};
const p95 = (a) => [...a].sort((a, b) => a - b)[Math.ceil(0.95 * a.length) - 1];
const samples = [];
for (const run of runs) {
  const report = JSON.parse(
    fs.readFileSync(path.join(base, run.runId, "report.json")),
  );
  assert.equal(report.status, "PASS");
  assert(report.proxyRequests.length > 0);
  for (const s of report.samples) {
    assert.equal(s.revision, 18);
    assert.equal(s.frames.length, 4);
    assert.equal(s.editorContext.canEdit, true);
    const end = s.startAt + s.visibleCanvasMs;
    const q = report.proxyRequests.filter(
      (q) => q.startAt >= s.startAt && q.startAt < end,
    );
    const criticalLongTasks = s.longTasks.filter(
      (t) => s.timeOrigin + t.startMs < end,
    );
    const find = (phase) => s.timings.entries.find((e) => e.phase === phase);
    samples.push({
      platform: run.platform,
      mode: run.mode,
      round: run.round,
      runId: run.runId,
      phase: s.phase,
      revision: s.revision,
      targetFrameUuid: s.targetFrameUuid || s.editorContext.frameUuid,
      visibleCanvasMs: s.visibleCanvasMs,
      editableMs: s.editableMs,
      preStudioMs: s.timingStartAt - s.startAt,
      moduleImportMs: find("studio-module-import")?.durationMs,
      projectWaitMs: find("project-fetch")?.durationMs,
      unbundleMs: find("model-unbundle")?.durationMs,
      firstFrameRenderMs: find("frame-first-render")?.durationMs,
      maxHostLongTaskMs: Math.max(
        0,
        ...criticalLongTasks.map((t) => t.durationMs),
      ),
      apiRequests: q.filter((x) => x.path.startsWith("/api/")).length,
      networkRequests: q.length,
      networkBodyBytes: q.reduce((n, x) => n + (x.bytes || 0), 0),
      scriptBodyBytes: q
        .filter((x) => x.path.endsWith(".js"))
        .reduce((n, x) => n + (x.bytes || 0), 0),
      hiddenOnboardingImageBytes: q
        .filter((x) => x.path.includes("host-configure-project"))
        .reduce((n, x) => n + (x.bytes || 0), 0),
      editorView: s.editorContext.editorView,
    });
  }
}
for (const platform of ["desktop", "browser"]) {
  const group = samples.filter((s) => s.platform === platform);
  if (!group.length) continue;
  const ref = group[0].editorView;
  for (const s of group) {
    assert.equal(s.editorView.arenaId, ref.arenaId);
    assert(Math.abs(s.editorView.scale - ref.scale) < 0.00001);
    assert(Math.abs(s.editorView.scroll.x - ref.scroll.x) < 2);
    assert(Math.abs(s.editorView.scroll.y - ref.scroll.y) < 2);
  }
}
const summary = [];
for (const platform of ["desktop", "browser"])
  for (const phase of ["cold", "reopen"])
    for (const mode of ["before", "after"]) {
      const group = samples.filter(
        (s) => s.platform === platform && s.phase === phase && s.mode === mode,
      );
      if (!group.length) continue;
      summary.push({
        platform,
        phase,
        mode,
        n: group.length,
        editableP50: median(group.map((s) => s.editableMs)),
        editableP95: p95(group.map((s) => s.editableMs)),
        visibleP50: median(group.map((s) => s.visibleCanvasMs)),
        maxHostLongTaskP50: median(group.map((s) => s.maxHostLongTaskMs)),
        preStudioP50: median(group.map((s) => s.preStudioMs)),
        projectWaitP50: median(group.map((s) => s.projectWaitMs)),
        unbundleP50: median(group.map((s) => s.unbundleMs)),
        firstFrameRenderP50: median(group.map((s) => s.firstFrameRenderMs)),
        apiRequestsP50: median(group.map((s) => s.apiRequests)),
        networkBodyBytesP50: median(group.map((s) => s.networkBodyBytes)),
        scriptBodyBytesP50: median(group.map((s) => s.scriptBodyBytes)),
        hiddenOnboardingImageBytesP50: median(
          group.map((s) => s.hiddenOnboardingImageBytes),
        ),
      });
    }
const out = { generatedAt: new Date().toISOString(), samples, summary };
fs.writeFileSync(base + "/analysis.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(summary, null, 2));
