import { rspack, type Configuration } from "@rspack/core";
import { strict as assert } from "node:assert";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { expect, it, vi } from "vitest";
import { mkSharedRsbuildConfig } from "./sharedRsbuildConfig";

it.each(["development", "production"] as const)("builds and executes strict Preview compilation in Chromium (%s), including complete module replacement", async (mode) => {
  const output = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-preview-compiler-"));
  vi.stubEnv("NODE_ENV", mode);
  vi.stubEnv("COMMITHASH", "");
  vi.stubEnv("PLASMIC_SELF_HOSTED", "1");
  let shared: ReturnType<typeof mkSharedRsbuildConfig>;
  try { shared = mkSharedRsbuildConfig({ commitHash: "preview-browser-test" }); }
  finally { vi.unstubAllEnvs(); }
  assert(shared.tools?.rspack && typeof shared.tools.rspack === "object", "Shared browser build must expose its concrete Rspack configuration");
  const config: Configuration = {
    ...shared.tools.rspack,
    mode, target: "web", devtool: false,
    entry: path.resolve(__dirname, "fixtures/preview-compiler-browser.ts"),
    output: { path: output, filename: "browser.js", library: { type: "var", name: "PreviewCompilerHarness" } },
    resolve: {
      extensions: [".ts", ".tsx", ".js", ".json"],
      alias: { "@": path.resolve(__dirname, "../../src"), react: path.dirname(require.resolve("react/package.json")), "react-dom": path.dirname(require.resolve("react-dom/package.json")) },
    },
    module: {
      ...shared.tools.rspack.module,
      parser: { javascript: { dynamicImportMode: "eager" } },
      rules: [
        ...(shared.tools.rspack.module?.rules ?? []),
        { test: /\.tsx?$/, exclude: /node_modules/, use: [{ loader: "builtin:swc-loader", options: { jsc: { parser: { syntax: "typescript", tsx: true }, target: "es2022" } } }] },
      ],
    },
    optimization: { minimize: false, splitChunks: false },
  };
  try {
    await new Promise<void>((resolve, reject) => {
      const compiler = rspack(config);
      compiler.run((error, stats) => compiler.close((closeError) => {
        if (error || closeError) { reject(error || closeError); return; }
        if (!stats || stats.hasErrors()) { reject(new Error(stats?.toString({ all: false, errors: true }) ?? "Preview browser build produced no stats")); return; }
        resolve();
      }));
    });
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.addScriptTag({ path: path.join(output, "browser.js") });
      const result = await page.evaluate("PreviewCompilerHarness.runBrowserPreviewCompilerContract()");
      expect(errors).toEqual([]);
      expect(result).toMatchObject({
        compilerRuntimeImport: true, incremented: "Original:First:1",
        retainedSameSource: true, retainedText: "Updated:First:1",
        evictedImporter: true, dependencyEditText: "Updated:Second:0",
        evictedSource: true, sourceEditText: "Edited:Second:2",
        authoredVarInitial: '["undefined",4,4]', authoredVarUpdated: '["undefined",5,5]',
        authoredConditionalInitial: "first（未修改过）", authoredConditionalUpdated: "second（被用户修改过）",
        refCommandResult: ["first", "second"],
        rowActions: { busyDuringRequest: true, result: "done", denied: "denied", rejected: "request failed",
          busyAfter: false, error: "request failed", requests: 2, cleanups: 3 },
        nativeEventSyntax: [4, 5],
        defaultPragma: true, customPragma: "Custom JSX", cssAsset: true,
        nodeGlobals: { require: "undefined", process: "undefined" },
      });
      expect(result.errors).toHaveLength(4);
      expect(result.opaqueRefCommits).toBeLessThan(8);
      expect(result.errors[0]).toMatch(/Hooks must/);
      expect(result.errors[1]).toMatch(/React Compiler did not compile <anonymous>/);
      expect(result.errors[2]).toMatch(/React Compiler did not compile Skipped/);
      expect(result.errors[3]).toMatch(/React Compiler did not compile AliasedBoundary/);
    } finally { await browser.close(); }
  } finally { await fs.rm(output, { recursive: true, force: true }); }
}, 120000);
