// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { Tiptap } from "./registerTiptap";
import { TiptapContextProvider } from "./contexts";

const state = vi.hoisted(() => ({ canvas: false, mounts: 0 }));
vi.mock("@plasmicapp/host", async (original) => ({
  ...(await original<object>()), usePlasmicCanvasContext: () => state.canvas,
}));
vi.mock("@tiptap/react", () => ({ EditorProvider: () => {
  React.useEffect(() => { state.mounts++; }, []);
  return null;
} }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("keeps a fixed dependency list when canvas mode changes and refreshes external canvas content", () => {
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const content = (html: string) => <TiptapContextProvider><Tiptap className="editor" contentHtml={html} useJson={false} onChange={() => {}} /></TiptapContextProvider>;
  const view = render(content("<p>runtime</p>"));
  const runtimeMounts = state.mounts;
  view.rerender(content("<p>runtime change</p>"));
  expect(state.mounts).toBe(runtimeMounts);
  state.canvas = true;
  view.rerender(content("<p>canvas</p>"));
  const canvasMounts = state.mounts;
  expect(canvasMounts).toBeGreaterThan(runtimeMounts);
  view.rerender(content("<p>external change</p>"));
  expect(state.mounts).toBeGreaterThan(canvasMounts);
  state.canvas = false;
  view.rerender(content("<p>runtime again</p>"));
  expect(errors).not.toHaveBeenCalled();
});
