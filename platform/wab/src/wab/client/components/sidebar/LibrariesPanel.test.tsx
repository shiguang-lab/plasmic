import { LibrariesPanel } from "@/wab/client/components/sidebar/LibrariesPanel";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { observable } from "mobx";
import React from "react";
const mocks = vi.hoisted(() => ({ ctx: undefined as any, close: vi.fn() }));
vi.mock("@/wab/client/studio-ctx/StudioCtx", () => ({
  useStudioCtx: () => mocks.ctx,
}));
vi.mock("@/wab/client/components/insert-panel/InsertPanel", () => ({
  default: ({ mode, onClose }: any) => (
    <button onClick={onClose}>{mode} content</button>
  ),
}));
vi.mock("@/wab/client/components/sidebar/ProjectDependencies", () => ({
  ProjectDependenciesPanel: () => <div>Imported dependency list</div>,
}));
vi.mock("@/wab/client/components/ui/layout-styles", () => ({
  useLibraryPanelStyles: () => ({ styles: { root: "libraries" } }),
}));
vi.mock("@/wab/client/i18n", () => ({
  useI18n: () => ({ t: (text: string) => text }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.ctx = observable({
    libraryTab: "imports",
    permission: "writable",
    appCtx: { selfInfo: {} },
    getLeftTabPermission() {
      return this.permission;
    },
    setLibraryTab(tab: string) {
      this.libraryTab = tab;
    },
    changeUnsafe: async (fn: () => any) => fn(),
    switchLeftTab: mocks.close,
  });
});
afterEach(cleanup);
it("honors the selected tab and switches between the existing insertion and dependency flows", async () => {
  const { container } = render(<LibrariesPanel />);
  const header = container.querySelector(".editor-panel-header");
  expect(container.querySelectorAll(".editor-panel-header")).toHaveLength(1);
  expect(header?.contains(screen.getByRole("tablist"))).toBe(true);
  expect(header?.contains(screen.getByRole("button", { name: "Close" }))).toBe(
    true,
  );
  expect(
    screen
      .getByRole("tab", { name: "Imported projects" })
      .getAttribute("aria-selected"),
  ).toBe("true");
  expect(screen.getByText("Imported dependency list")).toBeTruthy();
  fireEvent.click(screen.getByRole("tab", { name: "Component store" }));
  expect(mocks.ctx.libraryTab).toBe("store");
  fireEvent.click(await screen.findByRole("button", { name: "store content" }));
  await waitFor(() => expect(mocks.close).toHaveBeenCalledWith(undefined));
});
it("closes from the shared header and retains the selected library tab on reopen", async () => {
  const { unmount } = render(<LibrariesPanel />);
  fireEvent.click(screen.getByRole("tab", { name: "Component store" }));
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  await waitFor(() => expect(mocks.close).toHaveBeenCalledWith(undefined));
  unmount();
  render(<LibrariesPanel />);
  expect(
    screen
      .getByRole("tab", { name: "Component store" })
      .getAttribute("aria-selected"),
  ).toBe("true");
});
it("uses the store when imported projects are hidden", () => {
  mocks.ctx.permission = "hidden";
  render(<LibrariesPanel />);
  expect(screen.queryByRole("tab", { name: "Imported projects" })).toBeNull();
  expect(
    screen
      .getByRole("tab", { name: "Component store" })
      .getAttribute("aria-selected"),
  ).toBe("true");
  expect(screen.getByRole("button", { name: "store content" })).toBeTruthy();
});
