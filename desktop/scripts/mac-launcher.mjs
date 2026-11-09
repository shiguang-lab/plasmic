import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Run after package dependency checks and before Electron's fuses and signing.
export function installMacLauncher(bundle, arch) {
  const minimum = execFileSync("/usr/libexec/PlistBuddy", [
    "-c", "Print :LSMinimumSystemVersion", path.join(bundle, "Contents/Info.plist"),
  ], { encoding: "utf8" }).trim();
  execFileSync("/usr/bin/clang", [
    "-O2", "-Wall", "-Wextra", "-Werror", "-arch", arch === "x64" ? "x86_64" : arch,
    `-mmacosx-version-min=${minimum}`,
    fileURLToPath(new URL("../src/mac-launcher.c", import.meta.url)),
    "-o", path.join(bundle, "Contents/MacOS/Plasmic"),
    "-Wl,-rpath,@executable_path/../Frameworks",
  ], { stdio: "inherit" });
}
