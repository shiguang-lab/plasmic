// @vitest-environment jsdom
import { render } from "@testing-library/react";
import * as Ant from "antd";

import { expect, test } from "vitest";
import { AntdBadge, registerAdditional } from "../src/registerAdditional";
import type { Registerable } from "../src/utils";

function metadata(register: (loader: Registerable) => void) {
  const metas = new Map<string, any>();
  register({
    registerComponent: (_component, meta) => metas.set(meta.name, meta),
  } as Registerable);
  return metas;
}

// The registered contract must stay identical to the official Ant Design Badge:
// no non-official props such as value/options may be added for convenience.
test("Badge registration exposes only official Ant Design props", () => {
  expect(AntdBadge).toBe(Ant.Badge);
  const props = metadata(registerAdditional).get("plasmic-antd6-badge").props;
  expect(Object.keys(props).sort()).toEqual(
    ["children", "classNames", "color", "count", "dot", "overflowCount", "showZero", "size", "status", "styles", "text"].sort(),
  );
  expect(props.styles.editor).toBe("semantic");
  expect(props.classNames.editor).toBe("semantic");
  expect(props.status.options).toEqual(["success", "processing", "default", "error", "warning"]);
});

test("per-row status is expressed with the official status and text props", () => {
  const { container } = render(
    <AntdBadge status="success" text="启用" />,
  );
  expect(container.querySelector(".ant-badge-status-success")).toBeTruthy();
  expect(container.textContent).toBe("启用");
});

test("re-registering Badge shares one editor stylesheet for the processing ring", () => {
  metadata(registerAdditional);
  metadata(registerAdditional);
  const styles = document.head.querySelectorAll<HTMLStyleElement>(
    "#plasmic-antd6-canvas-badge-style[data-plasmic-editor-style]",
  );
  expect(styles).toHaveLength(1);
  const rule = styles[0].sheet!.cssRules[0] as CSSStyleRule;
  expect(rule.selectorText).toBe(
    ".__non_interactive_canvas .ant-badge-status-dot.ant-badge-status-processing::after",
  );
  expect(rule.style.getPropertyValue("content")).toBe("none");
});
