import { AddItemKey } from "@/wab/shared/add-item-keys";
import { mkRuleSet } from "@/wab/shared/core/styles";
import { AddItemPrefs, getSimplifiedStyles } from "@/wab/shared/default-styles";
import { DEVFLAGS } from "@/wab/shared/devflags";

it("applies saved initial styles even when simplified layout is disabled, without enabling its defaults", () => {
  const previous = DEVFLAGS.simplifiedLayout;
  DEVFLAGS.simplifiedLayout = false;
  try {
    const prefs = {
      [AddItemKey.vstack]: mkRuleSet({
        values: {
          "padding-top": "12px",
          "padding-right": "12px",
          "padding-bottom": "12px",
          "padding-left": "12px",
        },
      }),
    } as AddItemPrefs;
    expect(getSimplifiedStyles(AddItemKey.vstack, prefs)).toEqual({
      paddingTop: "12px",
      paddingRight: "12px",
      paddingBottom: "12px",
      paddingLeft: "12px",
    });
    expect(getSimplifiedStyles(AddItemKey.hstack, prefs)).toEqual({});
    expect(getSimplifiedStyles(AddItemKey.vstack, undefined)).toEqual({});
  } finally {
    DEVFLAGS.simplifiedLayout = previous;
  }
});
