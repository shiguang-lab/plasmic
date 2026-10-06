import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import path from "node:path";
import { defineConfig } from "vitest/config";

const require = createRequire(import.meta.url);

export default defineConfig({
  resolve: {
    alias: ["react", "react-dom", "antd", "@ant-design/cssinjs"].map((name) => ({
      find: new RegExp(`^${name}(/.*)?$`),
      replacement: path.dirname(require.resolve(`${name}/package.json`)) + "$1",
    })),
  },
  root: fileURLToPath(new URL(".", import.meta.url)),
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.tsx"],
    setupFiles: ["tests/setup.ts"],
  },
});
