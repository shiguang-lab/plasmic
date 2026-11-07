import InsertPanelWrapper from "@/wab/client/components/insert-panel/InsertPanelWrapper";
import { Modal } from "@/wab/client/components/widgets/Modal";
import { StudioLeftPanelState } from "@/wab/client/studio-ctx/left-panel-state";
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";

const close = vi.hoisted(() => vi.fn());
const fixture = vi.hoisted(() => ({ ctx: undefined as any }));
vi.mock("@/wab/client/contexts/StudioContexts", () => ({
  useStudioCtx: () => fixture.ctx,
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
beforeEach(() => {
  const leftPanelState = new StudioLeftPanelState();
  leftPanelState.setPanel({ type: "insert", inline: false });
  fixture.ctx = {
    leftPanelState,
    get leftTabGroup() { return leftPanelState.leftTabGroup; },
    leftPaneWidth: 427,
    changeUnsafe: async (fn: () => void) => fn(),
    setShowAddDrawer: (show: boolean) => {
      close(show);
      leftPanelState.setPanel(
        show ? { type: "insert", inline: false } : undefined,
      );
    },
  };
});
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

it("tracks the canonical native drawer state for outside dismissal", async () => {
  render(
    <>
      <button>Outside resource panel</button>
      <InsertPanelWrapper />
    </>,
  );
  await act(() => fixture.ctx.leftPanelState.setPanel(undefined));
  fireEvent.mouseDown(
    screen.getByRole("button", { name: "Outside resource panel" }),
  );
  expect(close).not.toHaveBeenCalled();
});

it("uses native tab-group state when deciding outside dismissal", async () => {
  render(
    <>
      <button>Outside resource panel</button>
      <InsertPanelWrapper />
    </>,
  );
  await act(() => fixture.ctx.leftPanelState.setLeftTabGroup("more"));
  fireEvent.mouseDown(
    screen.getByRole("button", { name: "Outside resource panel" }),
  );
  expect(close).not.toHaveBeenCalled();

  await act(() => fixture.ctx.leftPanelState.setLeftTabGroup(undefined));
  fireEvent.mouseDown(
    screen.getByRole("button", { name: "Outside resource panel" }),
  );
  expect(close).toHaveBeenCalledWith(false);
});

it("does not dismiss when a submenu overlays the insert content", () => {
  render(
    <>
      <div className="sidebar-popover">
        <button>Images</button>
      </div>
      <InsertPanelWrapper />
    </>,
  );
  fireEvent.mouseDown(screen.getByRole("button", { name: "Images" }));
  expect(close).not.toHaveBeenCalled();
});

it("reads the current tab group before the dismiss event's React commit", async () => {
  render(<><button>Outside command boundary</button><InsertPanelWrapper /></>);
  const outside = screen.getByRole("button", { name: "Outside command boundary" });
  await act(() => {
    fixture.ctx.leftPanelState.setLeftTabGroup("more");
    outside.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  });
  expect(close).not.toHaveBeenCalled();
});
