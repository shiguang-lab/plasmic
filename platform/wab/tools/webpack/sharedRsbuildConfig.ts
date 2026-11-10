import { previewCompilerBrowserRule } from "./preview-compiler-resolve.cjs";
import type { RsbuildConfig } from "@rsbuild/core";
import { pluginBabel } from "@rsbuild/plugin-babel";
import { pluginReact } from "@rsbuild/plugin-react";
import { pluginSass } from "@rsbuild/plugin-sass";
import { DefinePlugin, ProvidePlugin, type SwcLoaderOptions } from "@rspack/core";
import { execSync } from "child_process";
import { dirname } from "path";
import { reactCompilerInclude, reactCompilerOptions } from "../react-compiler.mjs";
import { reactAriaRuntimeAliases } from "../react-aria-runtime.mjs";
import {
  OPTIONAL_VAR,
  REQUIRED_VAR,
  mkDefinePluginOptsForEnv,
} from "./mkDefinePluginOptsForEnv";

export function getCommitHash(): string {
  return (
    process.env.PLASMIC_COMMIT ||
    execSync("git rev-parse HEAD").toString().trim()
  ).slice(0, 6);
}

/**
 * Base rsbuild config to bundle our code.
 *
 * Used by:
 * - App build ./rsbuild.config.ts
 * - Storybook .storybook/rsbuild.config.ts
 */
export function mkSharedRsbuildConfig(opts: {
  commitHash: string;
}): RsbuildConfig {
  const { commitHash } = opts;
  const desktopChromiumMajor = process.env.PLASMIC_DESKTOP_CHROMIUM_VERSION?.split(".")[0];
  return {
    resolve: {
      alias: {
        ...Object.fromEntries(Object.entries(reactAriaRuntimeAliases).map(([name, location]) => [`${name}$`, location])),
        // Local host contracts share Studio's React instance when linked from
        // the SDK workspace; hooks cannot use the SDK's separate peer copy.
        react: dirname(require.resolve("react/package.json")),
        "react-dom": dirname(require.resolve("react-dom/package.json")),
        // data-urls.ts only falls back to xmldom when there is no window.
        "@xmldom/xmldom": false,
        // site-invariants.ts uses the Node SDK only when there is no window.
        "@sentry/node": false,
      },
    },
    plugins: [
      pluginBabel({
        include: reactCompilerInclude,
        babelLoaderOptions: {
          babelrc: false,
          configFile: false,
          plugins: [["babel-plugin-react-compiler", reactCompilerOptions({
            logEvent: (filename, event) => {
              if (event.kind === "CompileSuccess") {
                console.info("React Compiler", filename, event.fnName, {
                  memoSlots: event.memoSlots,
                  memoBlocks: event.memoBlocks,
                });
              } else if (event.kind === "CompileError" || event.kind === "PipelineError") {
                console.error("React Compiler rejected", filename, event);
              }
            },
          })]],
        },
      }),
      pluginReact(),
      pluginSass(),
    ],
    tools: {
      ...(desktopChromiumMajor ? {
        // Only the Desktop build supplies its pinned renderer's actual version.
        // Run after Rsbuild resolves Web Browserslist targets, retaining all
        // other SWC options and the ordinary Web build's browser contract.
        swc: (config: SwcLoaderOptions) => {
          config.env = { ...config.env, targets: { chrome: desktopChromiumMajor } };
        },
      } : {}),
      rspack: {
        module: {
          rules: [previewCompilerBrowserRule],
          parser: { javascript: { worker: [
            "PreviewWorker from @/wab/client/components/live/preview-worker",
            "...",
          ] } },
        },
        plugins: [
          new ProvidePlugin({
            process: [require.resolve("process/browser")],
            Buffer: ["buffer", "Buffer"],
          }),
          new DefinePlugin({
            "process.env.PLASMIC_SELF_HOSTED": JSON.stringify(
              process.env.PLASMIC_SELF_HOSTED ?? "",
            ),
            ...mkDefinePluginOptsForEnv({
              NODE_ENV: REQUIRED_VAR,
              COMMITHASH: commitHash,
              STATIC_URL: OPTIONAL_VAR,
              POSTHOG_API_KEY: OPTIONAL_VAR,
              POSTHOG_HOST: OPTIONAL_VAR,
              POSTHOG_REVERSE_PROXY_HOST: OPTIONAL_VAR,
              SENTRY_DSN: OPTIONAL_VAR,
              SENTRY_ORG_ID: OPTIONAL_VAR,
              SENTRY_PROJECT_ID: OPTIONAL_VAR,
              STRIPE_PUBLISHABLE_KEY: OPTIONAL_VAR,
            }),
          }),
        ],
      },
    },
  };
}
