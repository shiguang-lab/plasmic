import promptForMetadata from "@/wab/client/components/modals/ComponentMetadataModal";
import { confirm, reactPrompt } from "@/wab/client/components/quick-modals";
import { setLanguagePreference } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import { ensure } from "@/wab/shared/common";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { act, fireEvent, screen } from "@testing-library/react";
import React from "react";

vi.mock("@/wab/client/components/widgets/Modal", () => ({
  Modal: ({
    title,
    children,
  }: {
    title: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <div role="dialog">
      {title}
      {children}
    </div>
  ),
}));
vi.mock("@/wab/client/components/widgets/Button", () => ({
  default: ({
    children,
    onClick,
    htmlType,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    htmlType?: "submit";
  }) => (
    <button type={htmlType ?? "button"} onClick={onClick}>
      {children}
    </button>
  ),
}));
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
