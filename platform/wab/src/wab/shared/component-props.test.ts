import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { getBaseVariant } from "@/wab/shared/Variants";
import { mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { inferPropTypeFromParam } from "@/wab/shared/component-props";
import { mkParam } from "@/wab/shared/core/lang";
import { mkTplComponentX } from "@/wab/shared/core/tpls";
import { typeFactory } from "@/wab/shared/model/model-util";
import { expect, it } from "vitest";

it("infers native icon slots and preserves their registered editor metadata", () => {
  const component = mkCodeComponent(
    "plasmic-antd6-button",
    {
      name: "plasmic-antd6-button",
      importPath: "@shiguang-lab/plasmic-antd6",
      props: {},
    },
    {},
  );
  const param = mkParam({
    name: "icon",
    paramType: "slot",
    type: typeFactory.renderable(),
  });
  component.params.push(param);
  const tpl = mkTplComponentX({
    component,
    baseVariant: getBaseVariant(component),
  });
  const studioCtx = {} as StudioCtx;
  const registeredSlot = { type: "slot" as const, hidePlaceholder: true };
  const viewCtx = {
    getCodeComponentMeta: () => ({ props: { icon: registeredSlot } }),
  } as unknown as ViewCtx;
  expect(inferPropTypeFromParam(studioCtx, viewCtx, tpl, param)).toBe(
    registeredSlot,
  );
  expect(inferPropTypeFromParam(studioCtx, undefined, tpl, param)).toEqual({
    type: "slot",
  });
});
