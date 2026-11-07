import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import antdConfig from "../antd6/vitest.config.mts";

export default defineConfig({
  ...antdConfig,
  root: fileURLToPath(new URL(".", import.meta.url)),
  server: {
    fs: { allow: [fileURLToPath(new URL("../..", import.meta.url))] },
  },
  test: {
    ...antdConfig.test,
    setupFiles: [fileURLToPath(new URL("../antd6/tests/setup.ts", import.meta.url))],
  },
});
