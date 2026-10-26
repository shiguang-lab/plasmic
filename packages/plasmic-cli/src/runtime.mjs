import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execute = promisify(execFile);

/** The bundled reference readers and verification scripts require Python 3.9+. */
export async function verifyRuntime() {
  let version;
  try {
    const { stdout } = await execute("python3", [
      "-c", "import json,sys; print(json.dumps(list(sys.version_info[:3])))",
    ], { timeout: 10000, maxBuffer: 4096 });
    version = JSON.parse(stdout);
  } catch (error) {
    throw new Error("Plasmic workflows require Python 3.9+ available as python3. Install it or make it available on this client's PATH, then resolve context again.", { cause: error });
  }
  if (!Array.isArray(version) || version.length !== 3 || !version.every(Number.isInteger) ||
      version[0] < 3 || (version[0] === 3 && version[1] < 9)) {
    throw new Error("Plasmic workflows require Python 3.9+ available as python3; the detected version is unsupported. Update it, then resolve context again.");
  }
  return { node: process.versions.node, python: { command: "python3", version: version.join(".") } };
}
