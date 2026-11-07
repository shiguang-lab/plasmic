import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import {
  LOADER_NEXTJS_VERSION,
  LOADER_REACT_VERSION,
  REACT_VERSION,
} from "./env";

export function verifyTargetRuntime(
  projectPath: string,
  sdk: "@plasmicapp/loader-nextjs" | "@plasmicapp/loader-react",
) {
  const appRequire = createRequire(path.join(projectPath, "package.json"));
  const sdkManifest = JSON.parse(
    readFileSync(
      path.join(projectPath, "node_modules", sdk, "package.json"),
      "utf8",
    ),
  );
  assert.equal(
    sdkManifest.version,
    sdk === "@plasmicapp/loader-react"
      ? LOADER_REACT_VERSION
      : LOADER_NEXTJS_VERSION,
    "Consumer must install the newly versioned SDK artifact",
  );
  const sdkRequire = createRequire(appRequire.resolve(sdk));
  const loaderRequire =
    sdk === "@plasmicapp/loader-react"
      ? sdkRequire
      : createRequire(sdkRequire.resolve("@plasmicapp/loader-react"));
  const react = appRequire("react");
  assert.equal(
    react.version,
    REACT_VERSION,
    "Consumer must use the target React version",
  );
  assert.equal(
    loaderRequire("react"),
    react,
    "Consumer and SDK must share one React instance",
  );
  const query = loaderRequire("@plasmicapp/query");
  assert.equal(
    typeof query.usePlasmicPrepass,
    "function",
    "Consumer must install this upgrade's SDK closure",
  );
  assert.equal(
    "isPlasmicPrepass" in query,
    false,
    "An older query runtime must not satisfy the upgrade test",
  );
}
