import { EditableNodeLabel } from "@/wab/client/components/canvas/EditableNodeLabel";
import { ViewOps } from "@/wab/client/components/canvas/view-ops";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame } from "@/wab/shared/Arenas";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";
import { createStore } from "zustand/vanilla";

function fixture() {
  const studio = mock<StudioCtx>();
  const view = mock<ViewCtx>();
  const operations = mock<ViewOps>();
  const renamingFocusedStore = createStore<boolean>(() => false);
  Object.assign(studio, {
    renamingFocusedStore,
    tryStartRenamingFocused: StudioCtx.prototype.tryStartRenamingFocused,
    endRenamingFocused: StudioCtx.prototype.endRenamingFocused,
    renamingFocused: StudioCtx.prototype.renamingFocused,
  });
  studio.changeUnsafe.mockImplementation(async (change) => change());
  studio.focusedViewCtx.mockReturnValue(view);
  view.getViewOps.mockReturnValue(operations);
  return { studio, view, operations, renamingFocusedStore };
}

afterEach(cleanup);

it("uses the frame component name and dispatches its existing rename command", async () => {
  const { studio, view, operations } = fixture();
  const component = mkComponent({ name: "Business", type: ComponentType.Plain, tplTree: mkTplTagX("div") });
  const frame = mkArenaFrame({ site: createSite(), component, width: 800, height: 600, name: "Fallback" });
  studio.focusedFrame.mockReturnValue(frame);
  render(<EditableNodeLabel studioCtx={studio} viewCtx={view} nameable={frame} displayName="Business" />);
  act(() => studio.tryStartRenamingFocused());
  expect(screen.getByRole<HTMLInputElement>("textbox").value).toBe("Business");
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "New business" } });
  await act(async () => fireEvent.blur(screen.getByRole("textbox")));
  expect(operations.renameNode).toHaveBeenCalledWith(frame, "New business");
});

it("detaches the old native rename source when its Studio owner changes and on unmount", () => {
  const first = fixture(), next = fixture();
  const stopFirst = vi.fn(), stopNext = vi.fn();
  const subscribeFirst = first.renamingFocusedStore.subscribe;
  vi.spyOn(first.renamingFocusedStore, "subscribe").mockImplementation((listener) => {
    const stop = subscribeFirst(listener);
    return () => { stopFirst(); stop(); };
  });
  const subscribeNext = next.renamingFocusedStore.subscribe;
  vi.spyOn(next.renamingFocusedStore, "subscribe").mockImplementation((listener) => {
    const stop = subscribeNext(listener);
    return () => { stopNext(); stop(); };
  });
  const component = mkComponent({ name: "Label", type: ComponentType.Plain, tplTree: mkTplTagX("div") });
  const frame = mkArenaFrame({ site: createSite(), name: "Label", component, width: 800, height: 600 });
  const label = render(<EditableNodeLabel studioCtx={first.studio} viewCtx={first.view} nameable={frame} displayName="Label" />);
  label.rerender(<EditableNodeLabel studioCtx={next.studio} viewCtx={next.view} nameable={frame} displayName="Label" />);
  expect(stopFirst).toHaveBeenCalledTimes(1);
  act(() => first.renamingFocusedStore.setState(true, true));
  expect(screen.queryByRole("textbox")).toBeNull();
  label.unmount();
  expect(stopNext).toHaveBeenCalledTimes(1);
});
