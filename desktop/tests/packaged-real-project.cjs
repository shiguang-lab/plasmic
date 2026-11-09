const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { spawn, execFileSync } = require("node:child_process");
const { parseArgs } = require("node:util");
const { setTimeout: delay } = require("node:timers/promises");
const { createHash } = require("node:crypto");
const asar = require("@electron/asar");
const { requestRpc } = require("../src/local-rpc.cjs");
const { createPackagedProjectProxy } = require("./fixtures/packaged-project-proxy.cjs");
const {values} = parseArgs({options: {app: {type: "string"}, fixtures: {type: "string"}, report: {type: "string"}}});
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const protocolHandler = () => execFileSync("/usr/bin/osascript", ["-l", "JavaScript", "-e",
  'ObjC.import("AppKit");var u=$.NSWorkspace.sharedWorkspace.URLForApplicationToOpenURL($.NSURL.URLWithString("plasmic-desktop://oauth/callback"));u.isNil()?"":u.path.js;'], {encoding: "utf8"}).trim();
async function until(read, description, timeout = 120000) {
  const end = Date.now() + timeout; let last;
  while (Date.now() < end) {
    try { const value = await read(); if (value) return value; } catch (error) {last = error;}
    await delay(250);
  }
  throw new Error(`Timed out: ${description}${last ? ` (${last.message})` : ""}`);
}
async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const ended = new Promise(resolve => child.once("exit", resolve));
  child.kill("SIGTERM");
  const timeout = setTimeout(() => child.kill("SIGKILL"), 10000);
  await ended; clearTimeout(timeout);
}
(async () => {
  assert.equal(process.platform, "darwin");
  assert(values.app && values.fixtures && values.report, "Pass --app, --fixtures and --report");
  const app = await fs.realpath(values.app), reportDir = path.resolve(values.report);
  assert(!app.startsWith("/Applications/"), "Use an independently installed task App");
  await fs.mkdir(reportDir, {recursive: true});
  const archive = path.join(app, "Contents/Resources/app.asar");
  const manifest = JSON.parse(asar.extractFile(archive, "renderer/desktop-assets.json"));
  const entry = asar.extractFile(archive, "src/entry.cjs").toString();
  assert.match(entry, /require\("\.\/main.cjs"\)\.bootstrap/);
  const {getCurrentFuseWire, FuseV1Options} = require("@electron/fuses");
  const wire = await getCurrentFuseWire(app);
  for (const option of [FuseV1Options.RunAsNode, FuseV1Options.EnableNodeOptionsEnvironmentVariable, FuseV1Options.EnableNodeCliInspectArguments]) assert.equal(wire[option], 48);
  execFileSync("/usr/bin/codesign", ["--verify", "--deep", "--strict", app]);
  const originalProtocolHandler = protocolHandler();
  const report = {app, asarSha256: hash(await fs.readFile(archive)), build: manifest.build, originalProtocolHandler, scope: "Installed App, unmodified packaged main and renderer, independent profiles, exact real-project offline fixtures; no NAS writes or live authentication claim", projects: []};
  for (const dataset of ["gp", "complex"]) {
    const output = path.join(reportDir, dataset), fixture = path.join(path.resolve(values.fixtures), dataset);
    const proxy = await createPackagedProjectProxy(fixture, path.join(output, "network"));
    const profile = path.join(output, "profile"); await fs.mkdir(profile, {recursive: true});
    const executable = path.join(app, "Contents/MacOS/Plasmic");
    const record = {dataset, projectId: proxy.projectId, sourceFixtureSha256: hash(proxy.originalBundle), cases: []};
    let child, log;
    try {
      const launch = async () => {
        log = await fs.open(path.join(output, "app.log"), "a");
        const env = {...process.env, PLASMIC_DESKTOP_PROFILE: profile, HTTPS_PROXY: proxy.proxyUrl, HTTP_PROXY: proxy.proxyUrl, NO_PROXY: ""};
        delete env.NODE_OPTIONS; delete env.ELECTRON_RUN_AS_NODE;
        child = spawn(executable, [`--ignore-certificate-errors-spki-list=${proxy.spki}`], {stdio: ["ignore", log.fd, log.fd], env});
        const info = await until(() => requestRpc(profile, "get_build_info"), "packaged RPC startup");
        assert.equal(info.build.rendererHash, manifest.build.rendererHash); assert.equal(info.build.desktopHash, manifest.build.desktopHash);
        assert.equal(protocolHandler(), originalProtocolHandler, "Isolated App must not replace the user's login handler");
        await requestRpc(profile, "open_design", {projectId: proxy.projectId});
        return info;
      };
      await launch(); record.cases.push("packaged-startup-and-real-project-open");
      const bundle = JSON.parse(proxy.originalBundle);
      const component = Object.values(bundle.map).find(value => value.__type === "Component" && value.type === "page");
      assert(component, "Real fixture must contain a page");
      const root = bundle.map[component.tplTree.__ref], target = {componentUuid: component.uuid, elementUuid: root.uuid};
      await requestRpc(profile, "get_app_state", {toolNames: ["read", "changeElement", "undo", "save", "navigate"], schemaView: "full"});
      const execute = (name, input = {}) => requestRpc(profile, "execute", {name, input});
      const readTarget = async () => {
        const value = await execute("read", {view: "tree", elements: [target], fields: ["uuid", "name"], depth: 0});
        const matches = [];
        const walk = item => {if (!item || typeof item !== "object") return; if (item.uuid === root.uuid && Object.hasOwn(item, "name")) matches.push(item.name); for (const value of Object.values(item)) walk(value);};
        walk(value); assert.equal(matches.length, 1, "Read must return the exact original element"); return matches[0];
      };
      await execute("navigate", {componentUuid: component.uuid});
      const originalName = await readTarget();
      assert(typeof originalName === "string" && originalName.length > 0, "Acceptance edits an existing named root");
      const reviewContext = {purpose: "Keep the existing page content, references and interactions intact while identifying its internal editor root clearly.", customOnly: false};
      const editedName = "DesktopAcceptance";
      await execute("changeElement", {...target, name: editedName, reviewContext}); assert.equal(await readTarget(), editedName);
      assert.equal((await execute("undo")).undone, true); assert.equal(await readTarget(), originalName);
      record.cases.push("native-registered-edit-and-undo-readback");
      await execute("changeElement", {...target, name: editedName, reviewContext});
      const saved = await execute("save"); assert.equal(saved.saved, true); assert(proxy.report.saves.length > 0);
      record.savedRevision = saved.revision; record.savedSha256 = hash(proxy.getSavedBundle());
      record.cases.push("real-save-endpoint-to-isolated-backend");
      await stop(child); await log.close(); log = undefined;
      await launch();
      await execute("navigate", {componentUuid: component.uuid}); assert.equal(await readTarget(), editedName);
      record.cases.push("quit-relaunch-and-persisted-model-readback");
      await execute("changeElement", {...target, name: originalName, reviewContext}); await execute("save");
      const preview = await requestRpc(profile, "preview", {action: "open", componentUuid: component.uuid}); assert.equal(preview.ready, true);
      const snapshot = await requestRpc(profile, "preview", {action: "snapshot"});
      assert(snapshot.text.total > 20, "Actual Preview business content must render");
      assert.equal(snapshot.runtime?.errors?.length ?? 0, 0, "Preview must have no runtime errors");
      await fs.writeFile(path.join(output, "preview-snapshot.json"), JSON.stringify(snapshot, null, 2));
      await requestRpc(profile, "preview", {action: "close"}); record.cases.push("real-native-preview-open-inspect-close");
      const image = await requestRpc(profile, "get_screenshot", {mode: "workspace"});
      assert(image.data && image.width > 0 && image.height > 0);
      await fs.writeFile(path.join(output, "installed-editor.webp"), Buffer.from(image.data, "base64"));
      record.cases.push("installed-renderer-visible-screenshot");
      record.finalState = await requestRpc(profile, "get_app_state");
      record.savedFixtureSha256 = hash(proxy.getSavedBundle()); record.backend = proxy.report;
      assert.equal(proxy.report.blocked.length, 0, "No fixture write or immutable resource may fail");
      report.projects.push(record); await fs.writeFile(path.join(reportDir, "report.json"), JSON.stringify(report, null, 2));
    } catch (error) {
      record.error = {name: error.name, message: error.message, stack: error.stack};
      record.backend = proxy.report;
      report.passed = false;
      report.projects.push(record);
      await fs.writeFile(path.join(reportDir, "report.json"), JSON.stringify(report, null, 2));
      throw error;
    } finally {if (child) await stop(child); await log?.close(); await proxy.close();}
  }
  report.passed = true; await fs.writeFile(path.join(reportDir, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({passed: true, projects: report.projects.map(project => ({dataset: project.dataset, cases: project.cases})), report: path.join(reportDir, "report.json")}));
})().catch(error => {console.error(error.stack); process.exitCode = 1;});
