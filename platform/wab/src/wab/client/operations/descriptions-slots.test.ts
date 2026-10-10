import { setupComponentWithTplTree } from "@/wab/client/operations/__testonly__/utils";
import {
  canInsertTplAsChild,
  insertTplAsChild,
  insertTplAt,
  pasteTpls,
} from "@/wab/client/operations/insert-tpl";
import { unwrap } from "@/wab/commons/neverthrow-utils";
import { $$$ } from "@/wab/shared/TplQuery";
import { getBaseVariant } from "@/wab/shared/Variants";
import {
  CodeComponentsRegistry,
  attachRenderableTplSlots,
  componentMetaToComponentParams,
  mkCodeComponent,
} from "@/wab/shared/code-components/code-components";
import { ensure } from "@/wab/shared/common";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { SlotSelection } from "@/wab/shared/core/slots";
import * as Tpls from "@/wab/shared/core/tpls";
import { CodeComponentMeta } from "@plasmicapp/host/registerComponent";
import { registerAdditional } from "../../../../../../plasmicpkgs/antd6/src/registerAdditional";
import type { Registerable } from "../../../../../../plasmicpkgs/antd6/src/utils";

function setupDescriptions() {
  const root = Tpls.mkTplTagX("div", {});
  const { component, site, tplMgr, vtm } = setupComponentWithTplTree(root);
  const metas = new Map<string, CodeComponentMeta<any>>();
  registerAdditional({
    registerComponent: (_implementation, meta) => {
      metas.set(meta.name, meta);
    },
    registerGlobalContext: () => {},
    registerToken: () => {},
  } satisfies Registerable);
  const registered = ["descriptions-item", "descriptions", "empty"].map(
    (name) => {
      const meta = ensure(
        metas.get(`plasmic-antd6-${name}`),
        "Missing registration",
      );
      const codeComponent = mkCodeComponent(meta.name, meta, {});
      tplMgr.attachComponent(codeComponent);
      return { codeComponent, meta };
    },
  );
  for (const { codeComponent, meta } of registered) {
    codeComponent.params = unwrap(componentMetaToComponentParams(site, meta));
    attachRenderableTplSlots(codeComponent);
  }
  const [item, descriptions, other] = registered.map(
    ({ codeComponent }) => codeComponent,
  );
  const baseVariant = getBaseVariant(component);
  const parent = Tpls.mkTplComponent(descriptions, baseVariant);
  $$$(root).append(parent);
  const makeItem = () => Tpls.mkTplComponent(item, baseVariant);
  const slot = (name: string) =>
    new SlotSelection({
      tpl: parent,
      slotParam: ensure(
        descriptions.params.find((p) => p.variable.name === name),
        "Missing slot",
      ),
    });
  return {
    component,
    site,
    root,
    parent,
    makeItem,
    slot,
    item,
    other,
    baseVariant,
    ctx: { tplMgr, vtm },
  };
}

test("Descriptions accepts Items through its children slot and sibling insertion", () => {
  const { parent, makeItem, slot, ctx } = setupDescriptions();
  const first = makeItem();
  expect(insertTplAsChild(first, parent, ctx).isOk()).toBe(true);
  expect(insertTplAsChild(makeItem(), slot("children"), ctx).isOk()).toBe(true);
  expect(insertTplAt(makeItem(), first, "before", ctx).isOk()).toBe(true);
  expect(insertTplAt(makeItem(), first, "after", ctx).isOk()).toBe(true);
});

test("Descriptions rejects text, containers, other components and Item wrappers without modifying the tree", () => {
  const {
    component,
    site,
    root,
    parent,
    makeItem,
    slot,
    item,
    other,
    baseVariant,
    ctx,
  } = setupDescriptions();
  const first = makeItem();
  expect(insertTplAsChild(first, parent, ctx).isOk()).toBe(true);
  const wrapper = mkComponent({
    name: "WrappedDescription",
    type: ComponentType.Plain,
    tplTree: (base) => Tpls.mkTplComponent(item, base),
  });
  ctx.tplMgr.attachComponent(wrapper);
  const invalid = [
    Tpls.mkTplTagX("span", { type: Tpls.TplTagType.Text }),
    Tpls.mkTplTagX("div", {}),
    Tpls.mkTplTagX("button", {}),
    Tpls.mkTplComponent(other, baseVariant),
    Tpls.mkTplComponent(wrapper, baseVariant),
  ];
  for (const child of invalid) {
    $$$(root).append(child);
    const originalChildren = [...root.children];
    for (const target of [parent, slot("children")]) {
      expect(canInsertTplAsChild(child, target, ctx)).toMatchObject({
        type: "ViolatesSlotType",
      });
      expect(insertTplAsChild(child, target, ctx).isErr()).toBe(true);
    }
    for (const location of ["before", "after"] as const) {
      expect(insertTplAt(child, first, location, ctx).isErr()).toBe(true);
    }
    const paste = pasteTpls([child], parent, "append", {
      ...ctx,
      component,
      site,
      ccRegistry: new CodeComponentsRegistry(window, {}),
    });
    expect(paste.pasted).toEqual([]);
    expect(paste.errors).toMatchObject([{ type: "ViolatesSlotType" }]);
    expect(root.children).toEqual(originalChildren);
    expect(child.parent).toBe(root);
  }
});

test("Descriptions title and Item label/content remain unrestricted slots", () => {
  const { parent, makeItem, slot, item, other, baseVariant, ctx } =
    setupDescriptions();
  const field = makeItem();
  expect(insertTplAsChild(field, parent, ctx).isOk()).toBe(true);
  const targets = [
    slot("title"),
    ...["label", "children"].map(
      (name) =>
        new SlotSelection({
          tpl: field,
          slotParam: ensure(
            item.params.find((p) => p.variable.name === name),
            "Missing Item slot",
          ),
        }),
    ),
  ];
  for (const target of targets) {
    expect(
      insertTplAsChild(
        Tpls.mkTplTagX("span", { type: Tpls.TplTagType.Text }),
        target,
        ctx,
      ).isOk(),
    ).toBe(true);
    expect(insertTplAsChild(Tpls.mkTplTagX("a", {}), target, ctx).isOk()).toBe(
      true,
    );
    expect(
      insertTplAsChild(Tpls.mkTplTagX("div", {}), target, ctx).isOk(),
    ).toBe(true);
    expect(
      insertTplAsChild(
        Tpls.mkTplComponent(other, baseVariant),
        target,
        ctx,
      ).isOk(),
    ).toBe(true);
  }
});
