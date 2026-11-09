import { mkArenaFrame } from "@/wab/shared/Arenas";
import { mkComponent, ComponentType } from "@/wab/shared/core/components";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { CanvasCtx } from "@/wab/client/components/canvas/canvas-ctx";
import * as Signals from "signals";
import { createStore } from "zustand/vanilla";
import { createStudioUiEnvironmentFixture } from "@/wab/client/__testonly__/studio-ui-environment";
import { mkMixedArena } from "@/wab/shared/Arenas";
import type { BranchId } from "@/wab/shared/ApiSchema";
import { CanvasContentEditorIndex } from "@/wab/client/studio-ctx/canvas-content-editor";
import { StudioOverlayState } from "@/wab/client/studio-ctx/studio-overlay-state";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { StudioArenaState } from "@/wab/client/studio-ctx/studio-arena-state";
import { createSite } from "@/wab/shared/core/sites";
import { StudioSaveState } from "@/wab/client/studio-ctx/save-state";
import { FollowingPlayer } from "@/wab/client/components/canvas/Multiplayer/FollowingPlayer";
import { createStudioModeFixture } from "@/wab/client/__testonly__/studio-mode";
import { PlayerBoxes } from "@/wab/client/components/canvas/Multiplayer/PlayerBoxes";
import { PlayerCursors } from "@/wab/client/components/canvas/Multiplayer/PlayerCursors";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { createViewportFixture } from "@/wab/client/__testonly__/viewport";
import { MultiplayerCtx } from "@/wab/client/studio-ctx/multiplayer-ctx";
import { ServerPlayerInfo } from "@/wab/shared/ApiSchema";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

let studio: StudioCtx;
vi.mock("@/wab/client/contexts/StudioContexts", () => ({
  useStudioCtx: () => studio,
}));
const disposeOwners: (() => void)[] = [];
afterEach(() => { cleanup(); disposeOwners.splice(0).forEach((dispose) => dispose()); });

async function fixture() {
  studio = mock<StudioCtx>({
    editMode: true,
    isLiveMode: false,
    currentArena: null,
  });
  Object.defineProperties(studio, Object.getOwnPropertyDescriptors(createViewportFixture()));
  const environment = createStudioUiEnvironmentFixture();
  Object.assign(studio, environment);
  Object.defineProperties(studio, Object.getOwnPropertyDescriptors(createStudioModeFixture()));
  Object.defineProperty(studio, "saveState", { value: new StudioSaveState() });
  const contentEditors = new CanvasContentEditorIndex(() => []);
  Object.defineProperty(studio, "activeContentEditorStore", { value: contentEditors.store });
  disposeOwners.push(() => contentEditors.dispose());
  const overlayState = new StudioOverlayState();
  Object.defineProperty(studio, "overlayState", { value: overlayState });
  disposeOwners.push(() => overlayState.dispose());
  const models = new ModelSnapshots();
  const site = createSite();
  const arena = new StudioArenaState({ site, modelSnapshots: models });
  Object.defineProperties(studio, { arenaState: { value: arena }, modelSnapshots: { value: models }, site: { value: site }, styleChanged: { value: new Signals.Signal() }, framesChanged: { value: new Signals.Signal() }, canvasContentEditor: { get: () => undefined } });
  disposeOwners.push(() => { arena.dispose(); models.dispose(); });
  const multiplayer = new MultiplayerCtx(studio);
  Object.defineProperty(studio, "multiplayerCtx", { value: multiplayer });
  multiplayer.updateSelfId(1);
  const session: ServerPlayerInfo = {
    type: "AnonUser",
    playerId: 2,
    viewInfo: {
      cursorInfo: { left: 0, top: 0 },
    },
  };
  await multiplayer.updateSessions([session]);
  return { multiplayer, session, site, environment: environment.uiEnvironment.store };
}

it("does not commit selection boxes for cursor-only updates", async () => {
  const { multiplayer, session } = await fixture();
  const commits = vi.fn();
  render(
    <React.Profiler id="selection" onRender={commits}>
      <PlayerBoxes />
    </React.Profiler>,
  );
  commits.mockClear();
  await act(async () => {
    await multiplayer.updateSessions([
      {
        ...session,
        viewInfo: {
          cursorInfo: { left: 100, top: 200 },
          positionInfo: { left: 10, top: 10, width: 800, height: 600 },
        },
      },
    ]);
  });
  expect(commits).not.toHaveBeenCalled();
  await act(async () => {
    await multiplayer.updateSessions([
      {
        ...session,
        viewInfo: {
          ...session.viewInfo,
          selectionInfo: { selectableFrameUuid: "frame" },
        },
      },
    ]);
  });
  expect(commits).toHaveBeenCalledOnce();
});

