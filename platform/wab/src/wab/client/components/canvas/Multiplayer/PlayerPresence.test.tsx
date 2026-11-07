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
import { act, cleanup, render } from "@testing-library/react";
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
  Object.defineProperties(studio, Object.getOwnPropertyDescriptors(createStudioModeFixture()));
  Object.defineProperty(studio, "saveState", { value: new StudioSaveState() });
  const contentEditors = new CanvasContentEditorIndex(() => []);
  Object.defineProperty(studio, "activeContentEditorStore", { value: contentEditors.store });
  disposeOwners.push(() => contentEditors.dispose());
  const overlayState = new StudioOverlayState();
  Object.defineProperty(studio, "overlayState", { value: overlayState });
  disposeOwners.push(() => overlayState.dispose());
  const models = new ModelSnapshots();
  const arena = new StudioArenaState({ site: createSite(), modelSnapshots: models });
  Object.defineProperty(studio, "arenaState", { value: arena });
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
  return { multiplayer, session };
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
