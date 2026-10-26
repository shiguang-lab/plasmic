import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { Popconfirm } from "antd";
import React from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { ActionGroup } from "../src/registerActionGroup";

// This is the skill's row-confirmation composition. The native span supplies
// Popconfirm's DOM ref; ActionGroup itself does not forward a ref.
function ConfirmedRowActions({
  max = 3,
  onMutate,
  items,
}: {
  max?: number;
  onMutate: (key: string) => void;
  items: { key: string; label: string; danger?: boolean }[];
}) {
  const [pending, setPending] = React.useState<string>();
  return (
    <Popconfirm
      open={pending !== undefined}
      title="删除初始化客群"
      description="到期用户召回：删除后无法恢复。"
      okText="删除"
      cancelText="取消"
      okButtonProps={{ danger: true }}
      onOpenChange={(open) => !open && setPending(undefined)}
      onCancel={() => setPending(undefined)}
      onConfirm={() => {
        if (pending) onMutate(pending);
        setPending(undefined);
      }}
    >
      <span data-testid="RowActionAnchor" style={{ display: "inline-block" }}>
        <ActionGroup
          max={max}
          items={items}
          onAction={(key) => (key === "delete" ? setPending(key) : onMutate(key))}
        />
      </span>
    </Popconfirm>
  );
}

const deletion = { key: "delete", label: "删除", danger: true };

test("row confirmation positions against its native DOM anchor", async () => {
  const nativeComputedStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((element) =>
    new Proxy(nativeComputedStyle(element), {
      get(style, property) {
        if (property === "width") return "100px";
        if (property === "height") return "40px";
        return Reflect.get(style, property);
      },
    }),
  );
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(100);
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(40);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    () => new DOMRect(200, 200, 100, 40),
  );

  render(<ConfirmedRowActions items={[deletion]} onMutate={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "删除" }));
  const popover = await screen.findByRole("tooltip");
  await vi.waitFor(() => {
    const popup = popover.closest<HTMLElement>(".ant-popover");
    expect(popup).not.toBeNull();
    // Antd leaves an unanchored popup at these offscreen coordinates.
    expect(popup?.style.left).not.toBe("-1000vw");
    expect(popup?.style.top).not.toBe("-1000vh");
  });
});

test("a confirmed action does not mutate before confirm or after cancel", async () => {
  const onMutate = vi.fn();
  render(<ConfirmedRowActions items={[deletion]} onMutate={onMutate} />);
  fireEvent.click(screen.getByRole("button", { name: "删除" }));
  const popover = await screen.findByRole("tooltip");
  expect(within(popover).getByText("到期用户召回：删除后无法恢复。")).toBeTruthy();
  expect(onMutate).not.toHaveBeenCalled();
  fireEvent.click(within(popover).getByRole("button", { name: /取\s*消/ }));
  expect(onMutate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "删除" }));
  const reopened = await screen.findByRole("tooltip");
  fireEvent.click(within(reopened).getByRole("button", { name: /删\s*除/ }));
  expect(onMutate).toHaveBeenCalledExactlyOnceWith("delete");
});

test("a folded More action opens the same confirmation; unconfirmed actions run directly", async () => {
  const onMutate = vi.fn();
  render(
    <ConfirmedRowActions
      items={[
        { key: "detail", label: "详情" },
        { key: "edit", label: "编辑" },
        { key: "copy", label: "复制" },
        deletion,
      ]}
      onMutate={onMutate}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "详情" }));
  expect(onMutate).toHaveBeenCalledExactlyOnceWith("detail");
  expect(screen.queryByRole("tooltip")).toBeNull();
  // @react/ui opens More on click by default.
  fireEvent.click(screen.getByRole("button", { name: /更多/ }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "删除" }));
  const popover = await screen.findByRole("tooltip");
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(within(popover).getByRole("button", { name: /删\s*除/ }));
  expect(onMutate).toHaveBeenLastCalledWith("delete");
});

test("an outside click dismisses the confirmation without mutating", async () => {
  const onMutate = vi.fn();
  render(<ConfirmedRowActions items={[deletion]} onMutate={onMutate} />);
  fireEvent.click(screen.getByRole("button", { name: "删除" }));
  const popover = await screen.findByRole("tooltip");
  await act(
    () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
  );
  fireEvent.pointerDown(document.body);
  fireEvent.mouseDown(document.body);
  fireEvent.click(document.body);
  // jsdom does not complete Antd CSS motion; leaving proves open became false.
  await vi.waitFor(() =>
    expect(popover.closest(".ant-popover")?.className).toMatch(
      /ant-zoom-big-leave|ant-popover-hidden/,
    ),
  );
  expect(onMutate).not.toHaveBeenCalled();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
beforeAll(() => {
  window.matchMedia = vi
    .fn()
    .mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
