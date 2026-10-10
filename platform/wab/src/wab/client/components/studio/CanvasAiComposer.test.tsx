import { AntdConfigProvider } from "@/wab/client/antd-theme";
import { CanvasAiComposer } from "@/wab/client/components/studio/CanvasAiComposer";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { mock } from "vitest-mock-extended";

afterEach(cleanup);
it("keeps a local draft but never submits to the unimplemented AI dialog", () => {
  const ctx = mock<StudioCtx>();
  ctx.canEditProject.mockReturnValue(true);
  ctx.focusedViewCtx.mockReturnValue(undefined);
  render(
    <AntdConfigProvider productUI>
      <CanvasAiComposer studioCtx={ctx} />
    </AntdConfigProvider>,
  );
  expect(screen.getByText("Current canvas")).toBeTruthy();
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "Update the table" } });
  expect((input as HTMLInputElement).value).toBe("Update the table");
  expect(
    screen
      .getByRole("button", { name: "Send AI request" })
      .hasAttribute("disabled"),
  ).toBe(true);
  expect(
    screen
      .getByRole("button", { name: "Add AI context" })
      .hasAttribute("disabled"),
  ).toBe(true);
  expect(
    document.getElementById(input.getAttribute("aria-describedby") || "")
      ?.textContent,
  ).toBe("AI editing is not available in this build.");
});
it("does not expose editing controls to read-only users", () => {
  const ctx = mock<StudioCtx>();
  ctx.canEditProject.mockReturnValue(false);
  render(
    <AntdConfigProvider productUI>
      <CanvasAiComposer studioCtx={ctx} />
    </AntdConfigProvider>,
  );
  expect(screen.queryByRole("group", { name: "AI canvas editing" })).toBeNull();
});
