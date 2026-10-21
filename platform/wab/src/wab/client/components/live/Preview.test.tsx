import Preview from "@/wab/client/components/live/Preview";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { observable, runInAction } from "mobx";
import React from "react";

const mocks = vi.hoisted(() => ({ preview: {} as { full: boolean; isLive: boolean; refreshKey: number } }));
vi.mock("@/wab/client/components/live/PreviewCtx", () => ({ usePreviewCtx: () => mocks.preview }));
vi.mock("@/wab/client/components/live/PreviewTopBar", () => ({ PreviewTopBar: () => <button>Preview controls</button> }));
vi.mock("@/wab/client/components/live/PreviewFrame", () => ({ PreviewFrame: () => <input aria-label="Runtime form" defaultValue="Initial" /> }));
vi.mock("@/wab/client/components/studio/TopFrameObserver", () => ({ TopFrameObserver: () => null }));
vi.mock("@/wab/client/components/ui/layout-styles", () => ({ useEditorLayoutStyles: () => ({ styles: {} }) }));
vi.mock("@/wab/client/dom-utils", () => ({ fixStudioIframePositionAndOverflow: vi.fn() }));
vi.mock("@/wab/client/shortcuts/shortcut-handler", () => ({ useBindShortcutHandlers: vi.fn() }));
afterEach(cleanup);

test("refresh replaces the runtime while retaining the Preview controls", () => {
  mocks.preview = observable({ full: false, isLive: true, refreshKey: 0 });
  const view = render(<Preview studioCtx={{} as StudioCtx} />);
  const controls = screen.getByRole("button", { name: "Preview controls" });
  const form = screen.getByRole("textbox", { name: "Runtime form" });
  fireEvent.change(form, { target: { value: "Edited" } });
  runInAction(() => { mocks.preview.refreshKey++; });
  view.rerender(<Preview studioCtx={{} as StudioCtx} />);
  expect(screen.getByRole("textbox", { name: "Runtime form" })).not.toBe(form);
  expect((screen.getByRole("textbox", { name: "Runtime form" }) as HTMLInputElement).value).toBe("Initial");
  expect(screen.getByRole("button", { name: "Preview controls" })).toBe(controls);
});
