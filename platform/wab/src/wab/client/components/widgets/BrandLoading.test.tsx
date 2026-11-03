import { BrandLogo } from "@/wab/client/components/BrandLogo";
import { BrandLoading } from "@/wab/client/components/widgets/BrandLoading";
import { ensure } from "@/wab/shared/common";
import { act, cleanup, render, screen } from "@testing-library/react";
import * as React from "react";

let frames: FrameRequestCallback[];
beforeEach(() => {
  frames = [];
  vi.spyOn(performance, "now").mockReturnValue(0);
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) =>
    frames.push(callback),
  );
  vi.spyOn(window, "cancelAnimationFrame").mockReturnValue(undefined);
});
afterEach(cleanup);

it("keeps simultaneous gradient logos independent", () => {
  const { container } = render(
    <>
      <BrandLogo />
      <BrandLogo />
    </>,
  );
  const gradients = container.querySelectorAll("linearGradient");
  expect(gradients).toHaveLength(2);
  expect(gradients[0].id).not.toBe(gradients[1].id);
  container.querySelectorAll("svg").forEach((svg, i) => {
    expect(svg.querySelector("g")?.getAttribute("fill")).toBe(
      `url(#${gradients[i].id})`,
    );
  });
});

it("settles on the gradient logo and stops scheduling frames", () => {
  const { container } = render(<BrandLoading />);
  expect(screen.getByRole("status").getAttribute("aria-busy")).toBe("true");
  act(() => ensure(frames.shift(), "Initial animation frame")(2800));
  expect(container.querySelector("[data-solid]")?.getAttribute("opacity")).toBe(
    "1",
  );
  expect(container.querySelector("[data-solid]")?.hasAttribute("mask")).toBe(
    false,
  );
  expect(container.querySelector("[data-grid]")?.getAttribute("opacity")).toBe(
    "0",
  );
  expect(frames).toHaveLength(0);
});

it("shows a static gradient when reduced motion is requested", () => {
  vi.spyOn(window, "matchMedia").mockReturnValue({
    matches: true,
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  });
  const { container } = render(<BrandLoading />);
  act(() => ensure(frames.shift(), "Reduced-motion frame")(0));
  expect(container.querySelector("[data-solid]")?.getAttribute("opacity")).toBe(
    "1",
  );
  expect(frames).toHaveLength(0);
});

it("cancels animation and removes temporary paths as soon as loading unmounts", () => {
  const { container, unmount } = render(<BrandLoading />);
  const lights = container.querySelector("[data-lights]");
  expect(lights?.children.length).toBeGreaterThan(0);
  unmount();
  expect(window.cancelAnimationFrame).toHaveBeenCalledWith(1);
  expect(lights?.children).toHaveLength(0);
});
