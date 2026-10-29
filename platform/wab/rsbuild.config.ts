import { defineConfig, mergeRsbuildConfig } from "@rsbuild/core";
import {
  Assets,
  Compiler,
  CopyRspackPlugin,
  RspackPluginInstance,
} from "@rspack/core";
import { readFileSync } from "fs";
import HtmlWebpackPlugin from "html-webpack-plugin";
import MonacoWebpackPlugin from "monaco-editor-webpack-plugin";
import { homepage } from "./package.json";
import { StudioHtmlPlugin } from "./tools/webpack/StudioHtmlPlugin";
import {
  getCommitHash,
  mkSharedRsbuildConfig,
} from "./tools/webpack/sharedRsbuildConfig";

const commitHash = getCommitHash();
const buildEnv = process.env.NODE_ENV ?? "production";
const isProd = buildEnv === "production";
// Interface to listen on, shared with the other servers in the dev stack.
const bindHost: string = process.env.BIND_HOST ?? "0.0.0.0";
const port: number = process.env.PORT ? +process.env.PORT : 3003;
const backendPort: number = process.env.BACKEND_PORT
  ? +process.env.BACKEND_PORT
  : 3004;
// Where to reach the backend, which is not necessarily where it binds.
const backendHost: string = process.env.BACKEND_HOST ?? "localhost";
const publicUrl: string =
  process.env.PUBLIC_URL ?? (isProd ? homepage : `http://localhost:${port}`);
const staticUrl: string = process.env.STATIC_URL ?? publicUrl;
const devApiUser = process.env.PLASMIC_DEV_API_USER;
const devApiToken = process.env.PLASMIC_DEV_API_TOKEN;
if (
  !isProd &&
  (devApiUser || devApiToken) &&
  (!devApiUser ||
    !devApiToken ||
    !["127.0.0.1", "localhost", "::1"].includes(bindHost))
) {
  throw new Error(
    "Local API credentials require both values and a loopback bind host.",
  );
}

console.log(`Starting rsbuild...
- commitHash: ${commitHash}
- buildEnv: ${buildEnv}
- publicUrl: ${publicUrl}
- bindHost: ${bindHost}
- port: ${port}
- backendHost: ${backendHost}
- backendPort: ${backendPort}
`);

/**
 * Appends a sourceMappingURL for js files in paths, by looking for
 * the source map file with the same hash-tagged name
 */
class AppendSourceMapWithHash implements RspackPluginInstance {
  constructor(
    private opts: {
      paths: string[];
    },
  ) {}

