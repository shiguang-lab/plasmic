import { createRequire } from "node:module";
import { reactCompilerInclude } from "../../../../../tools/react-compiler.mjs";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

const { compileReactSource } = createRequire(import.meta.url)("../../../../../tools/react-compiler-transform.cjs");

export default defineConfig({
  plugins: [{
    name: "email-react-compiler", enforce: "pre",
    transform(code, id) {
      const filename = id.split("?")[0];
      return reactCompilerInclude.test(filename) ? { code: compileReactSource(code, filename), map: null } : null;
    },
  }, react()],
  base: "/plasmic-host",
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@": path.resolve(__dirname, "../../../../"),
    },
  },
});
