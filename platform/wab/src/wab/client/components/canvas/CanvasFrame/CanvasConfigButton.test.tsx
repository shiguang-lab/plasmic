import { createViewportFixture } from "@/wab/client/__testonly__/viewport";
import { CanvasConfigButton } from "@/wab/client/components/canvas/CanvasFrame/CanvasConfigButton";
import { FrameHeights } from "@/wab/client/studio-ctx/frame-heights";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { StudioArenaState } from "@/wab/client/studio-ctx/studio-arena-state";
import { StudioSelection } from "@/wab/client/studio-ctx/studio-selection";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { mkArenaFrame, mkMixedArena, updateAutoDerivedFrameHeight } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { act, cleanup, render } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

const current = vi.hoisted(() => ({ studio: undefined as StudioCtx | undefined }));
vi.mock("@/wab/client/contexts/StudioContexts", () => ({ useStudioCtx: () => ensure(current.studio, "Config fixture Studio") }));
vi.mock("@/wab/client/components/sidebar-tabs/frame-tab", () => ({ FramePanel: () => null }));
afterEach(() => cleanup());

function setup() {
  let site = createSite(), models = new ModelSnapshots();
  const component = new TplMgr({ site }).addComponent({ name: "Dimensions", type: ComponentType.Page });
  const frame = mkArenaFrame({ site, component, name: "Dimensions", width: 800, height: 600 });
  const arena = mkMixedArena("Dimensions", [frame]), emptyArena = mkMixedArena("Empty");
  site.arenas.push(arena, emptyArena);
  const arenas = new StudioArenaState({ get site() { return site; }, get modelSnapshots() { return models; } });
  arenas.setCurrent(arena);
  const selection = new StudioSelection(() => models); selection.set(undefined, [frame]);
  const studio = mock<StudioCtx>();
  Object.defineProperties(studio, Object.getOwnPropertyDescriptors(createViewportFixture()));
  Object.defineProperties(studio, {
    site: { get: () => site }, modelSnapshots: { get: () => models }, arenaState: { value: arenas },
    selection: { value: selection }, selectionStore: { value: selection.store },
    currentArena: { get: () => arenas.currentArena() },
  });
  studio.focusedFrames.mockImplementation(() => StudioCtx.prototype.focusedFrames.call(studio));
  studio.focusedFrame.mockImplementation(() => StudioCtx.prototype.focusedFrame.call(studio));
  studio.focusedContentFrame.mockImplementation(() => StudioCtx.prototype.focusedContentFrame.call(studio));
  studio.focusedViewCtx.mockReturnValue(undefined);
  studio.hasPendingModelChanges.mockReturnValue(false);
  studio.subscribeModelChanges.mockImplementation(() => () => undefined);
  const heights = new FrameHeights(studio);
  Object.defineProperty(studio, "frameHeights", { value: heights });
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  current.studio = studio;
  return { studio, frame, arena, emptyArena, arenas, heights, get models() { return models; },
    commit(command: () => void) {
      const { changes } = recorder.withRecording(command);
      models.deferPublication(() => arenas.deferPublication(() => {
        models.sync(changes, () => { arenas.prepareModelCommit(changes); heights.prepareCommit(); });
        heights.publishCommit();
      }));
    },
    replace() {
      arenas.deferPublication(() => selection.deferPublication(() => {
        selection.resetModelOwner(); heights.resetModelOwner(); arenas.reset(); models.dispose();
        site = createSite(); models = new ModelSnapshots(); arenas.attachSite();
      }));
    },
    dispose() { cleanup(); heights.dispose(); selection.dispose(); arenas.dispose(); models.dispose(); recorder.dispose(); current.studio = undefined; },
  };
}

it("renders exact native width, measured height and arena-filtered focus without an observer", () => {
  const f = setup();
  try {
    const mounted = render(<CanvasConfigButton studioCtx={f.studio} frame={f.frame} showDims />);
    const button = ensure(mounted.container.querySelector("button"), "Dimension button");
    expect(button.textContent?.replace(/\s+/g, " ").trim()).toBe("800 ✕ 600");
    expect(button.getAttribute("data-test-id")).toBe("artboard-config-button");
    act(() => f.commit(() => { f.frame.width = 950; }));
    expect(button.textContent?.replace(/\s+/g, " ").trim()).toBe("950 ✕ 600");
    act(() => updateAutoDerivedFrameHeight(f.frame, 1800));
    expect(button.textContent?.replace(/\s+/g, " ").trim()).toBe("950 ✕ 1800");
    expect(f.frame.height).toBe(600);
    const widthState = f.models.field(f.frame, "width").getState();
    act(() => f.arenas.setCurrent(f.emptyArena));
    expect(mounted.container.querySelector('[data-test-id="artboard-config-button"]')).toBeNull();
    expect(f.models.field(f.frame, "width").getState()).toBe(widthState);
  } finally { f.dispose(); }
});

it("does not demand model dimensions when the dimension label is absent", () => {
  const f = setup(); const fields = vi.spyOn(f.models, "field");
  try {
    render(<CanvasConfigButton studioCtx={f.studio} frame={f.frame} />);
    expect(fields).not.toHaveBeenCalled();
  } finally { fields.mockRestore(); f.dispose(); }
});

it("retains the captured width and height across old-prop rerenders and StrictMode remounts", () => {
  const f = setup();
  try {
    const mounted = render(<CanvasConfigButton studioCtx={f.studio} frame={f.frame} showDims />);
    act(() => f.commit(() => { f.frame.width = 950; }));
    act(() => f.replace());
    const fields = vi.spyOn(f.models, "field");
    mounted.rerender(<CanvasConfigButton studioCtx={f.studio} frame={f.frame} showDims />);
    expect(mounted.container.querySelector("button")?.textContent?.replace(/\s+/g, " ").trim()).toBe("950 ✕ 600");
    mounted.unmount();
    const remount = render(<React.StrictMode><CanvasConfigButton studioCtx={f.studio} frame={f.frame} showDims /></React.StrictMode>);
    expect(remount.container.querySelector("button")?.textContent?.replace(/\s+/g, " ").trim()).toBe("950 ✕ 600");
    expect(fields).not.toHaveBeenCalled(); fields.mockRestore();
  } finally { f.dispose(); }
});
