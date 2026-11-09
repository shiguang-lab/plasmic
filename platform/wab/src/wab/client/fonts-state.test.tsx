import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { FontManager } from "@/wab/client/fonts";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { createSite } from "@/wab/shared/core/sites";
import { act, cleanup, render, screen } from "@testing-library/react";
import $ from "jquery";
import React from "react";
import { mock } from "vitest-mock-extended";
import { useStore } from "zustand";

beforeEach(() => {
  document.body.innerHTML = '<span class="fontTester"></span>';
  vi.spyOn($.fn, "width").mockReturnValue(100);
});
afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

it("publishes committed font edits, undo and redo through the real Studio transaction path", async () => {
  const { studioCtx } = fakeStudioCtx();
  const manager = studioCtx.fontManager;
  await vi.waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
  studioCtx.createViewStateUndoRecord();
  await Promise.resolve();
  const publish = vi.fn();
  const stop = manager.store.subscribe(publish);
  const initial = manager.store.getState();
  await studioCtx.changeUnsafe(() => {
    studioCtx.site.userManagedFonts.push("Project Font");
  });
  expect(manager.store.getState().userManagedFonts).toContain("Project Font");
  expect(
    manager.store
      .getState()
      .availableFonts.some((font) => font.fontFamily === "Project Font"),
  ).toBe(true);
  expect(manager.store.getState().managedFonts).toBe(initial.managedFonts);
  expect(manager.store.getState().localFonts).toBe(initial.localFonts);
  expect(publish).toHaveBeenCalledOnce();
  expect(studioCtx.canUndo()).toBe(true);
  await studioCtx.undo();
  expect(manager.store.getState().userManagedFonts).not.toContain(
    "Project Font",
  );
  await studioCtx.redo();
  expect(manager.store.getState().userManagedFonts).toContain("Project Font");
  expect(publish).toHaveBeenCalledTimes(3);
  const snapshot = manager.store.getState();
  for (let i = 0; i < 100; i++) {
    manager.syncSite(studioCtx.site);
  }
  expect(manager.store.getState()).toBe(snapshot);
  expect(publish).toHaveBeenCalledTimes(3);
  await studioCtx.changeUnsafe(() => {
    studioCtx.site.flags = { ...studioCtx.site.flags, fontStateTest: true };
  });
  expect(manager.store.getState()).toBe(snapshot);
  stop();
});

it("does not rerender font choices when only local availability changes", async () => {
  const site = createSite();
  const manager = new FontManager(site);
  const studio = mock<StudioCtx>({ site });
  Object.defineProperty(studio, "viewCtxs", { value: [] });
  await Promise.resolve();
  manager.loadFont(studio, "Menlo");
  await Promise.resolve();
  const choices = vi.fn();
  const warnings = vi.fn();
  function Choices() {
    const fonts = useStore(manager.store, (state) => state.availableFonts);
    return (
      <React.Profiler id="choices" onRender={choices}>
        <div>{fonts.length}</div>
      </React.Profiler>
    );
  }
  function Missing() {
    const fonts = useStore(manager.store, (state) => state.missingUsedFonts);
    return (
      <React.Profiler id="missing" onRender={warnings}>
        <output>{fonts.join(",")}</output>
      </React.Profiler>
    );
  }
  const view = render(
    <>
      <Choices />
      <Missing />
    </>,
  );
  expect(screen.getByRole("status").textContent).toContain("Menlo");
  choices.mockClear();
  warnings.mockClear();
  vi.mocked($.fn.width).mockImplementation(function (this: JQuery) {
    return this.css("font-family").includes("Menlo") ? 200 : 100;
  } as any);
  await act(() => manager.addUserManagedFont("Menlo"));
  expect(screen.getByRole("status").textContent).not.toContain("Menlo");
  expect(choices).not.toHaveBeenCalled();
  expect(warnings).toHaveBeenCalledOnce();
  const snapshot = manager.store.getState();
  await act(() => manager.addUserManagedFont("Menlo"));
  expect(manager.store.getState()).toBe(snapshot);
  expect(warnings).toHaveBeenCalledOnce();
  view.unmount();
  manager.dispose();
});

it("synchronizes replacement sites and dependencies without retaining an obsolete font list", async () => {
  const site = createSite();
  site.userManagedFonts.push("Old Font");
  const manager = new FontManager(site);
  await Promise.resolve();
  const next = createSite();
  next.userManagedFonts.push("New Font");
  manager.syncSite(next);
  expect(manager.store.getState().userManagedFonts).toEqual(["New Font"]);
  expect(
    manager.availFonts().some((font) => font.fontFamily === "Old Font"),
  ).toBe(false);
  expect(
    manager.availFonts().some((font) => font.fontFamily === "New Font"),
  ).toBe(true);
  manager.dispose();
});

it("does not publish an asynchronous probe after disposal", async () => {
  const fonts = document.fonts;
  let finish: () => void = () => undefined;
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: {
      check: () => false,
      load: () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    },
  });
  try {
    const manager = new FontManager(createSite());
    const publish = vi.fn();
    const stop = manager.store.subscribe(publish);
    const snapshot = manager.store.getState();
    manager.dispose();
    finish();
    await Promise.resolve();
    await Promise.resolve();
    expect(manager.store.getState()).toBe(snapshot);
    expect(publish).not.toHaveBeenCalled();
    stop();
  } finally {
    if (fonts) {
      Object.defineProperty(document, "fonts", {
        configurable: true,
        value: fonts,
      });
    } else {
      Reflect.deleteProperty(document, "fonts");
    }
  }
});
