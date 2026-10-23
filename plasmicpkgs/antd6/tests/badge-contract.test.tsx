// @vitest-environment jsdom
import { render } from "@testing-library/react";
import * as Ant from "antd";
import React from "react";
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
    ["children", "color", "count", "dot", "overflowCount", "showZero", "size", "status", "text"].sort(),
  );
  expect(props.status.options).toEqual(["success", "processing", "default", "error", "warning"]);
});

test("per-row status is expressed with the official status and text props", () => {
  const { container } = render(
    <AntdBadge status="success" text="启用" />,
  );
  expect(container.querySelector(".ant-badge-status-success")).toBeTruthy();
  expect(container.textContent).toBe("启用");
});
