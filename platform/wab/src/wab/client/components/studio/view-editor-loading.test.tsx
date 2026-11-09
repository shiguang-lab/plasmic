import { AppContext } from "@/wab/client/components/top-view";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { mkMixedArena } from "@/wab/shared/Arenas";
import { createSite } from "@/wab/shared/core/sites";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { PreviewCtx } from "@/wab/client/components/live/PreviewCtx";
import { ViewEditor_ } from "@/wab/client/components/studio/view-editor";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";

vi.mock("@shiguang2/components/esm/scrollbar", () => ({ Scrollbar: ({children}: React.PropsWithChildren) => <div>{children}</div> }));
vi.mock("@/wab/client/components/studio/LeftPane", () => ({ default: () => <aside data-testid="left-sidebar" /> }));
vi.mock("@/wab/client/components/studio/RightPane", () => ({ RightPane: ({canvasLoading}: {canvasLoading: boolean}) => <aside data-testid="right-sidebar" data-loading={String(canvasLoading)} /> }));
vi.mock("@/wab/client/components/studio/TopFrameObserver", () => ({ TopFrameObserver: ({studioReady}: {studioReady: boolean}) => <output data-testid="studio-ready">{String(studioReady)}</output> }));
vi.mock("@/wab/client/components/widgets/StudioLoading", () => ({ StudioLoading: () => <output data-testid="studio-loading" /> }));
vi.mock("@/wab/client/components/insert-panel/ComponentPresetsModal", () => ({ ComponentPresetsModal: () => <output data-testid="component-presets" /> }));
vi.mock("@/wab/client/components/canvas/canvas-arena", () => ({ CanvasArenaShell: ({arena}: {arena: {uid: number}}) => <div data-testid={`arena-${arena.uid}`} /> }));
vi.mock("@/wab/client/components/canvas/CanvasOverlayToolbar", () => ({ CanvasOverlayToolbar: () => null }));
vi.mock("@/wab/client/components/canvas/FreestyleBox", () => ({ FreestyleBox: () => null }));
vi.mock("@/wab/client/components/canvas/HoverBox/CloneBoxes", () => ({ CloneBoxes: () => null }));
vi.mock("@/wab/client/components/canvas/HoverBox/HoverBoxes", () => ({ HoverBoxes: () => null }));
vi.mock("@/wab/client/components/canvas/HoverBox/PreselectBoxes", () => ({ PreselectBoxes: () => null }));
vi.mock("@/wab/client/components/canvas/MeasureTool", () => ({ MeasureTool: () => null }));
vi.mock("@/wab/client/components/canvas/Multiplayer/FollowingPlayer", () => ({ FollowingPlayer: () => null }));
vi.mock("@/wab/client/components/canvas/Multiplayer/PlayerBoxes", () => ({ PlayerBoxes: () => null }));
vi.mock("@/wab/client/components/canvas/Multiplayer/PlayerCursors", () => ({ PlayerCursors: () => null }));
vi.mock("@/wab/client/components/canvas/Spotlight", () => ({ Spotlight: () => null }));
vi.mock("@/wab/client/components/canvas/VariantsBar", () => ({ VariantsBar: () => null }));
vi.mock("@/wab/client/components/canvas/CanvasDndOverlay", () => ({ CanvasDndOverlay: () => null }));
vi.mock("@/wab/client/components/canvas/RichText/RichTextToolbar", () => ({ default: () => null }));
vi.mock("@/wab/client/components/canvas/CanvasContentEditorControls", () => ({ CanvasContentEditorControls: () => null }));
vi.mock("@/wab/client/components/comments/CommentsDialogs", () => ({ CommentsDialogs: () => null }));
vi.mock("@/wab/client/components/studio/CanvasViewControls", () => ({ CanvasViewControls: () => null }));
vi.mock("@/wab/client/components/studio/FocusedModeToolbar/FocusedModeToolbar", () => ({ FocusedModeToolbar: () => null }));
vi.mock("@/wab/client/components/studio/GlobalCssVariables", () => ({ GlobalCssVariables: () => null }));
vi.mock("@/wab/client/components/studio/code-preview/CodePreviewPanel", () => ({ CodePreviewPanel: () => null }));
vi.mock("@/wab/client/components/top-bar/TopBar", () => ({ TopBar: () => null }));
vi.mock("@/wab/client/components/PageSettingsDialog", () => ({ PageSettingsDialog: () => null }));
vi.mock("@/wab/client/components/AutoOpenBanner", () => ({ default: () => null }));
vi.mock("@/wab/client/components/widgets/BrowserAlertBanner", () => ({ BrowserAlertBanner: () => null }));
vi.mock("@/wab/client/components/widgets/plasmic/AlertBanner", () => ({ AlertBanner: () => null }));
vi.mock("@/wab/client/components/BottomModal", () => ({ BottomModals: () => null }));
vi.mock("@/wab/client/components/widgets/FloatingWindow", () => ({ FloatingWindowLayer: ({children}: React.PropsWithChildren) => <>{children}</> }));

