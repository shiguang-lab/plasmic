import { productTheme } from "@/wab/client/antd-theme";
import { Modal } from "@/wab/client/components/widgets/Modal";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ConfigProvider } from "antd";
import * as React from "react";

afterEach(cleanup);

it("themes popup controls without relying on a theme class on the document body", () => {
  render(
    <ConfigProvider theme={productTheme("dark")}>
      <Modal title="Page settings" open footer={null}>
        <div className="templated-string-input" data-testid="portal-title">
          Page title
        </div>
        <div className="panel-dim-block" data-testid="portal-picker">
          Image picker
        </div>
      </Modal>
    </ConfigProvider>,
  );
  expect(
    getComputedStyle(screen.getByTestId("portal-title")).backgroundColor,
  ).toBe("rgb(32, 33, 40)");
  expect(getComputedStyle(screen.getByTestId("portal-title")).color).toBe(
    "rgb(237, 238, 245)",
  );
  expect(
    getComputedStyle(screen.getByTestId("portal-picker")).backgroundColor,
  ).toBe("rgb(21, 22, 27)");
});

it("opens and closes a focused product dialog through the native open contract", async () => {
  const onCancel = vi.fn();
  function Dialog() {
    const [open, setOpen] = React.useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Open product dialog</button>
        <Modal
          title="Product dialog"
          open={open}
          footer={null}
          onCancel={() => {
            onCancel();
            setOpen(false);
          }}
        >
          <input aria-label="Project name" />
        </Modal>
      </>
    );
  }
  render(<Dialog />);
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Open product dialog" }));
  expect(screen.getByRole("dialog")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(onCancel).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});
