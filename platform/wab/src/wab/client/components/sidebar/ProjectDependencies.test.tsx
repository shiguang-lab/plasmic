import { ProjectDependenciesPanel } from "@/wab/client/components/sidebar/ProjectDependencies";
import { getPublicUrl } from "@/wab/shared/urls";
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Menu } from "antd";
import React from "react";

const mocks = vi.hoisted(() => ({
  deps: [] as any[],
  catalog: [] as any[],
  permission: "writable",
  canSave: true,
  refresh: vi.fn(),
  remove: vi.fn(),
  dependents: vi.fn(),
  error: vi.fn(),
  promptDelete: vi.fn(),
  promptImport: vi.fn(),
  add: vi.fn(),
}));
vi.mock("@/wab/client/contexts/StudioContexts", () => ({
  useStudioCtx: () => ({
    appCtx: {
      selfInfo: { email: "user@example.com" },
      appConfig: { hostLessComponents: mocks.catalog },
    },
    canSave: () => mocks.canSave,
    getLeftTabPermission: () => mocks.permission,
    projectDependencyManager: {
      getDependencies: () => mocks.deps,
      refreshDeps: mocks.refresh,
      removeByPkgId: mocks.remove,
      getHostLessPackageDependents: mocks.dependents,
      addByProjectId: mocks.add,
    },
  }),
}));
vi.mock("@/wab/client/components/studio/add-drawer/AddDrawer", () => ({
  shouldShowHostLessPackage: () => true,
}));
vi.mock("@/wab/client/components/ui/layout-styles", () => ({
  useLibraryPanelStyles: () => ({ styles: { root: "libraries" } }),
}));
vi.mock("@/wab/client/components/view-common", () => ({
  Matcher: class {
    constructor(private query: string) {}
    matches(value: string) {
      return value.toLowerCase().includes(this.query.toLowerCase());
    }
    boldSnippets(value: string) {
      return value;
    }
  },
}));
vi.mock("@/wab/client/i18n", () => ({
  useI18n: () => ({
    t: (text: string, values: Record<string, string> = {}) =>
      text.replace(/\{(\w+)\}/g, (_, key) => String(values[key])),
  }),
}));
vi.mock("@/wab/client/i18n/UiText", () => ({
  UiText: ({ message }: { message: string }) => <>{message}</>,
}));
vi.mock("@/wab/client/components/quick-modals", () => ({
  reactConfirm: vi.fn(),
}));
vi.mock("@/wab/client/components/modals/ImportProjectModal", () => ({
  promptImportProject: mocks.promptImport,
}));
vi.mock("@/wab/client/components/modals/UpgradeDepModal", () => ({
  promptDeleteDep: mocks.promptDelete,
  promptUpgradeDep: vi.fn(),
  promptUpgradeDeps: vi.fn(),
}));
vi.mock("@/wab/client/ErrorNotifications", () => ({ showError: mocks.error }));
vi.mock("@/wab/client/cli-routes", () => ({ openNewTab: vi.fn() }));
vi.mock("@/wab/client/components/ContextMenu", () => ({
  WithContextMenu: ({ children, className }: any) => (
    <div className={className}>{children}</div>
  ),
}));
vi.mock("@/wab/client/components/widgets", () => ({
  IFrameAwareDropdownMenu: ({ menu, children }: any) => (
    <div>
      {children}
      {menu()}
    </div>
  ),
}));
vi.mock("@/wab/client/components/menu-builder", () => ({
  MenuBuilder: class {
    items: React.ReactNode[] = [];
    genSection(_name: any, callback: any) {
      callback((item: React.ReactNode) => this.items.push(item));
    }
    build() {
      return <Menu>{this.items}</Menu>;
    }
  },
}));
vi.mock("@/wab/shared/core/sites", () => ({
  isHostLessPackage: (site: any) => !!site.hostLessPackageInfo,
}));
vi.mock("@/wab/shared/core/tagged-unbundle", () => ({
  unbundleProjectDependency: vi.fn(),
}));
vi.mock("@shiguang2/components/esm/scrollbar", () => ({
  Scrollbar: ({ children }: any) => <div>{children}</div>,
}));

