import { AddItem, AddItemType } from "@/wab/client/definitions/insertables";
import { getSuperComponents, isCodeComponent } from "@/wab/shared/core/components";
import { groupBy } from "lodash";

/** Keep unconfigured packages flat and subcomponents in their parent's section. */
export function groupInstalledItems(items: AddItem[]) {
  const sections = groupBy(items, (item) => {
    if (item.type !== AddItemType.tpl || !item.component) {
      return "";
    }
    const component =
      getSuperComponents(item.component).slice(-1)[0] ?? item.component;
    return isCodeComponent(component) ? component.codeComponentMeta.section ?? "" : "";
  });
  return items.length === 0
    ? [{ label: "", items }]
    : Object.entries(sections).map(([label, sectionItems]) => ({ label, items: sectionItems }));
}
