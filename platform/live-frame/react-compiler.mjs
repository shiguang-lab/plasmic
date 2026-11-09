import { fileURLToPath } from "node:url";
import { transformAsync } from "@babel/core";
import compiler from "babel-plugin-react-compiler";
import { reactCompilerOptions } from "../wab/tools/react-compiler.mjs";

export function reactCompilerPlugin() {
  return {
    name: "live-frame-react-compiler",
    async transform(code, filename) {
      if (!filename.startsWith(fileURLToPath(new URL("./src/", import.meta.url))) || !/\.[jt]sx?$/.test(filename)) { return null; }
      const result = await transformAsync(code, {
        filename, babelrc: false, configFile: false, sourceMaps: true,
        parserOpts: { plugins: ["typescript", "jsx"] },
        plugins: [[compiler, reactCompilerOptions()]],
      });
      if (!result?.code) { throw new Error(`Compiler returned no live frame source: ${filename}`); }
      return { code: result.code, map: result.map };
    },
  };
}
