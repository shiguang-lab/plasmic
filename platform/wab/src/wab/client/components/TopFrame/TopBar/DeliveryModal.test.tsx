import {
  DeliveryModal,
  DeliveryTab,
} from "@/wab/client/components/TopFrame/TopBar/DeliveryModal";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import * as React from "react";

vi.mock("@/wab/client/i18n", () => ({
  useI18n: () => ({ t: (label: string) => label }),
}));
afterEach(cleanup);

it("switches delivery workflows within one dialog and closes through its shared control", async () => {
  function Dialog() {
    const [tab, setTab] = React.useState<DeliveryTab>("share");
    const [open, setOpen] = React.useState(true);
    return (
      <DeliveryModal
        tab={tab}
        open={open}
        onSelectDelivery={setTab}
        onClose={() => setOpen(false)}
      >
        <div>
          {tab === "share"
            ? "Permission editor"
            : tab === "code"
              ? "Code integration"
              : "Publish settings"}
        </div>
      </DeliveryModal>
    );
  }
  render(<Dialog />);
  fireEvent.click(screen.getByRole("tab", { name: "Export code" }));
  expect(screen.getByText("Code integration")).toBeTruthy();
  expect(screen.queryByText("Permission editor")).toBeNull();
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  fireEvent.click(screen.getByRole("tab", { name: "Publish" }));
  expect(screen.getByText("Publish settings")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it("keeps a running publication in its current workflow", () => {
  const change = vi.fn();
  render(
    <DeliveryModal
      tab="publish"
      open
      busy
      onSelectDelivery={change}
      onClose={vi.fn()}
    >
      Actual deployment status
    </DeliveryModal>,
  );
  fireEvent.click(screen.getByRole("tab", { name: "Export code" }));
  expect(change).not.toHaveBeenCalled();
  expect(screen.getByText("Actual deployment status")).toBeTruthy();
});
