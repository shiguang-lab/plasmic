// Public format for task-local acceptance inputs, not a Studio property model.
const text = { type: "string", pattern: "\\S" };
const array = (items) => ({ type: "array", items });
const object = (properties, required = Object.keys(properties)) => ({ type: "object", properties, required });
const strings = array(text);
const owner = object({ nodeName: text, slot: text });
const binding = object({ nodeName: text, source: text, props: strings, dynamicProps: strings, events: strings,
  propStateDependencies: { type: "object", additionalProperties: { ...strings, minItems: 1 } } }, ["nodeName", "source"]);
const component = object({ nodeName: text, component: text, source: text, purpose: text,
  role: { enum: ["widget", "content-scope", "category", "row-actions", "pagination"] },
  props: { type: "object" }, dynamicProps: strings, owner, dataOwner: text }, ["nodeName", "component", "source", "purpose", "role"]);
const step = object({ action: { enum: ["open", "close", "snapshot", "click", "hover", "fill", "select", "press", "scroll"] },
  componentUuid: text, role: text, name: { type: "string" }, value: { type: "string" },
  key: { enum: ["Enter", "Escape", "Tab", "ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Space", "Backspace", "Delete", "Home", "End"] },
  width: { type: "integer" }, height: { type: "integer" }, x: { type: "integer" }, y: { type: "integer" } }, ["action"]);
const runtimeCase = object({ id: text, source: text, steps: { ...array(step), minItems: 1 },
  assertions: { ...array(require("./prototype-mcp.cjs").assertionSchema), minItems: 1 }, deferred: { type: "boolean" }, targetPath: text }, ["id", "source", "steps", "assertions"]);
const page = object({ path: { type: "string", pattern: "^/" }, name: text, screen: text, source: text,
  pageHeader: { anyOf: [{ type: "null" }, object({ nodeName: text, source: text })] },
  components: array(component), copy: object({ source: text, excluded: array(object({ text, source: text })), help: array(object({ text, source: text, nodeName: text })) }),
  bindings: array(binding), bindingsNotApplicable: text, controls: array(object({ nodeName: text, source: text, props: { type: "object" } }, ["nodeName", "source"])),
  runtimeCases: { ...array(runtimeCase), minItems: 1 } }, ["path", "name", "screen", "source", "pageHeader", "components", "copy", "bindings", "runtimeCases"]);
const field = object({ nodeName: text, name: text, label: text, control: text, rules: array(object({ ruleType: text })) });
const form = object({ name: text, fields: array(field), layout: object({ container: text, columns: { type: "integer", minimum: 1 },
  columnGap: { type: "number", minimum: 0 }, modalWidth: { type: "number", exclusiveMinimum: 0 },
  rows: array(object({ container: text, fields: strings })) }, ["container", "columns", "columnGap", "rows"]) }, ["name", "fields"]);
const group = object({ name: text, container: text, title: { type: "string" }, column: {}, items: { anyOf: [{ type: "string" }, array({ type: "object" })] },
  itemSlots: array(object({ name: text })) }, ["name", "container", "title", "column"]);
const overlay = object({ name: text, component: text, footer: { enum: ["none", "native", "custom"] }, closeIcon: { type: "boolean" },
  footerActions: array(object({ name: text, effect: { enum: ["business", "dismiss"] }, reason: text, props: { type: "object" } }, ["name", "effect"])) });
const inventory = (properties, required) => object({ pages: array(object({ path: text, ...properties }, ["path", ...required])) });
const inventoryPath = object({ inventory: text });
const planSchema = object({
  suite: { ...object({ structure: inventoryPath, forms: inventoryPath, descriptions: inventoryPath, overlays: inventoryPath,
    references: inventoryPath, slots: object({ pages: array(object({ path: text, intent: text })) }),
    model: { type: "object" }, rendering: { type: "object" }, page_layout: { type: "object" }, shell_height: { type: "object" } },
  ["structure", "forms", "descriptions", "overlays", "slots"]), additionalProperties: false },
  documents: object({ structure: object({ pages: { ...array(page), minItems: 1 }, navigation: object({ source: text, items: array({ type: "object" }) }) }),
    forms: inventory({ forms: array(form), standaloneControls: array(object({ nodeName: text, reason: text })) }, ["forms"]),
    descriptions: inventory({ groups: array(group) }, ["groups"]), overlays: inventory({ overlays: array(overlay) }, ["overlays"]),
    references: inventory({ references: array(object({ id: text, filePath: text, nodeId: text })), regions: array(object({ referenceId: text, decision: text, nodeNames: strings })) }, ["references", "regions"]),
  }, ["structure", "forms", "descriptions", "overlays"]),
});

const planExample = {
  suite: { structure: { inventory: "structure.json" }, forms: { inventory: "forms.json" }, descriptions: { inventory: "descriptions.json" },
    overlays: { inventory: "overlays.json" }, slots: { pages: [{ path: "/records", intent: "records.html" }] } },
  documents: {
    structure: { navigation: { source: "requirement.md §Navigation", items: [] }, pages: [{ path: "/records", name: "记录列表", screen: "requirement.md §Records", source: "requirement.md §Records",
      pageHeader: null, components: [{ nodeName: "KeywordInput", component: "plasmic-antd6-input", source: "requirement.md §Keyword", role: "widget", purpose: "Editable keyword" }],
      copy: { source: "requirement.md §Copy", excluded: [], help: [] }, bindings: [], bindingsNotApplicable: "Editable value only; no result query in this minimal format example",
      runtimeCases: [{ id: "edit-keyword", source: "requirement.md §Keyword", steps: [{ action: "fill", role: "textbox", name: "关键字", value: "示例" }], assertions: [{ kind: "value", role: "textbox", name: "关键字", value: "示例" }] }] }] },
    forms: { pages: [{ path: "/records", forms: [], standaloneControls: [{ nodeName: "KeywordInput", reason: "Independent editable keyword in this minimal format example" }] }] }, descriptions: { pages: [{ path: "/records", groups: [] }] }, overlays: { pages: [{ path: "/records", overlays: [] }] },
  },
  intents: { "records.html": '<plasmic-component data-plasmic-name="KeywordInput" data-plasmic-component="plasmic-antd6-input" data-props=\'{"aria-label":"关键字"}\'></plasmic-component>' },
};
module.exports = { planSchema, planExample };