function dependency(
  name: string,
  code = false,
  version = "1.0.0",
  latest = version,
) {
  return {
    model: {
      name,
      pkgId: name,
      projectId: name,
      version,
      site: { hostLessPackageInfo: code ? {} : undefined },
    },
    latestPkgVersionMeta: { version: latest, pkg: { projectId: name } },
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.permission = "writable";
  mocks.canSave = true;
  mocks.catalog = [{ name: "Ant Design 6", projectId: "antd6" }];
  mocks.deps = [
    dependency("antd6", true, "0.4.7", "0.5.0"),
    dependency("Business components", false, "1.4.0", "1.5.0"),
    dependency("No version", false, ""),
  ];
  mocks.refresh.mockResolvedValue(undefined);
  mocks.dependents.mockReturnValue([]);
  mocks.promptDelete.mockResolvedValue(true);
});
afterEach(cleanup);

it("shows real names, stable types and imported versions without invented provenance", () => {
  render(<ProjectDependenciesPanel />);
  expect(screen.getByText("Ant Design 6")).toBeVisible();
  expect(screen.getByText("Code library")).toBeVisible();
  expect(screen.getByText("v0.4.7")).toBeVisible();
  expect(screen.getByText("3 libraries")).toBeVisible();
  expect(screen.getAllByText("View update")).toHaveLength(1);
  expect(
    screen
      .getByText("No version")
      .closest(".project-library-row")
      ?.querySelector(".project-library-meta")?.textContent,
  ).toBe("Shared project");
  expect(
    screen.queryByText(/Store catalog|From component store|Unknown version/),
  ).toBeNull();
});
it("searches friendly and raw names while keeping the direct dependency total", () => {
  render(<ProjectDependenciesPanel />);
  const input = screen.getByRole("textbox", {
    name: "Search project libraries",
  });
  fireEvent.change(input, { target: { value: "antd6" } });
  expect(screen.getByText("Ant Design 6")).toBeVisible();
  expect(screen.queryByText("Business components")).toBeNull();
  fireEvent.change(input, { target: { value: "Ant Design" } });
  expect(screen.getByText("Ant Design 6")).toBeVisible();
  expect(screen.getByText("3 libraries")).toBeVisible();
  fireEvent.change(input, { target: { value: "missing" } });
  expect(screen.getByText("No matching libraries")).toBeVisible();
});
it.each(["readable", "hidden"])(
  "hides mutation actions for %s permissions",
  (permission) => {
    mocks.permission = permission;
    render(<ProjectDependenciesPanel />);
    expect(screen.queryByRole("button", { name: "Import project" })).toBeNull();
    expect(screen.queryByText("Remove imported project")).toBeNull();
    expect(screen.queryByText("View update")).toBeNull();
    expect(screen.getByText("Ant Design 6")).toBeVisible();
  },
);
it("keeps refresh loading until the request settles and reports failure", async () => {
  let reject!: (error: Error) => void;
  mocks.refresh.mockReturnValue(
    new Promise((_, rej) => {
      reject = rej;
    }),
  );
  render(<ProjectDependenciesPanel />);
  const button = screen.getByRole("button", { name: "Check for updates" });
  fireEvent.click(button);
  expect(button).toBeDisabled();
  await act(async () => reject(new Error("network failure")));
  await waitFor(() => expect(button).toBeEnabled());
  expect(mocks.error).toHaveBeenCalledWith(expect.any(Error), {
    title: "Failed to check for updates",
  });
});
it("removes through the existing confirmation and dependency manager", async () => {
  render(<ProjectDependenciesPanel />);
  fireEvent.click(screen.getAllByText("Remove imported project")[0]);
  await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith("antd6"));
  expect(mocks.promptDelete).toHaveBeenCalledWith(
    expect.objectContaining({ curDep: mocks.deps[0].model }),
  );
});
it("imports a project URL through the existing dependency manager", async () => {
  mocks.promptImport.mockResolvedValue(
    `${getPublicUrl()}/projects/business-library`,
  );
  mocks.add.mockResolvedValue({ site: {} });
  render(<ProjectDependenciesPanel />);
  fireEvent.click(screen.getByRole("button", { name: "Import project" }));
  await waitFor(() =>
    expect(mocks.add).toHaveBeenCalledWith("business-library"),
  );
});
