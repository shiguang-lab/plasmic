import { transformAsync } from "@babel/core";
import { playwright } from "@vitest/browser-playwright";
import fs from "fs";
import { isBuiltin } from "module";
import os from "os";
import path from "path";
import commonjs from "vite-plugin-commonjs";
import { defineConfig, Plugin } from "vitest/config";
import { reactAriaRuntimeAliases } from "./tools/react-aria-runtime.mjs";
import {
  reactCompilerInclude,
  reactCompilerOptions,
} from "./tools/react-compiler.mjs";

// Vite's ICSS loader normally reads referenced Sass files as plain CSS.
const SassModuleLoader =
  require("postcss-modules/build/FileSystemLoader").default;
const {
  compileSassModule,
} = require("./tools/webpack/sass-module-reference.cjs");
class StyleModuleLoader extends SassModuleLoader {
  constructor(...args: unknown[]) {
    super(...args);
    this.fs = {
      readFile(
        file: string,
        encoding: BufferEncoding,
        done: (err: Error | null, css?: string) => void,
      ) {
        if (/\.s[ac]ss$/.test(file)) {
          compileSassModule(file).then(
            (result: { css: string }) => done(null, result.css),
            done,
          );
        } else {
          fs.readFile(file, encoding, done);
        }
      },
    };
  }
}

// Vite forwards the additional Loader option to postcss-modules.
const cssModules = { scopeBehaviour: "local" as const, Loader: StyleModuleLoader };

const browserTests = [
  "src/wab/client/react-global-hook/frame-memory.browser.test.tsx",
  "src/wab/client/components/canvas/CanvasContentEditorControls.test.tsx",
  "src/wab/client/components/top-bar/VariantsComboSelect.test.tsx",
  "src/wab/client/components/ContextMenu.test.tsx",
  "src/wab/client/components/widgets/IFrameAwareDropdownMenu.test.tsx",
  "src/wab/client/antd-theme.test.tsx",
  "src/wab/client/product-ui-theme.test.tsx",
  "src/wab/client/components/QueryBuilder/FilterQueryBuilder.theme.test.tsx",
  "src/wab/client/components/style-controls/property-controls-theme.test.tsx",
  "src/wab/client/components/sidebar-tabs/DataBinding/DataPickerTheme.test.tsx",
];

const srcDir = path.join(__dirname, "src");
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

function reactCompilerForTests(): Plugin {
  return {
    name: "studio-react-compiler",
    enforce: "pre",
    async transform(code, id) {
      const filename = id.split("?")[0];
      if (!reactCompilerInclude.test(filename)) {
        return null;
      }
      const result = await transformAsync(code, {
        filename,
        babelrc: false,
        configFile: false,
        sourceMaps: true,
        parserOpts: { plugins: ["typescript", "jsx"] },
        plugins: [["babel-plugin-react-compiler", reactCompilerOptions()]],
      });
      if (!result?.code) {
        throw new Error(`React Compiler returned no code for ${filename}`);
      }
      return { code: result.code, map: result.map };
    },
  };
}

export default defineConfig({
  css: { modules: cssModules },
  plugins: [webpackLoaderPrefixes(), reactCompilerForTests()],
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
    // Workspace SDK Hooks and SWR's native CJS hook adapter must resolve from
    // Studio's dependency tree so every callback uses the renderer's React.
    dedupe: ["react", "react-dom", "swr"],
    alias: [
      ...Object.entries<string>(reactAriaRuntimeAliases).map(([name, replacement]) => ({
        find: new RegExp(`^${name}$`),
        replacement,
      })),
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
          // Published workspace Hooks must pass through Vite's React dedupe.
          /\/packages\/(?:query|data-sources)\/dist\/index\.esm\.js(?:\?.*)?$/,
          /(?:^|\/)swr(?:\/|$)/,
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
        plugins: [
          commonjs({
            filter: (id) =>
              id.startsWith(srcDir + "/") && /\.[jt]sx?(\?|$)/.test(id),
          }),
        ],
        optimizeDeps: {
          include: [
            "@/wab/client/i18n/locale-resolution.cjs",
            "@plasmic-shared/resource-cache",
            "short-uuid",
            "regexp.execall",
          ],
        },
        define: {
          global: "globalThis",
          "process.env": {
            COMMITHASH: "test",
            NODE_ENV: "test",
            PUBLICPATH: "/",
          },
        },
        resolve: {
          alias: [
            { find: /^@sentry\/node$/, replacement: "@sentry/browser" },
            {
              find: /^(?:node:)?path$/,
              replacement: require.resolve("path-browserify"),
            },
          ],
        },
        test: {
          name: "studio-theme",
          include: browserTests,
          setupFiles: ["./src/wab/client/__testonly__/theme-browser.ts"],
          css: { include: [/.*/], modules: { classNameStrategy: "scoped" } },
          browser: {
            enabled: true,
            screenshotFailures: false,
            viewport: { width: 1200, height: 800 },
            provider: playwright(),
            headless: true,
            instances: [{ browser: "chromium" }],
          },
        },
      },
      {
        extends: true,
        plugins: [nodeBuiltins()],
        test: {
          name: "server",
          setupFiles: ["./src/wab/client/__testonly__/setupTests.js"],
          include: [
            "src/wab/server/**/*.{spec,test}.{js,jsx,ts,tsx}",
            "tools/webpack/**/*.{spec,test}.{js,jsx,ts,tsx}",
          ],
          environment: "node",
        },
      },
      {
        extends: true,
        plugins: [nodeBuiltins()],
        test: {
          name: "studio",
          setupFiles: ["./src/wab/client/__testonly__/setupTests.js"],
          // Server and webpack utility tests use the node project above.
          include: ["src/**/*.{spec,test}.{js,jsx,ts,tsx}"],
          exclude: ["src/wab/server/**", ...browserTests],
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
    coverage: {
      include: ["src/**/*.{js,jsx,ts,tsx}"],
      exclude: ["src/**/*.d.ts"],
    },
    // Generated code asserts on its own CSS module class names.
    css: {
      include: [/\.module\.less$/],
      modules: { classNameStrategy: "non-scoped" },
    },
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
