import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
export default defineConfig({
  resolve: {
    alias: {
      "@plasmicapp/host/registerComponent": fileURLToPath(
        new URL(
          "../../packages/host/src/registerComponent.ts",
          import.meta.url,
        ),
      ),
      "@plasmicapp/host/registerGlobalContext": fileURLToPath(
        new URL(
          "../../packages/host/src/registerGlobalContext.ts",
          import.meta.url,
        ),
      ),
      "@plasmicapp/host": fileURLToPath(
        new URL("../../packages/host/src/index.ts", import.meta.url),
      ),
    },
  },
  test: { environment: "jsdom", include: ["src/**/*.test.tsx"], globals: true },
});
