import { FilterEffectPanel } from "@/wab/client/components/style-controls/FilterEffectPanel";
import { TransformPanel } from "@/wab/client/components/style-controls/TransformPanel";
import { TransformSettingsPanel } from "@/wab/client/components/style-controls/TransformSettingsPanel";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ensure } from "@/wab/shared/common";
import { type FilterEffect, fromFilterStringToObj, fromFilterObjToString } from "@/wab/shared/core/filter-effect-utils";
import { CssTransform } from "@/wab/shared/css/transforms";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

vi.mock("@/wab/client/components/sidebar/sidebar-helpers", () => ({
  LabeledItemRow: ({ label, children, menu }: { label: React.ReactNode; children: React.ReactNode; menu?: React.ReactNode }) => <section aria-label={typeof label === "string" ? label : undefined}>{label}{children}{menu}</section>,
  FullRow: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/wab/client/components/sidebar/SidebarSection", () => ({ SidebarSection: ({ title, children }: { title?: React.ReactNode; children: React.ReactNode }) => <fieldset><legend>{title}</legend>{children}</fieldset> }));
vi.mock("@/wab/client/components/widgets/DimTokenSelector", () => ({ default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => <input aria-label="Dimension" value={value} onChange={(event) => onChange(event.target.value)} /> }));
vi.mock("@/wab/client/components/widgets/ColorPicker", () => ({ ColorPicker: ({ color, onChange }: { color: string; onChange: (value: string) => void }) => <input aria-label="Color" value={color} onChange={(event) => onChange(event.target.value)} /> }));
vi.mock("@/wab/client/components/widgets/Select", () => {
  const Select = ({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: React.ReactNode }) => <select aria-label="Filter" value={value} onChange={(event) => onChange(event.target.value)}>{children}</select>;
  Select.Option = ({ value, children }: { value: string; children: React.ReactNode }) => <option value={value}>{children}</option>;
  Select.OptionGroup = ({ children }: { children: React.ReactNode }) => <>{children}</>;
  return { default: Select };
});
vi.mock("antd", async (importOriginal) => {
  const actual = await importOriginal<typeof import("antd")>();
  return { ...actual, Slider: ({ value, onChange, onAfterChange }: { value: number; onChange: (value: number) => void; onAfterChange: () => void }) => <input aria-label="Slider" type="range" min={-1000} max={1000} value={value} onChange={(event) => onChange(Number(event.target.value))} onMouseUp={onAfterChange} /> };
});
afterEach(cleanup);

it("uses parsed filter props, serializes edits through the existing helper and cleans up the command owner", () => {
  const studio = mock<StudioCtx>(), changed = vi.fn<(value: FilterEffect) => void>();
  const initial = fromFilterStringToObj("blur(2px)");
  const view = render(<FilterEffectPanel studioCtx={studio} filterEffect={initial} onChange={changed} />);
  fireEvent.change(screen.getByRole("slider"), { target: { value: "7" } });
  expect(studio.startUnlogged).toHaveBeenCalledOnce();
  expect(fromFilterObjToString(ensure(changed.mock.lastCall?.[0], "Expected emitted style value"))).toBe("blur(7px)");
  fireEvent.mouseUp(screen.getByRole("slider"));
  expect(studio.stopUnlogged).toHaveBeenCalledOnce();
  const next = fromFilterStringToObj("drop-shadow(1px 2px 3px #FFFFFF)");
  view.rerender(<FilterEffectPanel studioCtx={studio} filterEffect={next} onChange={changed} />);
  expect(screen.getAllByRole("slider").map((input) => input.getAttribute("value"))).toEqual(["1", "2", "3"]);
  fireEvent.change(screen.getByRole("textbox", { name: "Color" }), { target: { value: "#112233" } });
  expect(fromFilterObjToString(ensure(changed.mock.lastCall?.[0], "Expected emitted style value"))).toBe("drop-shadow(1px 2px 3px #112233)");
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "brightness" } });
  expect(fromFilterObjToString(ensure(changed.mock.lastCall?.[0], "Expected emitted style value"))).toBe("brightness(100%)");
  view.unmount();
  expect(studio.stopUnlogged).toHaveBeenCalledTimes(2);
});

