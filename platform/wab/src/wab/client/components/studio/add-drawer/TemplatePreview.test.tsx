import AddDrawerItem from "@/wab/client/components/studio/add-drawer/AddDrawerItem";
import {
  AddInstallableItem,
  AddItemType,
} from "@/wab/client/definitions/insertables";
import { useDismissibleStudioOverlay } from "@/wab/client/hooks/useDismissibleStudioOverlay";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";
vi.mock("@/wab/client/i18n", () => ({
  useI18n: () => ({ locale: "en", t: (text: string) => text }),
}));
const item: AddInstallableItem = {
  type: AddItemType.installable,
  key: "page-template-project-GroupsPage",
  projectId: "project",
  label: "GroupsPage",
  icon: null,
  isPackage: false,
  factory: () => undefined,
  previewImageUrl: "/template-preview.png",
};
afterEach(cleanup);
it("opens a requested template preview without inserting and reports dismissal to the resource panel", async () => {
  const insert = vi.fn();
  const changed = vi.fn();
  const { rerender } = render(
    <AddDrawerItem
      variant="card"
      studioCtx={{} as StudioCtx}
      item={item}
      onInsert={insert}
      previewOpen={false}
      onPreviewOpenChange={changed}
    />,
  );
  expect(screen.queryByRole("dialog")).toBeNull();
  rerender(
    <AddDrawerItem
      variant="card"
      studioCtx={{} as StudioCtx}
      item={item}
      onInsert={insert}
      previewOpen
      onPreviewOpenChange={changed}
    />,
  );
  await screen.findByRole("dialog");
  expect(insert).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(changed).toHaveBeenCalledWith(false);
  expect(insert).not.toHaveBeenCalled();
});
it("opens a real template thumbnail preview without inserting, then invokes only the explicit create action", async () => {
  const insert = vi.fn();
  const parentClick = vi.fn();
  render(
    <div onClick={parentClick}>
      <AddDrawerItem
        variant="card"
        studioCtx={{} as StudioCtx}
        item={item}
        onInsert={insert}
      />
    </div>,
  );
  fireEvent.click(screen.getByText("GroupsPage", { exact: true }));
  const dialog = await screen.findByRole("dialog");
  expect(dialog.querySelector('img[alt="GroupsPage"]')).toHaveAttribute(
    "src",
    "/template-preview.png",
  );
  expect(insert).not.toHaveBeenCalled();
  expect(parentClick).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Create page" }));
  expect(insert).toHaveBeenCalledOnce();
  expect(parentClick).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});
it("allows read-only preview, reports missing thumbnails, and blocks creation", async () => {
  const insert = vi.fn();
  render(
    <AddDrawerItem
      variant="card"
      studioCtx={{} as StudioCtx}
      item={{ ...item, isDisabled: true, previewImageUrl: undefined }}
      onInsert={insert}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Preview template" }));
  await screen.findByText("This template has no preview image.");
  expect(screen.getByRole("button", { name: "Create page" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(insert).not.toHaveBeenCalled();
});
it("keeps the resource overlay open for native modal mouse and wheel events, but dismisses on outside interaction", async () => {
  const insert = vi.fn();
  const dismiss = vi.fn();
  function ResourceOverlay() {
    const ref = React.useRef<HTMLDivElement>(null);
    const [open, setOpen] = React.useState(true);
    useDismissibleStudioOverlay({
      overlayRef: ref,
      isOpen: open,
      onDismiss: () => {
        dismiss();
        setOpen(false);
      },
    });
    return (
      <>
        <button>Outside overlay</button>
        <div ref={ref}>
          {open && (
            <AddDrawerItem
              variant="card"
              studioCtx={{} as StudioCtx}
              item={item}
              onInsert={insert}
            />
          )}
        </div>
      </>
    );
  }
  render(<ResourceOverlay />);
  fireEvent.click(screen.getByRole("button", { name: "Preview template" }));
  const create = await screen.findByRole("button", { name: "Create page" });
  fireEvent.wheel(create);
  fireEvent.mouseDown(create);
  expect(dismiss).not.toHaveBeenCalled();
  fireEvent.click(create);
  expect(insert).toHaveBeenCalledOnce();
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  fireEvent.mouseDown(screen.getByRole("button", { name: "Outside overlay" }));
  expect(dismiss).toHaveBeenCalledOnce();
  expect(screen.queryByRole("button", { name: "Preview template" })).toBeNull();
});
