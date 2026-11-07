const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { execFileSync, spawnSync } = require("node:child_process");

test("macOS runtime loads bundled dylibs after its original build tree is removed", { skip: process.platform !== "darwin" }, async t => {
  const { relocateComponentReuseRuntime } = await import("../scripts/component-reuse-runtime.mjs");
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "component-runtime-relocation-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const build = path.join(directory, "build"); const runtime = path.join(directory, "runtime");
  await fs.mkdir(build); await fs.mkdir(runtime);
  const source = path.join(directory, "fixture.c"); const main = path.join(directory, "main.c");
  await fs.writeFile(source, "int answer(void) { return 42; }\n");
  await fs.writeFile(main, '#include <stdio.h>\nextern int answer(void); int main(void) { printf("%d\\n", answer()); return 0; }\n');
  execFileSync("clang", ["-dynamiclib", source, "-Wl,-install_name,@rpath/libfixture.dylib", "-o", path.join(build, "libfixture.dylib")]);
  execFileSync("clang", [main, "-L" + build, "-lfixture", "-Wl,-rpath," + build, "-o", path.join(build, "llama-server")]);
  for (const name of ["llama-server", "libfixture.dylib"]) await fs.copyFile(path.join(build, name), path.join(runtime, name));
  await fs.rm(build, { recursive: true });
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith("DYLD_")));
  const executable = path.join(runtime, "llama-server");
  assert.notEqual(spawnSync(executable, { env }).status, 0);
  await relocateComponentReuseRuntime(runtime, "darwin");
  assert.equal(execFileSync(executable, { env, cwd: os.tmpdir(), encoding: "utf8" }).trim(), "42");
  const before = await fs.readFile(executable);
  await relocateComponentReuseRuntime(runtime, "darwin");
  assert.deepEqual(await fs.readFile(executable), before);
});
