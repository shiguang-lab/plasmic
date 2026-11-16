import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import {
  observeEditorViewMenuState,
  readEditorViewMenuState,
  runEditorViewMenuAction,
} from "@/wab/client/components/top-bar/editor-view-menu";
import { INACTIVE_EDITOR_VIEW_MENU_STATE } from "@/wab/shared/desktop-view-menu";
import { getArenaFrames } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite, getDedicatedArena } from "@/wab/shared/core/sites";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { act, waitFor } from "@testing-library/react";

vi.mock("@/wab/shared/devflags", async (original) => {
  const actual = await original<typeof import("@/wab/shared/devflags")>();
  return {
    ...actual,
    DEVFLAGS: { ...actual.DEVFLAGS, contentEditorMode: false },
  };
});

async function createEditorFixture() {
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(
    () => undefined,
  );
  vi.spyOn(ViewCtx.prototype, "awaitSync").mockResolvedValue();
  vi.spyOn(ViewCtx.prototype, "updateCtxPostChange").mockImplementation(
    () => undefined,
  );
  const site = createSite();
  const component = new TplMgr({ site }).addComponent({
    name: "ViewMenuPage",
    type: ComponentType.Page,
  });
  const arena = ensure(
    getDedicatedArena(site, component),
    "Dedicated arena",
  );
  const { studioCtx } = fakeStudioCtx({
    site,
    devFlagOverrides: { ccStubs: true },
  });
  await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
  studioCtx.currentArena = arena;

  const frame = getArenaFrames(arena)[0];
  const view = ensure(studioCtx.tryGetViewCtxForFrame(frame), "ViewCtx");

  let outlineMode = false;
  const outlineListeners = new Set<() => void>();
  vi.mocked(view.canvasCtx.isOutlineMode).mockImplementation(
    () => outlineMode,
  );
  vi.mocked(view.canvasCtx.setOutlineMode).mockImplementation(
    (next: boolean) => {
      outlineMode = next;
      outlineListeners.forEach((listener) => listener());
    },
  );
  vi.mocked(view.canvasCtx.subscribeOutlineMode).mockImplementation(
    (listener: () => void) => {
      outlineListeners.add(listener);
      return () => outlineListeners.delete(listener);
    },
  );
  studioCtx.selection.set(view, [frame]);

  return {
    studioCtx,
    setOutlineMode: (next: boolean) => {
      view.canvasCtx.setOutlineMode(next);
    },
  };
}

it("returns inactive state when editor view menu is disabled", async () => {
  const { studioCtx } = await createEditorFixture();
  try {
    expect(readEditorViewMenuState(studioCtx, false)).toEqual(
      INACTIVE_EDITOR_VIEW_MENU_STATE,
    );
  } finally {
    await studioCtx.awaitEval();
    studioCtx.dispose();
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

it("observes view menu state changes and executes all view menu actions", async () => {
  const { studioCtx, setOutlineMode } = await createEditorFixture();
  vi.spyOn(studioCtx, "showComments").mockReturnValue(true);
  vi.spyOn(studioCtx, "isContentEditor").mockReturnValue(false);
  const refreshFetched = vi
    .spyOn(studioCtx, "refreshFetchedDataFromPlasmicQuery")
    .mockImplementation(() => undefined);
  const refreshUserProps = vi
    .spyOn(studioCtx, "refreshAppUserProperties")
    .mockResolvedValue(undefined);
  const toggleFocused = vi.spyOn(studioCtx, "toggleFocusedMode");

  const published: ReturnType<typeof readEditorViewMenuState>[] = [];
  const stop = observeEditorViewMenuState(
    studioCtx,
    () => true,
    (next) => published.push(next),
  );

  try {
    expect(published.at(-1)).toMatchObject({
      available: true,
      hasFocusedViewCtx: true,
      outlineMode: false,
      canToggleFocusedMode: true,
      canShowComments: true,
      canChangeContentEditorMode: true,
    });

    await act(async () => {
      setOutlineMode(true);
    });
    expect(published.at(-1)?.outlineMode).toBe(true);

    const afterOutlineToggle = await runEditorViewMenuAction(
      studioCtx,
      "toggleOutlineMode",
    );
    expect(afterOutlineToggle.outlineMode).toBe(false);

    const beforeSlot = readEditorViewMenuState(studioCtx).showSlotPlaceholder;
    const afterSlot = await runEditorViewMenuAction(
      studioCtx,
      "toggleShowSlotPlaceholder",
    );
    expect(afterSlot.showSlotPlaceholder).toBe(!beforeSlot);

    const beforeContainer =
      readEditorViewMenuState(studioCtx).showContainerPlaceholder;
    const afterContainer = await runEditorViewMenuAction(
      studioCtx,
      "toggleShowContainerPlaceholder",
    );
    expect(afterContainer.showContainerPlaceholder).toBe(!beforeContainer);

    const beforeMultiplayer =
      readEditorViewMenuState(studioCtx).showMultiplayerSelections;
    const afterMultiplayer = await runEditorViewMenuAction(
      studioCtx,
      "toggleShowMultiplayerSelections",
    );
    expect(afterMultiplayer.showMultiplayerSelections).toBe(!beforeMultiplayer);

    const beforeHoverBoxes =
      readEditorViewMenuState(studioCtx).showAncestorsHoverBoxes;
    const afterHoverBoxes = await runEditorViewMenuAction(
      studioCtx,
      "toggleShowAncestorsHoverBoxes",
    );
    expect(afterHoverBoxes.showAncestorsHoverBoxes).toBe(!beforeHoverBoxes);

    const beforeFullHeight = readEditorViewMenuState(studioCtx).fullPageHeight;
    const afterFullHeight = await runEditorViewMenuAction(
      studioCtx,
      "toggleFullPageHeight",
    );
    expect(afterFullHeight.fullPageHeight).toBe(!beforeFullHeight);

    const beforeFocused = readEditorViewMenuState(studioCtx).focusedMode;
    const afterFocused = await runEditorViewMenuAction(
      studioCtx,
      "toggleFocusedMode",
    );
    expect(toggleFocused).toHaveBeenCalledOnce();
    expect(afterFocused.focusedMode).toBe(!beforeFocused);

    const beforeAutoOpen = readEditorViewMenuState(studioCtx).autoOpenMode;
    const afterAutoOpen = await runEditorViewMenuAction(
      studioCtx,
      "toggleAutoOpenMode",
    );
    expect(afterAutoOpen.autoOpenMode).toBe(!beforeAutoOpen);

    const beforeComments = readEditorViewMenuState(studioCtx).showCommentsOverlay;
    const afterComments = await runEditorViewMenuAction(
      studioCtx,
      "toggleShowCommentsOverlay",
    );
    expect(afterComments.showCommentsOverlay).toBe(!beforeComments);

    const beforeContentMode =
      readEditorViewMenuState(studioCtx).contentEditorMode;
    const afterContentMode = await runEditorViewMenuAction(
      studioCtx,
      "toggleContentEditorMode",
    );
    expect(afterContentMode.contentEditorMode).toBe(!beforeContentMode);

    await runEditorViewMenuAction(studioCtx, "refreshData");
    expect(refreshFetched).toHaveBeenCalledOnce();
    expect(refreshUserProps).toHaveBeenCalledOnce();

    stop();
    expect(published.at(-1)).toEqual(INACTIVE_EDITOR_VIEW_MENU_STATE);
  } finally {
    stop();
    await studioCtx.awaitEval();
    studioCtx.dispose();
  }
});
