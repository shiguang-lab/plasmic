import { absorbEditingCanvasEvent } from "@/wab/client/components/canvas/canvas-interactions";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { fireEvent, render } from "@testing-library/react";
import React from "react";
import { expect, it, vi } from "vitest";

it.each(["edit", "interactive", "live", "text"])(
  "keeps selection separate from runtime handlers in %s mode",
  (mode) => {
    const click = vi.fn();
    const pointer = vi.fn();
    const viewCtx = {
      studioCtx: {
        isLiveMode: mode === "live",
        isInteractiveMode: mode === "interactive",
      },
      viewOps: { isEditing: () => mode === "text" },
    } as unknown as ViewCtx;
    const container = document.createElement("div");
    document.body.append(container);
    const absorb = (event: Event) => absorbEditingCanvasEvent(event, viewCtx);
    container.addEventListener("click", absorb, true);
    const view = render(
      <button onClick={click} onPointerDown={pointer}>
        Canvas image
      </button>,
      { container },
    );
    fireEvent.pointerDown(view.getByRole("button"));
    fireEvent.click(view.getByRole("button"));
    expect(pointer).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledTimes(mode === "edit" ? 0 : 1);
    view.unmount();
    container.remove();
  },
);
