import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { buildResources } from "./build-plasmic-resources.mjs";
import { publishedCli, releaseVersion } from "../packages/plasmic-cli/scripts/publish.mjs";

export async function prepareResources({ tag, output, cliVersion, fetchRelease, registry } = {}) {
  const version = releaseVersion(tag);
  const cli = await publishedCli({ fetchRelease, registry });
  if (!cli) throw new Error("Publish a CLI to npm before releasing resources");
  if (cliVersion && cli.cliVersion !== cliVersion) throw new Error(`Expected npm CLI ${cliVersion}, received ${cli.cliVersion}`);
  return buildResources(output, version, cli);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { tag: { type: "string" }, output: { type: "string" }, "cli-version": { type: "string" } } });
  const tag = values.tag || process.env.GITHUB_REF_NAME;
  if (process.env.GITHUB_REF_TYPE === "tag" && tag !== process.env.GITHUB_REF_NAME) throw new Error("Requested release does not match the GitHub tag");
  console.log(JSON.stringify(await prepareResources({ tag, output: values.output, cliVersion: values["cli-version"] }), null, 2));
}
