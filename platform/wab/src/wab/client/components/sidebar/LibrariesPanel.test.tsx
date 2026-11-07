import { LibrariesPanel } from "@/wab/client/components/sidebar/LibrariesPanel";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createStudioUiEnvironmentFixture } from "@/wab/client/__testonly__/studio-ui-environment";
import { createStore } from "zustand/vanilla";
import React from "react";
const mocks = vi.hoisted(() => ({ ctx: undefined as any, close: vi.fn() }));
vi.mock("@/wab/client/contexts/StudioContexts", () => ({
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
  const tabs = createStore<"store" | "imports">(() => "imports");
  mocks.ctx = {
    ...createStudioUiEnvironmentFixture({ hasUserInfo: true }),
    libraryTabStore: tabs,
    get libraryTab() { return tabs.getState(); },
    appCtx: { selfInfo: {} },
    setLibraryTab(tab: "store" | "imports") {
      tabs.setState(tab, true);
    },
    changeUnsafe: async (fn: () => any) => fn(),
    switchLeftTab: mocks.close,
  };
});
afterEach(cleanup);
it("shows the selected Library view with a single title and no tabs", async () => {
  const { container } = render(<LibrariesPanel />);
  const header = container.querySelector(".editor-panel-header");
  expect(container.querySelectorAll(".editor-panel-header")).toHaveLength(1);
  expect(screen.queryByRole("tablist")).toBeNull();
  expect(header?.contains(screen.getByRole("button", { name: "Close" }))).toBe(
    true,
  );
  expect(header?.textContent).toContain("Imported projects");
  expect(screen.getByText("Imported dependency list")).toBeTruthy();
  await act(async () => { mocks.ctx.setLibraryTab("store"); });
  expect(mocks.ctx.libraryTab).toBe("store");
  expect(header?.textContent).toContain("Component store");
  expect(screen.queryByText("Imported dependency list")).toBeNull();
  fireEvent.click(await screen.findByRole("button", { name: "store content" }));
  await waitFor(() => expect(mocks.close).toHaveBeenCalledWith(undefined));
});
it("closes from the shared header and retains the selected library tab on reopen", async () => {
  const { unmount } = render(<LibrariesPanel />);
  await act(async () => { mocks.ctx.setLibraryTab("store"); });
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  await waitFor(() => expect(mocks.close).toHaveBeenCalledWith(undefined));
  unmount();
  render(<LibrariesPanel />);
  expect(screen.getByText("Component store")).toBeTruthy();
  expect(mocks.ctx.libraryTab).toBe("store");
});
it("uses the store when imported projects are hidden", () => {
  const state = mocks.ctx.uiEnvironment.store.getState();
  mocks.ctx.uiEnvironment.store.setState({ leftTabPermissions: Object.freeze({ ...state.leftTabPermissions, imports: "hidden" }) });
  render(<LibrariesPanel />);
  expect(screen.queryByText("Imported projects")).toBeNull();
  expect(screen.getByText("Component store")).toBeTruthy();
  expect(screen.getByRole("button", { name: "store content" })).toBeTruthy();
});
it("uses the store for anonymous users even if imports was selected", () => {
  mocks.ctx.appCtx.selfInfo = null;
  mocks.ctx.uiEnvironment.store.setState({ hasUserInfo: false });
  render(<LibrariesPanel />);
  expect(screen.queryByText("Imported dependency list")).toBeNull();
  expect(screen.getByText("Component store")).toBeTruthy();
});
