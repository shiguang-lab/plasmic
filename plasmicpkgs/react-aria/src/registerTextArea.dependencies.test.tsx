// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { BaseTextArea } from "./registerTextArea";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("resizes existing content when autoResize is enabled without repeating measurement on unrelated props", () => {
  const measure = vi.spyOn(HTMLTextAreaElement.prototype, "scrollHeight", "get").mockReturnValue(80);
  const field = (autoResize: boolean, className = "first") => <BaseTextArea aria-label="Notes" value="Existing content" autoResize={autoResize} className={className} />;
  const view = render(field(false));
  const input = screen.getByRole("textbox") as HTMLTextAreaElement;
  expect(input.style.height).toBe("");
  view.rerender(field(true));
  expect(input.style.height).toBe("80px");
  measure.mockClear();
  view.rerender(field(true, "second"));
  expect(measure).not.toHaveBeenCalled();
});
