import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { COPILOT_TOOLS } from "@/wab/client/copilot";
import { createSite } from "@/wab/shared/core/sites";
import { flattenTpls } from "@/wab/shared/core/tpls";
import { mkCodeComponent, propMetasToComponentParams } from "@/wab/shared/code-components/code-components";
import { ensure } from "@/wab/shared/common";
import { asCode } from "@/wab/shared/core/exprs";
import { initBuiltinActions } from "@/wab/shared/core/states";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { isKnownEventHandler, isKnownTplComponent } from "@/wab/shared/model/classes";
import { getExternalParams } from "@/wab/shared/codegen/react-p/params";
import type { SerializerBaseContext } from "@/wab/shared/codegen/react-p/types";

// Read the shipped registration, including the entry point used by canvas hosts.
const require = createRequire(import.meta.url);
const { registerTable } = require("../../../../../../plasmicpkgs/antd6/skinny/registerTable.cjs.js");

test("MCP reads Table expansion signatures and creates executable top-level interactions", async () => {
  initBuiltinActions({ projectId: "expansion-test", platform: "react", projectFlags: DEVFLAGS, inStudio: false });
  const registrations: any[] = [];
  registerTable({ registerComponent: (component: any, meta: any) => registrations.push({ component, meta }) });
  const site = createSite();
  const definitions = registrations.map(({ meta }) => mkCodeComponent(meta.name, meta, {}));
  site.components.push(...definitions);
  for (const [i, { meta }] of registrations.entries()) {
    definitions[i].params.push(...propMetasToComponentParams(meta.props, site, meta.name, meta)._unsafeUnwrap());
  }
  const definition = ensure(definitions.find((c) => c.name === "plasmic-antd6-table"), "Missing Table");
  const { studioCtx } = fakeStudioCtx({ site });
  (studioCtx as any).hostLessPkgsFrame.contentWindow.__PlasmicComponentRegistry = registrations;
  (studioCtx as any).hostLessRegistry.clear();
  const call = async (name: string, input: any) => JSON.parse(await ensure(COPILOT_TOOLS[name], "Missing tool").execute(studioCtx, input));
  const contract = (await call("read", { componentUuids: [definition.uuid], view: "contract" })).results[0];
  const props = new Map<string, any>(contract.props.map((p: any) => [p.name, p]));
  expect(props.get("onExpand").args).toEqual([{ name: "expanded", type: "boolean" }, { name: "row", type: "any" }]);
  expect(props.get("onExpand").registration.args).toEqual([{ name: "expanded", type: "boolean" }, { name: "row", type: "object" }]);
  expect(props.get("onExpandedRowsChange").args).toEqual([{ name: "expandedKeys", type: "any" }]);
  expect(props.get("onExpandedRowsChange").registration.args).toEqual([{ name: "expandedKeys", type: "object" }]);
  expect(props.get("expandedRowRender").args.map((a: any) => a.name)).toEqual(["row", "index", "indent", "expanded"]);
  expect(props.get("expandable").registration.fields).not.toHaveProperty("onExpandedRowsChange");
  expect(props.get("canvasExpandedRowKeys").registration).toMatchObject({
    type: "choice", multiSelect: true, editOnly: true, optionsDynamic: true,
  });
  const canvasParam = ensure(definition.params.find(p => p.variable.name === "canvasExpandedRowKeys"), "Missing canvas preview prop");
  expect(canvasParam.exportType).toBe("ToolsOnly");
  const exported = getExternalParams({ component: definition, exportOpts: {}, projectFlags: DEVFLAGS } as SerializerBaseContext);
  expect(exported.map(p => p.variable.name)).not.toContain("canvasExpandedRowKeys");
  expect(exported.map(p => p.variable.name)).toContain("expandable");
  const created = await call("createComponent", { name: "Expansion", type: "page", path: "/expansion" });
  const page = ensure(site.components.find((c) => c.uuid === created.created[0].uuid), "Missing Page");
  await call("insertHtml", { componentUuid: page.uuid, html: `<plasmic-component data-plasmic-component="plasmic-antd6-table" data-plasmic-name="Records" data-props='{"data":{"data":[]},"pagination":false,"canvasExpandedRowKeys":["alpha","beta"]}'></plasmic-component>` });
  const instance = ensure(flattenTpls(page.tplTree).find(isKnownTplComponent), "Missing Table instance");
  const readback = await call("read", { elements: [{ componentUuid: page.uuid, elementUuid: instance.uuid }], view: "properties", propNames: ["canvasExpandedRowKeys"] });
  expect(readback.results[0].properties.canvasExpandedRowKeys).toEqual(["alpha", "beta"]);
  for (const [eventName, code, values] of [
    ["onExpand", "capture(expanded, row)", [true, { id: "a" }]],
    ["onExpandedRowsChange", "$state.expandedKeys = expandedKeys", [["a"]]],
  ] as const) {
    await call("createInteraction", { componentUuid: page.uuid, elementUuid: instance.uuid, eventName, name: "SyncExpansion", action: { actionName: "customFunction", code } });
    const handler = ensure(instance.vsettings[0].args.find((arg) => arg.param.variable.name === eventName), "Missing event").expr;
    expect(isKnownEventHandler(handler)).toBe(true);
    const capture = vi.fn();
    const state = { expandedKeys: [] };
    const callback = runInNewContext(`(${asCode(handler, { component: page, inStudio: false, projectFlags: DEVFLAGS }).code})`, { capture, $state: state });
    await callback(...values);
    if (eventName === "onExpand") expect(capture).toHaveBeenCalledWith(...values);
    else expect(state.expandedKeys).toEqual(["a"]);
  }
});
