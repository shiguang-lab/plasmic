import { transformAsync } from "@babel/core";
import compiler from "babel-plugin-react-compiler";
import { reactCompilerInclude, reactCompilerOptions } from "../wab/tools/react-compiler.mjs";

export function reactCompilerPlugin() {
  return {
    name: "canvas-sdk-react-compiler",
    async transform(code, filename) {
      if (!reactCompilerInclude.test(filename)) { return null; }
      const result = await transformAsync(code, {
        filename, babelrc: false, configFile: false, sourceMaps: true,
        parserOpts: { plugins: ["typescript", "jsx"] },
        plugins: [[compiler, reactCompilerOptions()]],
      });
      if (!result?.code) { throw new Error(`Compiler returned no iframe SDK source: ${filename}`); }
      return { code: result.code, map: result.map };
    },
  };
}
