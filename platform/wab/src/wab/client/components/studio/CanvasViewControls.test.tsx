import { AntdConfigProvider } from "@/wab/client/antd-theme";
import { CanvasViewControls } from "@/wab/client/components/studio/CanvasViewControls";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { getArenaFrames } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite, getDedicatedArena } from "@/wab/shared/core/sites";
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
it("locates the current artboard repeatedly without toggling modes or selection", async () => {
  const state = observable({ focused: false, empty: false });
  const ctx = mock<StudioCtx>();
  Object.defineProperty(ctx, "viewCtxs", { value: [] });
  const frame = mock<ArenaFrame>();
  const arena = new Arena({ name: "Pages", children: [frame] });
  Object.defineProperties(ctx, {
    currentArena: { value: arena },
    canvasFocusActive: { get: () => state.focused },
    focusedMode: { get: () => state.focused },
    currentArenaEmpty: { get: () => state.empty },
  });
  render(
    <AntdConfigProvider productUI>
      <CanvasViewControls studioCtx={ctx} />
    </AntdConfigProvider>,
  );
  const locate = screen.getByRole("button", { name: "Locate current canvas" });
  expect(locate.textContent).toBe("");
  fireEvent.click(locate);
  expect(ctx.tryZoomToFitFrame).toHaveBeenCalledWith(frame, 1);
  await act(() =>
    runInAction(() => {
      state.focused = true;
    }),
  );
  fireEvent.click(locate);
  expect(ctx.tryZoomToFitFrame).toHaveBeenCalledTimes(2);
  expect(locate.hasAttribute("aria-pressed")).toBe(false);
  expect(
    screen.queryByRole("button", { name: "Return to overview" }),
  ).toBeNull();
  expect(ctx.returnToCanvasOverview).not.toHaveBeenCalled();
  expect(ctx.focusCanvasFrame).not.toHaveBeenCalled();
  expect(ctx.toggleFocusedMode).not.toHaveBeenCalled();
  expect(ctx.setStudioFocusOnFrame).not.toHaveBeenCalled();
  expect(ctx.togglePanels).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: /Zoom in|Zoom out/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Zoom to fit all" }));
  expect(ctx.returnToCanvasOverview).toHaveBeenCalledTimes(1);
  expect(ctx.turnFocusedModeOff).toHaveBeenCalledTimes(1);
  expect(ctx.tryZoomToFitArena).toHaveBeenCalledTimes(1);
  await act(() =>
    runInAction(() => {
      state.empty = true;
    }),
  );
  expect(
    screen
      .getByRole("button", { name: "Locate current canvas" })
      .hasAttribute("disabled"),
  ).toBe(true);
  expect(
    screen
      .getByRole("button", { name: "Zoom to fit all" })
      .hasAttribute("disabled"),
  ).toBe(true);
});

it("locates a standalone page without changing its focus mode", () => {
  const ctx = mock<StudioCtx>();
  Object.defineProperty(ctx, "viewCtxs", { value: [] });
  const site = createSite();
  const page = new TplMgr({ site }).addComponent({
    name: "Customers",
    type: ComponentType.Page,
  });
  const arena = getDedicatedArena(site, page);
  Object.defineProperties(ctx, {
    currentArena: { value: arena },
    currentArenaEmpty: { value: false },
    focusedMode: { value: false },
    canvasFocusActive: { value: false },
  });
  render(
    <AntdConfigProvider productUI>
      <CanvasViewControls studioCtx={ctx} />
    </AntdConfigProvider>,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Locate current canvas" }),
  );
  expect(ctx.tryZoomToFitFrame).toHaveBeenCalledWith(
    getArenaFrames(arena)[0],
    1,
  );
  expect(ctx.toggleFocusedMode).not.toHaveBeenCalled();
  expect(ctx.focusCanvasFrame).not.toHaveBeenCalled();
});

it("locates the active canvas instead of the first canvas in the arena", () => {
  const ctx = mock<StudioCtx>();
  Object.defineProperty(ctx, "viewCtxs", { value: [] });
  const first = mock<ArenaFrame>();
  const active = mock<ArenaFrame>();
  Object.defineProperties(ctx, {
    currentArena: {
      value: new Arena({ name: "Pages", children: [first, active] }),
    },
    currentArenaEmpty: { value: false },
  });
  ctx.focusedContentFrame.mockReturnValue(active);
  render(
    <AntdConfigProvider productUI>
      <CanvasViewControls studioCtx={ctx} />
    </AntdConfigProvider>,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Locate current canvas" }),
  );
  expect(ctx.tryZoomToFitFrame).toHaveBeenCalledWith(active, 1);
});

it("uses content navigation without leaving the active editing scope", () => {
  const ctx = mock<StudioCtx>();
  const frame = mock<ArenaFrame>();
  const locate = vi.fn();
  Object.defineProperties(ctx, {
    viewCtxs: { value: [{ contentEditor: { target: {}, locate } }] },
    currentArena: { value: new Arena({ name: "Pages", children: [frame] }) },
    currentArenaEmpty: { value: false },
  });
  render(<AntdConfigProvider productUI><CanvasViewControls studioCtx={ctx} /></AntdConfigProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Locate current canvas" }));
  expect(locate).toHaveBeenCalledWith();
  fireEvent.click(screen.getByRole("button", { name: "Zoom to fit all" }));
  expect(locate).toHaveBeenLastCalledWith(true);
  expect(ctx.returnToCanvasOverview).not.toHaveBeenCalled();
  expect(ctx.tryZoomToFitArena).not.toHaveBeenCalled();
});

it("toggles the full page height view and reflects its pressed state", async () => {
  const state = observable({ full: false });
  const ctx = mock<StudioCtx>();
  const frame = mock<ArenaFrame>();
  Object.defineProperties(ctx, {
    viewCtxs: { value: [] },
    currentArena: { value: new Arena({ name: "Pages", children: [frame] }) },
    currentArenaEmpty: { value: false },
    fullPageHeight: { get: () => state.full },
  });
  ctx.toggleFullPageHeight.mockImplementation(() =>
    runInAction(() => {
      state.full = !state.full;
    }),
  );
  render(
    <AntdConfigProvider productUI>
      <CanvasViewControls studioCtx={ctx} />
    </AntdConfigProvider>,
  );
  const toggle = screen.getByRole("button", { name: "Full page height" });
  expect(toggle.getAttribute("aria-pressed")).toBe("false");
  await act(async () => fireEvent.click(toggle));
  expect(ctx.toggleFullPageHeight).toHaveBeenCalledTimes(1);
  expect(toggle.getAttribute("aria-pressed")).toBe("true");
  // Viewing preferences never touch selection, focus or the camera.
  expect(ctx.tryZoomToFitFrame).not.toHaveBeenCalled();
  expect(ctx.setStudioFocusOnFrame).not.toHaveBeenCalled();
  await act(async () => fireEvent.click(toggle));
  expect(toggle.getAttribute("aria-pressed")).toBe("false");
});