function view(studioCtx: StudioCtx) {
  const policy = studioCtx.renderPolicy.store.getState();
  return <AppContext.Provider value={studioCtx.app}><AppCtxContext.Provider value={studioCtx.appCtx}><StudioCtxContext.Provider value={studioCtx}><ViewEditor_ studioCtx={studioCtx} viewCtx={undefined} previewCtx={mock<PreviewCtx>()} canvasLoading={false} renderInteractive={policy.interactive} renderDocs={policy.docs} renderDevMode={policy.devMode} panelsHidden={studioCtx.leftPanelState.panelsHidden} /></StudioCtxContext.Provider></AppCtxContext.Provider></AppContext.Provider>;
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("keeps both sidebar shells mounted while comments toggle without a focused artboard", async () => {
  const {studioCtx} = fakeStudioCtx();
  await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
  vi.spyOn(studioCtx, "showComments").mockReturnValue(true);
  vi.spyOn(studioCtx, "focusedOrFirstViewCtx").mockReturnValue(undefined);
  const mounted = render(view(studioCtx));
  const left = screen.getByTestId("left-sidebar"), right = screen.getByTestId("right-sidebar");
  try {
    expect(right.getAttribute("data-loading")).toBe("false");
    act(() => studioCtx.toggleCommentsPanel()); expect(studioCtx.showCommentsPanel).toBe(true);
    expect(screen.getByTestId("left-sidebar")).toBe(left); expect(screen.getByTestId("right-sidebar")).toBe(right);
    act(() => studioCtx.toggleCommentsPanel()); expect(studioCtx.showCommentsPanel).toBe(false);
    expect(screen.getByTestId("left-sidebar")).toBe(left); expect(screen.getByTestId("right-sidebar")).toBe(right);
  } finally { mounted.unmount(); studioCtx.dispose(); }
});

it("keeps the global mask and top-frame readiness closed until both target render and viewport restoration complete", async () => {
  const {studioCtx} = fakeStudioCtx();
  await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
  const target = vi.spyOn(studioCtx, "activeCanvasReady", "get").mockReturnValue(false);
  studioCtx.startupStore.setState({viewportLoaded: false});
  const mounted = render(view(studioCtx));
  const check = (ready: boolean) => { expect(!!screen.queryByTestId("studio-loading")).toBe(!ready); expect(screen.getByTestId("studio-ready").textContent).toBe(String(ready)); };
  try {
    check(false);
    target.mockReturnValue(true); mounted.rerender(view(studioCtx)); check(false);
    act(() => studioCtx.startupStore.setState({viewportLoaded: true})); check(true);
  } finally { mounted.unmount(); studioCtx.dispose(); }
});

it("refreshes the native drag-guard boundary and detaches it on unmount", async () => {
  const {studioCtx} = fakeStudioCtx(); await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
  const mounted = render(view(studioCtx));
  try {
    expect(document.querySelector(".drag-guard")).toBeNull();
    act(() => studioCtx.setIsDraggingObject(true)); const guard = document.querySelector(".drag-guard"); expect(guard).toBeTruthy();
    act(() => studioCtx.setIsDraggingObject(true)); expect(document.querySelector(".drag-guard")).toBe(guard);
    act(() => studioCtx.setIsDraggingObject(false)); expect(document.querySelector(".drag-guard")).toBeNull();
    mounted.unmount(); act(() => studioCtx.setIsDraggingObject(true)); expect(document.querySelector(".drag-guard")).toBeNull();
  } finally { mounted.unmount(); studioCtx.dispose(); }
});

it("uses native arena ownership and releases its exact readiness subscription on unmount", async () => {
  const site = createSite(), first = mkMixedArena("First"), second = mkMixedArena("Second"); site.arenas.push(first, second);
  const {studioCtx} = fakeStudioCtx({site}); await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true)); studioCtx.currentArena = first;
  const subscribe = studioCtx.subscribeActiveCanvasInputs.bind(studioCtx), released = vi.fn();
  vi.spyOn(studioCtx, "subscribeActiveCanvasInputs").mockImplementation((listener) => { const stop = subscribe(listener); return () => { released(); stop(); }; });
  const mounted = render(view(studioCtx));
  try {
    expect(screen.getByTestId("component-presets")).toBeTruthy();
    act(() => { studioCtx.currentArena = second; });
    expect(studioCtx.currentArena).toBe(second); expect(screen.getByTestId(`arena-${second.uid}`)).toBeTruthy();
    mounted.unmount(); expect(released).toHaveBeenCalledOnce();
    act(() => { studioCtx.currentArena = first; }); expect(screen.queryByTestId("component-presets")).toBeNull(); expect(released).toHaveBeenCalledOnce();
  } finally { mounted.unmount(); studioCtx.dispose(); }
});

it("retires the previous Studio controller and renders only the replacement owner's native stores", async () => {
  const first = fakeStudioCtx().studioCtx, second = fakeStudioCtx().studioCtx;
  await waitFor(() => expect(first.initialRouteReady && second.initialRouteReady).toBe(true));
  const mounted = render(view(first));
  try {
    mounted.rerender(view(second));
    act(() => first.setIsDraggingObject(true));
    expect(document.querySelector(".drag-guard")).toBeNull();
    act(() => second.setIsDraggingObject(true));
    expect(document.querySelector(".drag-guard")).toBeTruthy();
    mounted.unmount();
    expect(document.querySelector(".drag-guard")).toBeNull();
    act(() => { first.setIsDraggingObject(false); second.setIsDraggingObject(false); });
    expect(screen.queryByTestId("left-sidebar")).toBeNull();
  } finally { mounted.unmount(); first.dispose(); second.dispose(); }
});
