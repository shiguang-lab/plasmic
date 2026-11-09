const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const { ESLint } = require("eslint");

const repo = path.resolve(__dirname, "../..");
test("maintained Studio, Host and component sources enforce Hook ordering and dependencies", async () => {
  const eslint = new ESLint({ cwd: repo });
  for (const file of [
    "platform/wab/src/wab/client/components/Shell.tsx",
    "platform/sub/src/index.tsx",
    "platform/live-frame/src/render.tsx",
    "packages/host/src/history.ts",
    "packages/react-web/src/react-utils.tsx",
    "plasmicpkgs/antd6/src/form/FormList.tsx",
    "plasmicpkgs/plasmic-sanity-io/src/sanity.tsx",
    "plasmicpkgs/commerce-providers/shopify/src/cart/use-cart.tsx",
  ]) {
    const config = await eslint.calculateConfigForFile(file);
    assert.equal(config.rules["react-hooks/rules-of-hooks"][0], "error", file);
    assert.equal(config.rules["react-hooks/exhaustive-deps"][0], "warn", file);
  }
});

test("render API guards reject React 19 removals and allow current roots", async () => {
  const config = require("../../.eslintrc.js");
  const eslint = new ESLint({
    cwd: repo, useEslintrc: false,
    baseConfig: {
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
      rules: {
        "no-restricted-imports": config.rules["no-restricted-imports"],
        "no-restricted-properties": config.rules["no-restricted-properties"],
      },
    },
  });
  const [removed] = await eslint.lintText(`import { render, hydrate, findDOMNode, unmountComponentAtNode } from "react-dom";
import { act } from "react-dom/test-utils";
ReactDOM.render(); ReactDOM.hydrate(); ReactDOM.findDOMNode(); ReactDOM.unmountComponentAtNode();`);
  assert.equal(removed.errorCount, 9);
  const [current] = await eslint.lintText(`import { createRoot, hydrateRoot } from "react-dom/client";
import { act } from "react";
const root = createRoot(container); root.render(element); root.unmount(); hydrateRoot(container, element);`);
  assert.equal(current.errorCount, 0);
});
