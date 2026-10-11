import AllProjectsPage from "@/wab/client/components/dashboard/AllProjectsPage";
import { HistoryProvider } from "@/wab/client/route/HistoryProvider";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryHistory } from "history";
import * as React from "react";

const mocks = vi.hoisted(() => ({
  retry: vi.fn(),
  failed: false,
  loading: false,
}));
vi.mock("@/wab/client/contexts/AppContexts", () => ({
  useAllProjectsData: () => ({
    data:
      mocks.failed || mocks.loading
        ? undefined
        : {
            perms: [],
            projects: [
              {
                id: "alpha",
                name: "Alpha",
                workspaceId: "workspace1",
                workspaceName: "Workspace one",
                updatedAt: "2026-10-01",
              },
              {
                id: "beta",
                name: "Beta",
                workspaceId: "workspace2",
                workspaceName: "Workspace two",
                updatedAt: "2026-10-02",
              },
            ],
          },
    error: mocks.failed ? new Error("Unavailable") : undefined,
    mutate: mocks.retry,
  }),
  useAppCtx: () => ({
    workspaces: [
      { id: "workspace1", name: "Workspace one" },
      { id: "workspace2", name: "Workspace two" },
    ],
  }),
}));
vi.mock("@/wab/client/i18n", () => ({
  useI18n: () => ({ t: (message: string) => message }),
}));
vi.mock("@/wab/client/components/ProjectListItem", () => ({
  default: ({
    project,
    presentation,
    onSelect,
  }: {
    project: { name: string };
    presentation?: string;
    onSelect?: () => void;
  }) =>
    presentation === "details" ? (
      <div>Details for {project.name}</div>
    ) : (
      <button onClick={onSelect}>{project.name}</button>
    ),
}));
vi.mock("@/wab/client/components/NewProjectModal", () => ({
  default: () => <div>Project creation dialog</div>,
}));

afterEach(() => {
  cleanup();
  mocks.failed = false;
  mocks.loading = false;
  vi.clearAllMocks();
});

function renderProjects() {
  const history = createMemoryHistory();
  render(
    <HistoryProvider history={history}>
      <AllProjectsPage />
    </HistoryProvider>,
  );
  return history;
}

it("keeps workspace filtering and search when changing the project display", async () => {
  renderProjects();
  expect(screen.getByRole("button", { name: "Alpha" })).toBeInTheDocument();
  fireEvent.mouseDown(screen.getByLabelText("Workspace"));
  fireEvent.click(
    await screen.findByText("Workspace two", {
      selector: ".ant-select-item-option-content",
    }),
  );
  expect(screen.queryByRole("button", { name: "Alpha" })).toBeNull();
  expect(screen.getByRole("button", { name: "Beta" })).toBeInTheDocument();
  fireEvent.click(screen.getByText("List", { exact: true }));
  expect(screen.getByRole("button", { name: "Beta" })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Search…"), {
    target: { value: "Alpha" },
  });
  expect(screen.getByText("No projects matching query.")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Search…"), { target: { value: "" } });
  expect(screen.getByRole("button", { name: "Beta" })).toBeInTheDocument();
});

it("shows a retry action rather than an endless loading state after a request failure", () => {
  mocks.failed = true;
  renderProjects();
  expect(screen.getByText("Failed to load projects")).toBeInTheDocument();
  expect(
    screen.queryByRole("status", { name: "Loading projects…" }),
  ).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(mocks.retry).toHaveBeenCalledTimes(1);
});

it("opens the shared creation dialog from the workbench", () => {
  renderProjects();
  fireEvent.click(screen.getByRole("button", { name: "New project" }));
  expect(screen.getByText("Project creation dialog")).toBeInTheDocument();
});

it("selects and closes project details without mutating business data", () => {
  renderProjects();
  expect(screen.getByText("Details for Beta")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Alpha" }));
  expect(screen.getByText("Details for Alpha")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(
    screen.queryByRole("complementary", { name: "Project details" }),
  ).toBeNull();
  expect(mocks.retry).not.toHaveBeenCalled();
});

it("keeps workspace grouping links on their existing routes", () => {
  const history = renderProjects();
  fireEvent.click(screen.getByRole("link", { name: "Workspace one" }));
  expect(history.location.pathname).toBe("/workspaces/workspace1");
});

it("keeps the real toolbar while projects load and lets the user choose the list layout", () => {
  mocks.loading = true;
  renderProjects();
  expect(screen.getByRole("heading", { name: "All projects" })).toBeTruthy();
  expect(screen.getByLabelText("Workspace")).toBeTruthy();
  expect(
    screen.getByRole("status", { name: "Loading projects…" }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("radio", { name: /List/ }));
  expect(screen.getByRole("radio", { name: /List/ })).toBeChecked();
  expect(
    screen.getByRole("status", { name: "Loading projects…" }),
  ).toBeTruthy();
});
