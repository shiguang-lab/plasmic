import { readFile, writeFile } from "node:fs/promises";
import { captureComponentContracts } from "../../scripts/capture-component-contracts.mjs";
import { loadComponentReviewContract } from "./component-review-contract.mjs";
const { describeReviewRegistration } = await loadComponentReviewContract();
const { registrations } = await captureComponentContracts();
const documents = registrations.map(meta => ({ componentUuid: meta.name, name: meta.name, fromProject: "build-time-public-registration", version: "source", ...describeReviewRegistration(meta) }));
const file = new URL("../src/component-reuse-public-documents.json", import.meta.url);
const text = JSON.stringify(documents, null, 2) + "\n";
if (process.argv.includes("--check")) {
  if (await readFile(file, "utf8") !== text) throw new Error("Public component documents are stale; regenerate before release");
} else await writeFile(file, text);
