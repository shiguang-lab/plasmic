import { createRequire } from "node:module";
import path from "node:path";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { Input, Select } from "antd";
import React from "react";
import { expect, test, vi } from "vitest";
import { StudioControlsProvider } from "../../../platform/sub/src/studio-controls-provider";

test("host controls inject styles and portals into the target document and emit native values", async () => {
  const frame = document.createElement("iframe");
  document.body.appendChild(frame);
  const target = frame.contentDocument!;
  const container = target.createElement("div");
  target.body.appendChild(container);
  const change = vi.fn();
  const view = render(<StudioControlsProvider studioDocument={target}>
    <Input aria-label="Caption" onChange={(event) => change(event.target.value)} />
    <Select open options={[{ value: "green", label: "Green" }]} onChange={change} />
  </StudioControlsProvider>, { container });
  await waitFor(() => expect(target.head.querySelector("style[data-css-hash]")).toBeTruthy());
  expect(target.body.querySelector(".ant-select-dropdown")).toBeTruthy();
  expect(document.body.querySelector(".ant-select-dropdown")).toBeNull();
  fireEvent.change(target.querySelector("input")!, { target: { value: "Caption 123" } });
  expect(change).toHaveBeenCalledWith("Caption 123");
  fireEvent.click(target.querySelector(".ant-select-item-option-content")!);
  expect(change).toHaveBeenCalledWith("green", expect.objectContaining({ value: "green" }));
  view.unmount();
  frame.remove();
});


test("host trigger resolves HTML and SVG nodes from the Studio document", () => {
  const subRequire = createRequire(path.resolve("../../platform/sub/package.json"));
  const antdRequire = createRequire(subRequire.resolve("antd/package.json"));
  const { getDOM, isDOM } = antdRequire("@rc-component/util/lib/Dom/findDOMNode");
  const isVisible = antdRequire("@rc-component/util/lib/Dom/isVisible").default;
  const frame = document.createElement("iframe");
  document.body.appendChild(frame);
  const target = frame.contentDocument!;
  const button = target.createElement("button");
  const svg = target.createElementNS("http://www.w3.org/2000/svg", "svg");
  expect(button instanceof HTMLElement).toBe(false);
  expect(isDOM(button)).toBe(true);
  expect(isDOM(svg)).toBe(true);
  button.getBoundingClientRect = () => ({ width: 120, height: 32 } as DOMRect);
  expect(isVisible(button)).toBe(true);
  expect(getDOM({ nativeElement: button })).toBe(button);
  expect(getDOM({ current: button })).toBeNull();
  expect(isDOM(null)).toBe(false);
  expect(isDOM({})).toBe(false);
  frame.remove();
});
