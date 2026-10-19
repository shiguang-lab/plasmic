import { defineConfig, mergeRsbuildConfig } from "@rsbuild/core";
import production from "../../rsbuild.preview.config";
export default mergeRsbuildConfig(production, defineConfig({
  output: { distPath: { root: "/tmp/plasmic-cover-probe/production-build" } },
}));
