import dts from "rollup-plugin-dts";

export default {
  input: {
    index: ".declarations/index.d.ts",
    registerActionGroup: ".declarations/registerActionGroup.d.ts",
    registerResourceAuthorization: ".declarations/registerResourceAuthorization.d.ts",
    registerIntlComponents: ".declarations/registerIntlComponents.d.ts",
  },
  output: { dir: "dist", format: "esm", entryFileNames: "[name].d.ts", chunkFileNames: "[name]-[hash].d.ts" },
  external: (id) => !id.startsWith(".") && !id.startsWith("/") && id !== "@react/ui" && !id.startsWith("@react/ui/"),
  plugins: [dts({ respectExternal: true })],
};
