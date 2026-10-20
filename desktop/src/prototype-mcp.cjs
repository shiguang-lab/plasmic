const { REFERENCE_FIELDS } = require("./design-reference.cjs");
const object = (properties, required = []) => ({ type: "object", properties, required, additionalProperties: false });
const string = { type: "string", minLength: 1 };
const assertionSchema = { oneOf: [
  object({ kind: { const: "text" }, text: string, present: { type: "boolean" } }, ["kind", "text", "present"]),
  object({ kind: { const: "count" }, role: string, name: { type: "string" }, count: { type: "integer", minimum: 0 } }, ["kind", "role", "count"]),
  object({ kind: { const: "visible" }, role: string, name: { type: "string" }, present: { type: "boolean" } }, ["kind", "role", "present"]),
  object({ kind: { const: "value" }, role: string, name: { type: "string" }, value: { type: "string" } }, ["kind", "role", "value"]),
] };
const prototypeTools = [
  { name: "preview", description: "Operate the existing authenticated native Preview, without saving or importing. open/close use Studio's own Preview; width+height select a temporary CSS viewport, not a Page device. state reports actual runtime identity/readiness. snapshot returns paginated DOM roles/names/values and text; refs are runtime-only and expire after navigation/replacement. click/fill/select/press/scroll trigger real DOM/input events, never rewrite saved props or invoke business handlers directly. Antd dropdowns use click then snapshot then click option; select is for native select elements. assert checks actual visible DOM/text/value/count, optionally waiting up to timeoutMs. screenshot captures the displayed Preview iframe as compressed WebP and reports its CSS viewport and presentation rect. No arbitrary JavaScript or reference browser fallback.",
    inputSchema: object({ action: { enum: ["open", "close", "state", "snapshot", "click", "hover", "fill", "select", "press", "scroll", "screenshot", "assert"] }, componentUuid: string,
      width: { type: "integer", minimum: 240, maximum: 7680 }, height: { type: "integer", minimum: 240, maximum: 7680 }, ref: string, value: { type: "string", maxLength: 100000 },
      key: { type: "string", enum: ["Enter", "Escape", "Tab", "ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Space", "Backspace", "Delete", "Home", "End"] },
      x: { type: "integer", minimum: -100000, maximum: 100000 }, y: { type: "integer", minimum: -100000, maximum: 100000 },
      offset: { type: "integer", minimum: 0 }, limit: { type: "integer", minimum: 1, maximum: 50 }, textOffset: { type: "integer", minimum: 0 }, textLimit: { type: "integer", minimum: 1, maximum: 6000 },
      fullResolution: { type: "boolean" }, checks: { type: "array", minItems: 1, maxItems: 30, items: assertionSchema }, timeoutMs: { type: "integer", minimum: 0, maximum: 10000 },
    }, ["action"]) },
  { name: "design_reference", description: "Read a supplied local .pen through the installed Pen MCP in a read-only session. index returns paginated top-level frame identities/dimensions. read returns selected native layout/style/text fields and child IDs for one node/subtree (depth 0-3); follow nextOffset. screenshot returns one frame image as compressed WebP. Never reads raw .pen JSON, mutates Pen, or imports a raster prototype. Active prototype tasks archive actual downstream call evidence, properties and screenshots. On macOS discovers the installed Pen app; other installs configure command/args in Desktop user-data/design-reference.json.",
    inputSchema: object({ action: { enum: ["index", "read", "screenshot"] }, filePath: string, nodeId: string,
      depth: { type: "integer", minimum: 0, maximum: 3 }, fields: { type: "array", minItems: 1, uniqueItems: true, items: { enum: REFERENCE_FIELDS } },
      offset: { type: "integer", minimum: 0 }, limit: { type: "integer", minimum: 1, maximum: 50 }, fullResolution: { type: "boolean" },
    }, ["action", "filePath"]) },
  { name: "prototype_task", description: "Enforce source-reviewed native Page generation. validate_plan checks a suite before writes; start archives its immutable source/expectation baseline and binds the project. Each logical source screen maps to one Page. Empty Pages are allowed; shell/business writes require begin_page and current registered contract reads. Complete structure, image review and native Preview cases before complete_page and the next Page. cancel leaves the task incomplete and write-blocked across Desktop restarts; resume retains its original evidence. revise accepts additive checks and named-target-preserving implementation intent changes, never weaker business expectations. state returns compact progress and nextAction. finish requires all Page/deferred checks, save/reopen and a full live report. See the controlled-task reference for inventory fields and evidence contracts.",
    inputSchema: { ...object({ action: { enum: ["validate_plan", "start", "state", "resume", "revise", "begin_page", "structural_check", "review_visual", "begin_case", "cancel_case", "complete_page", "finish", "cancel"] },
      projectId: string, suitePath: string, resourceRoot: string, resourceRelease: { type: "string", pattern: "^[0-9a-f]{64}$" }, sourceFiles: { type: "array", minItems: 1, uniqueItems: true, items: string }, referenceFiles: { type: "array", uniqueItems: true, items: string },
      pagePath: string, reportPath: string, caseId: string,
      observations: { type: "array", minItems: 1, items: object({ referenceId: string, generatedEvidenceId: string, result: { enum: ["matched", "adapted", "failed"] }, observation: string, reason: string, source: string }, ["referenceId", "generatedEvidenceId", "result", "observation"]) },
    }, ["action"]), allOf: [
      { if: { properties: { action: { const: "start" } } }, then: { required: ["projectId", "suitePath", "resourceRoot", "resourceRelease", "sourceFiles", "referenceFiles"] } },
      { if: { properties: { action: { const: "validate_plan" } } }, then: { required: ["suitePath"] } },
    ] } },
  { name: "reference_browser", description: "Read a supplied external reference website while a ready, editable Studio project is open in edit mode. Start with load_page and an explicit HTTP(S) url; source and editor context are validated before showing the panel. get_state reads selection/viewport; select_element selects a CSS node or starts the picker; set_import_height changes capture/import extent; capture returns styled DOM by reference and compressed WebP. cdp supports DOM/CSS/accessibility reads and side-effect-free Runtime.evaluate only. close can always hide the panel. Native runtime acceptance belongs to preview; a failed preview leaves that acceptance incomplete, with no reference-browser fallback. This tool never imports to canvas; import_reference requires explicit import intent.",
    inputSchema: { ...object({ action: { enum: ["load_page", "get_state", "select_element", "set_import_height", "capture", "cdp", "close"] },
      url: { type: "string", pattern: "^https?://" }, selector: { type: "string", minLength: 1, maxLength: 500 }, width: { type: "integer", minimum: 320, maximum: 4096 }, height: { type: "integer", minimum: 240, maximum: 16384 },
      method: string, params: { type: "object" }, target: { enum: ["full_page", "selection"] }, fullResolution: { type: "boolean" },
    }, ["action"]), allOf: [{ if: { properties: { action: { const: "load_page" } } }, then: { required: ["url"] } }] } },
  { name: "import_reference", description: "Import an explicitly intended, loaded external reference into a new independent artboard while a ready, editable Studio project is open in edit mode. editable imports native editable layers; screenshot imports a raster. Use reference_browser load_page first for the external source. Does not append to a Page or perform Preview acceptance. Controlled native Page generation does not use this operation. Returns artboard identity; inspect actual imported contracts/content before consuming it.",
    inputSchema: object({ action: { enum: ["editable", "screenshot"] }, target: { enum: ["full_page", "selection", "visible_area"] }, name: { type: "string", pattern: "^[A-Z][A-Za-z0-9]*$" } }, ["action"]) },
];
module.exports = { prototypeTools, assertionSchema };
