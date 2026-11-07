// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";

import { Slider, SliderTrack } from "react-aria-components";
import { afterEach, expect, it, vi } from "vitest";
import { BaseSliderThumb } from "./registerSliderThumb";

afterEach(cleanup);

it("renders a registered advanced slot without changing its content", () => {
  const view = render(<Slider aria-label="Progress"><SliderTrack>
    <BaseSliderThumb advanced><span>Custom thumb</span></BaseSliderThumb>
  </SliderTrack></Slider>);
  expect(view.getByText("Custom thumb")).toBeTruthy();
});

it("passes native thumb state to a render-function child", () => {
  const child = vi.fn(({ isDisabled }: { isDisabled: boolean }) => <span>{isDisabled ? "Disabled thumb" : "Enabled thumb"}</span>);
  const content = (disabled: boolean) => <Slider aria-label="Progress" isDisabled={disabled}><SliderTrack>
    <BaseSliderThumb advanced>{child}</BaseSliderThumb>
  </SliderTrack></Slider>;
  const view = render(content(false));
  expect(view.getByText("Enabled thumb")).toBeTruthy();
  view.rerender(content(true));
  expect(view.getByText("Disabled thumb")).toBeTruthy();
});

it("keeps advanced children inactive until explicitly enabled", () => {
  const child = vi.fn(() => <span>Advanced thumb</span>);
  const view = render(<Slider aria-label="Progress"><SliderTrack>
    <BaseSliderThumb>{child}</BaseSliderThumb>
  </SliderTrack></Slider>);
  expect(child).not.toHaveBeenCalled();
  expect(view.queryByText("Advanced thumb")).toBeNull();
});
