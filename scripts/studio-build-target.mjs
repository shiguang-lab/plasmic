import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const chromiumEnvironment = "PLASMIC_DESKTOP_CHROMIUM_VERSION";

export function studioBuildEnvironment(browserTarget, environment = process.env) {
  const result = { ...environment };
  delete result[chromiumEnvironment];
  if (browserTarget?.kind === "desktop") {
    result[chromiumEnvironment] = browserTarget.chromium;
  }
  return result;
}

export function assertDesktopBrowserTarget(browserTarget, pinnedElectron) {
  if (browserTarget?.kind !== "desktop") {
    return;
  }
  if (browserTarget.electron !== pinnedElectron) {
    throw new Error(
      `Desktop renderer targets Electron ${browserTarget.electron}; package requires ${pinnedElectron}. Rebuild Studio with --desktop.`,
    );
  }
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(browserTarget.chromium ?? "")) {
    throw new Error("Desktop renderer must record its actual Chromium version.");
  }
}

export async function desktopBrowserTarget(repo) {
  const packagePath = path.join(repo, "desktop/package.json");
  const metadata = JSON.parse(await readFile(packagePath, "utf8"));
  const require = createRequire(packagePath);
  const environment = studioBuildEnvironment();
  delete environment.NODE_OPTIONS;
  environment.ELECTRON_RUN_AS_NODE = "1";
  const versions = JSON.parse(
    execFileSync(
      require("electron"),
      ["-e", "process.stdout.write(JSON.stringify({electron:process.versions.electron,chromium:process.versions.chrome}))"],
      { env: environment, encoding: "utf8" },
    ),
  );
  const target = { kind: "desktop", electron: versions.electron, chromium: versions.chromium };
  assertDesktopBrowserTarget(target, metadata.devDependencies.electron);
  return target;
}
