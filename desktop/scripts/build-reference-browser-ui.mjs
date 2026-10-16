import { build } from "esbuild";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const desktop = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const require = createRequire(
  new URL("../../platform/wab/package.json", import.meta.url),
);
export async function buildReferenceBrowserUi(
  target = path.join(desktop, "renderer"),
) {
  await build({
    entryPoints: [path.join(desktop, "src/reference-browser-scroll.jsx")],
    outfile: path.join(target, "reference-browser-ui.js"),
    nodePaths: [path.resolve(desktop, "../platform/wab/node_modules")],
    bundle: true,
    alias: {
      react: path.dirname(require.resolve("react/package.json")),
      "react-dom": path.dirname(require.resolve("react-dom/package.json")),
    },
    minify: true,
    format: "iife",
    platform: "browser",
    define: { "process.env.NODE_ENV": '"production"' },
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url))
  await buildReferenceBrowserUi(process.argv[2]);
