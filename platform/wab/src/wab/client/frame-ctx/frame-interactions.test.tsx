import { AntdConfigProvider } from "@/wab/client/antd-theme";
import {
  dispatchFrameInteraction,
  isForwardedFrameInteraction,
  trackFrameInteractions,
} from "@/wab/client/frame-ctx/frame-interactions";
import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Dropdown, Input, Popover, Select } from "antd";
import * as React from "react";
import { useInteractOutside } from "react-aria";

afterEach(cleanup);
function canvas() {
  const studioFrame = document.createElement("iframe");
  document.body.append(studioFrame);
  const studio = studioFrame.contentDocument;
  if (!studio) {
    throw new Error("Missing studio document");
  }
  const canvasFrame = studio.createElement("iframe");
  studio.body.append(canvasFrame);
  const canvasDoc = canvasFrame.contentDocument;
  if (!canvasDoc) {
    throw new Error("Missing canvas document");
  }
  const topNotify = vi.fn((event) => dispatchFrameInteraction(document, event));
  const releaseStudio = trackFrameInteractions(studio, topNotify);
  const releaseCanvas = trackFrameInteractions(canvasDoc, (event) =>
    dispatchFrameInteraction(studio, event),
  );
  const selection = vi.fn((event: Event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
  });
  canvasDoc.addEventListener("pointerdown", selection, true);
  const click = () => {
    const win = canvasDoc.defaultView;
    if (!win) {
      throw new Error("Missing canvas window");
    }
    const down = new win.MouseEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
      button: 0,
      buttons: 1,
    });
    canvasDoc.body.dispatchEvent(down);
    canvasDoc.body.dispatchEvent(
      new win.MouseEvent("pointerup", { bubbles: true, button: 0 }),
    );
    canvasDoc.body.dispatchEvent(
      new win.MouseEvent("click", { bubbles: true, button: 0 }),
    );
    return down;
  };
  return {
    studio,
    canvasDoc,
    selection,
    topNotify,
    click,
    release: () => {
      releaseStudio();
      releaseCanvas();
      studioFrame.remove();
    },
  };
}

it("closes ordinary Antd Select, Dropdown and Popover across both iframe boundaries", async () => {
  render(
    <AntdConfigProvider productUI>
      <Select
        aria-label="Model"
        defaultValue="a"
        virtual={false}
        options={[
          { value: "a", label: "Default" },
          { value: "b", label: "Alternate" },
        ]}
      />
      <Dropdown
        trigger={["click"]}
        menu={{ items: [{ key: "item", label: "Menu action" }] }}
      >
        <button>Menu</button>
      </Dropdown>
      <Popover trigger="click" content="Popover content">
        <button>Details</button>
      </Popover>
    </AntdConfigProvider>,
  );
  const frame = canvas();
  try {
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Model" }));
    await waitFor(() => expect(screen.getByText("Alternate")).toBeVisible());
    // A body click alone does not notify Select's mousedown listener or blur.
    fireEvent.click(document.body);
    expect(screen.getByText("Alternate")).toBeVisible();
    frame.click();
    await waitFor(() =>
      expect(screen.getByText("Alternate")).not.toBeVisible(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    await waitFor(() => expect(screen.getByText("Menu action")).toBeVisible());
    frame.click();
    await waitFor(() =>
      expect(screen.getByText("Menu action")).not.toBeVisible(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    await waitFor(() =>
      expect(screen.getByText("Popover content")).toBeVisible(),
    );
    frame.click();
    await waitFor(() =>
      expect(screen.getByText("Popover content")).not.toBeVisible(),
    );
    expect(frame.selection).toHaveBeenCalledTimes(3);
    expect(frame.topNotify).toHaveBeenCalledTimes(9);
  } finally {
    frame.release();
  }
});

it("blurs an outer controlled input, preserves canvas input focus and the original selection event", () => {
  const blur = vi.fn();
  render(<Input aria-label="Draft" onBlur={blur} />);
  const frame = canvas();
  try {
    const input = screen.getByRole("textbox", { name: "Draft" });
    input.focus();
    const canvasInput = frame.canvasDoc.createElement("input");
    frame.canvasDoc.body.append(canvasInput);
    // Keep the iframe active in its receiving studio document.
    canvasInput.focus();
    input.focus();
    const down = frame.click();
    expect(blur).toHaveBeenCalled();
    expect(input).not.toHaveFocus();
    expect(frame.canvasDoc.activeElement).toBe(canvasInput);
    expect(down.defaultPrevented).toBe(true);
    expect(frame.selection).toHaveBeenCalledOnce();
  } finally {
    frame.release();
  }
});

it("delivers complete outside interaction to React Aria and marks replayed canvas events", () => {
  const outside = vi.fn();
  function Overlay() {
    const ref = React.useRef<HTMLDivElement>(null);
    useInteractOutside({ ref, onInteractOutside: outside });
    return <div ref={ref}>Overlay</div>;
  }
  render(<Overlay />);
  const frame = canvas();
  const replayed = vi.fn((event) => {
    expect(isForwardedFrameInteraction(event)).toBe(true);
  });
  document.body.addEventListener("mousedown", replayed);
  try {
    fireEvent.click(document.body);
    expect(outside).not.toHaveBeenCalled();
    frame.click();
    expect(outside).toHaveBeenCalledOnce();
    expect(replayed).toHaveBeenCalledOnce();
    frame.release();
    fireEvent(
      frame.canvasDoc.body,
      new MouseEvent("pointerdown", { bubbles: true }),
    );
    expect(replayed).toHaveBeenCalledOnce();
  } finally {
    document.body.removeEventListener("mousedown", replayed);
    frame.release();
  }
});