it("does not commit cursor rows for selection-only updates and responds to cursor changes", async () => {
  const { multiplayer, session } = await fixture();
  const commits = vi.fn();
  render(
    <React.Profiler id="cursors" onRender={commits}>
      <PlayerCursors />
    </React.Profiler>,
  );
  commits.mockClear();
  const view = {
    ...session.viewInfo,
    selectionInfo: { selectableFrameUuid: "frame" },
  };
  await act(async () => {
    await multiplayer.updateSessions([{ ...session, viewInfo: view }]);
  });
  expect(commits).not.toHaveBeenCalled();
  await act(async () => {
    await multiplayer.updateSessions([
      { ...session, viewInfo: { ...view, cursorInfo: { left: 5, top: 5 } } },
    ]);
  });
  expect(commits).toHaveBeenCalledOnce();
});

it("updates the following border for the selected player without committing cursor movement", async () => {
  const { multiplayer, session } = await fixture();
  const commits = vi.fn();
  const view = render(
    <React.Profiler id="following" onRender={commits}>
      <FollowingPlayer studioCtx={studio} />
    </React.Profiler>,
  );
  expect(view.container.querySelector(".canvas-editor__watch-mode")).toBeNull();
  act(() => {
    multiplayer.setFollowedPlayer(2);
  });
  expect(
    view.container.querySelector(".canvas-editor__watch-mode"),
  ).toBeTruthy();
  commits.mockClear();
  await act(async () => {
    await multiplayer.updateSessions([
      { ...session, viewInfo: { cursorInfo: { left: 500, top: 500 } } },
    ]);
  });
  expect(commits).not.toHaveBeenCalled();
  await act(async () => {
    await multiplayer.updateSessions([]);
  });
  expect(view.container.querySelector(".canvas-editor__watch-mode")).toBeNull();
});

it("updates both multiplayer gates from exact editMode while save fences remain quiet", async () => {
  await fixture();
  const boxes = vi.fn(), cursors = vi.fn();
  render(<><React.Profiler id="boxes" onRender={boxes}><PlayerBoxes /></React.Profiler><React.Profiler id="cursors" onRender={cursors}><PlayerCursors /></React.Profiler></>);
  boxes.mockClear(); cursors.mockClear();
  act(() => { studio.saveState.counter++; });
  expect(boxes).not.toHaveBeenCalled(); expect(cursors).not.toHaveBeenCalled();
  act(() => { studio.saveState.deferPublication(() => { studio.saveState.editMode = false; }); });
  expect(boxes).toHaveBeenCalledOnce(); expect(cursors).toHaveBeenCalledOnce();
  boxes.mockClear(); cursors.mockClear();
  act(() => { studio.saveState.deferPublication(() => { studio.saveState.editMode = true; }); });
  expect(boxes).toHaveBeenCalledOnce(); expect(cursors).toHaveBeenCalledOnce();
});


it("updates both multiplayer gates only for their native overlay preference and detaches on unmount", async () => {
  await fixture();
  const boxes = vi.fn(), cursors = vi.fn();
  const mounted = render(<><React.Profiler id="boxes" onRender={boxes}><PlayerBoxes /></React.Profiler><React.Profiler id="cursors" onRender={cursors}><PlayerCursors /></React.Profiler></>);
  boxes.mockClear(); cursors.mockClear();
  act(() => { studio.overlayState.commentsOverlay = false; });
  expect(boxes).not.toHaveBeenCalled(); expect(cursors).not.toHaveBeenCalled();
  act(() => { studio.overlayState.multiplayerSelections = false; });
  expect(boxes).toHaveBeenCalledOnce(); expect(cursors).toHaveBeenCalledOnce();
  boxes.mockClear(); cursors.mockClear();
  act(() => { studio.overlayState.multiplayerSelections = false; });
  expect(boxes).not.toHaveBeenCalled(); expect(cursors).not.toHaveBeenCalled();
  act(() => { studio.overlayState.multiplayerSelections = true; });
  expect(boxes).toHaveBeenCalledOnce(); expect(cursors).toHaveBeenCalledOnce();
  mounted.unmount(); boxes.mockClear(); cursors.mockClear();
  act(() => { studio.overlayState.multiplayerSelections = false; });
  expect(boxes).not.toHaveBeenCalled(); expect(cursors).not.toHaveBeenCalled();
});


