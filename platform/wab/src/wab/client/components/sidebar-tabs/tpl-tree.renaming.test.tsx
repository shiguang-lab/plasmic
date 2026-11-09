import { AppContext } from "@/wab/client/components/top-view";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { OutlineCtx } from "@/wab/client/components/sidebar-tabs/OutlineCtx";
import { ArenaTree, TreeDndManager } from "@/wab/client/components/sidebar-tabs/tpl-tree";
import type { EditableLabelHandles, EditableLabelProps } from "@/wab/client/components/widgets/EditableLabel";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { mkParam } from "@/wab/shared/core/lang";
import { ensureKnownTplTag } from "@/wab/shared/model/classes";
import { typeFactory } from "@/wab/shared/model/model-util";
import { mkSlot, mkTplTagX } from "@/wab/shared/core/tpls";
import { ensureVariantSetting, getBaseVariant } from "@/wab/shared/Variants";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";

const labelRender = vi.hoisted(() => vi.fn());
vi.mock("@/wab/client/components/widgets/EditableLabel", async (original) => {
  const actual = await original<typeof import("@/wab/client/components/widgets/EditableLabel")>();
  const ReactModule = await import("react");
  return { ...actual, EditableLabel: ReactModule.forwardRef<EditableLabelHandles, EditableLabelProps>((props, ref) => {
    labelRender(props.value, props.defaultEditing);
    return <actual.EditableLabel {...props} ref={ref} />;
  }) };
});
vi.mock("react-window", async () => {
  const ReactModule = await import("react");
  return { FixedSizeList: ReactModule.forwardRef((props: { itemCount: number; itemData: unknown; itemKey: (index: number, data: unknown) => React.Key; children: React.ComponentType<{ index: number; data: unknown; style: React.CSSProperties }> }, _ref) => <div>{Array.from({ length: props.itemCount }, (_, index) => React.createElement(props.children, { key: props.itemKey(index, props.itemData), index, data: props.itemData, style: {} }))}</div>) };
});
vi.mock("@/wab/client/components/widgets/ListStack", () => ({ ListSpace: ({ children }: { children: (size: { height: number }) => React.ReactNode }) => children({ height: 500 }) }));
afterEach(() => { cleanup(); labelRender.mockClear(); vi.restoreAllMocks(); });

it("opens the actual focused tag and slot rename editors from the native command, then commits and cancels", async () => {
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  const { studioCtx: studio, app } = fakeStudioCtx();
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const component = await studio.changeUnsafe(() => studio.addComponent("Rename tree", { type: ComponentType.Plain }));
  const root = ensureKnownTplTag(component.tplTree);
  const node = mkTplTagX("div", { name: "NamedNode" });
  const other = mkTplTagX("div", { name: "OtherNode" });
  const param = mkParam({ name: "ContentSlot", paramType: "slot", type: typeFactory.renderable() });
  const slot = mkSlot(param);
  await studio.changeUnsafe(() => {
    component.params.push(param);
    for (const child of [node, other, slot]) { ensureVariantSetting(child, [getBaseVariant(component)]); child.parent = root; root.children.push(child); }
  });
  const vc = ensure(studio.focusedOrFirstViewCtx(), "Expected the component view");
  studio.setStudioFocusOnFrameContents(vc.arenaFrame());
  vc.setStudioFocusByTpl(node);
  const outline = new OutlineCtx(studio, "");
  outline.expandAll();
  const view = render(<AppContext.Provider value={app}><StudioCtxContext.Provider value={studio}><ArenaTree studioCtx={studio} arena={studio.currentArena} outlineCtx={outline} dndManager={new TreeDndManager(studio)} /></StudioCtxContext.Provider></AppContext.Provider>);
  try {
    expect(screen.queryByPlaceholderText("Element name")).toBeNull();
    const otherRenders = labelRender.mock.calls.filter(([name]) => name === "OtherNode").length;
    act(() => studio.startRenamingOnPanel());
    expect(screen.getByPlaceholderText("Element name")).toHaveProperty("value", "NamedNode");
    expect(labelRender.mock.calls.filter(([name]) => name === "OtherNode")).toHaveLength(otherRenders);
    fireEvent.change(screen.getByPlaceholderText("Element name"), { target: { value: "UpdatedNode" } });
    fireEvent.keyDown(screen.getByPlaceholderText("Element name"), { key: "Enter" });
    await waitFor(() => expect(node.name).toBe("UpdatedNode"));
    expect(studio.renamingOnPanelStore.getState()).toBe(false);
    expect(screen.queryByPlaceholderText("Element name")).toBeNull();
    await act(async () => { await studio.changeUnsafe(() => vc.setStudioFocusByTpl(slot)); });
    act(() => studio.startRenamingOnPanel());
    expect(screen.getByPlaceholderText("Slot name")).toHaveProperty("value", "ContentSlot");
    fireEvent.change(screen.getByPlaceholderText("Slot name"), { target: { value: "DraftSlot" } });
    fireEvent.keyDown(screen.getByPlaceholderText("Slot name"), { key: "Escape" });
    expect(studio.renamingOnPanelStore.getState()).toBe(false);
    expect(param.variable.name).toBe("ContentSlot");
    expect(screen.queryByPlaceholderText("Slot name")).toBeNull();
  } finally { view.unmount(); outline.dispose(); studio.dispose(); }
});
