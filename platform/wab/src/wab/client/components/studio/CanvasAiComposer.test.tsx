import { AntdConfigProvider } from "@/wab/client/antd-theme";
import { CanvasAiComposer } from "@/wab/client/components/studio/CanvasAiComposer";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import type { ArenaFrame, Component } from "@/wab/shared/model/classes";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { mock } from "vitest-mock-extended";

afterEach(cleanup);
it("opens the Web assistant with a pinned scope and does not submit an IME composition", () => {
  const ctx = mock<StudioCtx>();
  const view = mock<ViewCtx>();
  const openCopilotChat = vi.fn(async () => {});
  Object.defineProperties(ctx, {
    appCtx: { value: { appConfig: { enableLocalAiEditing: true }, topFrameApi: { openCopilotChat } } },
    siteInfo: { value: { id: "project" } },
    aiSessionId: { value: "session" },
  });
  ctx._changeCounter = 4;
  ctx.canEditProject.mockReturnValue(true);
  ctx.dbCtx.mockReturnValue(mock<ReturnType<StudioCtx["dbCtx"]>>());
  view.currentComponent.mockReturnValue(mock<Component>({ uuid: "page" }));
  view.arenaFrame.mockReturnValue(mock<ArenaFrame>({ uuid: "frame" }));
  view.focusedTpls.mockReturnValue([]);
  ctx.focusedViewCtx.mockReturnValue(view);
  render(<AntdConfigProvider productUI><CanvasAiComposer studioCtx={ctx} /></AntdConfigProvider>);
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "Change padding" } });
  fireEvent.keyDown(input, { key: "Enter", keyCode: 13, isComposing: true });
  expect(openCopilotChat).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Send AI request" }));
  expect(openCopilotChat).toHaveBeenCalledWith({ prompt: "Change padding", mode: undefined,
    localEditBinding: { projectId: "project", branchId: null, sessionId: "session", changeCounter: 4, componentUuid: "page", frameUuid: "frame", elementUuids: [] } });
});
it("keeps a draft while local AI editing is disabled", () => {
  const ctx = mock<StudioCtx>();
  ctx.canEditProject.mockReturnValue(true);
  ctx.focusedViewCtx.mockReturnValue(undefined);
  Object.defineProperty(ctx, "appCtx", { value: { appConfig: { enableLocalAiEditing: false } } });
  render(
    <AntdConfigProvider productUI>
      <CanvasAiComposer studioCtx={ctx} />
    </AntdConfigProvider>,
  );
  expect(screen.getByText("Current page")).toBeTruthy();
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
      .getByRole("button", { name: "Open AI assistant" })
      .hasAttribute("disabled"),
  ).toBe(true);
  expect(
    document.getElementById(input.getAttribute("aria-describedby") || "")
      ?.textContent,
  ).toBe("Local AI editing is disabled.");
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
