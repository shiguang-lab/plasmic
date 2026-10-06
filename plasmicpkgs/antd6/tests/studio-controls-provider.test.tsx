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
