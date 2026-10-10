import { AntdConfigProvider } from "@/wab/client/antd-theme";
import { CanvasViewControls } from "@/wab/client/components/studio/CanvasViewControls";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { Arena, ArenaFrame } from "@/wab/shared/model/classes";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { observable, runInAction } from "mobx";
import * as React from "react";
import { mock } from "vitest-mock-extended";

vi.mock("@/wab/client/components/top-bar/ZoomButton", () => ({
  ZoomButton: () => <button>Zoom</button>,
}));
afterEach(cleanup);
it("focuses the current artboard and restores overview without hiding panels", () => {
  const state = observable({ focused: false, empty: false });
  const ctx = mock<StudioCtx>();
  const frame = mock<ArenaFrame>();
  const arena = new Arena({ name: "Pages", children: [frame] });
  Object.defineProperties(ctx, {
    currentArena: { value: arena },
    canvasFocusActive: { get: () => state.focused },
    focusedMode: { value: false },
    currentArenaEmpty: { get: () => state.empty },
  });
  ctx.focusCanvasFrame.mockImplementation(() =>
    runInAction(() => {
      state.focused = true;
    }),
  );
  ctx.returnToCanvasOverview.mockImplementation(() =>
    runInAction(() => {
      state.focused = false;
    }),
  );
  render(
    <AntdConfigProvider productUI>
      <CanvasViewControls studioCtx={ctx} />
    </AntdConfigProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Focus canvas" }));
  expect(ctx.focusCanvasFrame).toHaveBeenCalledWith(frame);
  fireEvent.click(screen.getByRole("button", { name: "Return to overview" }));
  expect(ctx.returnToCanvasOverview).toHaveBeenCalledTimes(1);
  expect(ctx.togglePanels).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: /Zoom in|Zoom out/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Zoom to fit all" }));
  expect(ctx.tryZoomToFitArena).toHaveBeenCalledTimes(1);
  act(() =>
    runInAction(() => {
      state.empty = true;
    }),
  );
  expect(
    screen
      .getByRole("button", { name: "Focus canvas" })
      .hasAttribute("disabled"),
  ).toBe(true);
  expect(
    screen
      .getByRole("button", { name: "Zoom to fit all" })
      .hasAttribute("disabled"),
  ).toBe(true);
});
