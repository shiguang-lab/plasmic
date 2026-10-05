import json from "@rollup/plugin-json";
import esbuild from "rollup-plugin-esbuild";

export default {
  input: "src/index.ts",
  external: (id) => !id.startsWith(".") && !id.startsWith("/"),
  plugins: [json(), esbuild()],
  output: [
    { file: "dist/index.js", format: "cjs", exports: "named", interop: "auto" },
    { file: "dist/index.esm.js", format: "esm" },
  ],
};
