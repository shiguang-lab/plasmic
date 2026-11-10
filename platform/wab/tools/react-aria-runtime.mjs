import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
// Studio and workspace-linked Plume controls must share focus scopes, overlay
// stacks and press state. Resolve each family from Studio's pinned installation.
export const reactAriaRuntimeAliases = {};
for (const name of ["react-aria", "react-stately"]) {
  const root = dirname(dirname(require.resolve(name)));
  reactAriaRuntimeAliases[name] = root;
  const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  for (const dependency of Object.keys(manifest.dependencies)) {
    if (/^@(react-aria|react-stately|internationalized)\//.test(dependency)) {
      reactAriaRuntimeAliases[dependency] = dirname(
        dirname(require.resolve(dependency, { paths: [root] })),
      );
    }
  }
}
