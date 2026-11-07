import { ensureOk } from "@/wab/commons/neverthrow-utils";
import { buildPreviewModules } from "@/wab/client/components/live/preview-codegen";
import { ProjectId } from "@/wab/shared/ApiSchema";
import { mkCodeComponent, propMetasToComponentParams } from "@/wab/shared/code-components/code-components";
import { codegen } from "@/wab/shared/codegen/__testonly__/codegen-tests-util";
import { shouldSerializeState } from "@/wab/shared/codegen/react-p/states";
import { ensure } from "@/wab/shared/common";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { codeLit, customCode } from "@/wab/shared/core/exprs";
import { ParamExportType, mkParam } from "@/wab/shared/core/lang";
import { createSite, writeable } from "@/wab/shared/core/sites";
import { ensureCorrectImplicitStates, getStateVarName, mkNamedState } from "@/wab/shared/core/states";
import { flattenTpls, isTplComponent, mkTplComponentX, mkTplTagX } from "@/wab/shared/core/tpls";
import { RenderExpr, ensureKnownPropParam, ensureKnownStateParam } from "@/wab/shared/model/classes";
import { typeFactory } from "@/wab/shared/model/model-util";
import { fireEvent, render, screen } from "@testing-library/react";
import fs from "fs";
import path from "path";
import React from "react";
import tmp from "tmp";