  apply(compiler: Compiler) {
    const processFile = (filePath: string, assets: Assets) => {
      if (this.shouldProcessFile(filePath)) {
        const sourceMapFilePath = this.makeSourceMapFilePath(filePath);
        if (assets[sourceMapFilePath]) {
          let content = assets[filePath].source();
          // We use the full path (with publicUrl) because the files may be
          // loaded from the inner frame and so the relative path would be
          // wrong.
          const newMapping = `//# sourceMappingURL=${publicUrl}/${sourceMapFilePath}`;
          if (content.includes("//# sourceMappingURL=")) {
            content = content
              .toString()
              .replace(/\/\/# sourceMappingURL=[^\s*]*\s*$/, newMapping);
          } else {
            content = content.toString() + `\n${newMapping}\n`;
          }
          // @ts-expect-error: don't have access to Source classes
          assets[filePath] = {
            source: () => content,
            size: () => content.length,
          };
        }
      }
    };

    // This hook transforms the source map reference in dev mode
    compiler.hooks.compilation.tap("AppedSourceMapWithHash", (compilation) => {
      compilation.hooks.processAssets.tapAsync(
        {
          name: "AppendSourceMapWithHash",
          stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
        },
        (assets, callback) => {
          Object.keys(assets).forEach((filePath) => {
            processFile(filePath, assets);
          });
          callback();
        },
      );
    });

    // This hook appends the source map reference when doing `pnpm build`. Not
    // sure why this is necessary and why the previous hook alone isn't enough;
    // with just the previous hook, the source map reference is stripped out
    // completely for `pnpm build`.
    compiler.hooks.emit.tapAsync(
      "AppendSourceMapWithHash",
      (compilation, callback) => {
        Object.keys(compilation.assets).forEach((filePath) => {
          processFile(filePath, compilation.assets);
        });
        callback();
      },
    );
  }

  private makeSourceMapFilePath(file: string) {
    const parts = file.split(".");
    const ext = parts[parts.length - 1];
    const hash = parts[parts.length - 2];
    const rest = parts.slice(0, parts.length - 2).join(".");
    return `${rest}.${ext}.${hash}.map`;
  }

  private shouldProcessFile(filePath: string) {
    return (
      filePath.endsWith(".js") &&
      this.opts.paths.some((path) => filePath.startsWith(path))
    );
  }
}

const appConfig = defineConfig({
  dev: {
    // Compile routes before CI starts.
    ...(process.env.CI
      ? { lazyCompilation: false, hmr: false, liveReload: false }
      : {}),
    // We write intermediate files to disk (build/) for debugging,
    // and also because our local host server will serve from there.
    writeToDisk: publicUrl.includes("localhost") ? true : false,
  },
  server: {
    host: bindHost,
    port,
    ...(!isProd && devApiToken
      ? {
          cors: {
            origin: [
              publicUrl,
              new URL(
                process.env.REACT_APP_DEFAULT_HOST_URL ??
                  "http://localhost:3005/static/host.html",
              ).origin,
            ],
          },
        }
      : {}),
    proxy: {
      "/api": {
        target: `http://${backendHost}:${backendPort}`,
        ws: true,
        ...(!isProd && devApiUser && devApiToken
          ? {
              headers: {
                "x-plasmic-api-user": devApiUser,
                "x-plasmic-api-token": devApiToken,
              },
            }
          : {}),
      },
    },
  },
  source: {
    entry: {
      index: "src/wab/client/main.tsx",
    },
  },
  output: {
    assetPrefix: staticUrl,
    distPath: {
      root: "build",
    },
    charset: "utf8",
    sourceMap: {
      js: isProd ? "source-map" : "cheap-module-source-map",
      css: true,
    },
  },
  performance: {
    chunkSplit: {
      strategy: "split-by-experience",
      override: { maxSize: isProd ? 3_000_000 : 1_000_000 },
    },
  },
  tools: {
    // We use html-webpack-plugin directly instead of relying in @rsbuild/core
    // html plugin so it works with StudioHtmlPlugin.
    htmlPlugin: false,
    rspack: {
      plugins: [
        // For most files, we are appending a commitHash to the file name
        // for caching and cache-busting. Ideally they'd be using a
        // content hash instead, but the client needs to know the exact
        // file name to use, and it's too much work to expose each
        // one by one. Maybe one day! For now, at least this means all
        // the files are cacheable until the next deployment.
        new CopyRspackPlugin({
          patterns: [
            {
              from: "dev-build/static/styles/",
              to: `static/styles/[path][name].${commitHash}[ext]`,
            },
            {
              from: "../sub/public/static/",
              to: `static/[path][name].${commitHash}[ext]`,
            },
            {
              from: "../live-frame/build/",
              to: `static/live-frame/build/[path][name].${commitHash}[ext]`,
            },
            {
              from: "../react-web-bundle/build/",
              to: `static/react-web-bundle/build/[path][name].${commitHash}[ext]`,
            },
            {
              from: "../canvas-packages/build/",
              to: `static/canvas-packages/build/[path][name].${commitHash}[ext]`,
            },
            {
              from: "../loader-html-hydrate/build/",
              to: "static/js/",
              info: { minimized: true },
            },
          ],
        }),
        new AppendSourceMapWithHash({
          paths: [
            "static/sub/build/",
            "static/live-frame/build/",
            "static/react-web-bundle/build/",
            "static/canvas-packages/build/",
          ],
        }),
        new HtmlWebpackPlugin({
          template: "../sub/public/static/host.html",
          filename: `static/host.html`,
          inject: false,
          templateParameters: {
            commitHash,
            studioUrl: publicUrl,
            hostReadyMessages: Object.fromEntries(
              ["en", "zh-CN", "zh-TW", "ja", "ko"].map((locale) => [
                locale,
                Object.fromEntries(Object.entries(require(`./src/wab/client/i18n/locales/${locale}.json`)).filter(([key]) => key.startsWith("hostReady."))),
              ]),
            ),
            resolveUiLocale: require("./src/wab/client/i18n/locale-resolution.cjs").resolveUiLocale.toString(),
          },
        }),
        new MonacoWebpackPlugin(),
        new HtmlWebpackPlugin(
          Object.assign(
            {},
            {
              inject: true,
              template: "./public/index.html",
              templateParameters: {
                previewLoadingCss: readFileSync(new URL("./src/wab/client/components/live/PreviewLoading.css", import.meta.url), "utf8"),
                staticUrl,
              },
            },
            buildEnv === "production"
              ? {
                  minify: {
                    removeComments: true,
                    collapseWhitespace: true,
                    removeRedundantAttributes: true,
                    useShortDoctype: true,
                    removeEmptyAttributes: true,
                    removeStyleLinkTypeAttributes: true,
                    keepClosingSlash: true,
                    minifyJS: true,
                    minifyCSS: true,
                    minifyURLs: true,
                  },
                }
              : undefined,
          ),
        ),
        new StudioHtmlPlugin(commitHash),
      ],
    },
  },
});

export default mergeRsbuildConfig(
  mkSharedRsbuildConfig({ commitHash }),
  appConfig,
);
