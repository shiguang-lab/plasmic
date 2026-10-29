import { CodeEditor } from "@/wab/client/components/sidebar-tabs/ComponentProps/CodeEditor";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";

vi.mock("@/wab/client/components/coding/FullCodeEditor", async () => {
  const React = await import("react");
  return { FullCodeEditor: React.forwardRef(({ defaultValue, templateVariables }: any, ref) => {
    const [value, setValue] = React.useState(defaultValue);
    React.useImperativeHandle(ref, () => ({
      getValue: () => value,
      resetValue: () => setValue(defaultValue),
      insertAtCursor: (token: string) => setValue((current: string) => current + token),
    }));
    return <textarea aria-label="Template" value={value} data-variables={JSON.stringify(templateVariables)} onChange={(e) => setValue(e.target.value)} />;
  }) };
});

afterEach(cleanup);
beforeEach(() => {
  const getComputedStyle = window.getComputedStyle;
  vi.spyOn(window, "getComputedStyle").mockImplementation((element) => getComputedStyle(element));
});

it("inserts the declared variables and saves plain template text", async () => {
  const onChange = vi.fn();
  render(<CodeEditor title="Formatter" value="已输入 " lang="text" templateVariables={["count", "maxLength"]} onChange={onChange} />);
  fireEvent.click(screen.getByText("已输入"));
  const editor = await screen.findByRole("textbox", { name: "Template" });
  expect(editor.getAttribute("data-variables")).toBe('["count","maxLength"]');
  fireEvent.click(screen.getByRole("button", { name: "{count}" }));
  fireEvent.change(editor, { target: { value: (editor as HTMLTextAreaElement).value + " / " } });
  fireEvent.click(screen.getByRole("button", { name: "{maxLength}" }));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(onChange).toHaveBeenCalledExactlyOnceWith("已输入 {count} / {maxLength}");
});

it("cancelling an edit preserves the saved string", async () => {
  const onChange = vi.fn();
  render(<CodeEditor title="Formatter" value="{count}" lang="text" templateVariables={["count"]} onChange={onChange} />);
  fireEvent.click(screen.getByText("{count}"));
  fireEvent.change(await screen.findByRole("textbox", { name: "Template" }), { target: { value: "修改 {count}" } });
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(onChange).not.toHaveBeenCalled();
});