it("generated render-slot instances keep unbound native hover state independent", async () => {
  const site = createSite();
  const hoverMeta = {
    name: "NativeHover", importPath: "./NativeRows", importName: "NativeHover",
    props: { internalReveal: { type: "boolean", editOnly: true }, open: "boolean", defaultOpen: "boolean", label: "string", onOpenChange: { type: "eventHandler", argTypes: [{ name: "open", type: "boolean" }] } },
    states: { open: { type: "writable", valueProp: "open", initialValueProp: "defaultOpen", onChangeProp: "onOpenChange", variableType: "boolean" } },
  };
  const hover = mkCodeComponent(hoverMeta.name, hoverMeta as any, {});
  hover.params.push(...ensureOk(propMetasToComponentParams(hoverMeta.props as any, site, hoverMeta.name, hoverMeta as any)));
  expect(hover.params.find((param) => param.variable.name === "internalReveal")?.exportType).toBe(ParamExportType.ToolsOnly);
  const state = mkNamedState({
    name: "open", accessType: "writable", variableType: "boolean",
    param: ensureKnownStateParam(ensure(hover.params.find((p) => p.variable.name === "open"), "Missing open prop")),
    onChangeParam: ensureKnownPropParam(ensure(hover.params.find((p) => p.variable.name === "onOpenChange"), "Missing open event")),
  });
  hover.states.push(state);
  writeable(state.param).state = state;
  const rowsMeta = { name: "NativeRows", importPath: "./NativeRows", importName: "NativeRows", props: { render: { type: "slot", renderPropParams: ["row", "index"] } } };
  const rows = mkCodeComponent(rowsMeta.name, rowsMeta as any, {});
  rows.params.push(...ensureOk(propMetasToComponentParams(rowsMeta.props as any, site, rowsMeta.name, rowsMeta as any)));
  site.components.push(hover, rows);
  const page = mkComponent({
    name: "RowsPage", type: ComponentType.Plain,
    params: [mkParam({ name: "open", paramType: "prop", type: typeFactory.bool() }), mkParam({ name: "onOpenChange", paramType: "prop", type: typeFactory.any() })],
    tplTree: (baseVariant) => mkTplTagX("div", { baseVariant, attrs: {} }, [
      mkTplComponentX({ component: rows, name: "Rows", baseVariant, args: {
        render: new RenderExpr({ tpl: [mkTplComponentX({ component: hover, name: "Hint", baseVariant, args: {
          internalReveal: codeLit(true), label: customCode("row"), open: customCode("$props.open"), onOpenChange: customCode("$props.onOpenChange"),
        } })] }),
      } }),
    ]),
  });
  site.components.push(page);
  flattenTpls(page.tplTree).filter(isTplComponent).forEach((tpl) => ensureCorrectImplicitStates(site, page, tpl));
  const hintState = ensure(page.states.find((item) => item.tplNode?.name === "Hint"), "Missing implicit hover state");
  expect(shouldSerializeState(page, hintState)).toBe(false);
  // References to this state, its parent object, and dynamic state access must
  // keep the writable contract. Unrelated page state must not couple rows.
  const consumer = mkParam({ name: "consumer", paramType: "prop", type: typeFactory.any() });
  page.params.push(consumer);
  for (const reference of ["$state.hint.open", "$state.hint", "$state[$props.name]"]) {
    consumer.defaultExpr = customCode(reference);
    expect(shouldSerializeState(page, hintState)).toBe(true);
  }
  consumer.defaultExpr = customCode("$state.currentRecord");
  expect(shouldSerializeState(page, hintState)).toBe(false);
  consumer.defaultExpr = null;
  const dir = tmp.dirSync({ unsafeCleanup: true });
  try {
    fs.writeFileSync(path.join(dir.name, "NativeHover.tsx"), 'export { NativeHover } from "./NativeRows";');
    // Match native controlled/uncontrolled hover behavior without popup layout.
    fs.writeFileSync(path.join(dir.name, "NativeRows.tsx"), `import React from "react";
export function NativeRows({render}: {render: (row: string, index: number) => React.ReactNode}) {
  return <>{["First", "Second", "Third"].map((row, index) => <React.Fragment key={row}>{render(row, index)}</React.Fragment>)}</>;
}
export function NativeHover(props: {open?: boolean; defaultOpen?: boolean; label: string; onOpenChange?: (open: boolean) => void}) {
  const [localOpen, setOpen] = React.useState(props.defaultOpen ?? false);
  const change = (next: boolean) => { setOpen(next); props.onOpenChange?.(next); };
  return <button aria-expanded={props.open ?? localOpen} onMouseEnter={() => change(true)} onMouseLeave={() => change(false)}>{props.label}</button>;
}`);
    const { importFromProject, readFromProject } = await codegen(dir.name, site);
    const preview = buildPreviewModules({ site, siteInfo: { id: "hover-test" as ProjectId, name: "Hover test", appAuthProvider: undefined } }, page);
    expect(preview.rootOutput?.renderModule).not.toContain(`path: "${getStateVarName(hintState)}"`);
    expect(preview.rootOutput?.renderModule).not.toContain("internalReveal");
    expect(readFromProject("PlasmicRowsPage.tsx")).not.toContain("internalReveal");
    expect(flattenTpls(page.tplTree).filter(isTplComponent).some((tpl) => tpl.vsettings.some((vs) => vs.args.some((arg) => arg.param.variable.name === "internalReveal")))).toBe(true);
    expect(page.states).toContain(hintState);
    const Page = (await importFromProject("RowsPage.js")).default;
    const onOpenChange = vi.fn();
    const view = render(<Page onOpenChange={onOpenChange} />);
    const buttons = screen.getAllByRole("button");
    const openLabels = () => buttons.filter((button) => button.getAttribute("aria-expanded") === "true").map((button) => button.textContent);
    for (const target of [buttons[0], buttons[1], buttons[0]]) {
      fireEvent.mouseEnter(target);
      expect(openLabels()).toEqual([target.textContent]);
      fireEvent.mouseLeave(target);
      expect(openLabels()).toEqual([]);
    }
    expect(onOpenChange.mock.calls).toEqual([[true], [false], [true], [false], [true], [false]]);
    view.rerender(<Page open={true} onOpenChange={onOpenChange} />);
    fireEvent.mouseLeave(buttons[0]);
    expect(openLabels()).toEqual(["First", "Second", "Third"]);
    view.rerender(<Page open={false} onOpenChange={onOpenChange} />);
    expect(openLabels()).toEqual([]);
  } finally {
    dir.removeCallback();
  }
}, 60000);
