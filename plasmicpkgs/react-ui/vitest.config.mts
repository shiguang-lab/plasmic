import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import path from "node:path";
import { defineConfig } from "vitest/config";

const studioRequire = createRequire(new URL("../../platform/wab/package.json", import.meta.url));
const antdRequire = createRequire(studioRequire.resolve("antd/package.json"));
const packageRequire = createRequire(import.meta.url);
const aliases = [
  // Let the test runner resolve ahooks' React imports through the Studio alias.
  {
    find: /^ahooks$/,
    replacement: path.join(
      path.dirname(packageRequire.resolve("ahooks/package.json")),
      "es/index.js",
    ),
  },
  { find: /^@plasmicapp\/data-sources$/, replacement: fileURLToPath(new URL("../../packages/data-sources/src/index.tsx", import.meta.url)) },
  { find: /^@plasmicapp\/data-sources-context$/, replacement: fileURLToPath(new URL("../../packages/data-sources-context/src/index.tsx", import.meta.url)) },
  { find: /^@plasmicapp\/host$/, replacement: fileURLToPath(new URL("../../packages/host/src/index.ts", import.meta.url)) },
  { find: /^@plasmicapp\/query$/, replacement: fileURLToPath(new URL("../../packages/query/src/index.tsx", import.meta.url)) },
  ...["react", "react-dom", "antd", "antd-style", "@ant-design/icons", "@ant-design/cssinjs", "@testing-library/react", "swr", "dayjs"].map((name) => ({
  find: new RegExp(`^${name}(/.*)?$`),
  replacement: path.dirname((name === "@ant-design/cssinjs" ? antdRequire : studioRequire).resolve(`${name}/package.json`)) + "$1",
})),
];

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  resolve: { alias: aliases },
  test: {
    environment: "jsdom",
    server: { deps: { inline: [/\bahooks\b/] } },
    include: ["src/*.test.tsx", "tests/**/*.test.tsx"],
    setupFiles: ["../antd6/tests/setup.ts"],
  },
});
