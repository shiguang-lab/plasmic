import type { PlasmicCanvasProps } from "@plasmicapp/host";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { expect, test, vi } from "vitest";
import { CanvasSessionState } from "../../../platform/wab/src/wab/client/components/canvas/canvas-session-state";
import { useCanvasOverlay } from "../src/canvas-overlay";
import type { Registerable } from "../src/utils";
import { createSessionCanvas } from "./canvas-session";

type SurfaceProps = PlasmicCanvasProps & {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
  children?: React.ReactNode;
};

function ExtensionSurface(props: SurfaceProps) {
  const { open, props: canvasProps } = useCanvasOverlay(props, "trigger");
  return <>{props.trigger}{open ? <section aria-label="Extension content">
    {props.children}
    <button onClick={() => canvasProps.onOpenChange?.(false)}>Dismiss extension</button>
  </section> : null}</>;
}

function registerExtension(loader: Registerable) {
  loader.registerComponent(ExtensionSurface, {
    name: "extension-reveal-surface",
    canvasOverlay: { triggerSlot: "trigger" },
    props: {
      open: "boolean",
      defaultOpen: "boolean",
      onOpenChange: { type: "eventHandler", argTypes: [{ name: "open", type: "boolean" }] },
      children: "slot",
      trigger: "slot",
    },
  });
}

const Canvas = createSessionCanvas([registerExtension]);

test.each([false, true])("a new registered overlay reveals through the shared contract in interactive=%s", interactive => {
  const session = new CanvasSessionState(), onOpenChange = vi.fn();
  const businessProps = Object.freeze({ open: false, onOpenChange });
  const page = (slot: string | null, mode = interactive) => <Canvas session={session} interactive={mode}>
    <ExtensionSurface key="surface" {...businessProps} __canvas={{ selected: slot !== null, slot }}>
      <input aria-label="Extension draft" defaultValue="Retained input" />
    </ExtensionSurface>
  </Canvas>;
  const view = render(page(null));
  expect(screen.queryByRole("region")).toBeNull();
  view.rerender(page("trigger"));
  expect(screen.queryByRole("region")).toBeNull();
  view.rerender(page("children"));
  const field = screen.getByRole("textbox", { name: "Extension draft" });
  expect(session.getRuntime("root/surface", "open")).toBe(false);
  expect(onOpenChange).not.toHaveBeenCalled();
  view.rerender(page("children", !interactive));
  expect(screen.getByRole("textbox", { name: "Extension draft" })).toBe(field);
  view.rerender(page("children"));
  fireEvent.click(screen.getByRole("button", { name: "Dismiss extension" }));
  expect(onOpenChange).toHaveBeenCalledTimes(interactive ? 1 : 0);
  expect(!!screen.queryByRole("region")).toBe(!interactive);
  expect(businessProps.open).toBe(false);
  view.unmount();
  render(<ExtensionSurface {...businessProps} __canvas={{ selected: true, slot: "children" }} />);
  expect(screen.queryByRole("region")).toBeNull();
});
