import { AntdConfigProvider } from "@/wab/client/antd-theme";
import { AppCtx } from "@/wab/client/app-ctx";
import DefaultLayout, {
  DefaultLayoutProps,
} from "@/wab/client/components/dashboard/DefaultLayout";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { setLanguagePreference } from "@/wab/client/i18n";
import {
  HistoryProvider,
  useLocation,
} from "@/wab/client/route/HistoryProvider";
import {
  ApiTeam,
  ApiUser,
  ApiWorkspace,
  TeamId,
  WorkspaceId,
} from "@/wab/shared/ApiSchema";
import { DevFlagsType } from "@/wab/shared/devflags";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { createMemoryHistory } from "history";
import * as React from "react";
import { mock } from "vitest-mock-extended";

const promptNewTeam = vi.hoisted(() => vi.fn());
vi.mock("@/wab/client/components/dashboard/dashboard-actions", () => ({
  promptNewTeam,
}));

const team = mock<ApiTeam>({ id: "team" as TeamId, name: "Organization" });
const appCtx = mock<AppCtx>({
  appConfig: mock<DevFlagsType>({ brands: {} }),
  selfInfo: mock<ApiUser>({ displayName: "User", email: "user@example.com" }),
  getAllTeams: () => [team],
  workspaces: [
    mock<ApiWorkspace>({
      id: "workspace" as WorkspaceId,
      name: "Workspace",
      team,
    }),
  ],
});

beforeEach(() => setLanguagePreference("en"));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function setup(props: DefaultLayoutProps = {}, followRoute = false) {
  const history = createMemoryHistory({
    initialEntries: [APP_ROUTES.allProjects.fill({})],
  });
  function Layout() {
    const location = useLocation();
    const routeProps: DefaultLayoutProps = followRoute
      ? {
          navigation:
            location.pathname === APP_ROUTES.allProjects.fill({})
              ? "allProjects"
              : location.pathname === APP_ROUTES.playground.fill({})
                ? "myProjects"
                : "spaces",
          team: location.pathname.startsWith("/workspaces/") ? team : undefined,
        }
      : props;
    return <DefaultLayout {...routeProps}>Content</DefaultLayout>;
  }
  const view = render(
    <AntdConfigProvider productUI>
      <AppCtxContext.Provider value={appCtx}>
        <HistoryProvider history={history}>
          <Layout />
        </HistoryProvider>
      </AppCtxContext.Provider>
    </AntdConfigProvider>,
  );
  return { ...view, history };
}

it.each([
  ["myProjects", "My Playground"],
  ["allProjects", "Projects"],
  [undefined, "Spaces"],
] as const)(
  "selects only %s navigation when a team is present",
  (navigation, selected) => {
    setup({ team, navigation });
    expect(screen.getAllByRole("radio", { checked: true })).toEqual([
      screen.getByRole("radio", { name: selected }),
    ]);
  },
);

it("groups navigation, creation and user actions in the header and removes the sidebar", () => {
  const { container, history } = setup({ navigation: "allProjects" });
  const header = screen.getByRole("banner");
  expect(header.contains(screen.getByRole("radio", { name: "Projects" }))).toBe(
    true,
  );
  const creation = screen.getByRole("button", { name: "New organization" });
  expect(creation.textContent).toContain("New organization");
  const user = screen.getByRole("button", { name: "User" });
  expect(creation.parentElement).toBe(user.parentElement);
  expect(
    creation.parentElement?.contains(
      screen.getByRole("radio", { name: "Spaces" }),
    ),
  ).toBe(true);
  expect(container.querySelector("aside")).toBeNull();
  fireEvent.click(creation);
  expect(promptNewTeam).toHaveBeenCalledWith(appCtx, history);
});

it("follows project routes and restores the selected navigation with back", () => {
  const { history } = setup({}, true);
  fireEvent.click(screen.getByRole("radio", { name: "My Playground" }));
  expect(history.location.pathname).toBe(APP_ROUTES.playground.fill({}));
  expect(
    screen.getByRole("radio", { name: "My Playground", checked: true }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("radio", { name: "Projects" }));
  expect(history.location.pathname).toBe(APP_ROUTES.allProjects.fill({}));
  act(() => history.back());
  expect(
    screen.getByRole("radio", { name: "My Playground", checked: true }),
  ).toBeTruthy();
});

it("opens the organizations page from the header and restores navigation with back", () => {
  const { container, history } = setup({}, true);
  fireEvent.click(screen.getByRole("radio", { name: "Spaces" }));
  expect(history.location.pathname).toBe(APP_ROUTES.organizations.fill({}));
  expect(
    screen.getByRole("radio", { name: "Spaces", checked: true }),
  ).toBeTruthy();
  expect(container.querySelector(".ant-popover")).toBeNull();
  expect(screen.queryByRole("link", { name: "Workspace" })).toBeNull();
  act(() => history.back());
  expect(
    screen.getByRole("radio", { name: "Projects", checked: true }),
  ).toBeTruthy();
});

it("navigates to organizations with arrow keys and returns to the personal workspace", () => {
  const { history } = setup({}, true);
  fireEvent.click(screen.getByRole("radio", { name: "My Playground" }));
  fireEvent.keyDown(screen.getByRole("radio", { name: "My Playground" }), {
    key: "ArrowRight",
  });
  expect(history.location.pathname).toBe(APP_ROUTES.organizations.fill({}));
  fireEvent.keyDown(screen.getByRole("radio", { name: "Spaces" }), {
    key: "ArrowLeft",
  });
  expect(history.location.pathname).toBe(APP_ROUTES.playground.fill({}));
  expect(
    screen.getByRole("radio", { name: "My Playground", checked: true }),
  ).toBeTruthy();
});

it("opens the user menu from the shared capsule", async () => {
  setup();
  fireEvent.click(screen.getByRole("button", { name: "User" }));
  expect(
    await screen.findByRole("menuitem", { name: "Settings" }),
  ).toBeTruthy();
  expect(screen.getByRole("menuitem", { name: "Sign Out" })).toBeTruthy();
});
