import { EditableNodeLabel } from "@/wab/client/components/canvas/EditableNodeLabel";
import { ViewOps } from "@/wab/client/components/canvas/view-ops";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame } from "@/wab/shared/Arenas";
import { ensure } from "@/wab/shared/common";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { mkParam } from "@/wab/shared/core/lang";
import { createSite } from "@/wab/shared/core/sites";
import { mkSlot, mkTplTagX } from "@/wab/shared/core/tpls";
import { ensureKnownSlotParam } from "@/wab/shared/model/classes";
import { typeFactory } from "@/wab/shared/model/model-util";
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

it("starts through the native rename command and retains a draft across external name changes", async () => {
  const { studio, view, operations } = fixture();
  const tpl = mkTplTagX("div", { name: "Original" });
  view.focusedTpl.mockReturnValue(tpl);
  const changed = vi.fn();
  const label = render(<EditableNodeLabel studioCtx={studio} viewCtx={view} nameable={tpl} displayName="Original" onChangeEditing={changed} />);
  act(() => studio.tryStartRenamingFocused());
  expect(studio.renamingFocused()).toBe(false);
  const input = screen.getByRole<HTMLInputElement>("textbox");
  expect(input.value).toBe("Original");
  fireEvent.change(input, { target: { value: "Draft" } });
  tpl.name = "External";
  label.rerender(<EditableNodeLabel studioCtx={studio} viewCtx={view} nameable={tpl} displayName="External" onChangeEditing={changed} />);
  expect(input.value).toBe("Draft");
  await act(async () => fireEvent.blur(input));
  expect(operations.renameTpl).toHaveBeenCalledWith("Draft", tpl);
  expect(operations.renameTpl).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(changed).toHaveBeenLastCalledWith(false);
  act(() => studio.tryStartRenamingFocused());
  expect(screen.getByRole<HTMLInputElement>("textbox").value).toBe("External");
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Cancelled" } });
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
  expect(operations.renameTpl).toHaveBeenCalledTimes(1);
});

it("captures real slot and frame names at editing entry and dispatches their existing commands", async () => {
  const { studio, view, operations } = fixture();
  const param = ensureKnownSlotParam(mkParam({ name: "children", paramType: "slot", type: typeFactory.renderable() }));
  const slot = mkSlot(param);
  const label = render(<EditableNodeLabel studioCtx={studio} viewCtx={view} nameable={slot} displayName="Slot" />);
  fireEvent.doubleClick(screen.getByText("Slot"));
  expect(screen.getByRole<HTMLInputElement>("textbox").value).toBe("children");
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "content" } });
  await act(async () => fireEvent.blur(screen.getByRole("textbox")));
  expect(operations.tryRenameParam).toHaveBeenCalledWith("content", param);
  const component = mkComponent({ name: "Business", type: ComponentType.Plain, tplTree: mkTplTagX("div") });
  const frame = mkArenaFrame({ site: createSite(), component, width: 800, height: 600, name: "Fallback" });
  studio.focusedFrame.mockReturnValue(frame);
  label.rerender(<EditableNodeLabel studioCtx={studio} viewCtx={view} nameable={frame} displayName="Business" />);
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
  const tpl = mkTplTagX("div", { name: "Label" });
  const label = render(<EditableNodeLabel studioCtx={first.studio} nameable={tpl} displayName="Label" />);
  label.rerender(<EditableNodeLabel studioCtx={next.studio} nameable={tpl} displayName="Label" />);
  expect(stopFirst).toHaveBeenCalledTimes(1);
  act(() => first.renamingFocusedStore.setState(true, true));
  expect(screen.queryByRole("textbox")).toBeNull();
  label.unmount();
  expect(stopNext).toHaveBeenCalledTimes(1);
  expect(ensure(tpl.name, "Missing name")).toBe("Label");
});
