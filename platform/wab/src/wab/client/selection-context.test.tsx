import { TEST_GLOBAL_VARIANT } from "@/wab/__testonly__/tpls";
import { selectionPath } from "@/wab/client/selection-context";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkVariant, mkVariantSetting } from "@/wab/shared/Variants";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { customCode } from "@/wab/shared/core/exprs";
import { mkParam } from "@/wab/shared/core/lang";
import { SlotSelection } from "@/wab/shared/core/slots";
import { mkTplComponent, mkTplTagX } from "@/wab/shared/core/tpls";
import { Rep, Var } from "@/wab/shared/model/classes";
import { typeFactory } from "@/wab/shared/model/model-util";
import { expect, it } from "vitest";

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
  } as unknown as ViewCtx;
  return { component, tpl, viewCtx };
}
it("represents component identity and effective repetition independently", () => {
  const { tpl, viewCtx } = fixture();
  expect(selectionPath(viewCtx, tpl)[0]).toMatchObject({
    scope: "component-instance",
    repeated: true,
  });
  tpl.vsettings[0].dataRep = null;
  expect(selectionPath(viewCtx, tpl)[0].repeated).toBe(false);
});
it("keeps the Slot identity, path and sharing context when selecting the slot itself", () => {
  const { component, tpl, viewCtx } = fixture();
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
