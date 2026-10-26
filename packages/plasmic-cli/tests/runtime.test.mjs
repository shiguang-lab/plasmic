import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const run = promisify(execFile);
const runtimeUrl = new URL("../src/runtime.mjs", import.meta.url).href;

async function pythonPath(t, version) {
  const directory = await mkdtemp(path.join(tmpdir(), "plasmic-python-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  if (version !== undefined) {
    await writeFile(path.join(directory, "python3"), `#!/bin/sh\nprintf '%s\\n' '${JSON.stringify(version)}'\n`, { mode: 0o755 });
  }
  return { ...process.env, PATH: directory };
}

test("workflow runtime reports supported Python and rejects old or malformed versions", { skip: process.platform === "win32" }, async (t) => {
  for (const version of [[3, 9, 6], [3, 12, 1], [3, 8, 20], [2, 7, 18], "Python unknown"]) {
    const env = await pythonPath(t, version);
    const command = `const {verifyRuntime}=await import(${JSON.stringify(runtimeUrl)}); console.log(JSON.stringify(await verifyRuntime()));`;
    if (Array.isArray(version) && version[0] === 3 && version[1] >= 9) {
      const { stdout } = await run(process.execPath, ["--input-type=module", "-e", command], { env });
      assert.equal(JSON.parse(stdout).python.version, version.join("."));
    } else {
      await assert.rejects(run(process.execPath, ["--input-type=module", "-e", command], { env }), /Python 3\.9\+/);
    }
  }
});

test("both context resolvers fail before resource access when Python is missing", async (t) => {
  const env = await pythonPath(t);
  const calls = [
    [new URL("../src/references.mjs", import.meta.url).href, "resolveContext('prototype', {feed:'http://127.0.0.1:1/unreachable'})"],
    [new URL("../../../scripts/plasmic-local-context.mjs", import.meta.url).href, "resolveLocalContext('prototype', '/missing-resources', '/missing-cache')"],
  ];
  for (const [url, call] of calls) {
    const code = `const {resolveContext,resolveLocalContext}=await import(${JSON.stringify(url)}); await ${call};`;
    await assert.rejects(run(process.execPath, ["--input-type=module", "-e", code], { env }), error => {
      assert.match(error.stderr, /Python 3\.9\+.*python3/);
      assert.doesNotMatch(error.stderr, /fetch failed|scandir.*missing-resources/);
      return true;
    });
  }
});
