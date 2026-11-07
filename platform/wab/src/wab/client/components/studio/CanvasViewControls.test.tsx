import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { CanvasContentEditorIndex, type CanvasContentEditor, type ContentEditorTarget } from "@/wab/client/studio-ctx/canvas-content-editor";
import { StudioRenderPolicy } from "@/wab/client/studio-ctx/studio-render-policy";
import { AntdConfigProvider } from "@/wab/client/antd-theme";
import { createStudioSelectionFixture } from "@/wab/client/__testonly__/studio-selection";
import { CanvasViewControls } from "@/wab/client/components/studio/CanvasViewControls";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { getArenaFrames, mkArenaFrame, type AnyArena } from "@/wab/shared/Arenas";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { StudioArenaState } from "@/wab/client/studio-ctx/studio-arena-state";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { ensure } from "@/wab/shared/common";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite, getDedicatedArena } from "@/wab/shared/core/sites";
import { Arena, type Site } from "@/wab/shared/model/classes";
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
const disposals = new Set<() => void>();
const recorded = new WeakMap<StudioCtx, ChangeRecorder>();
afterEach(() => { cleanup(); for (const dispose of disposals) { dispose(); } disposals.clear(); });

function scene(count = 1) {
  const site = createSite();
  const component = new TplMgr({ site }).addComponent({ name: "Canvas", type: ComponentType.Plain });
  const frames = Array.from({ length: count }, (_, index) => mkArenaFrame({ site, component, name: `Canvas ${index}`, width: 100, height: 100 }));
  const arena = new Arena({ name: "Pages", children: frames });
  site.arenas.push(arena);
  return { site, arena, frames };
}

// Existing command mock fixture with a real native arena owner, not an actual StudioCtx.
function createContext(input: { site: Site; arena: AnyArena } = scene()) {
  const ctx = mock<StudioCtx>();
  const modelSnapshots = new ModelSnapshots();
  const contentEditors = new CanvasContentEditorIndex(() => ctx.viewCtxs);
  Object.defineProperty(ctx, "activeContentEditorStore", { value: contentEditors.store, configurable: true });
  disposals.add(() => contentEditors.dispose());
  const arenaState = new StudioArenaState({ site: input.site, modelSnapshots });
  arenaState.setCurrent(input.arena);
  const renderPolicy = new StudioRenderPolicy({ isLive: () => false, isDragging: () => false });
  const recorder = new ChangeRecorder({ inst: input.site, _instUtil: instUtil });
  recorded.set(ctx, recorder);
  Object.defineProperties(ctx, Object.getOwnPropertyDescriptors(createStudioSelectionFixture()));
  Object.defineProperties(ctx, { arenaState: { value: arenaState }, modelSnapshots: { value: modelSnapshots }, site: { value: input.site }, renderPolicy: { value: renderPolicy } });
  disposals.add(() => { recorder.dispose(); renderPolicy.dispose(); arenaState.dispose(); modelSnapshots.dispose(); });
  return ctx;
}
function commitArena(ctx: StudioCtx, command: () => void) {
  const changes = ensure(recorded.get(ctx), "Arena fixture recorder").withRecording(command).changes;
  ctx.arenaState.deferPublication(() => ctx.modelSnapshots.sync(changes, () => ctx.arenaState.prepareModelCommit(changes)));
}

it("toggles canvas interaction and reflects changes from other entry points", async () => {
  const state = observable({ focused: true });
  const ctx = createContext();
  Object.defineProperties(ctx, {
    viewCtxs: { value: [] },
    focusedMode: { get: () => state.focused },
    isInteractiveMode: {
      get: () => ctx.renderPolicy.interactive,
      set: (value: boolean) => {
        ctx.renderPolicy.interactive = value;
        ctx.renderPolicy.prepareInputs();
        ctx.renderPolicy.publishCommit();
      },
    },
  });
  ctx.change.mockImplementation(async (fn) => runInAction(fn));
  ctx.toggleInteractiveMode.mockImplementation(() => {
    ctx.isInteractiveMode = !ctx.isInteractiveMode;
  });
  render(
    <AntdConfigProvider productUI>
      <CanvasViewControls studioCtx={ctx} />
    </AntdConfigProvider>,
  );
  const toggle = screen.getByRole("button", { name: "Interactive" });
  expect(toggle.textContent).toBe("");
  expect(toggle.getAttribute("aria-pressed")).toBe("false");
  await act(async () => fireEvent.click(toggle));
  expect(ctx.isInteractiveMode).toBe(true);
  expect(toggle.getAttribute("aria-pressed")).toBe("true");
  await act(async () => fireEvent.click(toggle));
  expect(ctx.isInteractiveMode).toBe(false);
  expect(ctx.change).toHaveBeenCalledTimes(2);

  await act(() => { ctx.isInteractiveMode = true; });
  expect(toggle.getAttribute("aria-pressed")).toBe("true");
  expect(ctx.refreshFocusedFrameArena).not.toHaveBeenCalled();
  expect(ctx.toggleFocusedMode).not.toHaveBeenCalled();

  await act(() => runInAction(() => { state.focused = false; }));
  expect(screen.getByRole("button", { name: "Interactive" })).toBe(toggle);
  await act(async () => fireEvent.click(toggle));
  expect(ctx.isInteractiveMode).toBe(false);
  expect(ctx.toggleInteractiveMode).toHaveBeenCalledTimes(3);
});

