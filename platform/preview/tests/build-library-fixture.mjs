import { build } from "esbuild";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

assert(
  process.argv[2],
  "Pass the output JSON path for the local library fixture",
);
const result = await build({
  stdin: {
    contents: `
      export { AppShell } from "./plasmicpkgs/antd6/src/registerAppShell";
      export { ActionGroup } from "./plasmicpkgs/react-ui/src/registerActionGroup";
    `,
    resolveDir: fileURLToPath(new URL("../../../", import.meta.url)),
    loader: "tsx",
  },
  bundle: true,
  platform: "browser",
  format: "iife",
  globalName: "PlasmicLibrary",
  footer: { js: "Object.assign(exports, PlasmicLibrary);" },
  jsx: "automatic",
  write: false,
  metafile: true,
  outfile: "libraries.js",
  plugins: [
    {
      name: "loader-builtin-modules",
      setup(builder) {
        const builtins = new Set([
          "react",
          "react/jsx-runtime",
          "react/jsx-dev-runtime",
          "react-dom",
          "react-dom/client",
          "@plasmicapp/host",
          "@plasmicapp/query",
        ]);
        builder.onResolve({ filter: /^(react|@plasmicapp\/)/ }, (args) =>
          builtins.has(args.path)
            ? { path: args.path, external: true }
            : undefined,
        );
      },
    },
  ],
  define: { "process.env.NODE_ENV": '"production"' },
});
const modules = result.outputFiles.map((file) => {
  const fileName = file.path.endsWith(".css")
    ? "libraries.css"
    : "libraries.js";
  return fileName.endsWith(".css")
    ? { type: "asset", fileName, source: file.text }
    : {
        type: "code",
        fileName,
        code: file.text,
        imports: result.metafile.outputs["libraries.js"].imports.map(
          (entry) => entry.path,
        ),
      };
});
await writeFile(
  process.argv[2],
  JSON.stringify({ modules: { server: [], browser: modules } }),
);
console.log(
  `Built ${modules.length} local library modules for published website verification`,
);
