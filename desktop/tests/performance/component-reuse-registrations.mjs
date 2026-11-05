import { createRequire } from "node:module";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { captureComponentContracts } from "../../../scripts/capture-component-contracts.mjs";
import { loadComponentReviewContract } from "../../scripts/component-review-contract.mjs";

const require = createRequire(import.meta.url);
const { ComponentEmbedding, MODEL } = require("../../src/component-embedding.cjs");
const { ComponentReuse, hash } = require("../../src/component-reuse.cjs");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const contract = await loadComponentReviewContract();
const cases = JSON.parse(await readFile(new URL("component-reuse-cases.json", import.meta.url), "utf8"));
const directory = await mkdtemp(path.join(os.tmpdir(), "component-registration-probe-"));
const captures = { before: await captureComponentContracts({ before: true }), after: await captureComponentContracts() };
const stripped = meta => Object.fromEntries(Object.entries(meta).filter(([key]) => key !== "description"));
const unchangedContracts = JSON.stringify(captures.before.registrations.map(stripped)) === JSON.stringify(captures.after.registrations.map(stripped));
if (!unchangedContracts) throw new Error("Registration changes extend beyond root descriptions");
const report = { model: MODEL, cases, unchangedContracts, descriptionChanges: captures.after.registrations.filter((meta, i) => meta.description !== captures.before.registrations[i].description).map(meta => meta.name),
  limitations: ["Small manually authored diagnostic set, not independent holdout or production success guarantee.", "Executed source registrations, not a saved installed project. Queries use the same structured serializer and production search service.", "Source registration callbacks are not executed; runtime methods/behavior are not tested by this capture."] };
for (const label of ["before", "after"]) {
  const embedding = new ComponentEmbedding(path.join(root, "desktop/component-reuse-runtime", process.platform + "-" + process.arch));
  const service = new ComponentReuse({ directory, embedding });
  const scope = { account: hash("registration-probe"), project: label };
  try {
    const documents = captures[label].registrations.map(meta => ({ componentUuid: meta.name, name: meta.name, fromProject: "source-registrations", version: label, ...contract.describeReviewRegistration(meta) }));
    let started = performance.now(); const initial = await service.sync(scope, documents); const syncMs = performance.now() - started;
    const deadline = Date.now() + 180000;
    while (service.coverage().indexed < service.coverage().total) {
      if (service.failure) throw service.failure;
      if (Date.now() > deadline) throw new Error("Registration indexing deadline");
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    const indexing = { syncMs, totalReadyMs: performance.now() - started, initial, counters: { ...service.stats }, nativeStarted: !!embedding.child };
    const results = [];
    for (const item of cases) {
      const context = contract.componentReviewContextSchema.parse(item.retrieval);
      const result = await service.review(scope, [{ componentUuid: "page", elementUuid: item.id, intent: context.purpose, facts: [], usedComponentUuids: [] }]);
      const candidates = result.suggestions[0]?.candidates ?? [];
      results.push({ id: item.id, expected: item.expected, elapsedMs: result.elapsedMs, status: result.status, candidates, hit: item.expected.length ? candidates.some(candidate => item.expected.includes(candidate.componentUuid)) : null });
    }
    report[label] = { catalogueCount: documents.length, described: captures[label].registrations.filter(meta => meta.description?.trim()).length,
      inputSha256: hash(JSON.stringify(documents)), documents, indexing, hitAt3: results.filter(item => item.hit).length,
      positiveCases: cases.filter(item => item.expected.length).length, negativeSuggestions: results.filter(item => !item.expected.length && item.candidates.length).map(item => item.id), results };
    if (label === "after") {
      const chineseResults = [];
      for (const item of cases) {
        const context = contract.componentReviewContextSchema.parse({ purpose: item.purpose });
        const result = await service.review(scope, [{ componentUuid: "page", elementUuid: item.id, intent: context.purpose, facts: [], usedComponentUuids: [] }]);
        const candidates = result.suggestions[0]?.candidates ?? [];
        chineseResults.push({ id: item.id, expected: item.expected, candidates, hit: item.expected.length ? candidates.some(candidate => item.expected.includes(candidate.componentUuid)) : null });
      }
      report.after.chineseOnlyComparison = { hitAt3: chineseResults.filter(item => item.hit).length, negativeSuggestions: chineseResults.filter(item => !item.expected.length && item.candidates.length).map(item => item.id), results: chineseResults };
    }
  } finally { await service.close(); }
}
const output = process.argv[process.argv.indexOf("--report") + 1];
if (!output || !process.argv.includes("--report")) throw new Error("Use --report PATH");
await writeFile(output, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(Object.fromEntries(["before", "after"].map(label => [label, { indexing: report[label].indexing, hitAt3: report[label].hitAt3, positiveCases: report[label].positiveCases, negativeSuggestions: report[label].negativeSuggestions }]))));
