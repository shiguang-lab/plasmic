import { transformSync } from "@babel/core";
import fs from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
import {
  reactCompilerBuildInfo,
  reactCompilerFiles,
  reactCompilerInclude,
  reactCompilerOptions,
} from "../react-compiler.mjs";

const codeCandidate = path.resolve(
  __dirname,
  "../../src/wab/client/components/coding/CodeDisplayContent.tsx",
);

it("limits compilation to audited components and excludes observers, canvas and SDKs", () => {
  expect(reactCompilerInclude.test(codeCandidate)).toBe(true);
  for (const file of [
    "src/wab/client/components/canvas/canvas-observer.ts",
    "src/wab/client/studio-ctx/StudioCtx.tsx",
    "src/wab/client/components/QueryBuilder/FilterQueryBuilder.tsx",
    "packages/react-web/src/index.tsx",
    "src/wab/client/components/coding/CodeDisplayContent.test.tsx",
  ]) {
    expect(reactCompilerInclude.test(path.resolve(file))).toBe(false);
  }
});
it.each(reactCompilerFiles)("actually compiles %s against React 19", (file) => {
  const candidate = path.resolve(__dirname, "../../", file);
  const names: Array<string | null> = [];
  const output = transformSync(fs.readFileSync(candidate, "utf8"), {
    filename: candidate,
    babelrc: false,
    configFile: false,
    parserOpts: { plugins: ["typescript", "jsx"] },
    plugins: [
      [
        "babel-plugin-react-compiler",
        reactCompilerOptions({
          logEvent: (_file, event) => {
            if (event.kind === "CompileSuccess") {
              names.push(event.fnName);
            }
          },
        }),
      ],
    ],
  });
  expect(names).toContain(
    file.endsWith("SettingsPage.tsx")
      ? "SettingsPageContent"
      : path.basename(file, ".tsx"),
  );
  expect(output?.code).toContain('from "react/compiler-runtime"');
});
it("does not compile annotated code outside the whitelist", () => {
  const output = transformSync(
    'function ObserverView(props) { "use memo"; return props.store.values.map(x => x.name); }',
    {
      filename: path.resolve(
        __dirname,
        "../../src/wab/client/components/canvas/ObserverView.tsx",
      ),
      babelrc: false,
      configFile: false,
      plugins: [["babel-plugin-react-compiler", reactCompilerOptions()]],
    },
  );
  expect(output?.code).not.toContain("react/compiler-runtime");
});

it("enables Compiler in ordinary production builds without an environment opt-in", () => {
  expect(reactCompilerBuildInfo()).toMatchObject({
    enabled: true,
    target: "19",
  });
});
