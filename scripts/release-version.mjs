import { compareVersions } from "../packages/plasmic-cli/src/protocol.mjs";

export function isNewReleaseSeries(version, previousVersion) {
  return (
    compareVersions(version, previousVersion) > 0 &&
    version.split(".").slice(0, 2).join(".") !==
      previousVersion.split(".").slice(0, 2).join(".")
  );
}
