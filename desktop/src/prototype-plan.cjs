// Source-review contracts, not a second Studio component/property model.
const { AjvJsonSchemaValidator } = require("@modelcontextprotocol/sdk/validation/ajv-provider.js");
const { planSchema } = require("./prototype-plan-schema.cjs");
const validateFormat = new AjvJsonSchemaValidator().getValidator(planSchema);
const invalidPlan = (message) => Object.assign(new Error(message), {
  context: { code: "INVALID_PLAN", operationExecuted: false, schemaTool: { tool: "prototype_task", arguments: { action: "plan_schema" } } },
});
function validatePlan(suite, documents) {
  const format = validateFormat({ suite, documents });
  if (!format.valid) throw invalidPlan("Invalid reviewed plan: " + format.errorMessage);
  const fail = (at, expected) => { throw invalidPlan(`Invalid reviewed plan at ${at}: expected ${expected}`); };
  const object = (value, at) => { if (!value || typeof value !== "object" || Array.isArray(value)) fail(at, "object"); return value; };
  const text = (value, at) => { if (typeof value !== "string" || !value.trim()) fail(at, "nonempty string"); };
  const list = (value, at, visit = object) => { if (!Array.isArray(value)) fail(at, "array"); value.forEach((v, i) => visit(v, `${at}/${i}`)); return value; };
  const texts = (value, at) => list(value, at, text);
  const unique = (values, at) => { if (new Set(values).size !== values.length) fail(at, "distinct identities"); };
  const structure = object(documents.structure, "structure");
  for (const key of Object.keys(suite)) if (!["model", "rendering", "structure", "page_layout", "forms", "descriptions", "overlays", "slots", "shell_height", "references"].includes(key)) fail(key, "supported verification gate");
  const pages = list(structure.pages, "structure/pages");
  if (!pages.length) fail("structure/pages", "at least one Page");
  unique(pages.map((p) => p.path), "structure/pages/path");
  unique(pages.map((p) => p.screen), "structure/pages/screen");
  const navigation = object(structure.navigation, "structure/navigation");
  text(navigation.source, "structure/navigation/source");
  list(navigation.items, "structure/navigation/items");
  for (const [i, page] of pages.entries()) {
    const at = `structure/pages/${i}`;
    for (const key of ["path", "name", "source", "screen"]) text(page[key], at + "/" + key);
    if (!page.path.startsWith("/")) fail(at + "/path", "absolute Page route");
    if (!Object.hasOwn(page, "pageHeader")) fail(at + "/pageHeader", "null or source-reviewed header");
    if (page.pageHeader !== null) { object(page.pageHeader, at + "/pageHeader"); for (const k of ["nodeName", "source"]) text(page.pageHeader[k], at + "/pageHeader/" + k); }
    const uses = list(page.components, at + "/components");
    unique(uses.map((c) => c.nodeName), at + "/components/nodeName");
    for (const c of uses) {
      for (const k of ["nodeName", "component", "source", "purpose"]) text(c[k], at + "/components/" + k);
      if (!["widget", "content-scope", "category", "row-actions", "pagination"].includes(c.role)) fail(at + "/components/role", "reviewed widget role");
      if (c.props !== undefined) object(c.props, at + "/components/props");
      if (c.dynamicProps !== undefined) texts(c.dynamicProps, at + "/components/dynamicProps");
      if (c.owner !== undefined) { object(c.owner, at + "/components/owner"); text(c.owner.nodeName, at + "/components/owner/nodeName"); text(c.owner.slot, at + "/components/owner/slot"); if (!uses.some((u) => u.nodeName === c.owner.nodeName)) fail(at + "/components/owner", "source-declared owning component"); }
      const registered = c.component.toLowerCase().replace(/[^a-z0-9]/g, "");
      if ((registered === "plasmicantd6pagination" || registered === "plasmicantd6table" && c.props?.pagination !== false) && c.role !== "pagination") fail(at + "/components/role", "pagination role for every declared active native pager, or explicitly disabled Table pagination");
      if (c.role === "content-scope" && registered !== "plasmicantd6tabs") fail(at + "/components", "native Tabs for content-scope navigation in this library suite");
      if (c.role === "category" && !(registered === "plasmicantd6tag" || registered === "plasmicantd6tablecolumn" && c.props?.displayType === "tag")) fail(at + "/components", "native Tag or Column tag display for category presentation");
      if (c.role === "row-actions") {
        let child = c, column;
        const visited = new Set();
        while (child.owner && !visited.has(child)) {
          visited.add(child);
          const owner = uses.find((u) => u.nodeName === child.owner.nodeName);
          if (!owner) break;
          if (String(owner.component).toLowerCase().replace(/[^a-z0-9]/g, "") === "plasmicantd6tablecolumn") { if (child.owner.slot === "render") column = owner; break; }
          child = owner;
        }
        if (registered !== "plasmicreactuiactiongroup" || column?.props?.fixed !== "right" || typeof column.props?.width !== "number" || !(column.props.width > 0)) fail(at + "/components", "ActionGroup in a reviewed fixed-right Column render Slot with positive width");
      }
      if (c.role === "pagination") {
        const table = registered === "plasmicantd6table";
        if ((!table && registered !== "plasmicantd6pagination") || !c.dynamicProps?.includes(table ? "pagination.showTotal" : "showTotal")) fail(at + "/components", "one native pagination owner with a bound showTotal function");
        if (table) object(c.props?.pagination, at + "/components/props/pagination");
        else {
          text(c.dataOwner, at + "/components/dataOwner");
          const owner = uses.find((u) => u.nodeName === c.dataOwner);
          if (!owner || owner === c || owner.role === "pagination" || String(owner.component).toLowerCase().replace(/[^a-z0-9]/g, "") === "plasmicantd6table" && owner.props?.pagination !== false) fail(at + "/components/dataOwner", "reviewed data region with duplicated Table pagination disabled");
        }
      }
    }
    const copy = object(page.copy, at + "/copy"); text(copy.source, at + "/copy/source");
    for (const key of ["excluded", "help"]) for (const c of list(copy[key], at + "/copy/" + key)) {
      for (const k of ["text", "source", ...(key === "help" ? ["nodeName"] : [])]) text(c[k], at + "/copy/" + key + "/" + k);
    }
    for (const key of ["controls", "bindings"]) for (const [j, c] of list(page[key] ?? [], at + "/" + key).entries()) {
      const node = at + "/" + key + "/" + j;
      text(c.nodeName, node + "/nodeName"); text(c.source, node + "/source");
      if (key === "controls" && c.props !== undefined) object(c.props, node + "/props");
      if (key === "bindings") {
        for (const prop of ["props", "dynamicProps", "events"]) if (c[prop] !== undefined) texts(c[prop], node + "/" + prop);
        if (c.propStateDependencies !== undefined) for (const [prop, states] of Object.entries(object(c.propStateDependencies, node + "/propStateDependencies"))) {
          texts(states, node + "/propStateDependencies/" + prop);
          if (!states.length) fail(node + "/propStateDependencies/" + prop, "nonempty state paths");
        }
      }
    }
    if (!Array.isArray(page.bindings) || (!page.bindings.length && (typeof page.bindingsNotApplicable !== "string" || !page.bindingsNotApplicable.trim())) || (page.bindings.length && page.bindingsNotApplicable !== undefined)) fail(at + "/bindings", "source-derived bindings, or [] with bindingsNotApplicable reason");
    const cases = list(page.runtimeCases, at + "/runtimeCases");
    if (!cases.length || cases.every((c) => c.deferred)) fail(at + "/runtimeCases", "nondeferred runtime cases");
    unique(cases.map((c) => c.id), at + "/runtimeCases/id");
    for (const c of cases) {
      text(c.id, at + "/runtimeCases/id"); text(c.source, at + "/runtimeCases/source");
      if (!list(c.steps, at + "/runtimeCases/steps").length || !list(c.assertions, at + "/runtimeCases/assertions").length) fail(at + "/runtimeCases", "steps and assertions");
      for (const step of c.steps) {
        if (!["open", "close", "snapshot", "click", "hover", "fill", "select", "press", "scroll"].includes(step.action)) fail(at + "/runtimeCases/steps/action", "native Preview action");
        if (["click", "hover", "fill", "select", "press"].includes(step.action)) text(step.role, at + "/runtimeCases/steps/role");
        if (["fill", "select"].includes(step.action) && typeof step.value !== "string") fail(at + "/runtimeCases/steps/value", "string");
        if (step.action === "press" && !["Enter", "Escape", "Tab", "ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Space", "Backspace", "Delete", "Home", "End"].includes(step.key)) fail(at + "/runtimeCases/steps/key", "native Preview key");
      }
      if ((c.deferred || c.targetPath !== undefined) && !pages.some((p) => p.path === c.targetPath)) fail(at + "/runtimeCases/targetPath", "planned destination route");
      for (const a of c.assertions) {
        if (!["text", "count", "visible", "value"].includes(a.kind)) fail(at + "/runtimeCases/assertions/kind", "native DOM assertion");
        if (a.kind === "text") text(a.text, at + "/runtimeCases/assertions/text"); else text(a.role, at + "/runtimeCases/assertions/role");
        if (["text", "visible"].includes(a.kind) && typeof a.present !== "boolean") fail(at + "/runtimeCases/assertions/present", "boolean");
        if (a.kind === "count" && (!Number.isInteger(a.count) || a.count < 0)) fail(at + "/runtimeCases/assertions/count", "nonnegative integer");
        if (a.kind === "value" && typeof a.value !== "string") fail(at + "/runtimeCases/assertions/value", "string");
      }
    }
  }
  for (const name of ["forms", "descriptions", "overlays"]) {
    const inventory = object(documents[name], name);
    const entries = list(inventory.pages, name + "/pages");
    if (entries.length !== pages.length || pages.some((p) => entries.filter((e) => e.path === p.path).length !== 1)) fail(name + "/pages", "exact planned Page routes, including empty inventories");
    for (const p of entries) {
      const at = name + "/pages/" + p.path;
      if (name === "forms") {
        for (const form of list(p.forms, at + "/forms")) {
          text(form.name, at + "/forms/name");
          if (form.layout !== undefined) {
            const layout = object(form.layout, at + "/forms/layout");
            text(layout.container, at + "/forms/layout/container");
            for (const k of ["columns", "columnGap", ...(layout.modalWidth !== undefined ? ["modalWidth"] : [])]) if (typeof layout[k] !== "number" || !Number.isFinite(layout[k]) || layout[k] < (k === "columnGap" ? 0 : 1)) fail(at + "/forms/layout/" + k, "valid numeric layout dimension");
            if (!Number.isInteger(layout.columns)) fail(at + "/forms/layout/columns", "positive integer");
            for (const row of list(layout.rows, at + "/forms/layout/rows")) { text(row.container, at + "/forms/layout/rows/container"); texts(row.fields, at + "/forms/layout/rows/fields"); }
          }
          for (const field of list(form.fields, at + "/forms/fields")) {
            for (const k of ["nodeName", "name", "label", "control"]) text(field[k], at + "/forms/fields/" + k);
            for (const rule of list(field.rules, at + "/forms/fields/rules")) text(rule.ruleType, at + "/forms/fields/rules/ruleType");
          }
        }
        for (const c of list(p.standaloneControls ?? [], at + "/standaloneControls")) for (const k of ["nodeName", "reason"]) text(c[k], at + "/standaloneControls/" + k);
      } else if (name === "descriptions") {
        for (const group of list(p.groups, at + "/groups")) {
          for (const k of ["name", "container"]) text(group[k], at + "/groups/" + k);
          if (typeof group.title !== "string" || !Object.hasOwn(group, "column")) fail(at + "/groups", "title and column");
          if (group.itemSlots !== undefined) for (const slot of list(group.itemSlots, at + "/groups/itemSlots")) text(slot.name, at + "/groups/itemSlots/name");
          else if (typeof group.items !== "string") list(group.items, at + "/groups/items");
        }
      } else for (const overlay of list(p.overlays, at + "/overlays")) {
        for (const k of ["name", "component"]) text(overlay[k], at + "/overlays/" + k);
        if (!["none", "native", "custom"].includes(overlay.footer) || typeof overlay.closeIcon !== "boolean") fail(at + "/overlays", "footer ownership and boolean closeIcon");
        for (const action of list(overlay.footerActions, at + "/overlays/footerActions")) {
          text(action.name, at + "/overlays/footerActions/name");
          if (!["business", "dismiss"].includes(action.effect)) fail(at + "/overlays/footerActions/effect", "business or dismiss");
          if (action.effect === "business") text(action.reason, at + "/overlays/footerActions/reason");
          if (action.props !== undefined) object(action.props, at + "/overlays/footerActions/props");
        }
      }
    }
  }
  const intents = list(object(suite.slots, "slots").pages, "slots/pages");
  if (intents.length !== pages.length || pages.some((p) => intents.filter((e) => e.path === p.path && typeof e.intent === "string" && e.intent).length !== 1)) fail("slots/pages", "one intent path per planned Page");
  if (documents.references) {
    const refs = list(object(documents.references, "references").pages, "references/pages");
    if (refs.length !== pages.length || pages.some((p) => refs.filter((r) => r.path === p.path).length !== 1)) fail("references/pages", "exact planned Page routes");
    for (const p of refs) {
      for (const ref of list(p.references, "references/" + p.path + "/references")) for (const k of ["id", "filePath", "nodeId"]) text(ref[k], "references/" + p.path + "/" + k);
      for (const region of list(p.regions, "references/" + p.path + "/regions")) { text(region.referenceId, "references/referenceId"); text(region.decision, "references/decision"); texts(region.nodeNames, "references/nodeNames"); }
    }
  }
  return pages;
}

// Revisions can add checks, never remove or rewrite a previously reviewed check.
function retains(original, revised) {
  if (Array.isArray(original)) return Array.isArray(revised) && original.length <= revised.length && original.every((v, i) => retains(v, revised[i]));
  if (original && typeof original === "object") return revised && !Array.isArray(revised) && typeof revised === "object" && Object.entries(original).every(([k, v]) => Object.hasOwn(revised, k) && retains(v, revised[k]));
  return original === revised;
}
function intentNames(markup) {
  return new Set([...markup.matchAll(/\sdata-plasmic-name\s*=\s*(["'])([A-Z][A-Za-z0-9]*)\1/g)].map((m) => m[2]));
}
module.exports = { validatePlan, retains, intentNames };
