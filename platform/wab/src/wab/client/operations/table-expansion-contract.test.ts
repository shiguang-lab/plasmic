import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { COPILOT_TOOLS } from "@/wab/client/copilot";
import { createSite, writeable } from "@/wab/shared/core/sites";
import { flattenTpls, mkSlot } from "@/wab/shared/core/tpls";
import { getSlotParams } from "@/wab/shared/SlotUtils";
import {
  mkCodeComponent,
  propMetasToComponentParams,
} from "@/wab/shared/code-components/code-components";
import { getExternalParams } from "@/wab/shared/codegen/react-p/params";
import type { SerializerBaseContext } from "@/wab/shared/codegen/react-p/types";
import { ensure } from "@/wab/shared/common";
import { asCode } from "@/wab/shared/core/exprs";
import { initBuiltinActions, mkNamedState } from "@/wab/shared/core/states";
import { DEVFLAGS } from "@/wab/shared/devflags";
import {
  ensureKnownTplTag,
  ensureKnownStateParam,
  ensureKnownPropParam,
  isKnownEventHandler,
  isKnownTplComponent,
} from "@/wab/shared/model/classes";
import { PROTOTYPE_TOOL_META } from "@/wab/shared/copilot/prototype-tools";
import { FastBundler } from "@/wab/shared/bundler";
import { unbundleSite } from "@/wab/shared/core/tagged-unbundle";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";

// Read the shipped registration, including the entry point used by canvas hosts.
const require = createRequire(import.meta.url);
const { registerTable } = require("../../../../../../plasmicpkgs/antd6/skinny/registerTable.cjs.js");
const { registerModal } = require("../../../../../../plasmicpkgs/antd6/skinny/registerModal.cjs.js");