it("renders parsed transform replacements and preserves clone-based edits and drag commands", () => {
  const studio = mock<StudioCtx>(), changed = vi.fn<(value: CssTransform) => void>();
  const initial = ensure(CssTransform.fromCss("translate3d(1px, 2px, 3px)"), "Expected parsed translation");
  const view = render(<TransformPanel studioCtx={studio} transform={initial} onChange={changed} />);
  const x = within(screen.getByRole("region", { name: "X" }));
  fireEvent.change(x.getByRole("slider"), { target: { value: "9" } });
  const edited = ensure(changed.mock.lastCall?.[0], "Expected emitted style value");
  expect(edited).not.toBe(initial);
  expect(edited.showCss()).toBe("translate3d(9px, 2px, 3px)");
  expect(initial.showCss()).toBe("translate3d(1px, 2px, 3px)");
  expect(studio.setIsTransformingObject).toHaveBeenLastCalledWith(true);
  expect(studio.startUnlogged).toHaveBeenCalledOnce();
  fireEvent.mouseUp(x.getByRole("slider"));
  expect(studio.setIsTransformingObject).toHaveBeenLastCalledWith(false);
  expect(studio.stopUnlogged).toHaveBeenCalledOnce();
  const next = ensure(CssTransform.fromCss("scale3d(2, 3, 4)"), "Expected parsed scale");
  view.rerender(<TransformPanel studioCtx={studio} transform={next} onChange={changed} />);
  fireEvent.change(within(screen.getByRole("region", { name: "Y" })).getByRole("textbox"), { target: { value: "5" } });
  expect(ensure(changed.mock.lastCall?.[0], "Expected emitted style value").showCss()).toBe("scale3d(2, 5, 4)");
  view.unmount();
  expect(studio.stopUnlogged).toHaveBeenCalledTimes(2);
});

it("keeps transform setting scalar/origin props current and preserves unset, drag and owner cleanup", () => {
  const studio = mock<StudioCtx>();
  const props = { studioCtx: studio, selfPerspective: "100px", transformOrigin: Object.freeze({ left: "20%", top: "30%" }), perspectiveOrigin: Object.freeze({ left: "40%", top: "50%" }), childPerspective: "200px", backfaceVisibility: "visible", updateSelfPerspective: vi.fn(), updateTransformOrigin: vi.fn(), updatePerspectiveOrigin: vi.fn(), updateBackfaceVisibility: vi.fn(), updateChildPerspective: vi.fn() };
  const view = render(<TransformSettingsPanel {...props} />);
  const origin = within(screen.getAllByRole("region", { name: "Origin Left" })[0]);
  fireEvent.change(origin.getByRole("slider"), { target: { value: "25" } });
  expect(props.updateTransformOrigin).toHaveBeenLastCalledWith({ left: "25%", top: "30%" });
  expect(studio.setIsTransformingObject).toHaveBeenLastCalledWith(true);
  fireEvent.mouseUp(origin.getByRole("slider"));
  expect(studio.setIsTransformingObject).toHaveBeenLastCalledWith(false);
  fireEvent.click(origin.getByRole("menuitem", { name: "Unset" }));
  expect(props.updateTransformOrigin).toHaveBeenLastCalledWith(undefined);
  view.rerender(<TransformSettingsPanel {...props} selfPerspective="300px" transformOrigin={{ left: "60%", top: "70%" }} />);
  const current = within(screen.getAllByRole("region", { name: "Origin Left" })[0]);
  fireEvent.change(current.getByRole("textbox"), { target: { value: "65%" } });
  expect(props.updateTransformOrigin).toHaveBeenLastCalledWith({ left: "65%", top: "70%" });
  const self = within(screen.getByRole("group", { name: "Self Perspective" }));
  expect(self.getByRole("textbox").getAttribute("value")).toBe("300px");
  fireEvent.change(self.getByRole("textbox"), { target: { value: "350px" } });
  expect(props.updateSelfPerspective).toHaveBeenLastCalledWith("350px");
  view.unmount();
  expect(studio.stopUnlogged).toHaveBeenCalledTimes(2);
});
