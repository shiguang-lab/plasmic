// @vitest-environment jsdom
import "../../../antd6/tests/setup";
import { PlasmicCanvasContext } from "@plasmicapp/host";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Form, Input } from "antd";
import React from "react";
import { expect, it, vi } from "vitest";
import { FormItemWrapper } from "./FormItem";
import { FormListWrapper } from "./FormList";
import { InternalFormInstanceContext } from "./contexts";
import { FormWrapper } from "./Form";

it("keeps field and list hooks ordered when entering and leaving the canvas", async () => {
  const error = vi.spyOn(console, "error");
  const fireOnValuesChange = vi.fn(), forceRemount = vi.fn();
  const registerField = vi.fn(() => vi.fn());
  const internalFieldCtx = { registeredFields: [], preservedRegisteredFields: [] };
  const initialValues = {};
  const rows = ["first"];
  const formRef = React.createRef<ReturnType<typeof Form.useForm>[0]>();
  const fieldContext = vi.fn();
  function Row() { return <span>Row</span>; }
  function Fixture({ canvas, initialValue = "Canvas" }: { canvas: boolean; initialValue?: string }) {
    const [form] = Form.useForm();
    React.useImperativeHandle(formRef, () => form, [form]);
    return <PlasmicCanvasContext.Provider value={canvas ? { componentName: null, globalVariants: {} } : false}>
      <InternalFormInstanceContext.Provider value={{ fireOnValuesChange, forceRemount, registerField, internalFieldCtx, initialValues }}>
        <Form form={form}>
          <FormItemWrapper name="title" initialValue={initialValue} setControlContextData={fieldContext}><Input /></FormItemWrapper>
          <FormListWrapper name="rows" initialValue={rows}><Row /></FormListWrapper>
        </Form>
      </InternalFormInstanceContext.Provider>
    </PlasmicCanvasContext.Provider>;
  }
  try {
    const view = render(<Fixture canvas={false} />);
    expect(fireOnValuesChange).not.toHaveBeenCalled();
    view.rerender(<Fixture canvas />);
    expect(formRef.current?.getFieldsValue(true)).toEqual({ title: "Canvas", rows: ["first"] });
    expect(fieldContext.mock.calls.at(-1)?.[0].formInstance).toBe(formRef.current);
    const notifications = fireOnValuesChange.mock.calls.length;
    view.rerender(<Fixture canvas />);
    expect(fireOnValuesChange).toHaveBeenCalledTimes(notifications);
    view.rerender(<Fixture canvas initialValue="Updated" />);
    expect(screen.getByRole("textbox")).toHaveProperty("value", "Updated");
    view.rerender(<Fixture canvas={false} initialValue="Runtime" />);
    await act(async () => {});
    expect(formRef.current?.getFieldValue("title")).toBe("Updated");
    expect(forceRemount).not.toHaveBeenCalled();
    expect(error.mock.calls.some((args) => /order of Hooks|Rendered (more|fewer) hooks/.test(args.join(" ")))).toBe(false);
    view.unmount();
    expect(registerField.mock.results.every(({ value }) => value.mock.calls.length === 1)).toBe(true);
  } finally { error.mockRestore(); }
});

it("preserves canvas field edits across unrelated FormWrapper updates", () => {
  function Fixture({ disabled }: { disabled: boolean }) {
    return <PlasmicCanvasContext.Provider value={{ componentName: null, globalVariants: {} }}>
      <FormWrapper disabled={disabled}>
        <FormItemWrapper name="title" initialValue="Initial"><Input /></FormItemWrapper>
      </FormWrapper>
    </PlasmicCanvasContext.Provider>;
  }
  const view = render(<Fixture disabled={false} />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Edited" } });
  view.rerender(<Fixture disabled />);
  expect(screen.getByRole("textbox")).toHaveProperty("value", "Edited");
});

it("notifies the new callback for canvas initial-value edits without resetting the field on callback changes", () => {
  const first = vi.fn(), second = vi.fn();
  function Fixture({ callback, value }: { callback: (values: any) => void; value: string }) {
    return <PlasmicCanvasContext.Provider value={{ componentName: null, globalVariants: {} }}>
      <FormWrapper extendedOnValuesChange={callback}>
        <FormItemWrapper name="title" initialValue={value}><Input /></FormItemWrapper>
      </FormWrapper>
    </PlasmicCanvasContext.Provider>;
  }
  const view = render(<Fixture callback={first} value="Initial" />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Edited" } });
  first.mockClear();
  view.rerender(<Fixture callback={second} value="Initial" />);
  expect(screen.getByRole("textbox")).toHaveProperty("value", "Edited");
  expect(second).not.toHaveBeenCalled();
  view.rerender(<Fixture callback={second} value="New default" />);
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledWith({ title: "New default" });
});
