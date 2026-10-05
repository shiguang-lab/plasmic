import { act, fireEvent, render, screen } from "@testing-library/react";
import { Button, ConfigProvider, Form, Input } from "antd";
import React from "react";
import { expect, test, vi } from "vitest";
import { FormRefActions, FormWrapper } from "../src/form/Form";

import { FormItemWrapper } from "../src/form/FormItem";

const capture = vi.hoisted(() => ({ props: null as any }));
vi.mock("antd", async (importOriginal) => {
  const original = await importOriginal<typeof import("antd")>();
  const React = await import("react");
  const CapturedForm = Object.assign(
    React.forwardRef((props: any, ref: any) => {
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
