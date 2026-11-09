import { reactCompilerPlugin } from "./react-compiler.mjs";
import babel from "@rollup/plugin-babel";
import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";
import sucrase from "@rollup/plugin-sucrase";
import postcss from "rollup-plugin-postcss";
import { terser } from "rollup-plugin-terser";

const isProd = process.env.NODE_ENV === "production";

export default {
  input: "src/index.ts",
  external: ["react", "react/jsx-runtime", "react/jsx-dev-runtime", "react-dom", "@plasmicapp/host", "@plasmicapp/query"],
  output: {
    file: "build/client.js",
    format: "iife",
    sourcemap: true,
    globals: {
      react: "__Sub.React",
      "react/jsx-runtime": "__Sub.jsxRuntime",
      "react/jsx-dev-runtime": "__Sub.jsxDevRuntime",
      "react-dom": "__Sub.ReactDOM",
      "@plasmicapp/host": "__Sub",
      "@plasmicapp/query": "__Sub.PlasmicQuery || {}",
    },
  },
  plugins: [
    reactCompilerPlugin(),
    resolve({
      browser: true,
    }),
    commonjs(),
    postcss(),
    sucrase({
      exclude: ["node_modules/**"],
      transforms: ["typescript", "jsx"],
    }),
    babel({
      presets: [["@babel/react", { runtime: "automatic" }]],
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
