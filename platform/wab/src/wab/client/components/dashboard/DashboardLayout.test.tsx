import { DashboardLayout } from "@/wab/client/components/dashboard/DashboardLayout";
import { HistoryProvider } from "@/wab/client/route/HistoryProvider";
import { Switch, switchCase, switchDefault } from "@/wab/client/route/Switch";
import { ensure } from "@/wab/shared/common";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import { act, render, screen } from "@testing-library/react";
import { createMemoryHistory } from "history";
import * as React from "react";

const appCtx = vitest.hoisted(() => ({
  workspaces: [
    { id: "workspace", team: { id: "org" } },
    { id: "other", team: { id: "org" } },
    { id: "personal-workspace", team: { id: "personal" } },
  ],
  personalWorkspace: { id: "personal-workspace" },
  personalTeam: { id: "personal" },
  getAllTeams: () => [{ id: "org" }],
}));

vitest.mock("@/wab/client/contexts/AppContexts", async () => {
  const { createContext } = await import("react");
  return { useAppCtx: () => appCtx, AppCtxContext: createContext(appCtx) };
});
vitest.mock("@/wab/client/components/dashboard/DashboardPageLoading", () => ({
  DashboardPageLoading: () => <div role="status">Workspace skeleton</div>,
}));
vitest.mock("@/wab/client/components/widgets", () => ({
  Spinner: () => <div role="status">Loading</div>,
}));
vitest.mock("@/wab/client/components/dashboard/SpacesNavigation", () => ({
  SpacesNavigation: () => <aside aria-label="Spaces">Organizations tree</aside>,
}));
vitest.mock("@/wab/client/components/dashboard/DefaultTeamLayout", () => ({
  default: ({ team, workspace, navigation, children }) => (
    <div>
      <header>
        Dashboard
        <nav
          data-team={team?.id}
          data-workspace={workspace?.id}
          data-navigation={navigation}
        >
          Dashboard navigation
        </nav>
      </header>
      <main>{children}</main>
    </div>
  ),
}));

it("keeps dashboard chrome mounted across routes and confines lazy loading to main", async () => {
  let finishLoading:
    ((value: { default: React.ComponentType }) => void) | undefined;
  const Workspace = React.lazy(
    () =>
      new Promise<{ default: React.ComponentType }>((resolve) => {
        finishLoading = resolve;
      }),
  );
  const history = createMemoryHistory({
    initialEntries: [APP_ROUTES.allProjects.fill({})],
  });
  render(
    <HistoryProvider history={history}>
      <Switch
        cases={[
          switchCase({
            route: APP_ROUTES.allProjects,
            render: () => <DashboardLayout>Projects</DashboardLayout>,
          }),
          switchCase({
            route: APP_ROUTES.playground,
            render: () => <DashboardLayout>Playground</DashboardLayout>,
          }),
          switchCase({
            route: APP_ROUTES.org,
            render: () => <DashboardLayout>Organization</DashboardLayout>,
          }),
          switchCase({
            route: APP_ROUTES.workspace,
            render: ({ workspaceId }) => (
              <DashboardLayout>
                <Workspace key={workspaceId} />
              </DashboardLayout>
            ),
          }),
          switchDefault({ render: () => null }),
        ]}
      />
    </HistoryProvider>,
  );
  const navigation = screen.getByRole("navigation");
  const header = screen.getByRole("banner");
  const main = screen.getByRole("main");
  expect(navigation.dataset.navigation).toBe("allProjects");

  act(() => history.push("/orgs/org"));
  expect(navigation.dataset.team).toBe("org");
  expect(navigation.dataset.navigation).toBe("spaces");
  const spaces = screen.getByRole("complementary", { name: "Spaces" });
  expect(main.contains(spaces)).toBe(true);

  act(() => history.push("/workspaces/workspace"));
  expect(screen.getByRole("navigation")).toBe(navigation);
  expect(screen.getByRole("banner")).toBe(header);
  expect(screen.getByRole("main")).toBe(main);
  expect(main.contains(screen.getByRole("status"))).toBe(true);
  expect(navigation.dataset.workspace).toBe("workspace");
  expect(screen.getByRole("complementary", { name: "Spaces" })).toBe(spaces);
  await act(async () =>
    ensure(
      finishLoading,
      "Workspace import should be pending",
    )({ default: () => <div>Workspace content</div> }),
  );
  expect(screen.getByText("Workspace content")).toBeTruthy();

  act(() => history.push("/workspaces/other"));
  expect(screen.getByRole("navigation")).toBe(navigation);
  expect(navigation.dataset.workspace).toBe("other");
  act(() => history.push(APP_ROUTES.playground.fill({})));
  expect(navigation.dataset.team).toBe("personal");
  expect(navigation.dataset.navigation).toBe("myProjects");
  expect(screen.queryByRole("complementary", { name: "Spaces" })).toBeNull();
  act(() => history.push("/workspaces/personal-workspace"));
  expect(navigation.dataset.navigation).toBe("myProjects");
  expect(screen.queryByRole("complementary", { name: "Spaces" })).toBeNull();
  act(() => history.push(APP_ROUTES.allProjects.fill({})));
  expect(screen.getByRole("navigation")).toBe(navigation);
  expect(navigation.dataset.team).toBeUndefined();
  expect(navigation.dataset.workspace).toBeUndefined();
});
