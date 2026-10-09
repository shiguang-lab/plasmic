import { act, fireEvent, render, screen } from "@testing-library/react";
import { Button, ConfigProvider, Form, Input } from "antd";
import React from "react";
import { expect, test, vi } from "vitest";
import { FormRefActions, FormWrapper } from "../src/form/Form";

import { FormItemWrapper } from "../src/form/FormItem";
import { FormWrapper as SchemaForm } from "../src/form/SchemaForm";

test("FormItem reports one ordered error, keeps its description and clears errors after correction", async () => {
  const ref = React.createRef<FormRefActions>();
  const range = vi.fn((_rule, value) => Number.isInteger(value) && value >= 1 && value <= 365);
  const view = render(
    <FormWrapper ref={ref}>
      <FormItemWrapper
        name="expiry"
        label="Expiry"
        description={<span>Default 14 days; maximum 365 days.</span>}
        rules={[
          { ruleType: "required", message: "Enter expiry" },
          { ruleType: "advanced", custom: range, message: "Use an integer from 1 to 365" },
        ]}
      >
        <Input />
      </FormItemWrapper>
    </FormWrapper>,
  );
  await act(async () => {
    await expect(ref.current!.validateFields()).rejects.toMatchObject({
      errorFields: [{ name: ["expiry"], errors: ["Enter expiry"] }],
    });
  });
  expect(range).not.toHaveBeenCalled();
  expect(view.container.querySelector(".ant-form-item-extra")?.textContent).toBe("Default 14 days; maximum 365 days.");
  for (const value of [0, 366, 1.5]) {
    act(() => ref.current!.setFieldsValue({ expiry: value }));
    await act(async () => {
      await expect(ref.current!.validateFields()).rejects.toMatchObject({
        errorFields: [{ errors: ["Use an integer from 1 to 365"] }],
      });
    });
  }
  act(() => ref.current!.setFieldsValue({ expiry: 14 }));
  await act(async () => {
    await expect(ref.current!.validateFields()).resolves.toEqual({ expiry: 14 });
  });
  await vi.waitFor(() => expect(view.container.querySelectorAll(".ant-form-item-explain-error").length).toBe(0));
  expect(view.container.querySelector(".ant-form-item-extra")?.textContent).toBe("Default 14 days; maximum 365 days.");
});

test("FormItem honors explicit validateFirst=false", async () => {
  const ref = React.createRef<FormRefActions>();
  render(
    <FormWrapper ref={ref}>
      <FormItemWrapper name="expiry" validateFirst={false} rules={[
        { ruleType: "required", message: "Enter expiry" },
        { ruleType: "advanced", custom: () => false, message: "Invalid expiry" },
      ]}>
        <Input />
      </FormItemWrapper>
    </FormWrapper>,
  );
  await act(async () => {
    await expect(ref.current!.validateFields()).rejects.toMatchObject({
      errorFields: [{ errors: ["Enter expiry", "Invalid expiry"] }],
    });
  });
});

const capture = vi.hoisted(() => ({ props: null as any }));
vi.mock("antd", async (importOriginal) => {
  const original = await importOriginal<typeof import("antd")>();
  const ReactModule = await import("react");
  const CapturedForm = Object.assign(
    ReactModule.forwardRef((props: any, ref: any) => {
      capture.props = props;
      return <original.Form {...props} ref={ref} />;
    }),
    {
      Item: original.Form.Item,
      List: original.Form.List,
      ErrorList: original.Form.ErrorList,
      Provider: original.Form.Provider,
      useForm: original.Form.useForm,
      useFormInstance: original.Form.useFormInstance,
      useWatch: original.Form.useWatch,
    },
  );
  return { ...original, Form: CapturedForm };
});

test("explicit Form disabled and inherited ConfigProvider disabled remain effective", () => {
  const view = render(
    <FormWrapper disabled>
      <Input />
    </FormWrapper>,
  );
  expect((screen.getByRole("textbox") as HTMLInputElement).disabled).toBe(true);
  view.rerender(
    <ConfigProvider componentDisabled>
      <FormWrapper>
        <Input />
      </FormWrapper>
    </ConfigProvider>,
  );
  expect((screen.getByRole("textbox") as HTMLInputElement).disabled).toBe(true);
  view.rerender(
    <ConfigProvider componentDisabled>
      <FormWrapper disabled={false}>
        <Input />
      </FormWrapper>
    </ConfigProvider>,
  );
  expect((screen.getByRole("textbox") as HTMLInputElement).disabled).toBe(
    false,
  );
});

