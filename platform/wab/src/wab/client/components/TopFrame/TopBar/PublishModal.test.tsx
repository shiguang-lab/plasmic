import { PublishModal } from "@/wab/client/components/TopFrame/TopBar/PublishModal";
import { ensure } from "@/wab/shared/common";
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

it("opens publishing directly without delivery tabs and closes through its shared control", async () => {
  function Dialog() {
    const [open, setOpen] = React.useState(true);
    return (
      <PublishModal open={open} onClose={() => setOpen(false)} footer={null}>
        Publish settings
      </PublishModal>
    );
  }
  render(<Dialog />);
  expect(screen.getByRole("dialog", { name: "Publish" })).toBeTruthy();
  expect(screen.getByText("Publish settings")).toBeTruthy();
  expect(screen.queryByRole("tablist")).toBeNull();
  expect(screen.queryByText("Share")).toBeNull();
  expect(screen.queryByText("Export code")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it.each([false, true])(
  "protects a running publication from mask dismissal (busy: %s)",
  async (busy) => {
    const close = vi.fn();
    const { baseElement } = render(
      <PublishModal open busy={busy} onClose={close} footer={null}>
        Actual deployment status
      </PublishModal>,
    );
    const backdrop = ensure(
      baseElement.querySelector(".ant-modal-wrap"),
      "Missing modal backdrop",
    );
    fireEvent.mouseDown(backdrop);
    fireEvent.click(backdrop);
    await waitFor(() => expect(close).toHaveBeenCalledTimes(busy ? 0 : 1));
    expect(screen.getByText("Actual deployment status")).toBeTruthy();
  },
);
