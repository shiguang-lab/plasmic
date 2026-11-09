const { test } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const repository = path.resolve(__dirname, "../..");
const electronPackage = require("../node_modules/electron/package.json");
const electronBinary = require("electron");
const chromiumEnvironment = "PLASMIC_DESKTOP_CHROMIUM_VERSION";

async function buildFixture({ desktop, pinnedElectron = electronPackage.version }) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "studio-build-target-"));
  const output = path.join(root, "test-output");
  await fs.mkdir(output);
  for (const name of ["scripts/build-studio.mjs", "scripts/build-identity.mjs", "scripts/studio-build-target.mjs"]) {
    await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await fs.copyFile(path.join(repository, name), path.join(root, name));
  }
  await fs.mkdir(path.join(root, "desktop/mcp"), { recursive: true });
  await fs.mkdir(path.join(root, "platform/wab/tools"), { recursive: true });
  await fs.writeFile(path.join(root, "package.json"), '{"type":"module"}');
  await fs.writeFile(path.join(root, "desktop/package.json"), JSON.stringify({ devDependencies: { electron: pinnedElectron } }));
  await fs.writeFile(path.join(root, "platform/wab/tools/react-compiler.mjs"), "export const reactCompilerBuildInfo=()=>({enabled:true});");
  if (desktop) {
    await fs.mkdir(path.join(root, "desktop/node_modules/electron"), { recursive: true });
    await fs.writeFile(path.join(root, "desktop/node_modules/electron/index.js"), "module.exports=" + JSON.stringify(electronBinary) + ";");
  }
  await fs.writeFile(path.join(root, ".gitignore"), "build/\ntest-output/\nnode_modules/\n");
  const preload = path.join(root, "mock-build.mjs");
  await fs.writeFile(preload, `
    import child from 'node:child_process';
    import {syncBuiltinESMExports} from 'node:module';
    import fs from 'node:fs';
    import path from 'node:path';
    const original=child.execFileSync;
    child.execFileSync=(command,args,options)=>{
      let stage;
      if(['npm','npm.cmd'].includes(path.basename(command))) stage=path.relative(process.cwd(),options.cwd)+':'+args[1];
      else if(args[0]?.endsWith('build-html-hydrate.mjs')) stage='hydration';
      if(stage){
        fs.appendFileSync('test-output/calls.jsonl',JSON.stringify({stage,chromium:options.env?.${chromiumEnvironment}??null})+'\\n');
        if(stage==='platform/wab:build'){
          fs.mkdirSync('platform/wab/build',{recursive:true});
          fs.writeFileSync('platform/wab/build/studio.js','compiled fixture');
        }
        return Buffer.alloc(0);
      }
      return original(command,args,options);
    };
    syncBuiltinESMExports();
  `);
  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["add", "."], { cwd: root });
  execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.test", "commit", "-qm", "fixture"], { cwd: root });
  return {
    root,
    run() {
      return execFileSync(process.execPath, ["--import", preload, "scripts/build-studio.mjs", ...(desktop ? ["--desktop"] : [])], {
        cwd: root,
        env: { ...process.env, [chromiumEnvironment]: "1.2.3.4" },
        encoding: "utf8",
        stdio: "pipe",
      });
    },
    async result() {
      return {
        metadata: JSON.parse(await fs.readFile(path.join(root, "platform/wab/build/studio-build.json"), "utf8")),
        calls: (await fs.readFile(path.join(output, "calls.jsonl"), "utf8")).trim().split("\n").map(JSON.parse),
      };
    },
    dispose: () => fs.rm(root, { recursive: true, force: true }),
  };
}

test("default Web build ignores inherited Desktop target across every build child", async () => {
  const fixture = await buildFixture({ desktop: false });
  try {
    fixture.run();
    const { metadata, calls } = await fixture.result();
    assert.deepEqual(calls.map(call => call.stage), ["platform/wab:build-css", "hydration", "platform/sub:build", "platform/live-frame:build", "platform/wab:build"]);
    assert(calls.every(call => call.chromium === null), "Web children must not inherit a Desktop target");
    assert.equal(Object.hasOwn(metadata, "browserTarget"), false);
  } finally { await fixture.dispose(); }
});

test("Desktop build queries the pinned actual Electron and scopes Chromium to WAB compilation", async () => {
  const fixture = await buildFixture({ desktop: true });
  try {
    fixture.run();
    const { metadata, calls } = await fixture.result();
    assert.equal(metadata.browserTarget.kind, "desktop");
    assert.equal(metadata.browserTarget.electron, electronPackage.version);
    assert.match(metadata.browserTarget.chromium, /^\d+\.\d+\.\d+\.\d+$/);
    assert(calls.slice(0, -1).every(call => call.chromium === null), "Only the WAB build receives the Desktop target");
    assert.equal(calls.at(-1).stage, "platform/wab:build");
    assert.equal(calls.at(-1).chromium, metadata.browserTarget.chromium);
  } finally { await fixture.dispose(); }
});

test("Desktop build rejects an installed Electron that differs from its pinned package before building", async () => {
  const fixture = await buildFixture({ desktop: true, pinnedElectron: "0.0.0" });
  try {
    assert.throws(() => fixture.run(), /package requires 0\.0\.0/);
    await assert.rejects(fs.access(path.join(fixture.root, "test-output/calls.jsonl")), { code: "ENOENT" });
  } finally { await fixture.dispose(); }
});

test("package target validation preserves Web assets and rejects an incompatible Desktop descriptor", async () => {
  const { assertDesktopBrowserTarget } = await import("../../scripts/studio-build-target.mjs");
  assert.doesNotThrow(() => assertDesktopBrowserTarget(undefined, "45.2.1"));
  assert.doesNotThrow(() => assertDesktopBrowserTarget({ kind: "web" }, "45.2.1"));
  assert.doesNotThrow(() => assertDesktopBrowserTarget({ kind: "desktop", electron: "45.2.1", chromium: "156.0.8078.75" }, "45.2.1"));
  assert.throws(() => assertDesktopBrowserTarget({ kind: "desktop", electron: "44.0.0", chromium: "152.0.0.0" }, "45.2.1"), /package requires 45\.2\.1/);
  assert.throws(() => assertDesktopBrowserTarget({ kind: "desktop", electron: "45.2.1" }, "45.2.1"), /actual Chromium/);
});

test("explicit Desktop child environment does not mutate or leak the parent's target", async () => {
  const { studioBuildEnvironment } = await import("../../scripts/studio-build-target.mjs");
  const parent = { NODE_ENV: "production", [chromiumEnvironment]: "unexpected inherited target" };
  assert.deepEqual(studioBuildEnvironment(undefined, parent), { NODE_ENV: "production" });
  assert.deepEqual(studioBuildEnvironment({ kind: "desktop", chromium: "156.0.8078.75" }, parent), { NODE_ENV: "production", [chromiumEnvironment]: "156.0.8078.75" });
  assert.equal(parent[chromiumEnvironment], "unexpected inherited target");
});
