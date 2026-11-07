// @vitest-environment jsdom

import { act, cleanup, render, renderHook } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlasmicCanvasHost, PlasmicCanvasProps, usePlasmicCanvasComponentInfo } from "./canvas-host";

it("keeps canvas selection, reveal callbacks and session bindings behind one internal entry", () => {
  const state = { value: false, reveal: vi.fn(), set: vi.fn() };
  const canvas = { selected: true, editing: true, slot: "body", fullContent: true,
    instance: "row-a", states: { open: state }, getState: vi.fn(() => state), onReveal: vi.fn() };
  const { result, rerender, unmount } = renderHook((props: PlasmicCanvasProps) => usePlasmicCanvasComponentInfo(props), {
    initialProps: { __canvas: canvas },
  });
  expect(result.current).toBe(canvas);
  result.current?.onReveal?.();
  expect(canvas.onReveal).toHaveBeenCalledOnce();
  expect(result.current?.getState?.("open", false)).toBe(state);
  rerender({});
  expect(result.current).toBeNull();
  unmount();
});

function studioScripts() {
  return Array.from(document.querySelectorAll("script")).filter((s) =>
    s.src.includes("/js/studio")
  );
}

async function renderHost(node: React.ReactElement) {
  await act(async () => {
    render(node);
  });
}

describe("PlasmicCanvasHost studio script", () => {
  beforeEach(() => {
    // Pretend we're in the Studio's host iframe: window.parent !== window
    const fakeParent = {} as Window;
    Object.defineProperty(window, "parent", {
      configurable: true,
      get: () => fakeParent,
    });
    window.location.hash = "#origin=https://studio.plasmic.app";
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
    window.location.hash = "";
  });

  it("appends the studio script", async () => {
    await renderHost(<PlasmicCanvasHost />);
    expect(studioScripts().map((s) => s.src)).toEqual([
      "https://studio.plasmic.app/js/studio.js",
    ]);
  });

  it("appends the studio script only once under StrictMode", async () => {
    await renderHost(
      <React.StrictMode>
        <PlasmicCanvasHost />
      </React.StrictMode>
    );
    expect(studioScripts()).toHaveLength(1);
  });

  it("does not append the studio script again on remount", async () => {
    await renderHost(<PlasmicCanvasHost />);
    cleanup();
    await renderHost(<PlasmicCanvasHost />);
    expect(studioScripts()).toHaveLength(1);
  });
});
