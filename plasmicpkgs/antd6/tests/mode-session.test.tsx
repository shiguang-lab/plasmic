import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { AntdTabItem, AntdTabs, registerTabs } from "../src/registerTabs";
import { AntdModal, registerModal } from "../src/registerModal";
import { AntdDrawer, registerDrawer } from "../src/registerDrawer";
import { AntdCollapse, AntdCollapsePanel, registerCollapse } from "../src/registerCollapse";
import { createSessionCanvas } from "./canvas-session";

const Canvas = createSessionCanvas([registerTabs, registerModal, registerDrawer, registerCollapse]);

test("mode changes preserve the selected tab and mounted descendants without events", () => {
  const mounted = vi.fn(), unmounted = vi.fn(), onChange = vi.fn();
  function Field() {
    React.useEffect(() => { mounted(); return unmounted; }, []);
    return <input aria-label="Retained draft" defaultValue="" />;
  }
  const page = (interactive: boolean) => <Canvas interactive={interactive}>
    <AntdTabs {...{ defaultActiveKey: "first", onChange, items: <>
      <AntdTabItem key="first" label="First">First body</AntdTabItem>
      <AntdTabItem key="second" label="Second"><Field /></AntdTabItem>
    </> } as any} />
  </Canvas>;
  const view = render(page(false));
  fireEvent.click(screen.getByRole("tab", { name: "Second" }));
  const field = screen.getByRole("textbox", { name: "Retained draft" });
  fireEvent.change(field, { target: { value: "unsaved input" } });
  for (const mode of [true, false, true, false]) {
    view.rerender(page(mode));
    expect(screen.getByRole("tab", { selected: true }).textContent).toBe("Second");
    expect(screen.getByRole("textbox", { name: "Retained draft" })).toBe(field);
    expect((field as HTMLInputElement).value).toBe("unsaved input");
  }
  expect(mounted).toHaveBeenCalledTimes(1);
  expect(unmounted).not.toHaveBeenCalled();
  expect(onChange).not.toHaveBeenCalled();
  view.rerender(page(true));
  fireEvent.click(screen.getByRole("tab", { name: "First" }));
  expect(onChange).toHaveBeenCalledExactlyOnceWith("first");
  view.rerender(page(false));
  expect(screen.getByRole("tab", { selected: true }).textContent).toBe("First");
});

for (const [name, Component, selector] of [
  ["Modal", AntdModal, ".ant-modal-wrap:not([style*='display: none'])"],
  ["Drawer", AntdDrawer, ".ant-drawer-open"],
] as const) {
  test(`${name} retains an editing reveal and inner inputs through both modes, without changing saved open`, async () => {
    const afterOpenChange = vi.fn(), onOpenChange = vi.fn();
    const props = { open: false, onOpenChange, afterOpenChange, __plasmic_selection_prop__: { isSelected: true, selectedSlotName: "children" } };
    const Overlay = Component as React.ComponentType<any>;
    // CSS motion runs in the browser regression; jsdom exercises state and callbacks.
    const motionProps = name === "Modal" ? { transitionName: "", maskTransitionName: "" } : {};
    const page = (interactive: boolean) => <Canvas interactive={interactive}>
      <Overlay {...props} {...motionProps} modalScopeClassName="" wrapClassName=""><input aria-label="Overlay draft" /></Overlay>
    </Canvas>;
    const view = render(page(false));
    await waitFor(() => expect(document.querySelector(selector)).toBeTruthy());
    const field = screen.getByRole("textbox", { name: "Overlay draft" });
    fireEvent.change(field, { target: { value: "draft" } });
    for (const mode of [true, false, true]) {
      view.rerender(page(mode));
      expect(document.querySelector(selector)).toBeTruthy();
      expect(screen.getByRole("textbox", { name: "Overlay draft" })).toBe(field);
      expect((field as HTMLInputElement).value).toBe("draft");
    }
    expect(props.open).toBe(false);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(afterOpenChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(document.querySelector(selector)).toBeFalsy());
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    for (const mode of [false, true, false, true]) {
      view.rerender(page(mode));
      expect(document.querySelector(selector)).toBeFalsy();
    }
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    view.unmount();
    render(page(true));
    expect(document.querySelector(selector)).toBeFalsy();
  });
}

test("Collapse retains revealed panels and their DOM while switching modes", () => {
  const onChange = vi.fn();
  const page = (interactive: boolean) => <Canvas interactive={interactive}>
    <AntdCollapse onChange={onChange}>
      <AntdCollapsePanel key="a" header="Alpha">Alpha content</AntdCollapsePanel>
      <AntdCollapsePanel key="b" header="Beta" {...{ __plasmic_selection_prop__: { isSelected: true } }}><input aria-label="Panel draft" /></AntdCollapsePanel>
    </AntdCollapse>
  </Canvas>;
  const view = render(page(false));
  const input = screen.getByRole("textbox", { name: "Panel draft" });
  view.rerender(page(true));
  expect(screen.getByRole("textbox", { name: "Panel draft" })).toBe(input);
  view.rerender(page(false));
  expect(screen.getByRole("textbox", { name: "Panel draft" })).toBe(input);
  expect(onChange).not.toHaveBeenCalled();
});
