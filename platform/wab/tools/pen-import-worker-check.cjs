// Smoke-test the production Worker (including QuickJS/WASM) in real Chromium.
// Build first with PUBLIC_URL=STATIC_URL=http://localhost:3003.
const { createServer } = require("node:http");
const { readFileSync, readdirSync } = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

async function main() {
  const root = path.resolve(__dirname, "../build");
  const js = path.join(root, "static/js/async");
  const file = readdirSync(js).find(
    (f) =>
      f.endsWith(".js") &&
      readFileSync(path.join(js, f), "utf8").includes(
        "Pen import expands to too many layers",
      ),
  );
  assert(file, "Build the Studio before running this check");
  const server = createServer((request, response) => {
    response.setHeader("Access-Control-Allow-Origin", "*");
    const uri = new URL(request.url, "http://localhost").pathname;
    if (uri === "/") {
      response.setHeader("Content-Type", "text/html");
      response.end("<!doctype html><title>Pen import worker check</title>");
      return;
    }
    const target =
      uri === "/comlink.mjs"
        ? require.resolve("comlink/dist/esm/comlink.mjs")
        : path.resolve(root, `.${uri}`);
    if (uri !== "/comlink.mjs" && !target.startsWith(`${root}/`)) {
      response.writeHead(403);
      response.end();
      return;
    }
    try {
      response.setHeader("Content-Type", "application/javascript");
      response.end(readFileSync(target));
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(3003, "127.0.0.1", resolve);
  });
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto("http://localhost:3003");
    const result = await page.evaluate(async (workerPath) => {
      const { wrap, releaseProxy } = await import("/comlink.mjs");
      const worker = new Worker(workerPath);
      const reader = wrap(worker);
      const doc = (children, extra = {}) =>
        JSON.stringify({ version: "2.21", children, ...extra });
      const files = {
        "bundle/design.pen": doc(
          [
            {
              type: "frame",
              id: "root",
              width: 800,
              height: 600,
              children: [
                {
                  type: "ref",
                  id: "instance",
                  ref: "lib:card",
                  descendants: { label: { content: "引用覆盖" } },
                },
                {
                  type: "script",
                  id: "script",
                  width: 200,
                  height: 32,
                  scriptUri: "scripts/parent.js",
                },
                {
                  type: "icon",
                  id: "icon",
                  library: "lucide",
                  icon: "check",
                  width: 16,
                  height: 16,
                  fill: "#123456",
                },
              ],
            },
          ],
          { imports: { lib: "library.lib.pen" } },
        ),
        "bundle/library.lib.pen": doc([
          {
            type: "frame",
            id: "card",
            children: [{ type: "text", id: "label", content: "Default" }],
          },
        ]),
        "bundle/scripts/parent.js": `return [{type:'script',width:pencil.width,height:pencil.height,scriptUri:'scripts/child.js'}];`,
        "bundle/scripts/child.js": `return [{type:'text',content:'script:'+typeof fetch+':'+typeof document}];`,
      };
      try {
        const designs = await reader.read(
          Object.entries(files).map(([path, value]) => ({
            path,
            file: new File([value], path.split("/").pop()),
          })),
        );
        const canvases = await reader.frames(designs[0].id);
        const design = await reader.convert(designs[0].id, canvases[0].id);
        const flatten = (n) => [n, ...n.children.flatMap(flatten)];
        return {
          text: flatten(design.root)
            .filter((n) => n.text !== undefined)
            .map((n) => n.text),
          assets: design.assets.length,
        };
      } finally {
        reader[releaseProxy]();
        worker.terminate();
      }
    }, `/static/js/async/${file}`);
    assert.deepEqual(result, {
      text: ["引用覆盖", "script:undefined:undefined"],
      assets: 1,
    });
    console.log(
      "PASS: production Pen Worker, library overrides, nested scripts, isolated globals and Lucide assets in Chromium",
    );
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
