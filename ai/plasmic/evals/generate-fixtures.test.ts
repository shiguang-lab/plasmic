import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { COPILOT_TOOLS } from "@/wab/client/copilot";
import { ensure } from "@/wab/shared/common";
import { mapCopilotToolsToJsonSchema } from "@/wab/shared/copilot/copilot-tool-types";
import { PROTOTYPE_TOOL_META } from "@/wab/shared/copilot/prototype-tools";
import { createSite } from "@/wab/shared/core/sites";
import { flattenTpls } from "@/wab/shared/core/tpls";
import fs from "node:fs";

it("records model and operation fixtures for isolated skill evaluation", async () => {
  const output = ensure(
    process.env.PLASMIC_SKILL_EVAL_OUTPUT,
    "PLASMIC_SKILL_EVAL_OUTPUT is required",
  );
  const catalog = JSON.parse(
    fs.readFileSync(
      "../../ai/plasmic/references/templates/admin/catalog.json",
      "utf8",
    ),
  );
  const site = createSite();
  const { studioCtx } = fakeStudioCtx({ site });
  const call = async (name: string, input: Record<string, unknown> = {}) =>
    JSON.parse(
      await ensure(COPILOT_TOOLS[name], "Missing tool").execute(
        studioCtx,
        input,
      ),
    );
  const create = async (name: string, html: string, type = "component") => {
    const created = await call("createComponent", {
      name,
      type,
      ...(type === "page" ? { path: `/${name.toLowerCase()}` } : {}),
    });
    const componentUuid = created.results[0].uuid;
    await call("insertHtml", { componentUuid, html });
    return componentUuid;
  };
  const section = await create(
    "SearchTableSection",
    '<div data-plasmic-name="SearchTable"><div data-plasmic-name="StatusFilter">Status filter</div><div data-plasmic-name="RecordsTable">Sample record</div></div>',
  );
  const shell = await create(
    "AppShell",
    '<div data-plasmic-name="ShellContent">Shell contract fixture</div>',
  );
  const detail = await create(
    "DrawerDetailSection",
    '<div data-plasmic-name="Details" style="display:none">Closed detail: sample record, not a production API</div>',
  );
  const standard = await create(
    "StandardListPage",
    '<plasmic-component data-plasmic-component="AppShell"></plasmic-component><plasmic-component data-plasmic-component="SearchTableSection"></plasmic-component><plasmic-component data-plasmic-component="DrawerDetailSection"></plasmic-component>',
  );
  const mutating = await create(
    "AccountSettings",
    '<div data-plasmic-name="EditCard" style="padding:16px"><div data-plasmic-name="EmailInput">Email field</div></div><div data-plasmic-name="SummaryCard" style="padding:12px">Keep this</div>',
    "page",
  );
  const coding = await create(
    "Orders",
    '<h1>Orders</h1><div data-plasmic-name="OrderFilters"><div data-plasmic-name="StatusFilter">All / Pending (0) / Completed (1)</div><div data-plasmic-name="KeywordFilter">Keyword</div><button>Search</button></div><div data-plasmic-name="OrderTable">Sample orders</div>',
    "page",
  );
  const page = ensure(
    site.components.find((c) => c.uuid === mutating),
    "page",
  );
  const editCard = ensure(
    flattenTpls(page.tplTree).find((t) => t.name === "EditCard"),
    "card",
  );
  const summary = ensure(
    flattenTpls(page.tplTree).find((t) => t.name === "SummaryCard"),
    "summary",
  );
  const reads: Record<string, unknown> = {};
  for (const c of site.components) {
    reads[c.uuid] = (
      await call("read", { componentUuids: [c.uuid] })
    ).results[0];
  }
  const allSchemas = mapCopilotToolsToJsonSchema(PROTOTYPE_TOOL_META);
  const schemas = Object.fromEntries(
    [
      "identify",
      "read",
      "changeElement",
      "validate",
      "save",
      "getEditorContext",
      "restoreEditorView",
    ]
      .filter((name) => name in allSchemas)
      .map((name) => [name, allSchemas[name]]),
  );
  fs.writeFileSync(
    output + "/model-fixtures.json",
    JSON.stringify(
      {
        schemas,
        overview: await call("read"),
        reads,
        identities: {
          section,
          shell,
          detail,
          standard,
          mutating,
          coding,
          editCard: editCard.uuid,
          summary: summary.uuid,
        },
        catalogStandard: catalog.templates.find(
          (t: { componentName: string }) =>
            t.componentName === "StandardListPage",
        ),
      },
      null,
      2,
    ),
  );
  studioCtx.copilotActivity.dispose();
});
