import NewProjectModal from "@/wab/client/components/NewProjectModal";
import { WorkspaceId } from "@/wab/shared/ApiSchema";
import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import * as React from "react";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  clone: vi.fn(),
  published: vi.fn(),
  preferences: vi.fn(),
  navigate: vi.fn(),
}));
vi.mock("@/wab/client/contexts/AppContexts", () => ({
  useAllProjectsData: () => ({
    data: {
      projects: [],
      perms: [
        { workspaceId: "workspace1", userId: "user1", accessLevel: "owner" },
      ],
    },
  }),
  useAppCtx: () => ({
    selfInfo: { id: "user1", email: "ui@example.test" },
    appConfig: { adminTeamDomain: "admin.example.com" },
    personalWorkspace: { id: "workspace1" },
    workspaces: [
      { id: "workspace1", name: "Editable workspace", team: { id: "team1" } },
      { id: "readonly", name: "Read only workspace", team: { id: "team2" } },
    ],
    starters: {
      templateAndExampleSections: [
        {
          projects: [
            {
              name: "Template one",
              projectId: "template1",
              tag: "template1",
              description: "Starter",
            },
          ],
        },
      ],
      appSections: [],
    },
    api: {
      createProject: mocks.create,
      cloneProject: mocks.clone,
      clonePublishedTemplate: mocks.published,
      updateUserPreferences: mocks.preferences,
    },
  }),
}));
vi.mock("@/wab/client/i18n", () => ({
  useI18n: () => ({ t: (message: string) => message }),
}));
vi.mock("@/wab/client/route/HistoryProvider", () => ({
  useHistory: () => ({ push: mocks.navigate }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("retains inputs after a failed creation and retries the same project in the same workspace", async () => {
  mocks.create
    .mockRejectedValueOnce(new Error("Service unavailable"))
    .mockResolvedValueOnce({ project: { id: "newproject" } });
  render(<NewProjectModal onCancel={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "My project" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  await screen.findByText("Service unavailable");
  expect(screen.getByLabelText("Name")).toHaveValue("My project");
  expect(mocks.create).toHaveBeenCalledWith({
    name: "My project",
    workspaceId: "workspace1",
  });
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  await waitFor(() =>
    expect(mocks.navigate).toHaveBeenCalledWith("/projects/newproject"),
  );
  expect(mocks.create).toHaveBeenCalledTimes(2);
});

it("rejects a blank project name before calling the API", async () => {
  render(<NewProjectModal onCancel={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "   " } });
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  await screen.findByText("Enter a project name");
  expect(mocks.create).not.toHaveBeenCalled();
});

it("requires a template selection and rejects a read only workspace", async () => {
  render(
    <NewProjectModal
      workspaceId={"readonly" as WorkspaceId}
      onCancel={vi.fn()}
    />,
  );
  expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
  fireEvent.click(screen.getByRole("tab", { name: "Templates" }));
  await screen.findByText("Template one");
  expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
  expect(mocks.clone).not.toHaveBeenCalled();
});
