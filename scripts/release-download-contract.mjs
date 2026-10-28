export const DESKTOP_FEEDS = {
  "latest.json": "desktop-latest.json",
  "darwin/arm64/latest-mac.yml": "latest-mac-arm64.yml",
  "darwin/x64/latest-mac.yml": "latest-mac-x64.yml",
  "win32/x64/latest.yml": "latest.yml",
  "linux/x64/latest-linux.yml": "latest-linux.yml",
};
export const RESOURCE_RELEASE = "plasmic-resources";
export const RESOURCE_FILES = [
  "manifest.json",
  "plasmic-cli.tgz",
  "resources.json.gz",
];
export function resourceAssetName(id, file) {
  if (!/^[a-f0-9]{64}$/.test(id) || !RESOURCE_FILES.includes(file))
    throw new Error("Invalid resource asset identity");
  return `${id}-${file}`;
}