test("MCP reads Table expansion signatures and creates executable top-level interactions", async () => {
  initBuiltinActions({
    projectId: "expansion-test",
    platform: "react",
    projectFlags: DEVFLAGS,
    inStudio: false,
  });
  const registrations: any[] = [];
  registerTable({ registerComponent: (component: any, meta: any) => registrations.push({ component, meta }) });
  registerModal({ registerComponent: (component: any, meta: any) => registrations.push({ component, meta }) });
  const site = createSite();
  const definitions = registrations.map(({ meta }) =>
    mkCodeComponent(meta.name, meta, {}),
  );
  site.components.push(...definitions);
  for (const [i, { meta }] of registrations.entries()) {
    definitions[i].params.push(...propMetasToComponentParams(meta.props, site, meta.name, meta)._unsafeUnwrap());
    for (const param of getSlotParams(definitions[i])) {
      const slot = mkSlot(param);
      slot.parent = definitions[i].tplTree;
      ensureKnownTplTag(definitions[i].tplTree).children.push(slot);
    }
    for (const [name, spec] of Object.entries<any>(meta.states ?? {})) {
      const param = ensureKnownStateParam(ensure(definitions[i].params.find(p => p.variable.name === spec.valueProp), "Missing state value prop"));
      const onChangeParam = ensureKnownPropParam(ensure(definitions[i].params.find(p => p.variable.name === spec.onChangeProp), "Missing state event"));
      const state = mkNamedState({ name, param, onChangeParam, accessType: spec.type, variableType: spec.variableType });
      writeable(param).state = state;
      definitions[i].states.push(state);
    }
  }
  const definition = ensure(
    definitions.find((c) => c.name === "plasmic-antd6-table"),
    "Missing Table",
  );
  const { studioCtx } = fakeStudioCtx({ site });
  (
    studioCtx as any
  ).hostLessPkgsFrame.contentWindow.__PlasmicComponentRegistry = registrations;
  (studioCtx as any).hostLessRegistry.clear();
  const call = async (name: string, input: any) => {
    const schema = PROTOTYPE_TOOL_META[name as keyof typeof PROTOTYPE_TOOL_META].inputSchema;
    return JSON.parse(await ensure(COPILOT_TOOLS[name], "Missing tool").execute(studioCtx,
      "reviewContext" in schema.shape ? { ...input, reviewContext: { purpose: "Edit native Table expansion and verify persistence of business props only" } } : input));
  };
  const contract = (await call("read", { componentUuids: [definition.uuid], view: "contract" })).results[0];
  const props = new Map<string, any>(contract.props.map((p: any) => [p.name, p]));
  expect(props.get("onExpand").args).toEqual([{ name: "expanded", type: "boolean" }, { name: "row", type: "any" }]);
  expect(props.get("onExpand").registration.args).toEqual([{ name: "expanded", type: "boolean" }, { name: "row", type: "object" }]);
  expect(props.get("onExpandedRowsChange").args).toEqual([{ name: "expandedKeys", type: "any" }]);
  expect(props.get("onExpandedRowsChange").registration.args).toEqual([{ name: "expandedKeys", type: "object" }]);
  expect(props.get("expandedRowRender").args.map((a: any) => a.name)).toEqual(["row", "index", "indent", "expanded"]);
  expect(props.get("expandable").registration.fields).not.toHaveProperty("onExpandedRowsChange");
  expect(props.has("canvasExpandedRowKeys")).toBe(false);
  expect(definition.params.some(p => p.variable.name === "canvasExpandedRowKeys")).toBe(false);
  const exported = getExternalParams({ component: definition, exportOpts: {}, projectFlags: DEVFLAGS } as SerializerBaseContext);
  expect(exported.map(p => p.variable.name)).not.toContain("canvasExpandedRowKeys");
  expect(exported.map(p => p.variable.name)).toContain("expandable");
  const modal = ensure(definitions.find(c => c.name === "plasmic-antd6-modal"), "Missing Modal");
  const modalContract = (await call("read", { componentUuids: [modal.uuid], view: "contract" })).results[0];
  expect(modalContract.props.map((p: any) => p.name)).toContain("open");
  expect(modalContract.props.map((p: any) => p.name)).not.toContain("previewOpen");
  expect(modalContract.props.map((p: any) => p.name)).not.toContain("__canvas");
  expect(modal.params.map(p => p.variable.name)).not.toContain("previewOpen");
  const created = await call("createComponent", { name: "Expansion", type: "page", path: "/expansion" });
  const page = ensure(site.components.find((c) => c.uuid === created.created[0].uuid), "Missing Page");
  await call("insertHtml", { componentUuid: page.uuid, html: `<plasmic-component data-plasmic-component="plasmic-antd6-table" data-plasmic-name="Records" data-props='{"data":{"data":[]},"pagination":false,"expandable":{"expandedRowKeys":[]}}'></plasmic-component>` });
  const instance = ensure(flattenTpls(page.tplTree).find(isKnownTplComponent), "Missing Table instance");
  await call("insertHtml", { componentUuid: page.uuid, html: `<plasmic-component data-plasmic-component="plasmic-antd6-modal" data-plasmic-name="Details" data-props='{"open":false}'></plasmic-component>` });
  const readback = await call("read", { elements: [{ componentUuid: page.uuid, elementUuid: instance.uuid }], view: "properties", propNames: ["canvasExpandedRowKeys"] });
  expect(readback.results[0].properties).toEqual({});
  for (const [eventName, code, values] of [
    ["onExpand", "capture(expanded, row)", [true, { id: "a" }]],
    ["onExpandedRowsChange", "$state.expandedKeys = expandedKeys", [["a"]]],
  ] as const) {
    await call("createInteraction", {
      componentUuid: page.uuid,
      elementUuid: instance.uuid,
      eventName,
      name: "SyncExpansion",
      action: { actionName: "customFunction", code },
    });
    const handler = ensure(
      instance.vsettings[0].args.find(
        (arg) => arg.param.variable.name === eventName,
      ),
      "Missing event",
    ).expr;
    expect(isKnownEventHandler(handler)).toBe(true);
    const capture = vi.fn();
    const state = { expandedKeys: [] };
    const callback = runInNewContext(
      `(${asCode(handler, { component: page, inStudio: false, projectFlags: DEVFLAGS }).code})`,
      { capture, $state: state },
    );
    await callback(...values);
    if (eventName === "onExpand") {
      expect(capture).toHaveBeenCalledWith(...values);
    } else {
      expect(state.expandedKeys).toEqual(["a"]);
    }
  }
  const saved = studioCtx.bundleSite().site;
  const reopened = unbundleSite(new FastBundler(), studioCtx.siteInfo.id, saved, []).site;
  expect(JSON.stringify(saved)).not.toContain("canvasExpandedRowKeys");
  expect(JSON.stringify(saved)).not.toContain("previewOpen");
  expect(JSON.stringify(saved)).not.toContain("__canvas");
  const reopenedPage = ensure(reopened.components.find(component => component.uuid === page.uuid), "Missing reopened page");
  expect(flattenTpls(reopenedPage.tplTree).filter(isKnownTplComponent).flatMap(tpl => tpl.vsettings.flatMap(vs => vs.args)).map(arg => arg.param.variable.name)).toEqual(expect.arrayContaining(["expandable", "onExpand", "onExpandedRowsChange", "open"]));
});
