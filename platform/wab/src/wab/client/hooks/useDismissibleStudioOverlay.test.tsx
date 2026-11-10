import { useDismissibleStudioOverlay } from "@/wab/client/hooks/useDismissibleStudioOverlay";
import { useStudioEscape } from "@/wab/client/hooks/useStudioEscape";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { createPortal } from "react-dom";

afterEach(cleanup);
function Overlay({
  dismiss,
  children,
}: {
  dismiss: (event: Event) => void;
  children?: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  useDismissibleStudioOverlay({ overlayRef: ref, onDismiss: dismiss });
  return (
    <div ref={ref}>
      <input aria-label="Inside" />
      {children}
    </div>
  );
}
it("delivers an outside wheel once and leaves inside pointer/selection events untouched", () => {
  const dismiss = vi.fn();
  render(
    <div className="studio">
      <Overlay dismiss={dismiss} />
      <button>Outside</button>
    </div>,
  );
  fireEvent.wheel(screen.getByRole("button"));
  expect(dismiss).toHaveBeenCalledOnce();
  const input = screen.getByRole("textbox");
  const bubbled = vi.fn();
  document.addEventListener("mousedown", bubbled);
  try {
    fireEvent.mouseDown(input);
    fireEvent.wheel(input);
    expect(bubbled).toHaveBeenCalledOnce();
    expect(dismiss).toHaveBeenCalledOnce();
  } finally {
    document.removeEventListener("mousedown", bubbled);
  }
});
it("handles Escape from inside, defers composition, and respects a child that consumes Escape", () => {
  const dismiss = vi.fn();
  render(
    <Overlay dismiss={dismiss}>
      <input aria-label="Child" onKeyDown={(event) => event.preventDefault()} />
    </Overlay>,
  );
  fireEvent.keyDown(screen.getByLabelText("Inside"), {
    key: "Escape",
    isComposing: true,
  });
  fireEvent.keyDown(screen.getByLabelText("Child"), { key: "Escape" });
  expect(dismiss).not.toHaveBeenCalled();
  fireEvent.keyDown(screen.getByLabelText("Inside"), { key: "Escape" });
  expect(dismiss).toHaveBeenCalledOnce();
});
it("closes a nested portaled layer before its parent and cleans it on unmount", () => {
  const parent = vi.fn(),
    child = vi.fn();
  function Nested() {
    const ref = React.useRef<HTMLDivElement>(null);
    useStudioEscape(ref, true, child);
    return createPortal(
      <div ref={ref}>
        <input aria-label="Nested" />
      </div>,
      document.body,
    );
  }
  function Fixture() {
    const [open, setOpen] = React.useState(false);
    return (
      <Overlay dismiss={parent}>
        <button onClick={() => setOpen(true)}>Open</button>
        {open && <Nested />}
      </Overlay>
    );
  }
  const ui = render(<Fixture />);
  fireEvent.click(screen.getByRole("button"));
  fireEvent.keyDown(screen.getByLabelText("Nested"), { key: "Escape" });
  expect(child).toHaveBeenCalledOnce();
  expect(parent).not.toHaveBeenCalled();
  ui.unmount();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(child).toHaveBeenCalledOnce();
  expect(parent).not.toHaveBeenCalled();
});
