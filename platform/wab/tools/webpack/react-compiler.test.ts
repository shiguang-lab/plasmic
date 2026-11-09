import { transformSync } from "@babel/core";
import fs from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
import {
  reactCompilerBuildInfo,
  reactCompilerInclude,
  reactCompilerOptions,
} from "../react-compiler.mjs";

it("includes Studio components, Hooks, shared UI and canvas sources without a whitelist", () => {
  for (const file of [
    "src/wab/main.tsx",
    "src/wab/server/emails/components.tsx",
    "src/wab/server/emails/templates/TemplateComments.tsx",
    "src/wab/server/emails/host/plasmic-host.tsx",
    "src/wab/client/components/Shell.tsx",
    "src/wab/client/components/canvas/canvas-observer.ts",
    "src/wab/client/studio-ctx/StudioCtx.tsx",
    "src/wab/client/components/QueryBuilder/FilterQueryBuilder.tsx",
    "src/wab/commons/components/ReactUtil.tsx",
    "src/wab/shared/react-utils.ts",
    "../canvas-packages/src/slate-string.tsx",
    "../react-web-bundle/src/canvas-component.tsx",
    "../live-frame/src/preview.tsx",
    "../live-frame/src/render.tsx",
    "../sub/src/studio-controls-provider.tsx",
    "../../packages/react-web/src/states/snapshot.tsx",
  ]) {
    expect(reactCompilerInclude.test(path.resolve(file)), file).toBe(true);
  }
  for (const file of [
    "src/wab/server/entities/Entities.ts",
    "src/wab/client/components/coding/CodeDisplayContent.test.tsx",
    "src/wab/client/components/coding/CodeDisplayContent.stories.tsx",
    "src/wab/client/__testonly__/setupTests.js",
    "src/wab/client/react-app-env.d.ts",
  ]) {
    expect(reactCompilerInclude.test(path.resolve(file)), file).toBe(false);
  }
});

it("compiles every native Slate leaf and Hook with the iframe runtime contract", () => {
  const filename = path.resolve(__dirname, "../../../canvas-packages/src/slate-string.tsx");
  const names: Array<string | null> = [];
  transformSync(fs.readFileSync(filename, "utf8"), {
    filename, babelrc: false, configFile: false,
    parserOpts: { plugins: ["typescript", "jsx"] },
    plugins: [["babel-plugin-react-compiler", reactCompilerOptions({ logEvent: (_file, event) => {
      if (event.kind === "CompileSuccess") { names.push(event.fnName); }
    } })]],
  });
  expect(names).toEqual(expect.arrayContaining(["SlateString", "TextString", "MemoizedText", "ZeroWidthString"]));
});

it.each([
  ["client/components/coding/CodeDisplayContent.tsx", "CodeDisplayContent"],
  ["client/components/canvas/CanvasFrame/CanvasHeader.tsx", "CanvasHeader"],
  ["client/components/studio/StudioChrome.tsx", "useStudioStartup"],
  ["client/plasmic/plasmic_kit_style_controls/PlasmicStyleSwitch.tsx", "useBehavior"],
  ["client/plasmic/plasmic_kit_style_controls/PlasmicStyleSwitch.tsx", "useNodeRenderOpts"],
  ["client/plasmic/plasmic_kit_style_controls/PlasmicStyleSwitch.tsx", "PlasmicStyleSwitch__root"],
  ["client/plasmic/plasmic_kit_style_controls/PlasmicStyleSwitch.tsx", "PlasmicStyleSwitch__labelContainer"],
])("compiles unannotated production code in %s", (file, name) => {
  const filename = path.resolve(__dirname, "../../src/wab", file);
  const code = fs.readFileSync(filename, "utf8");
  const names: Array<string | null> = [];
  expect(code).not.toContain('"use memo"');
  const output = transformSync(code, {
    filename,
    babelrc: false,
    configFile: false,
    parserOpts: { plugins: ["typescript", "jsx"] },
    plugins: [["babel-plugin-react-compiler", reactCompilerOptions({
      logEvent: (_file, event) => {
        if (event.kind === "CompileSuccess") { names.push(event.fnName); }
      },
    })]],
  });
  expect(names).toContain(name);
  expect(output?.code).toContain('from "react/compiler-runtime"');
});

it("rejects unsupported Hooks instead of silently skipping them", () => {
  const events: string[] = [];
  expect(() => transformSync(`
    import { useState } from "react";
    function Conditional({ enabled }) {
      if (enabled) { const [value] = useState(0); return <span>{value}</span>; }
      return null;
    }
  `, {
    filename: path.resolve("src/wab/client/components/CompilerExample.tsx"),
    babelrc: false,
    configFile: false,
    parserOpts: { plugins: ["jsx"] },
    plugins: [["babel-plugin-react-compiler", reactCompilerOptions({
      logEvent: (_file, event) => { events.push(event.kind); },
    })]],
  })).toThrow(/Hooks must/);
  expect(events).toContain("CompileError");
});

it("enables full inference in ordinary builds without an environment opt-in", () => {
  expect(reactCompilerBuildInfo()).toEqual({
    enabled: true,
    target: "19",
    compilationMode: "infer",
    scope: "studio-canvas-runtime-and-emails",
  });
});