it("keeps canvas interaction visible and disabled while the editor is loading", () => {
  render(<AntdConfigProvider productUI><CanvasViewControls /></AntdConfigProvider>);
  expect(screen.getByRole("button", { name: "Interactive" }).hasAttribute("disabled")).toBe(true);
});

it("keeps canvas interaction visible and disabled in an empty artboard group", () => {
  const ctx = createContext(scene(0));
  Object.defineProperty(ctx, "viewCtxs", { value: [] });
  render(<AntdConfigProvider productUI><CanvasViewControls studioCtx={ctx} /></AntdConfigProvider>);
  const toggle = screen.getByRole("button", { name: "Interactive" });
  expect(toggle.hasAttribute("disabled")).toBe(true);
  fireEvent.click(toggle);
  expect(ctx.toggleInteractiveMode).not.toHaveBeenCalled();
});

it("locates the current artboard repeatedly without toggling modes or selection", async () => {
  const state = observable({ focused: false });
  const input = scene();
  const ctx = createContext(input);
  Object.defineProperty(ctx, "viewCtxs", { value: [] });
  const frame = ensure(input.frames[0], "First canvas");
  Object.defineProperties(ctx, {
    canvasFocusActive: { get: () => state.focused },
    focusedMode: { get: () => state.focused },
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
  await act(() => commitArena(ctx, () => { input.arena.children.splice(0); }));
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
  const site = createSite();
  const page = new TplMgr({ site }).addComponent({
    name: "Customers",
    type: ComponentType.Page,
  });
  const arena = ensure(getDedicatedArena(site, page), "Page arena");
  const ctx = createContext({ site, arena });
  Object.defineProperty(ctx, "viewCtxs", { value: [] });
  Object.defineProperties(ctx, {
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
  const input = scene(2);
  const ctx = createContext(input);
  Object.defineProperty(ctx, "viewCtxs", { value: [] });
  const active = ensure(input.frames[1], "Active canvas");
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
  const ctx = createContext();
  const locate = vi.fn();
  const view = mock<ViewCtx>(), editor = mock<CanvasContentEditor>();
  Object.defineProperties(editor, { target: { value: mock<ContentEditorTarget>() }, viewCtx: { value: view } });
  editor.locate.mockImplementation(locate);
  Object.defineProperty(view, "contentEditor", { value: editor });
  const index = new CanvasContentEditorIndex(() => [view]); index.sync();
  Object.defineProperties(ctx, { viewCtxs: { value: [view] }, activeContentEditorStore: { value: index.store, configurable: true } });
  disposals.add(() => index.dispose());
  render(<AntdConfigProvider productUI><CanvasViewControls studioCtx={ctx} /></AntdConfigProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Locate current canvas" }));
  expect(locate).toHaveBeenCalledWith();
  fireEvent.click(screen.getByRole("button", { name: "Zoom to fit all" }));
  expect(locate).toHaveBeenLastCalledWith(true);
  expect(ctx.returnToCanvasOverview).not.toHaveBeenCalled();
  expect(ctx.tryZoomToFitArena).not.toHaveBeenCalled();
});

it("toggles the full page height view and reflects its pressed state", async () => {
  const ctx = createContext();
  Object.defineProperties(ctx, {
    viewCtxs: { value: [] },
    fullPageHeight: { get: () => ctx.renderPolicy.fullPageHeight },
  });
  ctx.toggleFullPageHeight.mockImplementation(() => {
    ctx.renderPolicy.toggleFullPageHeight();
    ctx.renderPolicy.prepareInputs();
    ctx.renderPolicy.publishCommit();
  });
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
