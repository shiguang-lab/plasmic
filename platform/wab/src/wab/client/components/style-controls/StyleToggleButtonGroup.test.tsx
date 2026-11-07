import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import StyleToggleButton from "./StyleToggleButton";
import StyleToggleButtonGroup from "./StyleToggleButtonGroup";

vi.mock("./StyleToggleButton", () => ({ default: (props: { value: string; onClick?: () => void; valueSetState?: string; isDisabled?: boolean }) => <button onClick={props.onClick} disabled={props.isDisabled} aria-pressed={props.valueSetState === "isSet"}>{props.value}</button> }));
vi.mock("@/wab/client/plasmic/plasmic_kit_style_controls/PlasmicStyleToggleButtonGroup", () => ({ PlasmicStyleToggleButtonGroup: ({ children }: React.PropsWithChildren) => <div>{children}</div> }));
afterEach(cleanup);

it("flattens nested fragments with React 19 elements and keeps selection and change values", () => {
  const onChange = vi.fn();
  const view = render(<StyleToggleButtonGroup value="left" onChange={onChange}><><StyleToggleButton key="left" value="left" /><>{[<StyleToggleButton key="right" value="right" />]}</></></StyleToggleButtonGroup>);
  expect(screen.getByRole("button", { name: "left" }).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "right" }));
  expect(onChange).toHaveBeenCalledExactlyOnceWith("right");
  view.rerender(<StyleToggleButtonGroup value="right" isDisabled><><StyleToggleButton key="left" value="left" /><StyleToggleButton key="right" value="right" /></></StyleToggleButtonGroup>);
  expect(screen.getByRole("button", { name: "right" }).getAttribute("aria-pressed")).toBe("true");
  expect((screen.getByRole("button", { name: "left" }) as HTMLButtonElement).disabled).toBe(true);
});

it("continues rejecting children that are not style controls", () => {
  expect(() => render(<StyleToggleButtonGroup><div /></StyleToggleButtonGroup>)).toThrow("Can only have instances of StyleToggleButton");
});
