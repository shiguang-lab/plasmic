import { libraryThumbnails } from "../../scripts/library-thumbnails.mjs";
import { fileURLToPath } from "node:url";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import resolve from "@rollup/plugin-node-resolve";
import glob from "glob";
import path from "path";
import esbuild from "rollup-plugin-esbuild";

const thumbnails = await libraryThumbnails(path.dirname(fileURLToPath(import.meta.url)), "@shiguang-lab/plasmic-antd6");

const SKINNY_INPUTS = [
  ...glob.sync("./src/{register*,form/Form*,form/registerForm,form/SchemaForm}.ts*"),
  "./src/native.ts",
];

const configs = [
  {
    input: ["./src/index.ts"],
    external: (id) => {
      if (id.startsWith("regenerator-runtime") || id.startsWith("tslib")) {
        return false;
      }
      return !id.startsWith(".") && !path.isAbsolute(id);
    },
    output: [
      {
        file: "dist/antd.esm.js",
        format: "esm",
        sourcemap: true,
        exports: "named",
      },
      {
        file: "dist/index.js",
        format: "cjs",
        sourcemap: true,
        exports: "named",
        interop: "auto",
      },
    ],
    plugins: [
      thumbnails,
      resolve(),
      commonjs(),
      json(),
      esbuild({
        loaders: {
          ".json": "json",
        },
      }),
    ],
  },
  {
    input: SKINNY_INPUTS,
    external: (id) => {
      if (id.startsWith("regenerator-runtime") || id.startsWith("tslib")) {
        return false;
      }
      return !id.startsWith(".") && !path.isAbsolute(id);
    },
    output: [
      {
        dir: "skinny",
        format: "cjs",
        sourcemap: true,
        exports: "named",
        interop: "auto",
        entryFileNames: `[name].cjs.js`,
        chunkFileNames: `[name]-[hash].cjs.js`,
      },
      {
        dir: "skinny",
        format: "esm",
        sourcemap: true,
        exports: "named",
        interop: "auto",
        entryFileNames: `[name].esm.js`,
        chunkFileNames: `[name]-[hash].esm.js`,
      },
    ],
    plugins: [
      thumbnails,
      resolve(),
      commonjs(),
      json(),
      esbuild({
        loaders: {
          ".json": "json",
        },
      }),
    ],
  },
];

export default [
  ...configs,
  { ...configs[1], input: ["./src/canvas-overlay.ts"] },
];
