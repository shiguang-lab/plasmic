import { ensureOk } from "@/wab/commons/neverthrow-utils";
import { mkCodeComponent, propMetasToComponentParams } from "@/wab/shared/code-components/code-components";
import { codegen } from "@/wab/shared/codegen/__testonly__/codegen-tests-util";
import { ensure } from "@/wab/shared/common";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { codeLit, customCode } from "@/wab/shared/core/exprs";
import { mkParam } from "@/wab/shared/core/lang";
import { createSite, writeable } from "@/wab/shared/core/sites";
import { ensureCorrectImplicitStates, mkNamedState } from "@/wab/shared/core/states";
import { mkTplComponentX } from "@/wab/shared/core/tpls";
import { ensureKnownStateParam, ensureKnownPropParam } from "@/wab/shared/model/classes";
import { typeFactory } from "@/wab/shared/model/model-util";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import fs from "fs";
import path from "path";
import tmp from "tmp";

it("generated native controlled props follow bindings while unbound states remain interactive", async () => {
  const site = createSite();
  const meta = {
    name: "NativeTabs", importPath: "./NativeTabs", importName: "NativeTabs",
    props: { activeKey: "string", defaultActiveKey: "string", onChange: { type: "eventHandler", argTypes: [{ name: "key", type: "string" }] } },
    states: { activeKey: { type: "writable", valueProp: "activeKey", onChangeProp: "onChange", variableType: "text" } },
  };
  const tabs = mkCodeComponent(meta.name, meta as any, {});
  tabs.params.push(...ensureOk(propMetasToComponentParams(meta.props as any, site, meta.name, meta as any)));
  tabs.states.push(mkNamedState({
    name: "activeKey", accessType: "writable", variableType: "text",
    param: ensureKnownStateParam(ensure(tabs.params.find((p) => p.variable.name === "activeKey"), "Missing value")),
    onChangeParam: ensureKnownPropParam(ensure(tabs.params.find((p) => p.variable.name === "onChange"), "Missing event")),
  }));
  writeable(tabs.states[0].param).state = tabs.states[0];
  site.components.push(tabs);
  for (const controlled of [true, false]) {
    const page = mkComponent({
      name: controlled ? "Controlled" : "Uncontrolled", type: ComponentType.Plain,
      params: [mkParam({ name: "current", paramType: "prop", type: typeFactory.text() }), mkParam({ name: "onSwitch", paramType: "prop", type: typeFactory.any() })],
      tplTree: (baseVariant) => mkTplComponentX({
        component: tabs, name: "Tabs", baseVariant,
        args: { defaultActiveKey: controlled ? codeLit("second") : customCode("$props.current"), ...(controlled ? { activeKey: customCode("$props.current"), onChange: customCode("$props.onSwitch") } : {}) },
      }),
    });
    site.components.push(page);
    ensureCorrectImplicitStates(site, page, page.tplTree as any);
  }
  const dir = tmp.dirSync({ unsafeCleanup: true });
  try {
    // This probe has native controlled/uncontrolled behavior; the actual Antd
    // wrapper is covered in antd6's runtime tests.
    fs.writeFileSync(path.join(dir.name, "NativeTabs.tsx"), `import React from "react";
export function NativeTabs(props: { activeKey?: string; defaultActiveKey?: string; onChange?: (key: string) => void; className?: string }) {
  const [key, setKey] = React.useState(props.defaultActiveKey);
  return <button data-controlled={props.activeKey !== undefined ? "yes" : "no"} onClick={() => { setKey("first"); props.onChange?.("first"); }}>{props.activeKey === undefined ? key : props.activeKey}</button>;
}`);
    const { importFromProject } = await codegen(dir.name, site);
    const Controlled = (await importFromProject("Controlled.js")).default;
    const Uncontrolled = (await importFromProject("Uncontrolled.js")).default;
    const onSwitch = vi.fn();
    const view = render(<Controlled current="second" onSwitch={onSwitch} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onSwitch).toHaveBeenCalledWith("first");
    expect(screen.getByRole("button").textContent).toBe("second");
    view.rerender(<Controlled current="first" onSwitch={onSwitch} />);
    expect(screen.getByRole("button").textContent).toBe("first");
    view.unmount();
    const undefinedBinding = render(<Controlled onSwitch={onSwitch} />);
    expect(screen.getByRole("button").textContent).toBe("second");
    expect(screen.getByRole("button").getAttribute("data-controlled")).toBe("no");
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button").getAttribute("data-controlled")).toBe("yes");
    expect(screen.getByRole("button").textContent).toBe("first");
    undefinedBinding.unmount();
    const uncontrolled = render(<Uncontrolled current="second" />);
    expect(screen.getByRole("button").textContent).toBe("second");
    expect(screen.getByRole("button").getAttribute("data-controlled")).toBe("no");
    uncontrolled.rerender(<Uncontrolled current="first" />);
    expect(screen.getByRole("button").textContent).toBe("second");
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button").textContent).toBe("first");
    expect(screen.getByRole("button").getAttribute("data-controlled")).toBe("yes");
  } finally {
    dir.removeCallback();
  }
}, 60000);
