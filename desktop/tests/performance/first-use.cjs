const { app } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const root = path.resolve(process.argv[2]), output = process.argv[3], feature = process.argv[4] || "image";
const { monitorEventLoopDelay } = require("node:perf_hooks");
require(path.join(root, "src/main.cjs"));
const { encodeImagePreview } = require(path.join(root, "src/image-preview.cjs"));
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=", "base64");
app.whenReady().then(async () => {
  const delay = monitorEventLoopDelay({ resolution: 1 }); delay.enable();
  await new Promise(resolve => setTimeout(resolve, 20));
  let start = performance.now();
  // The MCP server runs in its own stdio process. This measures module/validator
  // setup only; transport and desktop RPC have separate regression tests.
  if (feature === "server") require(path.join(root, "src/mcp.cjs"));
  const serverSetupMs = performance.now() - start;
  start = performance.now();
  const images = await Promise.all([encodeImagePreview(png), encodeImagePreview(png)]);
  const firstConcurrentImageMs = performance.now() - start;
  start = performance.now(); await encodeImagePreview(png);
  const warmImageMs = performance.now() - start;
  await new Promise(resolve => setTimeout(resolve, 20)); delay.disable();
  const result = { feature, serverSetupMs, firstConcurrentImageMs, warmImageMs,
    eventLoopMaxMs: delay.max / 1e6, imageSizes: images.map(i => [i.width,i.height]) };
  fs.writeFileSync(output, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result)); app.exit();
}).catch(error => { console.error(error); app.exit(1); });
