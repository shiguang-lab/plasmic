import { TransitionPanel } from "@/wab/client/components/style-controls/transition-panel";
import type { Transition } from "@/wab/client/components/sidebar-tabs/TransitionsSection";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";

vi.mock("@/wab/client/components/sidebar/sidebar-helpers", () => ({ LabeledItemRow: ({ label, children }: { label: React.ReactNode; children: React.ReactNode }) => <label>{label}{children}</label> }));
vi.mock("@/wab/client/components/style-controls/StyleSelect", () => {
  const Select = ({ children, value, onChange, "aria-label": label }: { children: React.ReactNode; value: string; onChange: (value: string) => void; "aria-label": string }) => <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>{children}</select>;
  Select.Option = ({ children, value }: { children: React.ReactNode; value: string }) => <option value={value}>{children}</option>;
  return { default: Select };
});
vi.mock("@/wab/client/plasmic/plasmic_kit/PlasmicTextbox", () => ({ PlasmicTextbox: ({ overrides }: { overrides: { root: React.ComponentProps<"div">; textbox: React.ComponentProps<"input"> } }) => <div {...overrides.root}><input {...overrides.textbox} /></div> }));
afterEach(cleanup);

const initial: Transition = Object.freeze({ transitionProperty: "opacity", transitionTimingFunction: "ease", transitionDuration: "100ms", transitionDelay: "0s" });

it("renders incoming scalar props and emits new transition values without mutating its input", () => {
  const changed = vi.fn();
  const view = render(<TransitionPanel transition={initial} onChange={changed} />);
  fireEvent.change(screen.getByRole("combobox", { name: "What to animate" }), { target: { value: "transform" } });
  expect(changed).toHaveBeenLastCalledWith({ ...initial, transitionProperty: "transform" });
  expect(initial.transitionProperty).toBe("opacity");
  const next = Object.freeze({ ...initial, transitionProperty: "color", transitionTimingFunction: "linear" });
  view.rerender(<TransitionPanel transition={next} onChange={changed} />);
  expect((screen.getByRole("combobox", { name: "What to animate" }) as HTMLSelectElement).value).toBe("color");
  expect((screen.getByRole("combobox", { name: "Timing curve" }) as HTMLSelectElement).value).toBe("linear");
  fireEvent.change(screen.getByRole("combobox", { name: "Timing curve" }), { target: { value: "ease-out" } });
  expect(changed).toHaveBeenLastCalledWith({ ...next, transitionTimingFunction: "ease-out" });
});

it("preserves actual textbox time normalization, invalid input recovery and Escape", () => {
  const changed = vi.fn();
  const view = render(<TransitionPanel transition={initial} onChange={changed} />);
  const duration = screen.getByRole("textbox", { name: "Duration" }) as HTMLInputElement;
  fireEvent.change(duration, { target: { value: "00250ms" } });
  fireEvent.blur(duration);
  expect(changed).toHaveBeenLastCalledWith({ ...initial, transitionDuration: "250ms" });
  expect(duration.value).toBe("250ms");
  const next = { ...initial, transitionDuration: "250ms" };
  view.rerender(<TransitionPanel transition={next} onChange={changed} />);
  changed.mockClear();
  fireEvent.change(duration, { target: { value: "invalid" } });
  fireEvent.blur(duration);
  expect(changed).not.toHaveBeenCalled();
  expect(duration.value).toBe("250ms");
  const delay = screen.getByRole("textbox", { name: "Delay" }) as HTMLInputElement;
  fireEvent.change(delay, { target: { value: "001s" } });
  fireEvent.blur(delay);
  expect(changed).toHaveBeenLastCalledWith({ ...next, transitionDelay: "1s" });
  fireEvent.change(delay, { target: { value: "2s" } });
  fireEvent.keyDown(delay, { key: "Escape" });
  expect(delay.value).toBe("0s");
});
