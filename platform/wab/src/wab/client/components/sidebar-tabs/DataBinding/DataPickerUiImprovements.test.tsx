import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import DataPicker from "@/wab/client/components/sidebar-tabs/DataBinding/DataPicker";
import DataPickerColumn from "@/wab/client/components/sidebar-tabs/DataBinding/DataPickerColumn";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { setUiLocale } from "@/wab/client/i18n";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";

afterEach(() => {
  cleanup();
});

describe("DataPicker UI Improvements", () => {
  it("renders DataPickerColumn with Scrollbar container", async () => {
    const { studioCtx: mockStudioCtx } = fakeStudioCtx();
    await waitFor(() => expect(mockStudioCtx.initialRouteReady).toBe(true));

    const data = {
      user: {
        name: "Alice",
        age: 30,
      },
    };
    const columnItems = [
      { name: "name", value: "Alice", pathPrefix: ["user"] },
      { name: "age", value: 30, pathPrefix: ["user"] },
    ];

    const { container, unmount } = render(
      <StudioCtxContext.Provider value={mockStudioCtx}>
        <DataPickerColumn
          columnIndex={0}
          data={data}
          selectedItem={undefined}
          isActiveColumn={true}
          columnItems={columnItems}
          onItemSelected={() => {}}
          opts={{ showAdvancedFields: false }}
        />
      </StudioCtxContext.Provider>,
    );

    // OverlayScrollbarsComponent (the underlying component of Scrollbar) creates an element with data-overlayscrollbars or class os-host / os-viewport
    const osElement = container.querySelector(
      "[data-overlayscrollbars-initialize], [data-overlayscrollbars-contents]",
    );
    expect(osElement).toBeTruthy();
    unmount();
    mockStudioCtx.dispose();
  });

  it("localizes 'Add new Query' and 'Add new State Variable' buttons based on current locale", async () => {
    await act(async () => {
      await setUiLocale("zh-CN");
    });

    const onAddQuery = vi.fn();
    const onAddVariableBtnClick = vi.fn();

    const { rerender } = render(
      <DataPicker
        data={{}}
        value={undefined}
        withAddQuery={true}
        onAddQuery={onAddQuery}
        onAddVariableBtnClick={onAddVariableBtnClick}
        onChange={() => {}}
        onCancel={() => {}}
      />,
    );

    // Should display localized Chinese text, not hardcoded English "Add new data query" or "Add new variable"
    expect(screen.getByText("新增查询")).toBeTruthy();
    expect(screen.getByText("新增状态变量")).toBeTruthy();
    expect(screen.queryByText("Add new data query")).toBeNull();
    expect(screen.queryByText("Add new variable")).toBeNull();

    // Now switch locale to English
    await act(async () => {
      await setUiLocale("en");
    });

    rerender(
      <DataPicker
        data={{}}
        value={undefined}
        withAddQuery={true}
        onAddQuery={onAddQuery}
        onAddVariableBtnClick={onAddVariableBtnClick}
        onChange={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByText("Add new Query")).toBeTruthy();
    expect(screen.getByText("Add new State Variable")).toBeTruthy();
  });
});
