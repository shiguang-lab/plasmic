import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import DataPicker from "@/wab/client/components/sidebar-tabs/DataBinding/DataPicker";
import DataPickerColumn from "@/wab/client/components/sidebar-tabs/DataBinding/DataPickerColumn";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { setUiLocale } from "@/wab/client/i18n";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as pickerUtil from "./DataPickerUtil";
import * as React from "react";

afterEach(() => {
  cleanup();
});

describe("DataPicker UI Improvements", () => {
  it("windows a large data column and scrolls to a selection outside the first window", async () => {
    const { studioCtx } = fakeStudioCtx();
    await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
    const records = Array.from({ length: 1000 }, (_, index) => `value-${index}`);
    const data = { records };
    const opts = { showAdvancedFields: false };
    const columnItems = pickerUtil.mkColumnItems(records, ["records"], opts);
    const column = (selectedItem: number) => (
      <StudioCtxContext.Provider value={studioCtx}>
        <DataPickerColumn data={data} columnIndex={0} isActiveColumn
          columnItems={columnItems} opts={opts} selectedItem={selectedItem}
          onItemSelected={() => {}} />
      </StudioCtxContext.Provider>
    );
    const view = render(column(0));
    try {
      expect(screen.getByText('"value-0"')).toBeTruthy();
      expect(screen.queryByText('"value-999"')).toBeNull();
      view.rerender(column(999));
      expect(screen.getByText('"value-999"')).toBeTruthy();
      expect(screen.queryByText('"value-0"')).toBeNull();
    } finally {
      view.unmount();
      studioCtx.dispose();
    }
  });

  it("skips previews for search misses and mounts only a window of matches", async () => {
    vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
    const { studioCtx } = fakeStudioCtx();
    const preview = vi.spyOn(pickerUtil, "evalExpr");
    const scan = vi.spyOn(pickerUtil, "getVariableType");
    try {
      await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
      const data = { records: Array.from({ length: 1000 }, (_, index) => ({ label: `value-${index}` })) };
      const view = render(
        <StudioCtxContext.Provider value={studioCtx}>
          <DataPicker data={data} value={undefined} onChange={() => {}} onCancel={() => {}} />
        </StudioCtxContext.Provider>,
      );
      try {
        const input = screen.getByRole("textbox");
        preview.mockClear();
        scan.mockClear();
        fireEvent.change(input, { target: { value: "absent-field" } });
        await waitFor(() => expect(scan).toHaveBeenCalledWith("value-999"));
        expect(preview.mock.calls.filter(([path]) => path[0] === "records")).toHaveLength(0);
        fireEvent.change(input, { target: { value: "label" } });
        await waitFor(() => expect(screen.getByText('"value-0"')).toBeTruthy());
        expect(screen.queryByText('"value-999"')).toBeNull();
        expect(preview.mock.calls.filter(([path]) => path[0] === "records").length).toBeLessThan(30);
      } finally {
        view.unmount();
      }
    } finally {
      preview.mockRestore();
      scan.mockRestore();
      studioCtx.dispose();
      vi.unstubAllGlobals();
    }
  });

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
