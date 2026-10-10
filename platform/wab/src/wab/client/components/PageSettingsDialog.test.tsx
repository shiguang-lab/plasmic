import { PageSettingsDialog } from "@/wab/client/components/PageSettingsDialog";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ComponentType, PageComponent } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { observable } from "mobx";
import React from "react";

const fixture = vi.hoisted(() => ({ viewCtxs: [] as any[] }));
vi.mock("@/wab/client/studio-ctx/StudioCtx", () => ({
  useStudioCtx: () => fixture,
}));
vi.mock("@/wab/client/components/PageSettings", () => ({
  default: ({ page, viewCtx }) => (
    <div>
      <input aria-label="Editing page" readOnly value={page.name} />
      <output data-testid="page-context">
        {viewCtx?.component.name ?? "No canvas context"}
      </output>
    </div>
  ),
}));
afterEach(cleanup);

it("identifies the requested page and excludes another page's canvas context", () => {
  const mgr = new TplMgr({ site: createSite() });
  const current = mgr.addComponent({ name: "Page1", type: ComponentType.Page });
  const page = mgr.addComponent({
    name: "Page2",
    type: ComponentType.Page,
  }) as PageComponent;
  const contexts = observable.array([{ component: current }], { deep: false });
  fixture.viewCtxs = contexts;
  const onClose = vi.fn();
  render(<PageSettingsDialog open page={page} onClose={onClose} />);
  expect(
    screen.getByRole("dialog").getAttribute("aria-labelledby"),
  ).toBeTruthy();
  expect(screen.getByText("Page settings: Page2")).toBeTruthy();
  expect(screen.getByTestId("page-context").textContent).toBe(
    "No canvas context",
  );
  act(() => {
    contexts.push({ component: page });
  });
  expect(screen.getByTestId("page-context").textContent).toBe("Page2");
});

it.each(["Done", "Close"])(
  "keeps page settings mounted after closing through %s and reopening",
  async (buttonName) => {
    const mgr = new TplMgr({ site: createSite() });
    const page = mgr.addComponent({
      name: "Page2",
      type: ComponentType.Page,
    }) as PageComponent;
    fixture.viewCtxs = [];
    const onClose = vi.fn();
    function Dialog() {
      const [open, setOpen] = React.useState(true);
      return (
        <>
          <button onClick={() => setOpen(true)}>Reopen settings</button>
          <PageSettingsDialog
            open={open}
            page={page}
            onClose={() => {
              onClose();
              setOpen(false);
            }}
          />
        </>
      );
    }
    render(<Dialog />);
    const field = screen.getByLabelText("Editing page");
    fireEvent.click(screen.getByRole("button", { name: buttonName }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(field.isConnected).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Reopen settings" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByLabelText("Editing page")).toBe(field);
  },
);
