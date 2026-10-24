import { execFileSync } from "node:child_process";
import { readFile, mkdir, rename, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { macSigningCertificate, verifyMacSignature } from "./local-signing.mjs";

const require = createRequire(import.meta.url);
const { requestRpc } = require("../src/local-rpc.cjs");
const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function installLocalApp(source) {
  if (process.platform !== "darwin") throw new Error("Local App installation currently targets macOS");
  verifyMacSignature(source, macSigningCertificate());
  const expected = JSON.parse(await readFile(path.join(desktop, "renderer/desktop-assets.json"), "utf8"));
  if (expected.build.kind !== "local") throw new Error("Install requires a local source build");
  const target = "/Applications/Plasmic.app";
  const profile = path.join(homedir(), "Library/Application Support/Plasmic Desktop");
  const running = () => {
    try { return !!execFileSync("/usr/bin/pgrep", ["-f", "^/Applications/Plasmic\\.app/Contents/MacOS/Plasmic$"], { encoding: "utf8" }).trim(); }
    catch (error) { if (error.status === 1) return false; throw error; }
  };
  if (running()) {
    const state = await requestRpc(profile, "get_app_state", {});
    if (state.projectId) {
      if (!state.ready) throw new Error("Wait for the current design to become ready before installing");
      if (state.editorContext?.mode === "preview") await requestRpc(profile, "preview", { action: "close" });
      await requestRpc(profile, "execute", { name: "save", input: {} });
    }
    execFileSync("/usr/bin/osascript", ["-e", 'tell application id "cn.publib.plasmic.desktop" to quit']);
    for (let i = 0; running() && i < 100; i++) await delay(200);
    if (running()) throw new Error("Plasmic has not quit; installation was not started");
  }
  const staging = `/Applications/.Plasmic-local-${randomUUID()}.app`;
  const backup = path.join(homedir(), "Library/Caches/Plasmic-local-backups", new Date().toISOString().replaceAll(":", "-"), "Plasmic.app");
  let previous = false;
  try {
    execFileSync("/usr/bin/ditto", [source, staging]);
    verifyMacSignature(staging, macSigningCertificate());
    if (existsSync(target)) {
      await mkdir(path.dirname(backup), { recursive: true });
      await rename(target, backup);
      previous = true;
    }
    try { await rename(staging, target); }
    catch (error) { if (previous) await rename(backup, target); throw error; }
  } finally { await rm(staging, { recursive: true, force: true }); }
  // A prohibited --mcp process may still be registered as this application.
  // Start the GUI explicitly; its own single-instance lock handles GUI reuse.
  execFileSync("/usr/bin/open", ["-n", target]);
  let actual;
  for (let i = 0; i < 60; i++) {
    try {
      actual = await requestRpc(profile, "get_build_info", {});
      if (actual.build?.rendererHash === expected.build.rendererHash && actual.build?.desktopHash === expected.build.desktopHash) break;
    } catch { /* The new App may still be starting its local RPC. */ }
    await delay(500);
  }
  if (actual?.build?.rendererHash !== expected.build.rendererHash || actual?.build?.desktopHash !== expected.build.desktopHash) {
    throw new Error("The running App did not report the installed local build hashes");
  }
  const result = { installed: target, backup: previous ? backup : null, version: actual.version, build: actual.build };
  await writeInstallReport(result);
  return result;
}

async function writeInstallReport(result) {
  const { writeFile } = await import("node:fs/promises");
  await mkdir(path.join(desktop, "dist"), { recursive: true });
  await writeFile(path.join(desktop, "dist/local-install.json"), JSON.stringify(result, null, 2) + "\n");
}
