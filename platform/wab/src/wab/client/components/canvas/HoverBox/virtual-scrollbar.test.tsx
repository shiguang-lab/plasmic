import { VirtualScrollBar } from "@/wab/client/components/canvas/HoverBox/virtual-scrollbar";
import { act, render } from "@testing-library/react";
import React from "react";

vi.mock("@/wab/client/studio-ctx/StudioCtx", () => ({
  useStudioCtx: () => ({ zoom: 1 }),
}));
vi.mock("@/wab/commons/components/XDraggable", () => ({
  XDraggable: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function element(overflow: string) {
  const node = document.createElement("div");
  node.style.overflowY = overflow;
  for (const [key, value] of Object.entries({
    clientHeight: 100,
    scrollHeight: 500,
  })) {
    Object.defineProperty(node, key, { value });
  }
  return node;
}

it.each(["auto", "scroll"])(
  "keeps the editor thumb in sync for overflow %s",
  (overflow) => {
    const node = element(overflow);
    const { container, unmount } = render(
      <VirtualScrollBar element={node} axis="vertical" />,
    );
    const thumb = container.querySelector<HTMLElement>(
      ".HoverBox__ScrollBar__Thumb",
    );
    expect(thumb?.style.height).toBe("20%");
    expect(thumb?.style.top).toBe("0%");
    act(() => {
      node.scrollTop = 200;
      node.dispatchEvent(new Event("scroll"));
    });
    expect(thumb?.style.top).toBe("40%");
    const remove = vi.spyOn(node, "removeEventListener");
    unmount();
    expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function));
  },
);

it.each(["hidden", "clip", "visible"])(
  "does not expose editor scrolling for overflow %s",
  (overflow) => {
    const { container } = render(
      <VirtualScrollBar element={element(overflow)} axis="vertical" />,
    );
    expect(container.childElementCount).toBe(0);
  },
);
