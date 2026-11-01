// Run in a fresh Electron process; deliberately does not bootstrap Desktop.
const { app } = require("electron");
const Module = require("node:module");
const path = require("node:path");
const fs = require("node:fs");
const root = path.resolve(process.argv[2] || path.join(__dirname, "../.."));
const output = process.argv[3];
const timings = [], stack = [];
const original = Module._load;
Module._load = function (request, ...args) {
  const start = performance.now(), frame = { children: 0 };
  stack.push(frame);
  try { return original.call(this, request, ...args); }
  finally {
    const ms = performance.now() - start;
    stack.pop();
    if (stack.length) stack.at(-1).children += ms;
    timings.push({ request, ms, selfMs: ms - frame.children });
  }
};
const start = performance.now();
require(path.join(root, "src/main.cjs"));
const totalMs = performance.now() - start;
Module._load = original;
const loaded = Object.keys(require.cache);
const result = { electron: process.versions.electron, totalMs,
  loadedModuleCount: loaded.length,
  heavyModules: loaded.filter(file => /modelcontextprotocol|node_modules\/sharp|node_modules\/ajv/.test(file)),
  topInclusive: timings.sort((a, b) => b.ms - a.ms).slice(0, 25) };
if (output) fs.writeFileSync(output, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
app.exit();
