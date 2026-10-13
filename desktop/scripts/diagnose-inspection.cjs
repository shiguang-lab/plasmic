// Read-only timing probe for targeted snapshots versus navigate + snapshot.
// Uses the same authenticated local RPC as MCP; never saves or opens a project.
const fs = require("node:fs/promises");
const path = require("node:path");
const { parseArgs } = require("node:util");
const { requestRpc } = require("../src/local-rpc.cjs");

async function main() {
  const { values } = parseArgs({ options: {
    profile: { type: "string" }, "project-id": { type: "string" },
    output: { type: "string" }, rounds: { type: "string", default: "3" },
  } });
  const rounds = Number(values.rounds);
  if (!values.profile || !values["project-id"] || !values.output ||
      !Number.isInteger(rounds) || rounds < 1 || rounds > 10) {
    throw new Error("Use --profile PATH --project-id ID --output NEW_DIRECTORY [--rounds 1..10]");
  }
  await fs.mkdir(values.output, { recursive: false });
  const report = { startedAt: new Date().toISOString(), projectId: values["project-id"], rounds, stages: [] };
  const output = path.join(values.output, "report.json");
  const persist = () => fs.writeFile(output, JSON.stringify(report, null, 2) + "\n");
  let original, state, navigated = false;
  async function call(stage, method, input = {}) {
    const record = { stage, method, operation: input.name, componentUuid: input.componentUuid || input.input?.componentUuid,
      startedAt: new Date().toISOString() };
    report.stages.push(record);
    await persist();
    console.log(stage);
    const started = performance.now();
    try {
      const result = await requestRpc(values.profile, method, input);
      record.ok = true;
      if (method === "snapshot_layout") {
        record.frames = result.frames.map((frame) => ({ frameUuid: frame.frameUuid, componentUuid: frame.componentUuid,
          ready: frame.ready, truncated: frame.truncated, width: frame.width, height: frame.height }));
      }
      return result;
    } catch (error) {
      record.ok = false;
      record.error = error.message;
      throw error;
    } finally {
      record.durationMs = Math.round(performance.now() - started);
      await persist();
    }
  }
  const execute = (stage, name, input = {}) => call(stage, "execute", { name, input });
  try {
    state = await call("initial metadata", "get_app_state");
    report.desktopVersion = state.version;
    if (!state.ready || state.projectId !== values["project-id"]) {
      throw new Error("Open the requested project before running this probe");
    }
    await execute("identify", "identify", { model: "diagnostic-script", client: "diagnose-inspection", skill: "plasmic" });
    original = await execute("initial context", "getEditorContext");
    report.before = original;
    if (!original.editorView || !state.editorTools.restoreEditorView) {
      throw new Error("View restoration is required for the navigation probe");
    }
    const overview = await execute("overview", "read");
    const projects = overview.results.filter((item) => item.__type === "Project");
    if (projects.length !== 1) throw new Error("Expected one project overview");
    const pages = projects[0].components.filter((item) => item.type === "page");
    report.pages = pages.map((page) => ({ uuid: page.uuid, path: page.pageMeta?.path }));
    if (!pages.length) throw new Error("No pages to inspect");
    for (let round = 1; round <= rounds; round++) {
      for (const page of pages) {
        await call(`targeted ${round}: ${page.uuid}`, "snapshot_layout", { componentUuid: page.uuid });
      }
    }
    for (const targeted of [true, false]) {
      const mode = targeted ? "targeted" : "unscoped";
      for (let round = 1; round <= rounds; round++) {
        for (const page of pages) {
          navigated = true;
          await execute(`navigate ${mode} ${round}: ${page.uuid}`, "navigate", { componentUuid: page.uuid });
          await call(`immediate ${mode} snapshot ${round}: ${page.uuid}`, "snapshot_layout",
            targeted ? { componentUuid: page.uuid } : {});
          await call(`post-${mode} metadata ${round}: ${page.uuid}`, "get_app_state");
        }
      }
    }
    report.completed = true;
  } catch (error) {
    report.error = error.message;
    process.exitCode = 1;
  } finally {
    if (navigated) {
      try {
        const current = await call("restore identity check", "get_app_state");
        if (current.projectId !== report.projectId) throw new Error("Project changed; view restoration skipped");
        await execute("restore editor view", "restoreEditorView", original.editorView);
        if (original.selectedElementUuids?.length === 1 && original.componentUuid) {
          await execute("restore selection", "selectElement", {
            componentUuid: original.componentUuid, elementUuid: original.selectedElementUuids[0],
            ...(original.frameUuid ? { frameUuid: original.frameUuid } : {}),
            ...(original.instanceIndex != null ? { instanceIndex: original.instanceIndex } : {}),
          });
        }
        report.after = await execute("final context", "getEditorContext");
      } catch (error) {
        report.restoreError = error.message;
        process.exitCode = 1;
      }
    }
    await persist();
    console.log(output);
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
