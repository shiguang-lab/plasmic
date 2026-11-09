import { transformAsync } from "@babel/core";
import { defineConfig } from "vitest/config";
import { reactCompilerInclude, reactCompilerOptions } from "../../platform/wab/tools/react-compiler.mjs";

export default defineConfig({
  plugins: [{
    name: "react-compiler",
    enforce: "pre",
    async transform(source, id) {
      const filename = id.split("?")[0];
      if (!reactCompilerInclude.test(filename)) return null;
      const result = await transformAsync(source, {
        filename,
        babelrc: false,
        configFile: false,
        sourceMaps: true,
        parserOpts: { plugins: ["typescript", "jsx"] },
        plugins: [["babel-plugin-react-compiler", reactCompilerOptions()]],
      });
      return result?.code ? { code: result.code, map: result.map } : null;
    },
  }],
});
