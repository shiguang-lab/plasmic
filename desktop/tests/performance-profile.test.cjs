const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");

const script = path.join(__dirname, "performance/studio-pipeline.cjs");
const source = fs.readFileSync(script, "utf8");

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pipeline-profile-test-"));
  const normal = path.join(root, "Plasmic Desktop");
  fs.mkdirSync(normal);
  const credential = path.join(normal, "device-session.json");
  fs.writeFileSync(credential, "untouched normal authorization");
  const paths = {};
  let locks = 0, quits = 0;
  const app = {
    on() {},
    getPath: () => root,
    setName() {},
    setPath: (name, value) => { paths[name] = value; },
    requestSingleInstanceLock: () => { locks++; return false; },
    quit: () => { quits++; },
  };
  const run = profile => {
    const mod = new Module(script);
    mod.filename = script;
    const originalRequire = mod.require.bind(mod);
    mod.require = name => name === "electron" ? { app } : originalRequire(name);
    // Supply diagnostic arguments without changing the test runner's process.
    mod._compile(`(function(process) {\n${source}\n})(${JSON.stringify({ env: {}, argv: ["electron", script, "installed", profile, "project", path.join(root, "report")] })});`, script);
  };
  t.after(() => {
    try {
      assert.equal(fs.readFileSync(credential, "utf8"), "untouched normal authorization");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
  return { root, normal, paths, run, locks: () => locks, quits: () => quits };
}

test("performance diagnostics reject the normal App profile before acquiring or using it", t => {
  const f = fixture(t);
  assert.throws(() => f.run(f.normal), /must not use the normal App profile/);
  assert.equal(f.locks(), 0);
  assert.deepEqual(f.paths, {});
});

test("a symlink cannot expose the normal App profile to diagnostics", t => {
  const f = fixture(t);
  const alias = path.join(f.root, "diagnostic-alias");
  fs.symlinkSync(f.normal, alias, "dir");
  assert.throws(() => f.run(alias), /must not use the normal App profile/);
  assert.equal(f.locks(), 0);
});

test("an already running diagnostic profile prevents a second credential owner", t => {
  const f = fixture(t);
  const profile = path.join(f.root, "independent-diagnostic");
  fs.mkdirSync(profile);
  f.run(profile);
  assert.equal(f.locks(), 1);
  assert.equal(f.quits(), 1);
  assert.deepEqual(f.paths, { userData: fs.realpathSync(profile), sessionData: fs.realpathSync(profile) });
  assert.equal(fs.existsSync(path.join(f.root, "report")), false);
  assert.equal(fs.existsSync(profile), true);
});
