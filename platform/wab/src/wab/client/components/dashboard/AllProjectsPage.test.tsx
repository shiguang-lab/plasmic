import AllProjectsPage from "@/wab/client/components/dashboard/AllProjectsPage";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";

const mocks = vi.hoisted(() => ({ retry: vi.fn(), failed: false }));
vi.mock("@/wab/client/contexts/AppContexts", () => ({
  useAllProjectsData: () => ({
    data: mocks.failed
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
  vi.clearAllMocks();
});

it("keeps workspace filtering and search when changing the project display", async () => {
  render(<AllProjectsPage />);
  expect(screen.getByRole("button", { name: "Alpha" })).toBeInTheDocument();
  fireEvent.mouseDown(screen.getByLabelText("Workspace"));
  fireEvent.click(await screen.findByText("Workspace two"));
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
  render(<AllProjectsPage />);
  expect(screen.getByText("Failed to load projects")).toBeInTheDocument();
  expect(
    screen.queryByRole("status", { name: "Loading projects…" }),
  ).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(mocks.retry).toHaveBeenCalledTimes(1);
});

it("opens the shared creation dialog from the workbench", () => {
  render(<AllProjectsPage />);
  fireEvent.click(screen.getByRole("button", { name: "New project" }));
  expect(screen.getByText("Project creation dialog")).toBeInTheDocument();
});
