import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { expect, test, vi } from "vitest";
import { FormRefActions, FormWrapper } from "../src/form/Form";
import { FormItemWrapper } from "../src/form/FormItem";
import { commonFormItemProps } from "../src/form/sharedRegistration";
import { AntdTextArea, registerTextArea } from "../src/registerInput";
import { Registerable } from "../src/utils";

test("registered TextArea exposes the native character counter", () => {
  let registration: any;
  registerTextArea({
    registerComponent(component, meta) {
      expect(component).toBe(AntdTextArea);
      registration = meta;
    },
  } as Registerable);
  expect(registration.props.showCount.type).toBe("object");
  expect(registration.props.showCount.toggleable).toBe(true);
  expect(registration.props.showCount.defaultValue).toBeUndefined();
  expect(registration.props.showCount.fields.formatter.type).toBe("string");
  expect(registration.props.showCount.fields.formatter.control).toBe("large");
  expect(registration.props.showCount.fields.formatter.templateVariables).toEqual(["count", "maxLength"]);
  expect(registration.props.showCount.fields.formatter.defaultValue).toBeUndefined();

  // Use the same JSON values that Studio persists as component props.
  const props = JSON.parse(JSON.stringify({ showCount: {}, maxLength: 500 }));
  const view = render(<AntdTextArea {...props} />);
  expect(screen.getByText("0 / 500")).toBeTruthy();
  expect(screen.getByRole("textbox").getAttribute("maxlength")).toBe("500");

  fireEvent.change(screen.getByRole("textbox"), { target: { value: "测试内容" } });
  expect(screen.getByText("4 / 500")).toBeTruthy();

  view.rerender(<AntdTextArea {...props} showCount={undefined} />);
  expect(screen.queryByText("4 / 500")).toBeNull();
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("测试内容");
});

test("saved plain template updates in the native counter and clears to the default", () => {
  const props = JSON.parse(JSON.stringify({
    showCount: { formatter: "已输入 {count} / {maxLength} 字" },
    maxLength: 500,
  }));
  const view = render(<AntdTextArea {...props} />);
  const counter = screen.getByText("已输入 0 / 500 字");
  expect(counter.classList.contains("ant-input-data-count")).toBe(true);

  fireEvent.change(screen.getByRole("textbox"), { target: { value: "测试内容" } });
  expect(screen.getByText("已输入 4 / 500 字")).toBe(counter);

  view.rerender(<AntdTextArea {...props} maxLength={100} />);
  expect(screen.getByText("已输入 4 / 100 字")).toBe(counter);
  view.rerender(<AntdTextArea {...props} showCount={{ formatter: "" }} />);
  expect(screen.getByText("4 / 500")).toBe(counter);
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("测试内容");

  view.rerender(<AntdTextArea {...props} showCount={{}} />);
  expect(screen.getByText("4 / 500")).toBe(counter);

  view.rerender(<AntdTextArea {...props} showCount={undefined} />);
  expect(view.container.querySelector(".ant-input-data-count")).toBeNull();
});

test("counter is opt-in and missing maxLength substitutes empty text", () => {
  const view = render(<AntdTextArea defaultValue="备注" />);
  expect(view.container.querySelector(".ant-input-data-count")).toBeNull();

  view.rerender(<AntdTextArea defaultValue="备注" showCount={{ formatter: "{count} 字[{maxLength}]" }} />);
  expect(screen.getByText("2 字[]")).toBeTruthy();
});

test("only supported tokens are replaced, with all other template text kept literal", () => {
  render(<AntdTextArea maxLength={500} showCount={{ formatter: '{count}/{count} <b>{maxLength}</b> {unknown} ${1 + 1}' }} />);
  expect(screen.getByText('0/0 <b>500</b> {unknown} ${1 + 1}')).toBeTruthy();
});

test("wrapper forwards the native ref, value and change event", () => {
  const ref = React.createRef<React.ComponentRef<typeof AntdTextArea>>();
  const onChange = vi.fn();
  const view = render(<AntdTextArea ref={ref} value="备注" onChange={onChange} showCount={{ formatter: "{count} 字" }} />);
  act(() => ref.current!.focus());
  expect(document.activeElement).toBe(screen.getByRole("textbox"));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "新的备注" } });
  expect(onChange).toHaveBeenCalledOnce();
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("备注");
  view.rerender(<AntdTextArea ref={ref} value="新的备注" onChange={onChange} showCount={{ formatter: "{count} 字" }} />);
  expect(screen.getByText("4 字")).toBeTruthy();
});

test("Form owns the wrapped TextArea value and retains text initial-value editing", async () => {
  const initialValue = commonFormItemProps("advanced-form-item").initialValue as any;
  expect(initialValue.control({ children: <AntdTextArea /> }, null, { path: [] }).type).toBe("string");
  const ref = React.createRef<FormRefActions>();
  render(
    <FormWrapper ref={ref} initialValues={{ remarks: "备注" }}>
      <FormItemWrapper name="remarks">
        <AntdTextArea maxLength={500} showCount={{ formatter: "{count}/{maxLength}" }} />
      </FormItemWrapper>
    </FormWrapper>,
  );
  expect(screen.getByText("2/500")).toBeTruthy();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "新的备注" } });
  expect(screen.getByText("4/500")).toBeTruthy();
  await act(async () => {
    await expect(ref.current!.validateFields()).resolves.toMatchObject({ remarks: "新的备注" });
  });
});
