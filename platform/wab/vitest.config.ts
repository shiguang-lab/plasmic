import { transformAsync } from "@babel/core";
import fs from "fs";
import { createRequire, isBuiltin } from "module";
import os from "os";
import path from "path";
import { defineConfig, Plugin } from "vitest/config";
import {
  reactCompilerInclude,
  reactCompilerOptions,
} from "./tools/react-compiler.mjs";

const srcDir = path.join(__dirname, "src");
const mobxReactRequire = createRequire(require.resolve("mobx-react"));
const mobxReactLiteRequire = createRequire(
  mobxReactRequire.resolve("mobx-react-lite"),
);

// jsdom makes vite resolve for the browser, which picks npm shims such as
// path@0.12.7 over the real builtins. Tests run in node, so use the builtins.
function nodeBuiltins(): Plugin {
  return {
    name: "node-builtins",
    enforce: "pre",
    resolveId(source) {
      return isBuiltin(source)
        ? {
            id: source.startsWith("node:") ? source : `node:${source}`,
            external: true,
          }
        : null;
    },
  };
}

// Resolves webpack loader-prefixed imports, e.g. `!!raw-loader!./foo.txt`, by
// dropping the prefix and reading the file as a string.
function webpackLoaderPrefixes(): Plugin {
  return {
    name: "webpack-loader-prefixes",
    enforce: "pre",
    async resolveId(source, importer) {
      const match = /^!+[\w-]+!(.*)$/.exec(source);
      if (!match) {
        return null;
      }
      const resolved = await this.resolve(match[1], importer, {
        skipSelf: true,
      });
      return resolved ? `${resolved.id}?raw` : null;
    },
  };
}

// Tests never assert on plain stylesheets, so skip preprocessing them
// entirely. CSS modules are left alone, since tests do assert on their keys.
function stubStylesheets(): Plugin {
  return {
    name: "stub-stylesheets",
    enforce: "pre",
    load(id) {
      const file = id.split("?")[0];
      return /\.(css|sass|scss|less)$/.test(file) &&
        !/\.module\.\w+$/.test(file)
        ? ""
        : null;
    },
  };
}

function reactCompilerForTests(): Plugin {
  return {
    name: "studio-react-compiler",
    enforce: "pre",
    async transform(code, id) {
      const filename = id.split("?")[0];
      if (!reactCompilerInclude.test(filename)) return null;
      const result = await transformAsync(code, {
        filename,
        babelrc: false,
        configFile: false,
        sourceMaps: true,
        parserOpts: { plugins: ["typescript", "jsx"] },
        plugins: [["babel-plugin-react-compiler", reactCompilerOptions()]],
      });
      if (!result?.code)
        throw new Error(`React Compiler returned no code for ${filename}`);
      return { code: result.code, map: result.map };
    },
  };
}

export default defineConfig({
  plugins: [
    nodeBuiltins(),
    webpackLoaderPrefixes(),
    stubStylesheets(),
    reactCompilerForTests(),
  ],
  server: {
    // The codegen tests compile into a temp dir and import the result.
    fs: {
      allow: [
        path.join(__dirname, "../.."),
        os.tmpdir(),
        fs.realpathSync(os.tmpdir()),
      ],
    },
  },
  resolve: {
    // Workspace SDK sources and their external-store hook must share Studio's React.
    dedupe: ["react", "react-dom"],
    alias: [
      {
        find: /^monaco-editor$/,
        replacement: require.resolve("monaco-editor/editor/editor.main.js"),
      },
      // The legacy lib/host entry re-exports Host through native require(),
      // which bypasses Vite's React dedupe when the SDK is workspace-linked.
      {
        find: /^@plasmicapp\/(?:host|react-web\/lib\/host)$/,
        replacement: path.resolve(
          __dirname,
          "../../packages/host/dist/host.esm.js",
        ),
      },
      // Consume the published ESM entry so Vite can dedupe its Host/React imports.
      {
        find: /^@plasmicpkgs\/plasmic-basic-components$/,
        replacement: path.resolve(
          __dirname,
          "../../plasmicpkgs/plasmic-basic-components/dist/plasmic-basic-components.esm.js",
        ),
      },
      {
        find: /^use-sync-external-store\/shim(?:\/index\.js)?$/,
        replacement: mobxReactLiteRequire.resolve(
          "use-sync-external-store/shim",
        ),
      },
      ...Object.entries({
        "@plasmicpkgs/antd5/form-meta": path.resolve(
          __dirname,
          "../../plasmicpkgs/antd5/src/form-meta.ts",
        ),
        "@/": `${srcDir}/`,
        "src/": `${srcDir}/`,
      }).map(([find, replacement]) => ({ find, replacement })),
    ],
  },
  test: {
    server: {
      deps: {
        inline: [
          /valtio/,
          /swr\//,
          /@plasmicpkgs\/react-aria/,
          /react-aria-components/,
          /@react-querybuilder\/antd/,
          /antd\/es\//,
          /(?:@react-aria|@react-stately|@internationalized|react-aria|react-stately)\//,
        ],
      },
    },
    projects: [
      {
        extends: true,
        test: {
          name: "server",
          include: [
            "src/wab/server/**/*.{spec,test}.{js,jsx,ts,tsx}",
            "tools/webpack/**/*.{spec,test}.{js,jsx,ts,tsx}",
            "tools/dashboard-preview-probe/server.test.ts",
            "tools/dashboard-preview-probe/migration.test.ts",
          ],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "studio",
          // Server and webpack utility tests use the node project above.
          include: [
            "src/**/*.{spec,test}.{js,jsx,ts,tsx}",
            "tools/dashboard-preview-probe/engine.test.ts",
            "tools/dashboard-preview-probe/entry.test.ts",
          ],
          exclude: ["src/wab/server/**"],
          environment: "jsdom",
          // DEVFLAGS.hostUrl is http://localhost in tests; keep the document on
          // the same origin so app-hosting URL checks pass.
          environmentOptions: {
            jsdom: {
              url: "http://localhost/",
              // Several tests parse untrusted HTML; don't run its <script>s.
              runScripts: "outside-only",
            },
          },
        },
      },
    ],
    globals: true,
    silent: "passed-only",
    setupFiles: ["./src/wab/client/__testonly__/setupTests.js"],
    coverage: {
      include: ["src/**/*.{js,jsx,ts,tsx}"],
      exclude: ["src/**/*.d.ts"],
    },
    // Generated code asserts on its own CSS module class names.
    css: { modules: { classNameStrategy: "non-scoped" } },
    // Modules read these at import time, so they must be set before the test
    // file's imports run, which rules out assigning them in a setup file.
    env: {
      COMMITHASH: "test",
      PUBLICPATH: "/",
      AWS_SDK_JS_SUPPRESS_MAINTENANCE_MODE_MESSAGE: "1",
    },
    testTimeout: 60000,
    hookTimeout: 60000,
    restoreMocks: true,
    maxWorkers: process.env.CI ? 3 : undefined,
  },
});
