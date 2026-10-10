import InsertPanelWrapper from "@/wab/client/components/insert-panel/InsertPanelWrapper";
import { Modal } from "@/wab/client/components/widgets/Modal";
import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";

const close = vi.hoisted(() => vi.fn());
vi.mock("@/wab/client/studio-ctx/StudioCtx", () => ({
  useStudioCtx: () => ({
    showAddDrawer: () => true,
    leftPaneWidth: 427,
    changeUnsafe: async (fn: () => void) => fn(),
    setShowAddDrawer: close,
  }),
}));
vi.mock("@/wab/client/components/insert-panel/InsertPanel", () => ({
  default: function Panel() {
    const [confirm, setConfirm] = React.useState(false);
    return (
      <>
        <button onClick={() => setConfirm(true)}>
          Delete referenced asset
        </button>
        <Modal open={confirm} title="Deleting asset" footer={null}>
          <button onClick={() => setConfirm(false)}>Cancel deletion</button>
        </Modal>
      </>
    );
  },
}));
afterEach(() => {
  cleanup();
  close.mockClear();
});
it("retains the resource panel while cancelling a tracked confirmation modal and still dismisses outside afterward", async () => {
  render(
    <>
      <button>Outside resource panel</button>
      <InsertPanelWrapper />
    </>,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Delete referenced asset" }),
  );
  const cancel = await screen.findByRole("button", { name: "Cancel deletion" });
  fireEvent.mouseDown(cancel);
  expect(close).not.toHaveBeenCalled();
  fireEvent.click(cancel);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(
    screen.getByRole("button", { name: "Delete referenced asset" }),
  ).toBeVisible();
  fireEvent.mouseDown(
    screen.getByRole("button", { name: "Outside resource panel" }),
  );
  await waitFor(() => expect(close).toHaveBeenCalledWith(false));
});

it("leaves dismissal to the rail action so switching tools does not also toggle the restored panel", () => {
  render(
    <>
      <div id="left-tab-strip">
        <button>Layers</button>
      </div>
      <InsertPanelWrapper />
    </>,
  );
  fireEvent.mouseDown(screen.getByRole("button", { name: "Layers" }));
  expect(close).not.toHaveBeenCalled();
});

it("uses the shared left panel width and viewport limit", () => {
  render(<InsertPanelWrapper />);
  expect(
    screen.getByRole("button", { name: "Delete referenced asset" })
      .parentElement,
  ).toHaveStyle({
    width: "427px",
    maxWidth: "calc(100vw - 96px)",
  });
});