test.each(["reject", "throw"])(
  "Form restores submitting state after %s and permits retry",
  async (kind) => {
    const onState = vi.fn();
    const failure = Error("save failed");
    const onFinish = vi
      .fn()
      .mockImplementationOnce(() => {
        if (kind === "throw") {
          throw failure;
        }
        return Promise.reject(failure);
      })
      .mockResolvedValue(undefined);
    render(
      <FormWrapper onFinish={onFinish} onIsSubmittingChange={onState}>
        <Input />
      </FormWrapper>,
    );
    await act(async () => {
      await expect(capture.props.onFinish({})).rejects.toBe(failure);
    });
    expect(onState.mock.calls).toEqual([[true], [false]]);
    expect((screen.getByRole("textbox") as HTMLInputElement).disabled).toBe(
      false,
    );
    await act(async () => {
      await capture.props.onFinish({});
    });
    expect(onFinish).toHaveBeenCalledTimes(2);
    expect(onState.mock.calls).toEqual([[true], [false], [true], [false]]);
  },
);

test("Form disables during an async submission and prevents a second submission", async () => {
  let finish!: () => void;
  const onFinish = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  render(
    <FormWrapper onFinish={onFinish}>
      <Input />
    </FormWrapper>,
  );
  let pending!: Promise<void>;
  act(() => {
    pending = capture.props.onFinish({});
  });
  expect((screen.getByRole("textbox") as HTMLInputElement).disabled).toBe(true);
  await act(async () => {
    await capture.props.onFinish({});
  });
  expect(onFinish).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish();
    await pending;
  });
  expect((screen.getByRole("textbox") as HTMLInputElement).disabled).toBe(
    false,
  );
});

test("Form keeps explicit disabled after a successful submission", async () => {
  render(
    <FormWrapper disabled onFinish={async () => undefined}>
      <Input />
    </FormWrapper>,
  );
  await act(async () => {
    await capture.props.onFinish({});
  });
  expect((screen.getByRole("textbox") as HTMLInputElement).disabled).toBe(true);
});

test("validateFields rejects real required-field errors and resolves valid values", async () => {
  const ref = React.createRef<FormRefActions>();
  render(
    <FormWrapper ref={ref}>
      <Form.Item name="name" rules={[{ required: true, message: "required" }]}>
        <Input />
      </Form.Item>
    </FormWrapper>,
  );
  await act(async () => {
    await expect(ref.current!.validateFields()).rejects.toMatchObject({
      errorFields: [{ name: ["name"], errors: ["required"] }],
    });
  });
  act(() => {
    ref.current!.setFieldsValue({ name: "valid" });
  });
  await act(async () => {
    await expect(ref.current!.validateFields()).resolves.toEqual({
      name: "valid",
    });
  });
});

test("invalid Form submit never calls business onFinish", async () => {
  const onFinish = vi.fn();
  render(
    <FormWrapper onFinish={onFinish}>
      <Form.Item name="name" rules={[{ required: true, message: "required" }]}>
        <Input />
      </Form.Item>
      <Button htmlType="submit">Save</Button>
    </FormWrapper>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(await screen.findByText("required")).toBeTruthy();
  expect(onFinish).not.toHaveBeenCalled();
});

test("same-tick duplicate submissions are guarded before React rerenders", async () => {
  let finish!: () => void;
  const onFinish = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  render(
    <FormWrapper onFinish={onFinish}>
      <Input />
    </FormWrapper>,
  );
  const handler = capture.props.onFinish;
  let pending!: Promise<void>;
  act(() => {
    pending = handler({});
    void handler({});
  });
  expect(onFinish).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish();
    await pending;
  });
});

