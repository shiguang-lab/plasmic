import { RichTextEditor } from "@/wab/client/components/RichTextEditor";
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";

vi.mock("@/wab/client/components/TinyEditor", () => ({
  TinyEditor: (props: { disabled?: boolean; value: string }) => (
    <textarea disabled={props.disabled} value={props.value} readOnly />
  ),
}));
afterEach(cleanup);
it("preserves revision content and uses TinyMCE's supported disabled contract through readonly transitions", () => {
  const props = { value: "<p>Published 中文 revision</p>", onChange: vi.fn() };
  const view = render(<RichTextEditor {...props} readOnly />);
  const field = screen.getByRole("textbox") as HTMLTextAreaElement;
  expect(field.disabled).toBe(true);
  expect(field.value).toBe(props.value);
  view.rerender(<RichTextEditor {...props} readOnly={false} />);
  expect(field.disabled).toBe(false);
  expect(field.value).toBe(props.value);
  view.rerender(<RichTextEditor {...props} readOnly />);
  expect(field.disabled).toBe(true);
  expect(props.onChange).not.toHaveBeenCalled();
});
