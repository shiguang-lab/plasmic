import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import resolve from "@rollup/plugin-node-resolve";
import glob from "glob";
import path from "path";
import esbuild from "rollup-plugin-esbuild";

const SKINNY_INPUTS = glob.sync("./src/register*.ts*");

export default [
  {
    input: ["./src/index.ts"],
    external: (id) => {
      if (id === "@react/ui" || id.startsWith("@react/ui/") || id.startsWith("regenerator-runtime") || id.startsWith("tslib")) {
        return false;
      }
      return !id.startsWith(".") && !path.isAbsolute(id);
    },
    output: [
      {
        file: "dist/index.esm.js",
        format: "esm",
        sourcemap: true,
        exports: "named",
      },
      {
        file: "dist/index.js",
        format: "cjs",
        paths: (id) => id.replace(/^antd\/es\//, "antd/lib/").replace(/^@ant-design\/icons\/es\//, "@ant-design/icons/lib/"),
        sourcemap: true,
        exports: "named",
        interop: "auto",
      },
    ],
    plugins: [
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
      if (id === "@react/ui" || id.startsWith("@react/ui/") || id.startsWith("regenerator-runtime") || id.startsWith("tslib")) {
        return false;
      }
      return !id.startsWith(".") && !path.isAbsolute(id);
    },
    output: [
      {
        dir: "skinny",
        format: "cjs",
        paths: (id) => id.replace(/^antd\/es\//, "antd/lib/").replace(/^@ant-design\/icons\/es\//, "@ant-design/icons/lib/"),
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
