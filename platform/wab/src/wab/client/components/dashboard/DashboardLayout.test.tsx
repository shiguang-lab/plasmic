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
  ],
  personalTeam: { id: "personal" },
  getAllTeams: () => [{ id: "org" }],
}));

vitest.mock("@/wab/client/contexts/AppContexts", () => ({
  useAppCtx: () => appCtx,
}));
vitest.mock("@/wab/client/components/widgets", () => ({
  Spinner: () => <div role="status">Loading</div>,
}));
vitest.mock("@/wab/client/components/dashboard/DefaultTeamLayout", () => ({
  default: ({ team, workspace, navigation, children }) => (
    <div>
      <header>Dashboard</header>
      <nav
        data-team={team?.id}
        data-workspace={workspace?.id}
        data-navigation={navigation}
      >
        Sidebar
      </nav>
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
  const sidebar = screen.getByRole("navigation");
  const header = screen.getByRole("banner");
  const main = screen.getByRole("main");
  expect(sidebar.dataset.navigation).toBe("allProjects");

  act(() => history.push("/orgs/org"));
  expect(sidebar.dataset.team).toBe("org");

  act(() => history.push("/workspaces/workspace"));
  expect(screen.getByRole("navigation")).toBe(sidebar);
  expect(screen.getByRole("banner")).toBe(header);
  expect(screen.getByRole("main")).toBe(main);
  expect(main.contains(screen.getByRole("status"))).toBe(true);
  expect(sidebar.dataset.workspace).toBe("workspace");
  await act(async () =>
    ensure(
      finishLoading,
      "Workspace import should be pending",
    )({ default: () => <div>Workspace content</div> }),
  );
  expect(screen.getByText("Workspace content")).toBeTruthy();

  act(() => history.push("/workspaces/other"));
  expect(screen.getByRole("navigation")).toBe(sidebar);
  expect(sidebar.dataset.workspace).toBe("other");
  act(() => history.push(APP_ROUTES.playground.fill({})));
  expect(sidebar.dataset.team).toBe("personal");
  expect(sidebar.dataset.navigation).toBe("myProjects");
  act(() => history.push(APP_ROUTES.allProjects.fill({})));
  expect(screen.getByRole("navigation")).toBe(sidebar);
  expect(sidebar.dataset.team).toBeUndefined();
  expect(sidebar.dataset.workspace).toBeUndefined();
});
