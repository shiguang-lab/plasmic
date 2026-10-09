const fs = require("node:fs"),
  path = require("node:path"),
  { createRequire } = require("node:module");
const req = createRequire(
  path.resolve(__dirname, "../../../desktop/package.json"),
);
const Ajv = req("ajv");
const [run, tool, raw = "{}"] = process.argv.slice(2),
  config = JSON.parse(fs.readFileSync(run + "/environment.json", "utf8")),
  input = JSON.parse(raw);
const fixture = JSON.parse(fs.readFileSync(config.modelFixture, "utf8"));
const state = fs.existsSync(run + "/model-state.json")
  ? JSON.parse(fs.readFileSync(run + "/model-state.json", "utf8"))
  : { reads: fixture.reads, saves: 0, changes: 0, projectId: config.projectId };
const trace = { time: new Date().toISOString(), tool, input };
function execute(name, args) {
  const meta = fixture.schemas[name];
  if (!meta) {
    throw new Error("Unavailable operation: " + name);
  }
  const validate = new Ajv({ strict: false, validateFormats: false }).compile(
    meta.inputSchema,
  );
  if (!validate(args)) {
    throw new Error(JSON.stringify(validate.errors));
  }
  if (name === "identify") {
    return {
      projectId: state.projectId,
      projectName: config.projectName,
      canEdit: config.canEdit,
      ...args,
    };
  }
  if (name === "read") {
    if (args.elements) {
      throw new Error("Use full component reads in this isolated transport");
    }
    if (!args.componentUuids) {
      const overview = structuredClone(fixture.overview);
      if (config.componentScope) {
        for (const project of overview.results) {
          project.id = state.projectId;
          project.components = project.components.filter((c) =>
            config.componentScope.includes(c.uuid),
          );
          project.pageFrames = project.pageFrames.filter((c) =>
            config.componentScope.includes(c.componentUuid),
          );
          project.importedProjects = [];
        }
      }
      return overview;
    }
    return {
      __type: "Resources",
      results: args.componentUuids.map((id) => {
        if (
          !state.reads[id] ||
          (config.componentScope && !config.componentScope.includes(id))
        ) {
          throw new Error("Component not found in current project: " + id);
        }
        return state.reads[id];
      }),
    };
  }
  if (name === "getEditorContext") {
    return {
      projectId: state.projectId,
      fixture: true,
      previewAvailable: false,
    };
  }
  if (name === "restoreEditorView") {
    return { restored: true };
  }
  if (!config.canEdit) {
    throw new Error("Project is read-only");
  }
  if (name === "changeElement") {
    const component = state.reads[args.componentUuid];
    if (!component) {
      throw new Error("Component not found");
    }
    const escaped = args.elementUuid.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      tag = new RegExp(`<[^>]*id="${escaped}"[^>]*>`);
    if (!tag.test(component.baseVariantTplTree)) {
      throw new Error("Element not found");
    }
    if (
      args.props ||
      args.repeat ||
      args.visibleIf ||
      args.resetProps ||
      args.variantUuids ||
      args.name
    ) {
      throw new Error("Fixture supports CSS changes only");
    }
    component.baseVariantTplTree = component.baseVariantTplTree.replace(
      tag,
      (old) => {
        const styles = Object.fromEntries(
          (old.match(/style="([^"]*)"/)?.[1] || "")
            .split(";")
            .filter(Boolean)
            .map((s) => s.trim().split(/:\s*/)),
        );
        for (const [key, value] of Object.entries(args.styles || {})) {
          if (value === null) {
            delete styles[key];
          } else {
            styles[key] = value;
          }
        }
        return old.replace(/ style="[^"]*"/, "").replace(
          />$/,
          ` style="${Object.entries(styles)
            .map(([k, v]) => `${k}: ${v}`)
            .join("; ")}">`,
        );
      },
    );
    state.changes++;
    return { __type: "Resources", results: [component] };
  }
  if (name === "save") {
    state.saves++;
    return { saved: true, fixture: true };
  }
  if (name === "validate") {
    if (config.validationProjectSwitch) {
      state.projectId = config.validationProjectSwitch;
      fs.writeFileSync(run + "/model-state.json", JSON.stringify(state, null, 2));
      throw new Error("Component not found in the current project after session change");
    }
    return { errors: [], fixture: true };
  }
  throw new Error("Unavailable operation in isolated transport: " + name);
}
try {
  let result;
  if (tool === "get_app_state") {
    result = {
      ready: true,
      projectId: state.projectId,
      version: "evaluation-fixture",
      editorTools: Object.fromEntries(
        [
          "identify",
          "read",
          "changeElement",
          "validate",
          "save",
          "getEditorContext",
          "restoreEditorView",
        ]
          .filter((n) => fixture.schemas[n])
          .map((n) => [n, fixture.schemas[n]]),
      ),
      editorContext: { fixture: true, previewAvailable: false },
      operations: [],
    };
  } else if (tool === "list_projects") {
    result = {
      projects: [
        {
          id: config.projectId,
          name: config.projectName,
          canEdit: config.canEdit,
        },
        ...(config.additionalProjects || []),
      ],
    };
  } else if (tool === "open_design") {
    if (input.projectId !== state.projectId) {
      if (config.canEdit) {
        state.saves++;
      }
      state.projectId = input.projectId;
    }
    result = { ready: true, projectId: state.projectId };
  } else if (tool === "execute") {
    result = execute(input.name, input.input || {});
  } else {
    throw new Error("Unavailable tool: " + tool);
  }
  trace.ok = true;
  trace.result = result;
  fs.writeFileSync(run + "/model-state.json", JSON.stringify(state, null, 2));
  console.log(JSON.stringify(result, null, 2));
} catch (e) {
  trace.ok = false;
  trace.error = e.message;
  console.log(JSON.stringify({ isError: true, error: e.message }));
  // Public MCP errors may be returned over a successful transport.
  process.exitCode = config.validationProjectSwitch ? 0 : 1;
} finally {
  fs.appendFileSync(run + "/calls.jsonl", JSON.stringify(trace) + "\n");
}
