import { AddItemType, AddTplItem } from "@/wab/client/definitions/insertables";
import { ComponentType } from "@/wab/shared/core/components";
import { Component } from "@/wab/shared/model/classes";
import { describe, expect, it } from "vitest";
import { groupInstalledItems } from "@/wab/client/components/insert-panel/groupInstalledItems";

function item(name: string, section?: string, parent?: Component): AddTplItem {
  return {
    type: AddItemType.tpl,
    key: name,
    label: name,
    icon: null,
    factory: () => undefined,
    component: {
      name,
      type: ComponentType.Code,
      codeComponentMeta: { section },
      superComp: parent ?? null,
    } as Component,
  };
}

describe("installed package sections", () => {
  it("preserves unclassified packages and empty packages", () => {
    const items = [item("A"), item("B")];
    expect(groupInstalledItems(items)).toEqual([{ label: "", items }]);
    expect(groupInstalledItems([])).toEqual([{ label: "", items: [] }]);
  });

  it("groups configured components without separating their descendants", () => {
    const parent = item("Card", "Data Display");
    const child = item("Meta", "Other", parent.component);
    const grandchild = item("Nested", undefined, child.component);
    const button = item("Button", "General");
    const uncategorized = item("Custom");
    expect(groupInstalledItems([parent, child, grandchild, button, uncategorized])).toEqual([
      { label: "Data Display", items: [parent, child, grandchild] },
      { label: "General", items: [button] },
      { label: "", items: [uncategorized] },
    ]);
  });
});
