import { SpacesNavigation } from "@/wab/client/components/dashboard/SpacesNavigation";
import {
  HistoryProvider,
  useLocation,
} from "@/wab/client/route/HistoryProvider";
import {
  ApiTeam,
  ApiWorkspace,
  TeamId,
  WorkspaceId,
} from "@/wab/shared/ApiSchema";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import "@testing-library/jest-dom/vitest";
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

const team = mock<ApiTeam>({ id: "org" as TeamId, name: "Example organization" });
const otherTeam = mock<ApiTeam>({
  id: "other-org" as TeamId,
  name: "Other organization",
});
const workspace = mock<ApiWorkspace>({
  id: "workspace" as WorkspaceId,
  name: "Workspace",
  team,
});
vi.mock("@/wab/client/contexts/AppContexts", () => ({
  useAppCtx: () => ({
    getAllTeams: () => [team, otherTeam],
    workspaces: [
      workspace,
      { id: "other-workspace", name: "Other workspace", team: otherTeam },
      { id: "personal", name: "Personal", team: { id: "private" } },
    ],
  }),
}));
vi.mock("@/wab/client/i18n", () => ({
  useI18n: () => ({ t: (value: string) => value }),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function setup() {
  const history = createMemoryHistory({
    initialEntries: ["/workspaces/workspace"],
  });
  function Navigation() {
    const { pathname } = useLocation();
    return (
      <SpacesNavigation
        team={team}
        workspace={APP_ROUTES.workspace.parse(pathname) ? workspace : undefined}
      />
    );
  }
  render(
    <HistoryProvider history={history}>
      <Navigation />
    </HistoryProvider>,
  );
  return history;
}

it("shows organizations and workspaces without project leaves or the personal workspace", () => {
  const history = setup();
  expect(
    screen.getByRole("complementary", { name: "Spaces" }),
  ).toBeInTheDocument();
  expect(screen.queryByText("Project")).toBeNull();
  expect(screen.queryByText("Personal")).toBeNull();
  expect(screen.queryByText("Private project")).toBeNull();
  expect(screen.queryByText("Organizations")).toBeNull();
  expect(screen.getAllByText("Organization")).toHaveLength(2);
  expect(screen.getByText("Other workspace")).toBeVisible();
  const tree = screen.getByRole("tree");
  expect(tree.closest(".ant-tree")).toHaveClass("ant-tree-show-line");
  expect(tree.querySelector(".ant-tree-switcher-icon")).toBeNull();
  expect(tree.querySelector(".ant-tree-switcher-line-icon")).toBeNull();
  expect(
    screen.getByText("Workspace").closest(".ant-tree-node-content-wrapper"),
  ).toHaveClass("ant-tree-node-selected");
  fireEvent.click(screen.getByText(team.name));
  expect(history.location.pathname).toBe("/orgs/org");
  expect(
    screen.getByText(team.name).closest(".ant-tree-node-content-wrapper"),
  ).toHaveClass("ant-tree-node-selected");
  fireEvent.click(screen.getByText("Workspace"));
  expect(history.location.pathname).toBe("/workspaces/workspace");
  act(() => history.back());
  expect(
    screen.getByText(team.name).closest(".ant-tree-node-content-wrapper"),
  ).toHaveClass("ant-tree-node-selected");
});
