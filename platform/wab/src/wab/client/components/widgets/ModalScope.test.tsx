import { WithContextMenu } from "@/wab/client/components/ContextMenu";
import { Modal } from "@/wab/client/components/widgets/Modal";
import { useStudioEscape } from "@/wab/client/hooks/useStudioEscape";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";

afterEach(cleanup);

it("closes a nested portaled menu before the native dialog without passing Escape to the canvas", async () => {
  const cancel = vi.fn(),
    underlying = vi.fn();
  render(
    <Modal open onCancel={cancel} title="Settings">
      <WithContextMenu overlay={<button>Menu action</button>}>
        <button>Open menu</button>
      </WithContextMenu>
      <input aria-label="Setting" />
    </Modal>,
  );
  await screen.findByRole("dialog");
  fireEvent.contextMenu(screen.getByText("Open menu"));
  const action = await screen.findByRole("button", { name: "Menu action" });
  window.addEventListener("keydown", underlying);
  try {
    fireEvent.keyDown(action, { key: "Escape", keyCode: 27 });
    await waitFor(() => expect(screen.queryByText("Menu action")).toBeNull());
    fireEvent.keyUp(screen.getByLabelText("Setting"), {
      key: "Escape",
      keyCode: 27,
    });
    expect(cancel).not.toHaveBeenCalled();
    expect(underlying).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByLabelText("Setting"), {
      key: "Escape",
      keyCode: 27,
    });
    expect(cancel).toHaveBeenCalledOnce();
    expect(underlying).not.toHaveBeenCalled();
  } finally {
    window.removeEventListener("keydown", underlying);
  }
});

it("keeps composition and an input's consumed Escape inside the native dialog", async () => {
  const cancel = vi.fn();
  render(
    <Modal open onCancel={cancel}>
      <input aria-label="Composing" />
      <input
        aria-label="Editor"
        onKeyDown={(event) => event.preventDefault()}
      />
    </Modal>,
  );
  fireEvent.keyDown(await screen.findByLabelText("Composing"), {
    key: "Escape",
    keyCode: 27,
    isComposing: true,
  });
  fireEvent.keyDown(screen.getByLabelText("Editor"), {
    key: "Escape",
    keyCode: 27,
  });
  expect(cancel).not.toHaveBeenCalled();
});

it("keeps a keyboard-disabled modal above background Escape owners", async () => {
  const cancel = vi.fn(),
    background = vi.fn();
  function Fixture() {
    const root = React.useRef<HTMLDivElement>(null);
    useStudioEscape(root, true, background, false);
    return (
      <div ref={root}>
        <Modal open keyboard={false} onCancel={cancel}>
          <input aria-label="Locked" />
        </Modal>
      </div>
    );
  }
  render(<Fixture />);
  fireEvent.keyDown(await screen.findByLabelText("Locked"), { key: "Escape" });
  expect(cancel).not.toHaveBeenCalled();
  expect(background).not.toHaveBeenCalled();
});
