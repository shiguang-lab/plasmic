// Exercise both sides of the wire against an already-synchronized index.
const { ComponentCandidates } = require("../../src/component-candidates.cjs");

async function reviewIndex(index, scope, regions, options) {
  const client = new ComponentCandidates(async (_project, body, signal) => {
    if (body.command === "sync")
      return { ...index.coverage(), version: index.state.fingerprint };
    return index.search(body.intent, signal);
  });
  await client.sync(scope, [], 0);
  return client.review(scope, regions, options);
}

module.exports = { reviewIndex };
