import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { ComponentMetaDataPropsSection } from "@/wab/client/components/sidebar-tabs/ComponentMetaDataPropsSection";
import { LegacyComponentParamsSection } from "@/wab/client/components/sidebar-tabs/legacy-component-params-section";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { ComponentType, addOrEditComponentMetadata, removeComponentMetadata } from "@/wab/shared/core/components";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { ensure } from "@/wab/shared/common";

afterEach(cleanup);

it.each([
  ["current", ComponentMetaDataPropsSection],
  ["legacy", LegacyComponentParamsSection],
] as const)("keeps %s metadata rows bound to their key and current component", async (_name, Section) => {
  const { studioCtx: studio } = fakeStudioCtx();
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const component = studio.tplMgr().addComponent({ name: "Metadata", type: ComponentType.Plain });
  const other = studio.tplMgr().addComponent({ name: "Other metadata", type: ComponentType.Plain });
  await studio.changeUnsafe(() => {
    addOrEditComponentMetadata(component, "first", "First value");
    addOrEditComponentMetadata(component, "second", "Second value");
    addOrEditComponentMetadata(other, "other", "Other value");
  });
  const contents = (current = component) => <StudioCtxContext.Provider value={studio}><Section studioCtx={studio} component={current} /></StudioCtxContext.Provider>;
  const view = render(contents());
  try {
    await act(async () => { await studio.changeUnsafe(() => {
      component.editableByContentEditor = true;
      component.hiddenFromContentEditor = false;
    }); });
    const editableSwitch = () => within(ensure(screen.getByText("Editable by content editors").parentElement, "Editable row")).getByRole("switch");
    const hiddenSwitch = () => within(ensure(screen.getByText("Hidden from content editors").parentElement, "Hidden row")).getByRole("switch");
    expect(editableSwitch()).toHaveProperty("checked", true);
    expect(hiddenSwitch()).toHaveProperty("checked", false);
    await act(async () => { fireEvent.click(editableSwitch()); });
    await waitFor(() => expect(component.editableByContentEditor).toBe(false));
    await act(async () => { studio.toggleContentEditorMode(); });
    expect(screen.queryByText("Editable by content editors")).toBeNull();
    expect(screen.queryByText("Hidden from content editors")).toBeNull();
    expect(screen.getByText("Second value")).toBeTruthy();
    await act(async () => { studio.toggleContentEditorMode(); });
    expect(editableSwitch()).toHaveProperty("checked", false);
    expect(hiddenSwitch()).toHaveProperty("checked", false);
    fireEvent.doubleClick(screen.getByText("Second value"));
    fireEvent.change(screen.getByDisplayValue("Second value"), { target: { value: "Edited second" } });
    await act(async () => {
      await studio.changeUnsafe(() => {
        removeComponentMetadata(component, "first");
        addOrEditComponentMetadata(component, "replacement", "Replacement value");
      });
    });
    expect(screen.queryByText("First value")).toBeNull();
    expect(screen.getByText("Replacement value")).toBeTruthy();
    const input = screen.getByDisplayValue("Edited second");
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(component.metadata.second).toBe("Edited second"));
    view.rerender(contents(other));
    expect(screen.getByText("Other value")).toBeTruthy();
    await act(async () => { await studio.changeUnsafe(() => addOrEditComponentMetadata(component, "second", "Old owner update")); });
    expect(screen.queryByText("Old owner update")).toBeNull();
    fireEvent.doubleClick(screen.getByText("Other value"));
    fireEvent.change(screen.getByDisplayValue("Other value"), { target: { value: "Edited other" } });
    fireEvent.keyDown(screen.getByDisplayValue("Edited other"), { key: "Enter" });
    await waitFor(() => expect(other.metadata.other).toBe("Edited other"));
    expect(component.metadata.second).toBe("Old owner update");
  } finally { view.unmount(); studio.dispose(); }
});
