import { reactCompilerPlugin } from "./react-compiler.mjs";
import postcss from "rollup-plugin-postcss";
import sucrase from "@rollup/plugin-sucrase";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import replace from "@rollup/plugin-replace";
import { terser } from "rollup-plugin-terser";

const isProd = process.env.NODE_ENV === "production";

export default {
  input: "src/index.ts",
  external: ["react"],
  output: {
    file: "build/client.js",
    format: "iife",
    sourcemap: true,
    globals: {react: "__Sub.React"},
  },
  plugins: [
    reactCompilerPlugin(),
    resolve(),
    commonjs(),
    postcss(),
    sucrase({
      exclude: ["node_modules/**"],
      transforms: ["typescript", "jsx"],
    }),
    replace({
      // Get production-mode react
      "process.env.NODE_ENV": JSON.stringify(
        isProd ? "production" : "development"
      ),
    }),
    ...(isProd ? [terser()] : []),
  ],
};
