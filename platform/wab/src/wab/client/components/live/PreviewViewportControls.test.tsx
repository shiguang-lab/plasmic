import { PreviewViewportControls } from "@/wab/client/components/live/PreviewViewportControls";
import {
  PreviewViewport,
  getViewportScale,
} from "@/wab/client/components/live/preview-viewport";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";

function setup() {
  const onChange = vi.fn();
  function Controls() {
    const [value, setValue] = React.useState<PreviewViewport>({
      viewport: "desktop",
      width: 1600,
      height: 872,
    });
    return (
      <PreviewViewportControls
        value={value}
        scale={getViewportScale({ width: 1600, height: 872 }, value)}
        onChange={(next) => {
          onChange(next);
          setValue(next);
        }}
      />
    );
  }
  render(<Controls />);
  return onChange;
}

test("desktop, phone and tablet show explicit sizes; rotation swaps the CSS viewport", () => {
  setup();
  expect(screen.getByText("1600 × 872 · Fit to window")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Phone" }));
  expect(screen.getByText("390 × 844")).toBeTruthy();
  expect(screen.getByText("Zoom 99%")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Switch to landscape" }));
  expect(screen.getByText("844 × 390")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Switch to portrait" }));
  expect(screen.getByText("390 × 844")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Tablet" }));
  expect(screen.getByText("768 × 1024")).toBeTruthy();
  expect(screen.getByText("Zoom 81%")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Switch to landscape" }));
  expect(screen.getByText("1024 × 768")).toBeTruthy();
});

test("custom dimensions require valid integers, apply together, and desktop remains available", () => {
  const onChange = setup();
  fireEvent.click(screen.getByRole("button", { name: "Custom" }));
  fireEvent.change(screen.getByLabelText("Preview width"), {
    target: { value: "1280" },
  });
  fireEvent.change(screen.getByLabelText("Preview height"), {
    target: { value: "720" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  expect(onChange).toHaveBeenLastCalledWith({
    viewport: "custom",
    width: 1280,
    height: 720,
  });
  for (const invalid of ["", "0", "239", "300.5", "7681"]) {
    fireEvent.change(screen.getByLabelText("Preview width"), {
      target: { value: invalid },
    });
    expect(
      screen.getByRole("button", { name: "Apply" }).hasAttribute("disabled"),
    ).toBe(true);
  }
  fireEvent.click(screen.getByRole("button", { name: "Desktop" }));
  expect(
    screen
      .getByRole("button", { name: "Desktop" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  expect(screen.queryByLabelText("Preview width")).toBeNull();
});

test("small preview windows scale presentation without changing the requested viewport", () => {
  const device = { width: 768, height: 1024 };
  expect(getViewportScale({ width: 500, height: 600 }, device)).toBe(
    560 / 1024,
  );
  expect(device).toEqual({ width: 768, height: 1024 });
  expect(getViewportScale({ width: 2000, height: 1600 }, device)).toBe(1);
});
