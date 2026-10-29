import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { COPILOT_TOOLS } from "@/wab/client/copilot";
import { isPropShown } from "@/wab/client/components/sidebar-tabs/PropEditorRow";
import { ensureOk } from "@/wab/commons/neverthrow-utils";
import { FastBundler } from "@/wab/shared/bundler";
import { attachRenderableTplSlots, componentMetaToComponentParams, getNewStates, mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { codegen } from "@/wab/shared/codegen/__testonly__/codegen-tests-util";
import { ensure } from "@/wab/shared/common";
import { getRealParams, getParamDisplayName } from "@/wab/shared/core/components";
import { createSite, writeable } from "@/wab/shared/core/sites";
import { unbundleSite } from "@/wab/shared/core/tagged-unbundle";
import { flattenTpls } from "@/wab/shared/core/tpls";
import { isKnownTplComponent } from "@/wab/shared/model/classes";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { build } from "esbuild";
import fs from "fs";
import path from "path";
import React from "react";
import tmp from "tmp";

it("real Antd6 Tabs survives MCP contracts, bindings, persistence and generated button interactions", async () => {
  const dir = tmp.dirSync({ unsafeCleanup: true });
  try {
    // Antd6 and WAB have separate pnpm roots. Bundle the real library with React
    // external so this test and the generated application share one renderer.
    fs.symlinkSync(path.resolve("node_modules"), path.join(dir.name, "node_modules"));
    const libraryFile = path.join(dir.name, "VerifiedTabs.mjs");
    await build({
      entryPoints: [path.resolve("../../plasmicpkgs/antd6/skinny/registerTabs.esm.js")],
      outfile: libraryFile, bundle: true, format: "esm", platform: "browser",
      external: ["react", "react-dom", "react/jsx-runtime", "@plasmicapp/host", "@plasmicapp/host/*"],
    });
    fs.writeFileSync(path.join(dir.name, "VerifiedTabs.d.mts"), `export { AntdTabs, AntdTabItem, registerTabs } from ${JSON.stringify(path.resolve("../../plasmicpkgs/antd6/dist/registerTabs"))};`);
    const library = await import(libraryFile);
    const registrations: any[] = [];
    library.registerTabs({ registerComponent: (component: any, meta: any) => registrations.push({ component, meta }) });
    const site = createSite();
    for (const { meta } of registrations) {
      site.components.push(mkCodeComponent(meta.name, meta, {}));
      fs.writeFileSync(path.join(dir.name, `${meta.importName}.tsx`), `export { ${meta.importName} } from "./VerifiedTabs.mjs";`);
    }
    for (const { meta } of registrations) {
      const component = ensure(site.components.find((c) => c.name === meta.name), "Missing registration");
      component.params = ensureOk(componentMetaToComponentParams(site, meta));
      component.states = ensureOk(getNewStates(site, component, meta));
      component.states.forEach((state) => { writeable(state.param).state = state; });
      attachRenderableTplSlots(component as Parameters<typeof attachRenderableTplSlots>[0]);
    }
    const { studioCtx } = fakeStudioCtx({ site });
    (studioCtx as any).hostLessPkgsFrame.contentWindow.__PlasmicComponentRegistry = registrations;
    (studioCtx as any).hostLessRegistry.clear();
    const call = async (name: string, input: Record<string, unknown> = {}) =>
      JSON.parse(await ensure(COPILOT_TOOLS[name], "Missing tool").execute(studioCtx, input));
    const tabs = ensure(site.components.find((c) => c.name === "plasmic-antd6-tabs"), "Missing Tabs");
    const contract = (await call("read", { componentUuids: [tabs.uuid], view: "contract" })).results[0];
    expect(contract.props.map((p: any) => p.name)).toEqual(expect.arrayContaining(["activeKey", "defaultActiveKey", "onChange"]));
    expect(contract.states).toEqual([expect.objectContaining({ name: "activeKey", valueProp: "activeKey", onChangeProp: "onChange", accessType: "writable" })]);
    expect(getRealParams(tabs).map((p) => p.variable.name)).toEqual(expect.arrayContaining(["activeKey", "defaultActiveKey"]));
    const tabsMeta = ensure(registrations.find((r) => r.meta.name === tabs.name), "Missing live Tabs metadata").meta;
    for (const [name, label] of [["activeKey", "Active tab key"], ["defaultActiveKey", "Default active tab key"]]) {
      expect(isPropShown(tabsMeta.props[name], {})).toBe(true);
      expect(getParamDisplayName(tabs, ensure(tabs.params.find((p) => p.variable.name === name), "Missing panel prop"))).toBe(label);
    }

    for (const mode of ["Uncontrolled", "Bound", "Fixed"]) {
      const created = await call("createComponent", { name: mode, type: "page", path: `/${mode.toLowerCase()}` });
      const page = ensure(site.components.find((c) => c.uuid === created.created[0].uuid), "Missing page");
      if (mode === "Bound") await call("createState", { componentUuid: page.uuid, name: "selected", variableType: "text", initialValue: "first" });
      const props = { defaultActiveKey: "first", ...(mode === "Bound" ? { activeKey: "{{ $state.selected }}" } : mode === "Fixed" ? { activeKey: "second" } : {}) };
      await call("insertHtml", { componentUuid: page.uuid, html: `<div>
        <button data-plasmic-name="GoSecond">Go second</button>
        <plasmic-component data-plasmic-component="plasmic-antd6-tabs" data-plasmic-name="Tabs" data-props='${JSON.stringify(props)}'>
          <slot name="items">
            <plasmic-component data-plasmic-component="plasmic-antd6-tab-item" data-props='{"key":"first"}'><slot name="label">First</slot><slot name="children">First content</slot></plasmic-component>
            <plasmic-component data-plasmic-component="plasmic-antd6-tab-item" data-props='{"key":"second"}'><slot name="label">Second</slot><slot name="children">Second content</slot></plasmic-component>
          </slot>
        </plasmic-component>
      </div>` });
      const nodes = flattenTpls(page.tplTree);
      const button = ensure(nodes.find((n) => "name" in n && n.name === "GoSecond"), "Missing button");
      const instance = ensure(nodes.find((n) => isKnownTplComponent(n) && n.component === tabs), "Missing Tabs instance");
      await call("createInteraction", {
        componentUuid: page.uuid, elementUuid: button.uuid, eventName: "onClick", name: "GoSecond",
        action: { actionName: "updateVariable", variable: mode === "Bound" ? ["selected"] : ["tabs", "activeKey"], operation: "NewValue", value: '{{ "second" }}' },
      });
      if (mode === "Bound") await call("createInteraction", {
        componentUuid: page.uuid, elementUuid: instance.uuid, eventName: "onChange", name: "SelectTab",
        action: { actionName: "updateVariable", variable: ["selected"], operation: "NewValue", value: "{{ activeKey }}" },
      });
    }
    expect((await call("validate")).valid).toBe(true);
    const saved = studioCtx.bundleSite().site;
    const reopened = unbundleSite(new FastBundler(), studioCtx.siteInfo.id, saved, []).site;
    const { importFromProject } = await codegen(dir.name, reopened);
    for (const mode of ["Uncontrolled", "Bound", "Fixed"]) {
      const Page = (await importFromProject(`${mode}.js`)).default;
      const view = render(<Page />);
      expect(screen.getByRole("tab", { selected: true }).textContent).toBe(mode === "Fixed" ? "Second" : "First");
      fireEvent.click(screen.getByRole("button", { name: "Go second" }));
      expect(screen.getByRole("tab", { selected: true }).textContent).toBe("Second");
      expect(screen.getByRole("tabpanel").textContent).toBe("Second content");
      fireEvent.click(screen.getByRole("tab", { name: "First" }));
      expect(screen.getByRole("tab", { selected: true }).textContent).toBe(mode === "Fixed" ? "Second" : "First");
      view.unmount();
    }
  } finally {
    cleanup();
    dir.removeCallback();
  }
}, 60000);
