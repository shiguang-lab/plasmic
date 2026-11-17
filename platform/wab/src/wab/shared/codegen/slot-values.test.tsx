import { ensureOk } from "@/wab/commons/neverthrow-utils";
import { buildPreviewModules } from "@/wab/client/components/live/preview-codegen";
import { ProjectId } from "@/wab/shared/ApiSchema";
import { mkCodeComponent, propMetasToComponentParams } from "@/wab/shared/code-components/code-components";
import { codegen } from "@/wab/shared/codegen/__testonly__/codegen-tests-util";
import { jsLiteral } from "@/wab/shared/codegen/util";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { codeLit, customCode } from "@/wab/shared/core/exprs";
import { mkParam } from "@/wab/shared/core/lang";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplComponentX, mkTplTagX } from "@/wab/shared/core/tpls";
import { typeFactory } from "@/wab/shared/model/model-util";
import { render, screen } from "@testing-library/react";
import fs from "fs";
import path from "path";
import React from "react";
import tmp from "tmp";

it("preserves literal children and bound named slots in Preview and exported runtime", async () => {
  const site = createSite();
  const meta = {
    name: "SlotControl", importPath: "./SlotControl", importName: "SlotControl",
    props: { children: { type: "slot" }, label: { type: "slot" }, helperText: { type: "slot" } },
  };
  const control = mkCodeComponent(meta.name, meta as any, {});
  control.params.push(...ensureOk(propMetasToComponentParams(meta.props as any, site, meta.name, meta as any)));
  const page = mkComponent({
    name: "SlotPage", type: ComponentType.Plain,
    params: [mkParam({ name: "empty", paramType: "prop", type: typeFactory.bool() })],
    tplTree: (baseVariant) => mkTplTagX("div", { baseVariant, attrs: {} }, [
      mkTplComponentX({ component: control, baseVariant, args: {
        children: codeLit("保存"), label: codeLit("昵称"),
        helperText: customCode("$props.empty ? '请输入昵称' : ''"),
      } }),
    ]),
  });
  site.components.push(control, page);
  const dir = tmp.dirSync({ unsafeCleanup: true });
  try {
    fs.writeFileSync(path.join(dir.name, "SlotControl.tsx"), `import React from "react";
export function SlotControl({children, label, helperText}: {children?: React.ReactNode; label?: React.ReactNode; helperText?: React.ReactNode}) {
  return <><label>{label}</label><button>{children}</button><p>{helperText}</p></>;
}`);
    const { importFromProject } = await codegen(dir.name, site);
    const preview = buildPreviewModules({ site, siteInfo: { id: "slot-test" as ProjectId, name: "Slot test", appAuthProvider: undefined } }, page);
    expect(preview.rootOutput?.renderModule).toContain(`children={${jsLiteral("保存")}}`);
    expect(preview.rootOutput?.renderModule).toContain("请输入昵称");
    const Page = (await importFromProject("SlotPage.js")).default;
    const view = render(<Page empty={false} />);
    expect(screen.getByRole("button", { name: "保存" })).toBeTruthy();
    expect(screen.getByText("昵称")).toBeTruthy();
    expect(screen.queryByText("请输入昵称")).toBeNull();
    view.rerender(<Page empty />);
    expect(screen.getByText("请输入昵称")).toBeTruthy();
  } finally {
    dir.removeCallback();
  }
}, 60000);
