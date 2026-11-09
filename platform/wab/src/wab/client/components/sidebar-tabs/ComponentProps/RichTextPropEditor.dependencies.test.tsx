import { RichTextPropEditor } from "@/wab/client/components/sidebar-tabs/ComponentProps/RichTextPropEditor";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";

vi.mock("@/wab/client/components/widgets", () => ({ Spinner: () => null }));
vi.mock("@/wab/commons/components/OnClickAway", () => ({ OnClickAway: ({ children }: any) => children }));
vi.mock("@/wab/client/components/RichTextEditor", () => ({ default: ({ value, onChange }: any) => <textarea value={value} onChange={(event) => onChange(event.target.value)} /> }));
beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); });

it("accepts external content while a save is pending and later saves to the current callback", async () => {
  const first = vi.fn(), second = vi.fn();
  const view = render(<RichTextPropEditor value="Initial" onChange={first} />);
  await act(async () => { await vi.dynamicImportSettled(); });
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Stale draft" } });
  view.rerender(<RichTextPropEditor value="External update" onChange={second} />);
  expect(screen.getByRole("textbox")).toHaveProperty("value", "External update");
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(first).not.toHaveBeenCalled();
  expect(second).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Current edit" } });
  await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
  expect(second).toHaveBeenCalledExactlyOnceWith("Current edit");
});
