import { TEST_GLOBAL_VARIANT } from "@/wab/__testonly__/tpls";
import { SelectionPath } from "@/wab/client/components/sidebar-tabs/SelectionPath";
import { selectionPath } from "@/wab/client/selection-context";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkVariant, mkVariantSetting } from "@/wab/shared/Variants";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { customCode } from "@/wab/shared/core/exprs";
import { mkParam } from "@/wab/shared/core/lang";
import { SlotSelection } from "@/wab/shared/core/slots";
import { mkTplComponent, mkTplTagX } from "@/wab/shared/core/tpls";
import { Rep, TplNode, Var } from "@/wab/shared/model/classes";
import { typeFactory } from "@/wab/shared/model/model-util";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { expect, it, vi } from "vitest";

function fixture() {
  const component = mkComponent({
    name: "Card list",
    tplTree: mkTplTagX("div", {}),
    type: ComponentType.Plain,
  });
  const tpl = mkTplComponent(component, TEST_GLOBAL_VARIANT, []);
  tpl.vsettings[0].dataRep = new Rep({
    element: new Var({ name: "item", uuid: "item" }),
    index: null,
    collection: customCode("[1,2]"),
  });
  const focus = vi.fn();
  const viewCtx = {
    effectiveCurrentVariantSetting: (node: typeof tpl) => node.vsettings[0],
    getTplCodeComponentMeta: () => ({
      props: {
        render: {
          type: "slot",
          displayName: "共享内容",
          renderPropParams: ["row"],
        },
      },
    }),
    focusedSelectable: () => null,
    currentComponent: () => component,
    change: (fn: () => void) => fn(),
    focusedCloneKey: () => undefined,
    setStudioFocusByTpl: focus,
    setStudioFocusBySelectable: focus,
  } as unknown as ViewCtx;
  return { component, tpl, viewCtx, focus };
}
it("represents component identity and effective repetition independently", () => {
  const { tpl, viewCtx } = fixture();
  expect(selectionPath(viewCtx, tpl)[0]).toMatchObject({
    scope: "component-instance",
    repeated: true,
  });
  const view = render(<SelectionPath tpl={tpl} viewCtx={viewCtx} />);
  expect(screen.getByText(/修改会作用于所有实例/)).toBeTruthy();
  view.unmount();
  tpl.vsettings[0].dataRep = null;
  expect(selectionPath(viewCtx, tpl)[0].repeated).toBe(false);
});
it("keeps the Slot identity, path and sharing context when selecting the slot itself", () => {
  const { component, tpl, viewCtx, focus } = fixture();
  // A regular component slot shares the parent's repetition scope.
  const param = mkParam({
    name: "render",
    type: typeFactory.renderable(),
    paramType: "slot",
  });
  component.params.push(param);
  const slot = new SlotSelection({ tpl, slotParam: param });
  const path = selectionPath(viewCtx, slot);
  expect(path.at(-1)).toMatchObject({
    scope: "slot",
    slotName: "render",
    elementUuid: tpl.uuid,
  });
  render(<SelectionPath tpl={slot} viewCtx={viewCtx} />);
  expect(screen.getByText(/修改会作用于所有实例/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "选择 render" }));
  expect(focus).toHaveBeenCalledWith(slot);
});

it("does not report repetition that only exists in an inactive variant", () => {
  const { tpl, viewCtx } = fixture();
  const inactive = mkVariantSetting({
    variants: [mkVariant({ name: "Other variant" })],
  });
  inactive.dataRep = tpl.vsettings[0].dataRep;
  tpl.vsettings[0].dataRep = null;
  tpl.vsettings.push(inactive);
  expect(selectionPath(viewCtx, tpl)[0].repeated).toBe(false);
});

it("collapses middle ancestors while keeping the complete path selectable", () => {
  const { tpl, viewCtx, focus } = fixture();
  let root: TplNode = tpl;
  for (let i = 0; i < 5; i++) {
    root = mkTplTagX(
      "div",
      { variants: [mkVariantSetting({ variants: [TEST_GLOBAL_VARIANT] })] },
      [root],
    );
    root.name = `Ancestor ${i}`;
  }
  render(<SelectionPath tpl={tpl} viewCtx={viewCtx} />);
  const details = screen.getByLabelText("展开完整编辑路径").parentElement;
  expect(details?.hasAttribute("open")).toBe(false);
  fireEvent.click(screen.getByLabelText("展开完整编辑路径"));
  expect(details?.hasAttribute("open")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "选择 Ancestor 2" }));
  expect(focus).toHaveBeenCalled();
});
