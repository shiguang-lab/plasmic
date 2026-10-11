import WorkspacePage from "@/wab/client/components/dashboard/WorkspacePage";
import { HistoryProvider } from "@/wab/client/route/HistoryProvider";
import { ForbiddenError, NotFoundError } from "@/wab/shared/ApiErrors/errors";
import { WorkspaceId } from "@/wab/shared/ApiSchema";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createMemoryHistory } from "history";
import * as React from "react";
import { SWRConfig } from "swr";

const mocks = vi.hoisted(() => ({
  getWorkspace: vi.fn(),
  getProjects: vi.fn(),
  listCmsDatabasesForWorkspace: vi.fn(),
  reportError: vi.fn(),
}));
vi.mock("@/wab/client/ErrorNotifications", () => ({
  reportError: mocks.reportError,
}));
vi.mock("@/wab/client/contexts/AppContexts", () => ({
  useAppCtx: () => ({
    api: mocks,
    workspaces: [{ id: "workspace", name: "Customer portal" }],
  }),
}));
vi.mock("@/wab/client/i18n", () => ({
  useI18n: () => ({ t: (message: string) => message }),
}));
vi.mock("@/wab/client/components/dashboard/DashboardPageLoading", () => ({
  DashboardPageLoading: () => <div>Workspace skeleton</div>,
}));
vi.mock(
  "@/wab/client/plasmic/plasmic_kit_dashboard/PlasmicWorkspacePage",
  () => ({
    PlasmicWorkspacePage: ({ workspaceSection }) => (
      <div>
        <h1>{workspaceSection.props.workspace.name}</h1>
        {workspaceSection.props.projects.map((project) => (
          <div key={project.id}>{project.name}</div>
        ))}
        <button
          onClick={() => {
            void workspaceSection.props.onUpdate();
          }}
        >
          Refresh
        </button>
      </div>
    ),
  }),
);

beforeEach(() => {
  mocks.getWorkspace.mockResolvedValue({
    workspace: { id: "workspace", name: "Customer portal" },
    perms: [],
  });
  mocks.getProjects.mockResolvedValue({
    projects: [
      { id: "project", name: "Existing project", updatedAt: "2026-10-01" },
    ],
    perms: [],
  });
  mocks.listCmsDatabasesForWorkspace.mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

function setup() {
  const history = createMemoryHistory({
    initialEntries: ["/workspaces/workspace"],
  });
  const view = render(
    <SWRConfig
      value={{
        provider: () => new Map(),
        shouldRetryOnError: false,
        dedupingInterval: 0,
      }}
    >
      <HistoryProvider history={history}>
        <WorkspacePage workspaceId={"workspace" as WorkspaceId} />
      </HistoryProvider>
    </SWRConfig>,
  );
  return { history, ...view };
}

it("stays on the workspace after a network failure and recovers on retry", async () => {
  mocks.getWorkspace.mockRejectedValueOnce(new Error("502"));
  const { history } = setup();
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(history.location.pathname).toBe("/workspaces/workspace");
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("Existing project")).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
});

it("retains successful content through repeated refresh failures and recovery", async () => {
  const { history } = setup();
  await screen.findByText("Existing project");
  mocks.getProjects
    .mockRejectedValueOnce(new Error("502"))
    .mockRejectedValueOnce(new Error("502 again"));
  fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
  await screen.findByRole("alert");
  expect(screen.getByText("Existing project")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(() => expect(mocks.getProjects).toHaveBeenCalledTimes(3));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: /Retry/ }).className,
    ).not.toContain("loading"),
  );
  expect(screen.getByText("Existing project")).toBeTruthy();
  expect(history.location.pathname).toBe("/workspaces/workspace");
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  expect(screen.getByText("Existing project")).toBeTruthy();
});

it("still redirects when the workspace is explicitly missing", async () => {
  mocks.getWorkspace.mockRejectedValueOnce(new NotFoundError());
  const { history } = setup();
  await waitFor(() => expect(history.location.pathname).toBe("/"));
});

it("redirects after an explicit permission failure even with cached content", async () => {
  const { history } = setup();
  await screen.findByText("Existing project");
  mocks.getWorkspace.mockRejectedValueOnce(new ForbiddenError());
  fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
  await waitFor(() => expect(history.location.pathname).toBe("/"));
});
