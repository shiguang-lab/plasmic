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
  cached: false,
  validating: false,
}));
vi.mock("@/wab/client/contexts/AppContexts", () => ({
  useAllProjectsData: () => ({
    data:
      (mocks.failed && !mocks.cached) || mocks.loading
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
    isValidating: mocks.validating,
    mutate: mocks.retry,
  }),
  useAppCtx: () => ({
    personalWorkspace: { id: "personal", name: "My Playground" },
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
  default: ({ project }: { project: { name: string } }) => (
    <button>{project.name}</button>
  ),
}));
vi.mock("@/wab/client/components/NewProjectModal", () => ({
  default: () => <div>Project creation dialog</div>,
}));

afterEach(() => {
  cleanup();
  mocks.failed = false;
  mocks.loading = false;
  mocks.cached = false;
  mocks.validating = false;
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

it("keeps cached projects visible alongside a refresh error", () => {
  mocks.failed = true;
  mocks.cached = true;
  renderProjects();
  expect(screen.queryByText("Failed to load projects")).toBeNull();
  expect(screen.getByRole("alert")).toHaveClass("ant-alert-warning");
  expect(
    screen.getByText(
      "Couldn't refresh projects. Showing the last loaded projects.",
    ),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Alpha" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(mocks.retry).toHaveBeenCalledWith(expect.any(Function), {
    revalidate: true,
    throwOnError: false,
  });
});

it("replaces the initial failure with content skeletons while retrying", () => {
  mocks.failed = true;
  mocks.validating = true;
  renderProjects();
  expect(
    screen.getByRole("status", { name: "Loading projects…" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(document.querySelector(".ant-spin")).toBeNull();
  expect(screen.queryByRole("button", { name: "Alpha" })).toBeNull();
});

it("keeps loaded content during background refresh without a floating spinner", () => {
  mocks.cached = true;
  mocks.validating = true;
  renderProjects();
  expect(screen.getByRole("button", { name: "Alpha" })).toBeInTheDocument();
  expect(
    screen.queryByRole("status", { name: "Loading projects…" }),
  ).toBeNull();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(document.querySelector(".ant-spin")).toBeNull();
});

it("keeps the cached refresh warning and disables retry without a spinner", () => {
  mocks.failed = true;
  mocks.cached = true;
  mocks.validating = true;
  renderProjects();
  expect(screen.getByRole("alert")).toHaveClass("ant-alert-warning");
  expect(screen.getByRole("button", { name: "Alpha" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Loading…" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Loading…" })).toHaveAttribute(
    "aria-busy",
    "true",
  );
  expect(document.querySelector(".ant-spin")).toBeNull();
});

it("opens the shared creation dialog from the workbench", () => {
  renderProjects();
  fireEvent.click(screen.getByRole("button", { name: "New project" }));
  expect(screen.getByText("Project creation dialog")).toBeInTheDocument();
});

it("renders the project library without a selected details pane", () => {
  renderProjects();
  expect(screen.getByRole("button", { name: "Alpha" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Beta" })).toBeInTheDocument();
  expect(screen.queryByRole("complementary")).toBeNull();
  expect(screen.queryByRole("button", { name: "Open project" })).toBeNull();
  expect(screen.queryByRole("heading", { name: "All projects" })).toBeNull();
  expect(screen.queryByText("My Playground")).toBeNull();
  expect(screen.getAllByRole("button", { name: "New project" })).toHaveLength(
    1,
  );
});

it("keeps workspace grouping links on their existing routes", () => {
  const history = renderProjects();
  fireEvent.click(screen.getByRole("link", { name: "Workspace one" }));
  expect(history.location.pathname).toBe("/workspaces/workspace1");
});

it("keeps the real toolbar while projects load and lets the user choose the list layout", () => {
  mocks.loading = true;
  renderProjects();
  expect(screen.queryByRole("heading", { name: "All projects" })).toBeNull();
  expect(screen.getByRole("button", { name: "New project" })).toBeTruthy();
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
