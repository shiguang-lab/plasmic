#!/usr/bin/env node
import { realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { formatProgress } from "./progress.mjs";
import { CLI_VERSION } from "./protocol.mjs";
import {
  checkCliVersion,
  checkReferences,
  referencePath,
  resolveContext,
  updateReferences,
} from "./references.mjs";
import { installSkill } from "./skill.mjs";

const usage = `plasmickit commands:
  skill install [--dry-run]
  version check [--feed HTTPS_URL]
  references check|update|path [--feed HTTPS_URL] [--home CACHE_ROOT]
  context resolve --mode inspect|prototype|codegen [--feed HTTPS_URL] [--home CACHE_ROOT]
  --version
`;
export async function main(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      "dry-run": { type: "boolean" },
      mode: { type: "string" },
      feed: { type: "string" },
      home: { type: "string" },
      help: { type: "boolean" },
      version: { type: "boolean" },
    },
  });
  if (values.version) {
    process.stdout.write(CLI_VERSION + "\n");
    return;
  }
  if (!positionals.length || values.help) {
    process.stdout.write(usage);
    return;
  }
  const [command, action] = positionals;
  if (positionals.length !== 2) {
    throw new Error("Expected a command and action; use --help");
  }
  values.onProgress = (event) =>
    process.stderr.write(
      formatProgress({
        ...event,
        versionKind: command === "version" ? "cli" : "resources",
      }),
    );
  let output;
  if (command === "skill" && action === "install") {
    output = await installSkill({ dryRun: values["dry-run"] });
  } else if (command === "version" && action === "check") {
    output = await checkCliVersion(values);
  } else if (command === "references" && action === "check") {
    output = await checkReferences(values);
  } else if (command === "references" && action === "update") {
    const { manifest: _manifest, ...result } = await updateReferences(values);
    output = result;
  } else if (command === "references" && action === "path") {
    output = await referencePath(values);
  } else if (command === "context" && action === "resolve") {
    output = await resolveContext(values.mode, values);
  } else {
    throw new Error(`Unknown command: ${command} ${action}`);
  }
  process.stdout.write(JSON.stringify({ ok: true, ...output }, null, 2) + "\n");
  if (output.ok === false) {
    process.exitCode = 1;
  }
}
if (
  process.argv[1] &&
  realpathSync(path.resolve(process.argv[1])) === fileURLToPath(import.meta.url)
) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(
      JSON.stringify({
        ok: false,
        error: error.message,
        ...(error.stage ? { stage: error.stage } : {}),
        ...(error.cliUrl
          ? {
              cliUrl: error.cliUrl,
              cliVersion: error.cliVersion,
              latestCliVersion: error.latestCliVersion,
              minCliVersion: error.minCliVersion,
            }
          : {}),
      }) + "\n",
    );
    process.exitCode = 1;
  });
}
