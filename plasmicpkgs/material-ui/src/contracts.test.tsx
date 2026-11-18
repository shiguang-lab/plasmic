import { expect, it } from "vitest";
import api from "./api.json";
import { componentMeta, componentNames } from "./metadata";

it.each(componentNames)(
  "%s uses primitive controls for native scalar props",
  (name) => {
    const meta = componentMeta(name);
    for (const [key, source] of Object.entries(api[name].props)) {
      const nativeType =
        (source.type as { name: string; description?: string }).description ??
        source.type.name;
      const expected =
        nativeType === "bool"
          ? "boolean"
          : ["integer", "number"].includes(nativeType)
            ? "number"
            : undefined;
      // Native initial props are represented by the existing editOnly mapping.
      const prop =
        meta.props[key] ??
        Object.values(meta.props).find(
          (p) =>
            typeof p === "object" &&
            "uncontrolledProp" in p &&
            p.uncontrolledProp === key,
        );
      if (expected)
        expect(prop, `${name}.${key}`).toMatchObject({ type: expected });
      if (["elementType", "element type", "ref"].includes(nativeType))
        expect(prop, `${name}.${key}`).toMatchObject({ type: "exprEditor" });
    }
  },
);
it("keeps Grid.container boolean and exposes native layout/media props", () => {
  expect(componentMeta("Grid").props.container).toMatchObject({
    type: "boolean",
  });
  expect(componentMeta("Grid").props.sx).toMatchObject({ type: "object" });
  expect(componentMeta("Grid").props.component).toBe("exprEditor");
  expect(componentMeta("Grid").props.size).toMatchObject({
    type: "exprEditor",
  });
  expect(componentMeta("Stack").props.spacing).toMatchObject({
    type: "exprEditor",
  });
  expect(componentMeta("CardMedia").props.image).toMatchObject({
    type: "imageUrl",
  });
  expect(componentMeta("CardMedia").props.alt).toBe("string");
  expect(componentMeta("Dialog").props.container).toMatchObject({
    type: "exprEditor",
  });
  expect(componentMeta("Dialog").props.role).toMatchObject({
    type: "choice",
    options: ["alertdialog", "dialog"],
  });
});
it("mixed boolean enums retain actual booleans, not strings or object inputs", () => {
  expect(componentMeta("Autocomplete").props.blurOnSelect).toMatchObject({
    type: "choice",
    options: ["mouse", "touch", true, false],
  });
  expect(componentMeta("Autocomplete").props.forcePopupIcon).toMatchObject({
    type: "choice",
    options: ["auto", true, false],
  });
  expect(componentMeta("Container").props.maxWidth).toMatchObject({
    type: "choice",
    options: ["xs", "sm", "md", "lg", "xl", false],
  });
});
it("mixed scalar, collection and callback values use expression controls", () => {
  for (const [name, key] of [
    ["Select", "value"],
    ["Slider", "value"],
    ["Autocomplete", "options"],
    ["AvatarGroup", "spacing"],
    ["Slider", "valueLabelFormat"],
    ["TablePagination", "rowsPerPageOptions"],
  ] as const) {
    expect(componentMeta(name).props[key], `${name}.${key}`).toMatchObject({
      type: "exprEditor",
    });
  }
});
it("preserves real event arguments and controlled prop requirements/default hints", () => {
  for (const name of [
    "Checkbox",
    "Radio",
    "Switch",
    "FormControlLabel",
  ] as const) {
    expect(componentMeta(name).props.onChange).toMatchObject({
      type: "eventHandler",
      argTypes: [
        { name: "event", type: "object" },
        { name: "checked", type: "boolean" },
      ],
    });
  }
  expect(componentMeta("Rating").props.onChange).toMatchObject({
    argTypes: [
      { name: "event", type: "object" },
      { name: "value", type: "number" },
    ],
  });
  expect(componentMeta("Autocomplete").props.onChange).toMatchObject({
    argTypes: [
      { name: "event", type: "object" },
      { name: "value", type: "object" },
      { name: "reason", type: "string" },
      { name: "details", type: "object" },
    ],
  });
  expect(componentMeta("Dialog").props.onTransitionEnter).toMatchObject({
    argTypes: [],
  });
  expect(componentMeta("Pagination").props.page).toMatchObject({
    type: "number",
    uncontrolledProp: "defaultPage",
    required: false,
  });
  expect(componentMeta("TablePagination").props.page).toMatchObject({
    type: "number",
    required: true,
  });
  expect(componentMeta("Accordion").props.expanded).toMatchObject({
    defaultValueHint: false,
  });
  expect(componentMeta("ToggleButton").props.value).toMatchObject({
    required: true,
  });
  expect(componentMeta("Autocomplete").props.renderInput).toMatchObject({
    required: false,
  });
  expect(componentMeta("Dialog").props.open).toMatchObject({ required: false });
});
it("permits real image content and both native/non-native select options", () => {
  expect(componentMeta("ImageListItem").props.children).not.toHaveProperty(
    "allowedComponents",
  );
  expect(componentMeta("Select").props.children).toMatchObject({
    allowedComponents: [
      "plasmic-material-ui-menu-item",
      "plasmic-material-ui-native-option",
    ],
  });
});
