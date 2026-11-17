import { EditableLabel } from "@/wab/client/components/widgets/EditableLabel/EditableLabel";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";

afterEach(cleanup);

it("keeps editing when the edit callback rejects the value", () => {
  const onEdit = vi.fn(() => false);
  render(<EditableLabel value="Draft" defaultEditing onEdit={onEdit} />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: " Updated " } });
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
  expect(onEdit).toHaveBeenCalledWith("Updated");
  expect(screen.getByRole<HTMLInputElement>("textbox").value).toBe(" Updated ");
});

it("finishes editing when the callback returns void", () => {
  const onEdit = vi.fn();
  render(<EditableLabel value="Draft" defaultEditing onEdit={onEdit} />);
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
  expect(onEdit).toHaveBeenCalledWith("Draft");
  expect(screen.queryByRole("textbox")).toBeNull();
});

it("finishes editing when no callback is provided", () => {
  render(<EditableLabel value="Draft" defaultEditing />);
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
  expect(screen.queryByRole("textbox")).toBeNull();
});
