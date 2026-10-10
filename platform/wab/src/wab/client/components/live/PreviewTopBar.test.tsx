import { PreviewTopBar } from "@/wab/client/components/live/PreviewTopBar";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";
const mocks = vi.hoisted(() => ({
  preview: {
    component: { uuid: "page", name: "Page1", kind: "page" },
    viewport: "desktop",
    width: 1440,
    height: 900,
    studioCtx: {
      site: {
        components: [] as { uuid: string; name: string; kind: string }[],
      },
    },
    pushViewport: vi.fn(),
    pushComponent: vi.fn(),
    toggleLiveMode: vi.fn(),
  },
  variants: [] as object[],
}));
vi.mock("@/wab/client/components/live/PreviewCtx", () => ({
  usePreviewCtx: () => mocks.preview,
}));
vi.mock("@/wab/client/studio-ctx/StudioCtx", () => ({
  useStudioCtx: () => ({ site: {} }),
}));
vi.mock("@/wab/client/components/top-bar/VariantsComboSelect", () => ({
  default: () => <button>Configured variants</button>,
}));
vi.mock("@/wab/client/components/top-bar/CodeButton", () => ({
  default: () => <button>Code</button>,
}));
vi.mock("@/wab/client/components/widgets/Icon", () => ({ Icon: () => null }));
vi.mock("@/wab/client/i18n", () => ({
  useI18n: () => ({ t: (text: string) => text }),
}));
vi.mock("@/wab/shared/Variants", () => ({
  getAllVariantsForTpl: () => mocks.variants,
  isBaseVariant: () => false,
  isPrivateStyleVariant: () => false,
  isScreenVariant: () => false,
  isStyleOrCodeComponentVariant: () => false,
}));
vi.mock("@/wab/shared/core/components", () => ({
  isCodeComponent: () => false,
  isFrameComponent: (c: { kind: string }) => c.kind === "artboard",
  isPageComponent: (c: { kind: string }) => c.kind === "page",
  isReusableComponent: (c: { kind: string }) => c.kind === "component",
}));
vi.mock("@/wab/shared/sort", () => ({
  naturalSort: (items: object[]) => items,
}));
afterEach(cleanup);
beforeEach(() => {
  mocks.variants = [];
  vi.clearAllMocks();
  mocks.preview.width = 1440;
  mocks.preview.height = 900;
  mocks.preview.studioCtx.site.components = [];
});
test("omits sharing and shows more only when variants exist", () => {
  const view = render(<PreviewTopBar />);
  expect(screen.queryByRole("button", { name: "More" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Share" })).toBeNull();
  view.unmount();
  mocks.variants = [{}];
  render(<PreviewTopBar />);
  expect(screen.getByRole("button", { name: "More" })).toBeTruthy();
});
test("places code and back to editor in the right action section", () => {
  render(<PreviewTopBar />);
  const back = screen.getByRole("button", { name: "Back to editor" });
  const code = screen.getByRole("button", { name: "Code" });
  expect(back.parentElement?.contains(code)).toBe(true);
  expect(back.parentElement?.previousElementSibling?.contains(code)).toBe(
    false,
  );
  fireEvent.click(back);
  expect(mocks.preview.toggleLiveMode).toHaveBeenCalledOnce();
});
test("displays the current name and preserves page, component and artboard navigation", async () => {
  const page = { uuid: "page2", name: "Page2", kind: "page" };
  mocks.preview.studioCtx.site.components = [
    mocks.preview.component,
    page,
    { uuid: "component", name: "CustomerCard", kind: "component" },
    { uuid: "artboard", name: "OverviewArtboard", kind: "artboard" },
  ];
  render(<PreviewTopBar />);
  expect(screen.getByText("Page1")).toBeTruthy();
  fireEvent.mouseDown(
    screen.getByRole("combobox", { name: "Select component" }),
  );
  expect(await screen.findByText("Pages")).toBeTruthy();
  expect(screen.getByText("Components")).toBeTruthy();
  expect(screen.getByText("Artboards")).toBeTruthy();
  fireEvent.click(screen.getByText("Page2"));
  expect(mocks.preview.pushComponent).toHaveBeenCalledWith(page);
});
test("Escape closes the size menu without leaving preview", async () => {
  render(<PreviewTopBar />);
  const viewport = screen.getByRole("button", { name: "Preview viewport" });
  fireEvent.click(viewport);
  const width = await screen.findByLabelText("Preview width");
  fireEvent.keyDown(width, { key: "Escape" });
  expect(viewport.getAttribute("aria-expanded")).toBe("false");
  expect(mocks.preview.toggleLiveMode).not.toHaveBeenCalled();
  fireEvent.click(viewport);
  fireEvent.keyDown(viewport, { key: "Escape" });
  expect(viewport.getAttribute("aria-expanded")).toBe("false");
});
test("reopening dimensions reads current viewport and rejects fractional sizes", async () => {
  const view = render(<PreviewTopBar />);
  fireEvent.click(screen.getByRole("button", { name: "Preview viewport" }));
  const width = await screen.findByLabelText("Preview width");
  expect((width as HTMLInputElement).value).toBe("1440");
  fireEvent.change(width, { target: { value: "300.5" } });
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Apply" }).hasAttribute("disabled"),
    ).toBe(true),
  );
  fireEvent.change(width, { target: { value: "1280" } });
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  expect(mocks.preview.pushViewport).toHaveBeenCalledWith({
    viewport: "custom",
    width: 1280,
    height: 900,
  });
  mocks.preview.width = 390;
  mocks.preview.height = 844;
  view.rerender(<PreviewTopBar />);
  fireEvent.click(screen.getByRole("button", { name: "Preview viewport" }));
  await waitFor(() =>
    expect(
      (screen.getByLabelText("Preview width") as HTMLInputElement).value,
    ).toBe("390"),
  );
});
