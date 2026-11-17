import { build } from "esbuild";
import { rm } from "node:fs/promises";
await rm("dist", { recursive: true, force: true });
for (const format of ["cjs", "esm"]) {
  await build({
    entryPoints: ["src/index.ts", "src/components.tsx"],
    bundle: true,
    packages: "external",
    platform: "neutral",
    format,
    target: "es2020",
    outdir: "dist",
    outExtension: { ".js": format === "esm" ? ".esm.js" : ".js" },
    sourcemap: true,
  });
}
