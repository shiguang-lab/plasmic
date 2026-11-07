const { hash } = require("./component-reuse.cjs");
const text = (value, max = 300) => typeof value === "string" && value.length <= max && /\S/.test(value);
const strings = (value, max = 100) => Array.isArray(value) && value.length <= max && value.every(item => text(item));
function documents(input) {
  if (!Array.isArray(input) || input.length > 5000) throw new Error("Invalid component catalogue");
  let length = 0; const ids = new Set();
  return input.map(doc => {
    if (!doc || ![doc.componentUuid, doc.name, doc.fromProject, doc.version].every(value => text(value)) || typeof doc.description !== "string" || doc.description.length > 4000 || !Array.isArray(doc.sections) || !doc.sections.length || doc.sections.length > 32 || !doc.sections.every(section => text(section, 32000)) || !strings(doc.props, 500) || !strings(doc.slots, 100) || !strings(doc.events, 100) || doc.parent !== undefined && !text(doc.parent)) throw new Error("Invalid component contract document");
    length += doc.sections.join().length + doc.description.length + doc.props.join().length + doc.slots.join().length + doc.events.join().length;
    if (length > 4 * 1024 * 1024 || ids.has(doc.componentUuid)) throw new Error("Component catalogue exceeds limits or has duplicate identities");
    ids.add(doc.componentUuid);
    return { componentUuid: doc.componentUuid, name: doc.name, fromProject: doc.fromProject, version: doc.version, description: doc.description,
      sections: doc.sections, props: doc.props, slots: doc.slots, events: doc.events, ...(doc.parent ? { parent: doc.parent } : {}) };
  });
}
function regions(input) {
  if (!Array.isArray(input) || input.length < 1 || input.length > 5) throw new Error("Invalid component review regions");
  return input.map(region => {
    if (!region || ![region.componentUuid, region.elementUuid].every(value => text(value)) || !text(region.intent, 600) || !strings(region.usedComponentUuids, 500) || region.ancestorComponentUuids !== undefined && !strings(region.ancestorComponentUuids, 500) || !strings(region.facts, 100)) throw new Error("Invalid component review region");
    return { componentUuid: region.componentUuid, elementUuid: region.elementUuid, intent: region.intent, usedComponentUuids: region.usedComponentUuids, ancestorComponentUuids: region.ancestorComponentUuids ?? [], facts: region.facts };
  });
}

function createComponentReuseHandler({ service, origin, trustedSender, projectId, currentUser }) {
  let epoch = 0; const requests = new Map(); let frame; let location; let owner;
  const observed = new WeakSet();
  const reset = () => { epoch++; for (const entry of requests.values()) entry.controller.abort(); requests.clear(); frame = null; location = null; owner = null; service.reset(); };
  const navigate = url => { if (location && new URL(url, origin).pathname !== new URL(location, origin).pathname) reset(); };
  return {
    reset,
    async close() { reset(); await service.close(); },
    async command(event, command, input = {}) {
      if (!trustedSender(event)) throw new Error("Invalid component reuse sender");
      if (event.sender?.on && !observed.has(event.sender)) {
        observed.add(event.sender);
        event.sender.on("did-start-navigation", (_event, url, _inPlace, main) => { if (main && owner === event.sender) navigate(url); });
        event.sender.on("did-navigate-in-page", (_event, url, main) => { if (main && owner === event.sender) navigate(url); });
        event.sender.once("destroyed", () => { if (owner === event.sender) reset(); });
      }
      if (command === "activity") { if (frame === event.senderFrame) service.activity(); return; }
      if (command === "cancel") {
        const entry = requests.get(input.id);
        if (entry?.frame === event.senderFrame) entry.controller.abort();
        return;
      }
      if (!text(input.projectId) || projectId(event.senderFrame.url) !== input.projectId) throw new Error("Invalid component reuse project");
      const version = epoch; const userId = await currentUser();
      if (!userId || version !== epoch || !trustedSender(event) || projectId(event.senderFrame.url) !== input.projectId) throw new Error("Component reuse account or project changed");
      const scope = { account: hash(origin + "\0" + userId), project: input.projectId };
      if (command === "release") { if (service.state?.scope.project === input.projectId && frame === event.senderFrame) reset(); return; }
      frame = event.senderFrame;
      if (command === "sync") {
        if (!Number.isInteger(input.unavailable) || input.unavailable < 0 || input.unavailable > 5000) throw new Error("Invalid component coverage");
        const docs = documents(input.documents);
        if (service.state && (service.state.scope.account !== scope.account || service.state.scope.project !== scope.project)) reset();
        frame = event.senderFrame;
        owner = event.sender;
        location = event.senderFrame.url;
        if (input.retry !== undefined && typeof input.retry !== "boolean") throw new Error("Invalid component review retry");
        return service.sync(scope, docs, input.unavailable, input.retry === true);
      }
      if (command !== "review" || !text(input.id, 100) || requests.has(input.id) || requests.size >= 8) throw new Error("Invalid component review request");
      const targets = regions(input.regions); const controller = new AbortController();
      requests.set(input.id, { controller, frame: event.senderFrame });
      try {
        const result = await service.review(scope, targets, { signal: controller.signal });
        if (version !== epoch || !trustedSender(event) || projectId(event.senderFrame.url) !== input.projectId) return { status: "cancelled", indexed: 0, total: 0, elapsedMs: result.elapsedMs, suggestions: [] };
        return result;
      } finally { requests.delete(input.id); }
    },
  };
}
module.exports = { createComponentReuseHandler, documents, regions };
