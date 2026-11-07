import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { ShortcutsModal } from "@/wab/client/components/studio/Shortcuts";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";

afterEach(cleanup);

it("opens through the real native commands, filters shortcuts and closes through the actual Modal", async () => {
  const { studioCtx: studio } = fakeStudioCtx();
  const label = render(<StudioCtxContext.Provider value={studio}><ShortcutsModal><button>Canvas action</button></ShortcutsModal></StudioCtxContext.Provider>);
  try {
    expect(screen.getByRole("button", { name: "Canvas action" })).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    act(() => studio.openShortcutsModal());
    expect(studio.isShortcutsModalOpen()).toBe(true);
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("Keyboard Shortcuts");
    expect(screen.getByText("Draw from center")).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("Search shortcuts here..."), { target: { value: "PROPORTIONALLY" } });
    expect(screen.getByText("Draw proportionally")).toBeTruthy();
    expect(screen.queryByText("Draw from center")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(studio.isShortcutsModalOpen()).toBe(false);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    act(() => studio.toggleShortcutsModal());
    expect(screen.getByPlaceholderText<HTMLInputElement>("Search shortcuts here...").value).toBe("PROPORTIONALLY");
    act(() => studio.closeShortcutsModal());
    expect(studio.shortcutsModalStore.getState()).toBe(false);
  } finally { label.unmount(); studio.dispose(); }
});

it("detaches the previous Studio source on ownership changes and unmount", () => {
  const first = fakeStudioCtx().studioCtx, next = fakeStudioCtx().studioCtx;
  const stopFirst = vi.fn(), stopNext = vi.fn();
  const firstSubscribe = first.shortcutsModalStore.subscribe;
  vi.spyOn(first.shortcutsModalStore, "subscribe").mockImplementation((listener) => {
    const stop = firstSubscribe(listener); return () => { stopFirst(); stop(); };
  });
  const nextSubscribe = next.shortcutsModalStore.subscribe;
  vi.spyOn(next.shortcutsModalStore, "subscribe").mockImplementation((listener) => {
    const stop = nextSubscribe(listener); return () => { stopNext(); stop(); };
  });
  const label = render(<StudioCtxContext.Provider value={first}><ShortcutsModal>Canvas</ShortcutsModal></StudioCtxContext.Provider>);
  try {
    label.rerender(<StudioCtxContext.Provider value={next}><ShortcutsModal>Canvas</ShortcutsModal></StudioCtxContext.Provider>);
    expect(stopFirst).toHaveBeenCalledTimes(1);
    act(() => first.openShortcutsModal());
    expect(screen.queryByRole("dialog")).toBeNull();
    label.unmount();
    expect(stopNext).toHaveBeenCalledTimes(1);
  } finally { label.unmount(); first.dispose(); next.dispose(); }
});
