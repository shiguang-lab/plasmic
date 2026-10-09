import { getAddItemLabel } from "@/wab/client/components/studio/add-drawer/AddDrawerItem";
import {
  AddFakeItem,
  AddItemType,
  INSERTABLES_MAP,
} from "@/wab/client/definitions/insertables";
import { languageOptions, messages } from "@/wab/client/i18n/locales";

it("localizes all built-in insertion captions without modifying insertable metadata", () => {
  for (const item of Object.values(INSERTABLES_MAP)) {
    const originalLabel = item.label;
    expect(Object.hasOwn(messages.en, originalLabel), originalLabel).toBe(true);
    for (const { value } of languageOptions) {
      expect(getAddItemLabel(item, value)).toBeTruthy();
    }
    expect(item.label).toBe(originalLabel);
  }
});

it("preserves user-authored names even when they match a translated built-in caption", () => {
  const item: AddFakeItem = {
    type: AddItemType.fake,
    icon: null,
    factory: () => false,
    key: "component-custom",
    label: "Text",
  };
  expect(getAddItemLabel(item, "zh-CN")).toBe("Text");
  expect(getAddItemLabel(INSERTABLES_MAP.text, "zh-CN")).toBe("文本");
});
