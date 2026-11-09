import { StudioArenaState } from "@/wab/client/studio-ctx/studio-arena-state";
import { ensure } from "@/wab/shared/common";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { createSite } from "@/wab/shared/core/sites";
import { HostLessPackageInfo, ProjectDependency } from "@/wab/shared/model/classes";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { createProjectDependenciesStore, setDependency } from "@/wab/client/studio-ctx/project-dependencies-state";
import { ProjectDependenciesPanel } from "@/wab/client/components/sidebar/ProjectDependencies";
import { createStudioUiEnvironmentFixture } from "@/wab/client/__testonly__/studio-ui-environment";
import { StudioSaveState } from "@/wab/client/studio-ctx/save-state";
import type { StudioUiEnvironmentState } from "@/wab/client/studio-ctx/studio-ui-environment";
import { getPublicUrl } from "@/wab/shared/urls";
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { Menu } from "antd";
import React from "react";

const mocks = vi.hoisted(() => ({
  studio: undefined as any,
  deps: [] as any[],
  catalog: [] as any[],
  permission: "writable",
  nativeInputs: vi.fn(),
  refresh: vi.fn(),
  remove: vi.fn(),
  dependents: vi.fn(),
  error: vi.fn(),
  promptDelete: vi.fn(),
  promptImport: vi.fn(),
  promptUpgrade: vi.fn(),
  upgrade: vi.fn(),
  getPkgVersion: vi.fn(),
  add: vi.fn(),
}));
vi.mock("@/wab/client/contexts/StudioContexts", () => ({ useStudioCtx: () => mocks.studio }));
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
  promptUpgradeDep: mocks.promptUpgrade,
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
vi.mock("@/wab/shared/core/tagged-unbundle", () => ({
  unbundleProjectDependency: () => ({
    projectDependency: dependency("antd6", true).model,
  }),
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
    model: new ProjectDependency({
      uuid: `dep-${name}`, name, pkgId: name, projectId: name, version,
      site: createSite({ hostLessPackageInfo: code ? new HostLessPackageInfo({ name, npmPkg: [], cssImport: [], deps: [], registerCalls: [], minimumReactVersion: null }) : null }),
    }),
    latestPkgVersionMeta: { version: latest, pkg: { projectId: name } },
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.permission = "writable";

  mocks.catalog = [{ name: "Ant Design 6", projectId: "antd6" }];
  mocks.deps = [
    dependency("antd6", true, "0.4.7", "0.5.0"),
    dependency("Business components", false, "1.4.0", "1.5.0"),
    dependency("No version", false, ""),
  ];
  const site = createSite({ projectDependencies: mocks.deps.map((entry) => entry.model) });
  const modelSnapshots = new ModelSnapshots(), arenaState = new StudioArenaState({site, modelSnapshots}), modelListeners = new Set<() => void>();
  const dependencyStateStore = createProjectDependenciesStore();
  dependencyStateStore.setState({ dependencyMap: Object.freeze(Object.fromEntries(mocks.deps.map((entry) => [entry.model.pkgId, entry]))) });
  const appUiListeners = new Set<() => void>();
  const native = { ...createStudioUiEnvironmentFixture(), saveState: new StudioSaveState(), site, modelSnapshots,
    arenaState, subscribeModelChanges: (listener: () => void) => { modelListeners.add(listener); return () => {modelListeners.delete(listener);}; }, close: () => { arenaState.dispose(); modelSnapshots.dispose(); } };
  mocks.nativeInputs.mockReturnValue(native);
  mocks.studio = {
    ...native,
    appCtx: { selfInfo: { email: "user@example.com" }, appConfig: { ...DEVFLAGS, hostLessComponents: mocks.catalog },
      subscribeUiEnvironmentInputs: (listener: () => void) => { appUiListeners.add(listener); return () => { appUiListeners.delete(listener); }; },
      publishUiEnvironmentInputs: () => appUiListeners.forEach((listener) => listener()),
      api: { getPkgVersion: mocks.getPkgVersion } },
    bundler: () => ({}),
    projectDependencyManager: { dependencyStateStore, getDependencies: () => mocks.deps, refreshDeps: mocks.refresh,
      removeByPkgId: mocks.remove, getHostLessPackageDependents: mocks.dependents,
      addByProjectId: mocks.add, upgradeProjectDeps: mocks.upgrade },
  };
  mocks.refresh.mockResolvedValue(undefined);
  mocks.dependents.mockReturnValue([]);
  mocks.promptDelete.mockResolvedValue(true);
  mocks.promptUpgrade.mockResolvedValue(true);
  mocks.getPkgVersion.mockResolvedValue({
    pkg: { projectId: "antd6" },
    depPkgs: [],
  });
});
afterEach(() => {
  cleanup();
  mocks.nativeInputs().saveState.dispose();
  mocks.nativeInputs().close();
});

it("shows real names, stable types and imported versions without invented provenance", () => {
  render(<ProjectDependenciesPanel />);
  expect(screen.getByText("Ant Design 6")).toBeVisible();
  expect(screen.getByText("Code library")).toBeVisible();
  expect(screen.getByText("v0.4.7")).toBeVisible();
  expect(screen.getByText("3 libraries")).toBeVisible();
  expect(screen.getAllByText("View update")).toHaveLength(2);
  expect(screen.getByText("New version available v0.5.0")).toBeVisible();
  expect(screen.getByText("New version available v1.5.0")).toBeVisible();
  expect(screen.getByRole("button", { name: "Update all" })).toBeVisible();
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
it.each(["readable", "hidden"] as const)(
  "hides mutation actions for %s permissions",
  (permission) => {
    mocks.permission = permission;
    mocks.nativeInputs().uiEnvironment.store.setState((state: StudioUiEnvironmentState) => ({
      ...state,
      leftTabPermissions: { ...state.leftTabPermissions, imports: permission, libraries: permission },
    }), true);
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
  const row = ensure(screen.getByText("Ant Design 6").closest<HTMLElement>(".project-library-row"), "Ant Design library row");
  fireEvent.click(within(row).getByText("Remove imported project"));
  await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith("antd6"));
  expect(mocks.promptDelete).toHaveBeenCalledWith(
    expect.objectContaining({ curDep: mocks.deps[0].model }),
  );
});
it("imports a project URL through the existing dependency manager", async () => {
  mocks.promptImport.mockResolvedValue(
    `${getPublicUrl()}/projects/business-library`,
  );
  mocks.add.mockResolvedValue(dependency("Imported").model);
  render(<ProjectDependenciesPanel />);
  fireEvent.click(screen.getByRole("button", { name: "Import project" }));
  await waitFor(() =>
    expect(mocks.add).toHaveBeenCalledWith("business-library"),
  );
});
it("upgrades hostless code library through the upgrade prompt and dependency manager", async () => {
  render(<ProjectDependenciesPanel />);
  const row = ensure(screen.getByText("Ant Design 6").closest<HTMLElement>(".project-library-row"), "Ant Design library row");
  fireEvent.click(within(row).getByRole("button", { name: "View update" }));
  await waitFor(() => expect(mocks.getPkgVersion).toHaveBeenCalledWith("antd6", "0.5.0"));
  await waitFor(() => expect(mocks.promptUpgrade).toHaveBeenCalled());
  await waitFor(() => expect(mocks.upgrade).toHaveBeenCalled());
});


it("publishes fetched version metadata through the dependency owner's native store", () => {
  render(<ProjectDependenciesPanel />);
  const before = mocks.deps[2];
  expect(screen.getAllByText("View update")).toHaveLength(2);
  act(() => {
    setDependency(mocks.studio.projectDependencyManager, before.model.pkgId, { ...before,
      latestPkgVersionMeta: { ...before.latestPkgVersionMeta, version: "2.0.0" } });
  });
  expect(screen.getAllByText("View update")).toHaveLength(3);
  expect(before.latestPkgVersionMeta.version).toBe("");
});

it("refreshes friendly package names after the app configuration publishes", () => {
  render(<ProjectDependenciesPanel />);
  expect(screen.getByText("Ant Design 6")).toBeVisible();
  act(() => {
    mocks.studio.appCtx.appConfig = { ...mocks.studio.appCtx.appConfig, hostLessComponents: [{ name: "Renamed library", projectId: "antd6" }] };
    mocks.studio.appCtx.publishUiEnvironmentInputs();
  });
  expect(screen.getByText("Renamed library")).toBeVisible();
  expect(screen.queryByText("Ant Design 6")).toBeNull();
});
