// @vitest-environment jsdom
import { expect, test } from "vitest";
import { registerDrawer } from "../src/registerDrawer";
import type { Registerable } from "../src/utils";

function metadata(register: (loader: Registerable) => void) {
  const metas = new Map<string, any>();
  register({
    registerComponent: (_component, meta) => metas.set(meta.name, meta),
  } as Registerable);
  return metas;
}

// Drawer props must match the official Ant Design API: width is the pixel width
// and size is the official default/large choice, never a numeric size.
test("Drawer registration exposes official width and size", () => {
  const props = metadata(registerDrawer).get("plasmic-antd6-drawer").props;
  expect(props.width.type).toBe("number");
  expect(props.size.type).toBe("choice");
  expect(props.size.options).toEqual(["default", "large"]);
});