it("hides and restores cursor rows when the current branch changes without a player update", async () => {
  const { multiplayer, session, site, environment } = await fixture();
  const arena = mkMixedArena("Canvas");
  site.arenas.push(arena);
  studio.currentArena = arena;
  studio.arenaState.setCurrent(arena);
  vi.mocked(studio.maybeCanvasClipper).mockReturnValue(document.createElement("div"));
  await multiplayer.updateSessions([{ ...session, viewInfo: {
    ...session.viewInfo,
    arenaInfo: { type: "custom", uuidOrName: "Canvas", focused: false },
  } }]);
  const { container } = render(<PlayerCursors />);
  expect(container.querySelector(".PlayerCursor")).toBeTruthy();
  act(() => { environment.setState({ branchId: "other" as BranchId }); });
  expect(container.querySelector(".PlayerCursor")).toBeNull();
  act(() => { environment.setState({ branchId: null }); });
  expect(container.querySelector(".PlayerCursor")).toBeTruthy();
});


it("remeasures a remote selection for native frame/style events and detaches geometry observers", async () => {
  const { multiplayer, session, site } = await fixture();
  const component = mkComponent({ name: "Remote", type: ComponentType.Plain, tplTree: mkTplTagX("div") });
  site.components.push(component);
  const frame = mkArenaFrame({ site, component, name: "Remote", width: 1000, height: 800 });
  const arena = mkMixedArena("Canvas", [frame]);
  site.arenas.push(arena);
  studio.currentArena = arena;
  studio.arenaState.setCurrent(arena);
  const container = document.createElement("div");
  const iframe = container.appendChild(document.createElement("iframe"));
  document.body.append(container);
  const doc = iframe.contentDocument;
  if (!doc) { throw new Error("Expected iframe document"); }
  const element = doc.body.appendChild(doc.createElement("div"));
  let left = 100, offset = 50;
  element.getBoundingClientRect = () => new DOMRect(left, 100, 80, 40);
  Object.defineProperty(element, "offsetWidth", { value: 80 });
  Object.defineProperties(doc.documentElement, { clientWidth: { value: 1000 }, clientHeight: { value: 800 } });
  Object.defineProperties(container, { offsetLeft: { get: () => offset }, offsetTop: { value: 60 } });
  const canvas = mock<CanvasCtx>();
  canvas.viewport.mockReturnValue(iframe);
  canvas.viewportContainer.mockReturnValue(container);
  canvas.viewportContainerOffset.mockImplementation(() => CanvasCtx.prototype.viewportContainerOffset.call(canvas));
  const state = mock<ViewCtx["renderState"]>();
  state.sel2dom.mockReturnValue([element]);
  const view = mock<ViewCtx>();
  const signal = new AbortController();
  Object.defineProperties(view, {
    studioCtx: { value: studio }, component: { value: component }, canvasCtx: { value: canvas }, renderState: { value: state },
    modelLifetime: { value: studio.arenaState.lifetime() }, disposeSignal: { value: signal.signal }, isDisposed: { value: false },
    initialRenderReadyStore: { value: createStore(() => true) },
    csEvaluator: { value: { renderStatusStore: createStore(() => ({ renderCount: 1, isFirstRenderComplete: true })) } },
  });
  view.arenaFrame.mockReturnValue(frame);
  view.getSelectableFromSelectionId.mockReturnValue(undefined);
  // The actual selection handle remains owned by the resolver; this test measures its rendered DOM.
  const selectable = mock<NonNullable<ReturnType<ViewCtx["getSelectableFromSelectionId"]>>>();
  view.getSelectableFromSelectionId.mockReturnValue(selectable);
  studio.arenaState.viewRegistry.register(view);
  disposeOwners.push(() => { signal.abort(); container.remove(); });
  await multiplayer.updateSessions([{ ...session, viewInfo: { ...session.viewInfo, selectionInfo: { selectableFrameUuid: frame.uuid, selectableKey: "remote" } } }]);
  const commits = vi.fn();
  const mounted = render(<React.Profiler id="remote" onRender={commits}><PlayerBoxes /></React.Profiler>);
  const box = mounted.container.querySelector<HTMLElement>(".PlayerBox");
  expect(box).toBeTruthy();
  expect(box?.style.left).toBe("150px");
  offset = 200;
  act(() => { container.style.left = "200px"; studio.framesChanged.dispatch(); });
  await waitFor(() => expect(box?.style.left).toBe("300px"));
  left = 20;
  act(() => studio.styleChanged.dispatch());
  await waitFor(() => expect(box?.style.left).toBe("220px"));
  mounted.unmount(); commits.mockClear();
  act(() => { studio.styleChanged.dispatch(); studio.framesChanged.dispatch(); });
  await new Promise((resolve) => setTimeout(resolve, 30));
  expect(commits).not.toHaveBeenCalled();
});
