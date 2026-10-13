import promptForMetadata from "@/wab/client/components/modals/ComponentMetadataModal";
import {
  alert,
  confirm,
  hardConfirm,
  reactPrompt,
} from "@/wab/client/components/quick-modals";
import { setLanguagePreference } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import { ensure } from "@/wab/shared/common";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import "@testing-library/jest-dom/vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import React from "react";

vi.mock("@/wab/client/components/widgets/Textbox", () => ({
  default: ({
    styleType: _styleType,
    ...props
  }: React.ComponentProps<"input"> & { styleType?: string[] }) => (
    <input {...props} />
  ),
}));

afterEach(() => {
  act(() => setLanguagePreference("en"));
});

it("updates default buttons in an independently mounted confirmation when the language changes", async () => {
  let result: Promise<boolean | undefined> | undefined;
  act(() => {
    result = confirm({
      title: <UiText message="Confirm deletion" />,
      message: "MyComponent",
    });
  });
  expect(screen.getByRole("button", { name: "Confirm" })).toBeTruthy();
  act(() => setLanguagePreference("zh-CN"));
  expect(screen.getByText("确认删除")).toBeTruthy();
  expect(screen.getByText("MyComponent")).toBeTruthy();
  expect(screen.getByRole("button", { name: "确认" })).toBeTruthy();
  act(() => {
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
  });
  await expect(
    ensure(result, "The prompt must be open"),
  ).resolves.toBeUndefined();
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("localizes destructive action captions without changing the confirmation result", async () => {
  act(() => setLanguagePreference("ja"));
  let result: Promise<boolean | undefined> | undefined;
  act(() => {
    result = confirm({ message: "MyToken", confirmLabel: "Delete" });
  });
  act(() => {
    fireEvent.click(screen.getByRole("button", { name: "削除" }));
  });
  await expect(ensure(result, "The prompt must be open")).resolves.toBe(true);
});

it("updates the prompt submit caption and preserves literal input values", async () => {
  const literal = "MyProp{count}$&";
  let result: Promise<string | undefined> | undefined;
  act(() => {
    result = reactPrompt({
      message: <UiText message="Prop name" />,
      defaultValue: literal,
    });
  });
  act(() => setLanguagePreference("zh-CN"));
  expect(screen.getByRole("textbox").getAttribute("value")).toBe(literal);
  act(() => {
    fireEvent.click(screen.getByRole("button", { name: "提交" }));
  });
  await expect(ensure(result, "The prompt must be open")).resolves.toBe(
    literal,
  );
});

it("updates metadata field placeholders without translating the component name", async () => {
  const name = "MyComponent{count}$&";
  const component = mkComponent({
    name,
    type: ComponentType.Plain,
    tplTree: (baseVariant) => mkTplTagX("div", { baseVariant }),
  });
  let result: Promise<{ key: string; value: string } | undefined> | undefined;
  act(() => {
    result = promptForMetadata(component);
  });
  expect(screen.getByPlaceholderText("Metadata key")).toBeTruthy();
  act(() => setLanguagePreference("zh-CN"));
  expect(screen.getByPlaceholderText("元数据键")).toBeTruthy();
  expect(screen.getByPlaceholderText("元数据值")).toBeTruthy();
  expect(screen.getByText(`“${name}”的新元数据键：`)).toBeTruthy();
  act(() => {
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
  });
  await expect(
    ensure(result, "The metadata prompt must be open"),
  ).resolves.toBeUndefined();
});

it("validates a creation name before submitting from the dialog footer", async () => {
  let result: Promise<string | undefined> | undefined;
  act(() => {
    result = reactPrompt({
      title: <UiText message="New organization" />,
      message: <UiText message="Name" />,
      actionText: <UiText message="Create" />,
      rules: [{ required: true, whitespace: true, message: "Required" }],
    });
  });
  expect(
    screen.getByRole("dialog").getAttribute("aria-labelledby"),
  ).toBeTruthy();
  expect(screen.getByText("New organization")).toBeTruthy();
  const input = screen.getByRole("textbox", { name: "Name" });
  fireEvent.change(input, { target: { value: "   " } });
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  await waitFor(() => expect(screen.getByText("Required")).toBeTruthy());
  expect(screen.getByRole("dialog")).toBeTruthy();
  fireEvent.change(input, { target: { value: "Design Team" } });
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  await expect(
    ensure(result, "The creation prompt must be open"),
  ).resolves.toBe("Design Team");
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("cancels a creation prompt with its close button", async () => {
  let result: Promise<string | undefined> | undefined;
  act(() => {
    result = reactPrompt({ title: "New organization", message: "Name" });
  });
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  await expect(
    ensure(result, "The creation prompt must be open"),
  ).resolves.toBeUndefined();
  expect(screen.queryByRole("dialog")).toBeNull();
});

function expectNativeFooter(button: HTMLElement) {
  const footer = ensure(
    button.closest(".ant-modal-footer"),
    "Expected native modal footer",
  );
  expect(button).toHaveClass("ant-btn");
  expect(getComputedStyle(footer).textAlign).toBe("end");
}

it("uses the native right-aligned footer and danger button for confirmations", async () => {
  let result: Promise<boolean | undefined> | undefined;
  act(() => {
    result = confirm({ message: "Delete this item?", danger: true });
  });
  const confirmButton = screen.getByRole("button", { name: "Confirm" });
  expectNativeFooter(confirmButton);
  expectNativeFooter(screen.getByRole("button", { name: "Cancel" }));
  expect(confirmButton).toHaveClass("ant-btn-dangerous");
  fireEvent.click(confirmButton);
  await expect(ensure(result, "Expected confirmation")).resolves.toBe(true);
});

it("renders only the native OK action for alerts", async () => {
  let result: Promise<boolean | undefined> | undefined;
  act(() => {
    result = alert({ message: "Saved" });
  });
  const ok = screen.getByRole("button", { name: "OK" });
  expectNativeFooter(ok);
  expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
  fireEvent.click(ok);
  await expect(ensure(result, "Expected alert")).resolves.toBe(true);
});

it("enables the native hard-confirm action only for the exact confirmation text", async () => {
  let result: Promise<boolean | undefined> | undefined;
  act(() => {
    result = hardConfirm({ message: "Type DELETE", mustType: "DELETE" });
  });
  const confirmButton = screen.getByRole("button", { name: "Confirm" });
  expectNativeFooter(confirmButton);
  expect(confirmButton).toBeDisabled();
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "DELETE" } });
  expect(confirmButton).toBeEnabled();
  fireEvent.change(input, { target: { value: "DELETE " } });
  expect(confirmButton).toBeDisabled();
  fireEvent.submit(ensure(input.closest("form"), "Expected confirmation form"));
  await act(async () => {
    await Promise.resolve();
  });
  expect(screen.getByRole("dialog")).toBeTruthy();
  fireEvent.change(input, { target: { value: "DELETE" } });
  fireEvent.click(confirmButton);
  await expect(ensure(result, "Expected confirmation")).resolves.toBe(true);
});

it("submits metadata fields from the native footer", async () => {
  const component = mkComponent({
    name: "Example",
    type: ComponentType.Plain,
    tplTree: (baseVariant) => mkTplTagX("div", { baseVariant }),
  });
  let result: Promise<{ key: string; value: string } | undefined> | undefined;
  act(() => {
    result = promptForMetadata(component);
  });
  fireEvent.change(screen.getByPlaceholderText("Metadata key"), {
    target: { value: " test " },
  });
  fireEvent.change(screen.getByPlaceholderText("Metadata value"), {
    target: { value: " value " },
  });
  const confirmButton = screen.getByRole("button", { name: "Confirm" });
  expectNativeFooter(confirmButton);
  fireEvent.click(confirmButton);
  await expect(ensure(result, "Expected metadata prompt")).resolves.toEqual({
    key: "test",
    value: "value",
  });
});