test("concurrent submissions keep submitting true until all finish", async () => {
  const complete: (() => void)[] = [];
  const onState = vi.fn();
  const onFinish = vi.fn(
    () => new Promise<void>((resolve) => complete.push(resolve)),
  );
  render(
    <FormWrapper
      autoDisableWhileSubmitting={false}
      onFinish={onFinish}
      onIsSubmittingChange={onState}
    >
      <Input />
    </FormWrapper>,
  );
  let first!: Promise<void>, second!: Promise<void>;
  act(() => {
    first = capture.props.onFinish({});
    second = capture.props.onFinish({});
  });
  expect(onFinish).toHaveBeenCalledTimes(2);
  await act(async () => {
    complete[0]();
    await first;
  });
  expect(onState.mock.calls).toEqual([[true]]);
  await act(async () => {
    complete[1]();
    await second;
  });
  expect(onState.mock.calls).toEqual([[true], [false]]);
});

test("exact-length FormItem rule blocks invalid values", async () => {
  const ref = React.createRef<FormRefActions>();
  render(
    <FormWrapper ref={ref} initialValues={{ code: "AB" }}>
      <FormItemWrapper
        name="code"
        label="Code"
        rules={[{ ruleType: "len", length: 3, message: "Exactly 3" }]}
      >
        <Input />
      </FormItemWrapper>
    </FormWrapper>,
  );
  await act(async () => {
    await expect(ref.current!.validateFields()).rejects.toMatchObject({
      errorFields: [{ errors: ["Exactly 3"] }],
    });
  });
  act(() => {
    ref.current!.setFieldsValue({ code: "ABC" });
  });
  await act(async () => {
    await expect(ref.current!.validateFields()).resolves.toEqual({
      code: "ABC",
    });
  });
});

test("FormItem owns required marks, whitespace errors and the label tooltip", async () => {
  const onFinish = vi.fn();
  const view = render(
    <FormWrapper onFinish={onFinish} initialValues={{ name: "   " }}>
      <FormItemWrapper
        name="name"
        label="Audience"
        tooltip={<span>Use the business audience name</span>}
        rules={[
          { ruleType: "required", message: "Enter a name" },
          { ruleType: "whitespace", message: "Enter a name" },
        ]}
      >
        <Input />
      </FormItemWrapper>
      <Button htmlType="submit">Save</Button>
    </FormWrapper>,
  );
  const label = view.container.querySelector("label")!;
  expect(label.classList.contains("ant-form-item-required")).toBe(true);
  expect(label.textContent).toBe("Audience");
  const help = label.querySelector(".ant-form-item-tooltip")!;
  expect(help).toBeTruthy();
  fireEvent.mouseEnter(help);
  expect((await screen.findByRole("tooltip")).textContent).toBe(
    "Use the business audience name",
  );
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(await screen.findByText("Enter a name")).toBeTruthy();
  expect(onFinish).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Audience A" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await vi.waitFor(() => expect(onFinish).toHaveBeenCalledWith({ name: "Audience A" }));
  view.rerender(
    <FormWrapper>
      <FormItemWrapper name="name" label="Audience" tooltip="">
        <Input />
      </FormItemWrapper>
    </FormWrapper>,
  );
  expect(view.container.querySelector(".ant-form-item-tooltip")).toBeNull();
});

test("simplified SchemaForm forwards field tooltip to the native label", async () => {
  const view = render(
    <SchemaForm
      mode="simplified"
      formItems={[{ name: "name", label: "Audience", tooltip: "Audience help" }]}
    />,
  );
  const help = view.container.querySelector("label .ant-form-item-tooltip")!;
  expect(help).toBeTruthy();
  fireEvent.mouseEnter(help);
  expect((await screen.findByRole("tooltip")).textContent).toBe("Audience help");
});

test("external footer submits through the Form ref and native validation", async () => {
  const ref = React.createRef<FormRefActions>();
  const onFinish = vi.fn();
  render(
    <SchemaForm ref={ref} mode="advanced" onFinish={onFinish} initialValues={{ name: "" }}>
      <FormItemWrapper name="name" label="Audience" rules={[{ ruleType: "required", message: "Enter a name" }]}>
        <Input />
      </FormItemWrapper>
    </SchemaForm>,
  );
  act(() => ref.current!.submit());
  expect(await screen.findByText("Enter a name")).toBeTruthy();
  expect(onFinish).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Audience A" } });
  act(() => ref.current!.submit());
  await vi.waitFor(() => expect(onFinish).toHaveBeenCalledExactlyOnceWith({ name: "Audience A" }));
});
