import { PlasmicStyleSwitch } from "@/wab/client/plasmic/plasmic_kit_style_controls/PlasmicStyleSwitch";
import { PlasmicFilterButton } from "@/wab/client/plasmic/plasmic_kit_left_pane/PlasmicFilterButton";
import { render, screen } from "@testing-library/react";
import * as React from "react";

it("renders independent generated node instances and updates their native props", () => {
  const view = render(<React.StrictMode>
    <PlasmicStyleSwitch.labelContainer args={{ children: "First" }} />
    <PlasmicStyleSwitch.labelContainer args={{ children: "Second" }} />
  </React.StrictMode>);
  const first = screen.getByText("First"), second = screen.getByText("Second");
  view.rerender(<React.StrictMode>
    <PlasmicStyleSwitch.labelContainer args={{ children: "Updated" }} />
    <PlasmicStyleSwitch.labelContainer args={{ children: "Second" }} />
  </React.StrictMode>);
  expect(screen.getByText("Updated")).toBe(first);
  expect(screen.getByText("Second")).toBe(second);
  expect(screen.queryByText("First")).toBeNull();
});

it("updates a generated private variant when its initial prop changes", () => {
  const view = render(<PlasmicFilterButton isActive={false} />);
  const button = screen.getByRole("button");
  expect(button.className).not.toContain("rootisActive");
  view.rerender(<PlasmicFilterButton isActive />);
  expect(button.className).toContain("rootisActive");
  view.rerender(<PlasmicFilterButton isActive={false} />);
  expect(button.className).not.toContain("rootisActive");
});
