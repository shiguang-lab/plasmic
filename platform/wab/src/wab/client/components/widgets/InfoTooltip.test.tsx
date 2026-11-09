import { InfoTooltip } from "@/wab/client/components/widgets/InfoTooltip";
import { act, fireEvent, render } from "@testing-library/react";
import React from "react";

afterEach(() => {
  vi.useRealTimers();
});

it("anchors the popover to the info icon and keeps it open on icon clicks", async () => {
  vi.useFakeTimers();
  const { container } = render(<InfoTooltip tooltip="Native scroll" />);
  const icon = container.querySelector(
    '[data-test-id="info-tooltip-trigger"]',
  ) as SVGElement;
  // The popover measures the element that received its ref: the svg itself.
  const rect = vi
    .spyOn(icon, "getBoundingClientRect")
    .mockReturnValue(new DOMRect(200, 400, 16, 16));

  fireEvent.mouseEnter(icon);
  await act(async () => {
    vi.advanceTimersByTime(600);
  });
  const popover = () =>
    document.querySelector(".ant-popover:not(.ant-popover-hidden)");
  expect(popover()?.textContent).toContain("Native scroll");
  expect(rect).toHaveBeenCalled();

  // A press on the icon is inside the trigger, not an outside click.
  fireEvent.mouseDown(icon);
  fireEvent.pointerDown(icon);
  await act(async () => {
    vi.advanceTimersByTime(600);
  });
  expect(popover()).toBeTruthy();
});
