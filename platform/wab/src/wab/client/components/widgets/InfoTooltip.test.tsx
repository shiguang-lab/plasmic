import { Icon } from "@/wab/client/components/widgets/Icon";
import { InfoTooltip } from "@/wab/client/components/widgets/InfoTooltip";
import InfoIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Info";
import { act, fireEvent, render } from "@testing-library/react";
import React from "react";

afterEach(() => {
  vi.useRealTimers();
});

it("puts a requested ref on the icon's own svg without extra DOM", () => {
  const plain = render(<Icon icon={InfoIcon} className="dimfg" />);
  expect(plain.container.innerHTML).toMatch(/^<svg /);

  const ref = React.createRef<Element>();
  const withRef = render(<Icon ref={ref} icon={InfoIcon} className="dimfg" />);
  // Same markup as without a ref, and the ref is that svg.
  expect(withRef.container.innerHTML).toBe(plain.container.innerHTML);
  expect(ref.current).toBe(withRef.container.firstElementChild);
  expect(ref.current?.classList.contains("dimfg")).toBe(true);
});

it("anchors icons that don't render a host element on a span", () => {
  const Composite = (props: React.ComponentProps<"svg">) => (
    <InfoIcon {...props} />
  );
  const ref = React.createRef<Element>();
  render(<Icon ref={ref} icon={Composite} className="dimfg" />);
  expect(ref.current?.tagName).toBe("SPAN");
  expect(ref.current?.querySelector("svg.dimfg")).toBeTruthy();
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
