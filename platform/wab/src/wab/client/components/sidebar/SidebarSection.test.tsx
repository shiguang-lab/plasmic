import { SidebarSection } from "@/wab/client/components/sidebar/SidebarSection";
import { isEmptyReactNode } from "@/wab/commons/ViewUtil";
import { setUiLocale } from "@/wab/client/i18n";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";

afterEach(() => {
  cleanup();
});

describe("isEmptyReactNode", () => {
  it("detects null, undefined, false, empty string, and empty arrays as empty", () => {
    expect(isEmptyReactNode(null)).toBe(true);
    expect(isEmptyReactNode(undefined)).toBe(true);
    expect(isEmptyReactNode(false)).toBe(true);
    expect(isEmptyReactNode("")).toBe(true);
    expect(isEmptyReactNode([])).toBe(true);
    expect(isEmptyReactNode([null, false, undefined])).toBe(true);
  });

  it("detects empty React.Fragment and fragments containing empty arrays as empty", () => {
    expect(isEmptyReactNode(<React.Fragment />)).toBe(true);
    expect(isEmptyReactNode(<>{[]}</>)).toBe(true);
    expect(isEmptyReactNode(<>{[].map((x) => x)}</>)).toBe(true);
    expect(isEmptyReactNode(<>{false}{undefined}{[]}</>)).toBe(true);
  });

  it("detects non-empty nodes correctly", () => {
    expect(isEmptyReactNode(<div>Hello</div>)).toBe(false);
    expect(isEmptyReactNode(<span></span>)).toBe(false);
    expect(isEmptyReactNode(<>{<div>Item</div>}</>)).toBe(false);
    expect(isEmptyReactNode("text")).toBe(false);
    expect(isEmptyReactNode(0)).toBe(false);
  });
});

describe("SidebarSection with Option A Collapse", () => {
  beforeEach(async () => {
    await act(async () => {
      await setUiLocale("zh-CN");
    });
  });

  it("does NOT render expansion toggle when rows content is empty", () => {
    const { container } = render(
      <SidebarSection title="测试区块">
        {(renderMaybeCollapsibleRows) =>
          renderMaybeCollapsibleRows([
            {
              collapsible: true,
              content: <>{[].map((x) => x)}</>,
            },
          ])
        }
      </SidebarSection>,
    );

    // No toggle button should be rendered when there are no actual items
    expect(container.querySelector('[data-test-id="collapse"]')).toBeNull();
    expect(screen.queryByText("更多选项")).toBeNull();
    expect(screen.queryByText("收起")).toBeNull();
  });

  it("renders Option A inline pill toggle with text and toggles on click", () => {
    const { container } = render(
      <SidebarSection title="尺寸设置">
        {(renderMaybeCollapsibleRows) =>
          renderMaybeCollapsibleRows([
            {
              collapsible: false,
              content: <div>常驻宽度</div>,
            },
            {
              collapsible: true,
              content: <div>高级最大宽度</div>,
            },
          ])
        }
      </SidebarSection>,
    );

    // Initial state: collapsible item is hidden
    expect(screen.getByText("常驻宽度")).toBeTruthy();
    expect(screen.queryByText("高级最大宽度")).toBeNull();

    // Toggle button should be rendered with Option A text "更多选项"
    const toggleButton = screen.getByRole("button", { name: "更多选项" });
    expect(toggleButton).toBeTruthy();
    expect(screen.getByText("更多选项")).toBeTruthy();

    // Click to expand
    fireEvent.click(toggleButton);

    // Now advanced item should be visible
    expect(screen.getByText("高级最大宽度")).toBeTruthy();
    // Button label switches to "收起"
    expect(screen.getByText("收起")).toBeTruthy();

    // Click to collapse again
    fireEvent.click(toggleButton);
    expect(screen.queryByText("高级最大宽度")).toBeNull();
    expect(screen.getByText("更多选项")).toBeTruthy();
  });

  it("supports English locale labels", async () => {
    await act(async () => {
      await setUiLocale("en");
    });

    render(
      <SidebarSection title="Size Settings">
        {(renderMaybeCollapsibleRows) =>
          renderMaybeCollapsibleRows([
            {
              collapsible: false,
              content: <div>Width</div>,
            },
            {
              collapsible: true,
              content: <div>Max Width</div>,
            },
          ])
        }
      </SidebarSection>,
    );

    expect(screen.getByText("More options")).toBeTruthy();
    const toggleButton = screen.getByRole("button", { name: "More options" });
    fireEvent.click(toggleButton);
    expect(screen.getByText("Show less")).toBeTruthy();
  });

  it("respects defaultExpanded={false} when body has content", () => {
    render(
      <SidebarSection title="Collapsed by default" defaultExpanded={false}>
        <div>Hidden body content</div>
      </SidebarSection>,
    );

    expect(screen.queryByText("Hidden body content")).toBeNull();
  });

  it("handles non-ReactElement primitive text in rows without crashing", () => {
    render(
      <SidebarSection title="Text Rows">
        {(renderMaybeCollapsibleRows) =>
          renderMaybeCollapsibleRows([
            {
              collapsible: false,
              content: "Plain text row",
            },
          ])
        }
      </SidebarSection>,
    );

    expect(screen.getByText("Plain text row")).toBeTruthy();
  });
});
