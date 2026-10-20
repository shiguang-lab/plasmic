import { PreviewTopBar } from "@/wab/client/components/live/PreviewTopBar";
import { HistoryProvider } from "@/wab/client/route/HistoryProvider";
import {
  cleanup,
  fireEvent,
  render as renderWithTestingLibrary,
  screen,
  waitFor,
} from "@testing-library/react";
import { createMemoryHistory } from "history";
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
  branching: true,
  setDragRegion: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/wab/client/contexts/AppContexts", () => ({
  useTopFrameApi: () => ({ setDesktopTitleBarDragRegions: mocks.setDragRegion }),
}));
vi.mock("@/wab/client/components/live/PreviewCtx", () => ({
  usePreviewCtx: () => mocks.preview,
}));
vi.mock("@/wab/client/contexts/StudioContexts", () => ({
  useStudioCtx: () => ({
    site: {},
    siteInfo: {},
    appCtx: { appConfig: {} },
    getCurrentUiConfig: () => ({}),
    showBranching: () => mocks.branching,
  }),
}));
vi.mock("@/wab/client/components/top-bar/VariantsComboSelect", () => ({
  default: () => <button>Configured variants</button>,
}));
vi.mock("@/wab/client/components/top-bar/BranchSwitcher", () => ({
  default: () => <button>Branches: main</button>,
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
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  mocks.variants = [];
  vi.clearAllMocks();
  mocks.preview.width = 1440;
  mocks.preview.height = 900;
  mocks.preview.studioCtx.site.components = [];
});
function render(children: React.ReactNode) {
  const history = createMemoryHistory();
  return renderWithTestingLibrary(children, {
    wrapper: ({ children: content }) => (
      <HistoryProvider history={history}>{content}</HistoryProvider>
    ),
  });
}
test("omits sharing and shows more only when variants exist", () => {
  const view = render(<PreviewTopBar />);
  expect(screen.queryByRole("button", { name: "More" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Share" })).toBeNull();
  view.unmount();
  mocks.variants = [{}];
  render(<PreviewTopBar />);
  expect(screen.getByRole("button", { name: "More" })).toBeTruthy();
});
test("keeps desktop chrome out of the browser preview", () => {
  const { container } = render(<PreviewTopBar />);
  expect(container.querySelector("[data-desktop-titlebar]")).toBeNull();
  expect(container.querySelector("[data-desktop-update-slot]")).toBeNull();
  expect(mocks.setDragRegion).not.toHaveBeenCalled();
});
test.each(["darwin", "win32"])("registers empty preview regions and cleans up on %s", (platform) => {
  vi.stubGlobal("navigator", { userAgent: `PlasmicDesktop/${platform}` });
  let updateRegions = () => {};
  vi.stubGlobal("ResizeObserver", class {
    constructor(update: () => void) { updateRegions = update; }
    observe() {}
    disconnect() {}
  });
  const { container, unmount } = render(<PreviewTopBar />);
  expect(Boolean(container.querySelector('[data-desktop-titlebar="mac"]'))).toBe(platform === "darwin");
  const updateSlot = container.querySelector(
    '[data-desktop-update-slot="header"]',
  );
  expect(updateSlot).toBeTruthy();
  expect(
    updateSlot?.nextElementSibling?.contains(
      screen.getByRole("button", { name: "Back to editor" }),
    ),
  ).toBe(true);
  expect(updateSlot?.nextElementSibling?.contains(updateSlot)).toBe(false);
  expect(
    updateSlot?.parentElement?.contains(
      screen.getByRole("button", { name: "Select component" }),
    ),
  ).toBe(false);
  const root = container.firstElementChild;
  const left = screen.getByRole("button", { name: "Select component" }).parentElement;
  const center = screen.getByRole("button", { name: "Preview viewport" }).parentElement;
  const right = updateSlot?.parentElement;
  const rect = (x: number, y: number, width: number, height = 42) =>
    ({ x, y, left: x, right: x + width, top: y, bottom: y + height, width, height, toJSON() {} });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this === root) { return rect(8, 8, 1584); }
    if (this === left) { return rect(8, 8, 400); }
    if (this === center) { return rect(600, 8, 400); }
    if (this === right) { return rect(1500, 8, 92); }
    return rect(0, 0, 0, 0);
  });
  updateRegions();
  expect(mocks.setDragRegion).toHaveBeenLastCalledWith([
    ...(platform === "darwin" ? [{ left: 8, top: 8, width: 80, height: 42 }] : []),
    { left: 408, top: 8, width: 192, height: 42 },
    { left: 1000, top: 8, width: 500, height: 42 },
  ]);

  // The viewport controls move to a second row in a narrower window.
  vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockImplementation(function (this: HTMLElement) {
    if (this === root) { return rect(8, 8, 984, 96); }
    if (this === left) { return rect(8, 8, 400); }
    if (this === center) { return rect(300, 62, 400); }
    if (this === right) { return rect(900, 8, 92); }
    return rect(0, 0, 0, 0);
  });
  updateRegions();
  expect(mocks.setDragRegion).toHaveBeenLastCalledWith([
    ...(platform === "darwin" ? [{ left: 8, top: 8, width: 80, height: 42 }] : []),
    { left: 408, top: 8, width: 492, height: 42 },
    { left: 8, top: 50, width: 984, height: 12 },
    { left: 8, top: 62, width: 292, height: 42 },
    { left: 700, top: 62, width: 292, height: 42 },
  ]);
  unmount();
  expect(mocks.setDragRegion).toHaveBeenLastCalledWith([]);
});
test("returns to the editor without a code generation entry", () => {
  render(<PreviewTopBar />);
  const back = screen.getByRole("button", { name: "Back to editor" });
  expect(screen.queryByRole("button", { name: "Code" })).toBeNull();
  fireEvent.click(back);
  expect(mocks.preview.toggleLiveMode).toHaveBeenCalledOnce();
});
test("displays the current name and preserves page, component and artboard navigation", async () => {
  const page = { uuid: "page2", name: "Page2", kind: "page" };
  const component = {
    uuid: "component",
    name: "CustomerCard",
    kind: "component",
  };
  const artboard = {
    uuid: "artboard",
    name: "OverviewArtboard",
    kind: "artboard",
  };
  mocks.preview.studioCtx.site.components = [
    mocks.preview.component,
    page,
    component,
    artboard,
  ];
  render(<PreviewTopBar />);
  expect(screen.getByText("Page1")).toBeTruthy();
  const trigger = screen.getByRole("button", { name: "Select component" });
  expect(screen.queryByRole("combobox")).toBeNull();
  fireEvent.click(trigger);
  expect(await screen.findByText("Pages")).toBeTruthy();
  expect(screen.getByText("Components")).toBeTruthy();
  expect(screen.getByText("Artboards")).toBeTruthy();
  for (const target of [page, component, artboard]) {
    if (trigger.getAttribute("aria-expanded") === "false") {
      fireEvent.click(trigger);
    }
    fireEvent.click(await screen.findByRole("menuitem", { name: target.name }));
    expect(mocks.preview.pushComponent).toHaveBeenLastCalledWith(target);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  }
});
test("Escape closes the page dropdown without leaving preview", async () => {
  mocks.preview.studioCtx.site.components = [mocks.preview.component];
  render(<PreviewTopBar />);
  const trigger = screen.getByRole("button", { name: "Select component" });
  fireEvent.click(trigger);
  fireEvent.keyDown(await screen.findByRole("menuitem", { name: "Page1" }), {
    key: "Escape",
  });
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  expect(mocks.preview.toggleLiveMode).not.toHaveBeenCalled();
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

test("shows branch switching in preview when branching is enabled", () => {
  mocks.branching = true;
  const view = render(<PreviewTopBar />);
  expect(screen.getByRole("button", { name: "Branches: main" })).toBeTruthy();
  view.unmount();
  mocks.branching = false;
  render(<PreviewTopBar />);
  expect(screen.queryByRole("button", { name: "Branches: main" })).toBeNull();
  mocks.branching = true;
});
