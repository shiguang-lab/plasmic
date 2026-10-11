import NewProjectModal from "@/wab/client/components/NewProjectModal";
import { isAnyModalOpen } from "@/wab/client/components/widgets/open-modals";
import { WorkspaceId } from "@/wab/shared/ApiSchema";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  push: vi.fn(),
  cancel: vi.fn(),
  loading: false,
}));
vi.mock("@/wab/client/contexts/AppContexts", () => ({
  useAppCtx: () => ({
    personalWorkspace: { id: "personal" },
    selfInfo: { id: "tester", email: "tester@example.test" },
    appConfig: {},
    workspaces: [
      { id: "personal", name: "Personal", team: { id: "personal-team" } },
      { id: "read-only", name: "Read only", team: { id: "other-team" } },
    ],
    perms: [
      { userId: "tester", teamId: "personal-team", accessLevel: "owner" },
      { userId: "tester", teamId: "other-team", accessLevel: "viewer" },
    ],
    starters: { templateAndExampleSections: [], appSections: [] },
    api: { createProject: mocks.create },
  }),
  useAllProjectsData: () => ({
    data: mocks.loading ? undefined : { projects: [], perms: [] },
    mutate: vi.fn(),
  }),
}));
vi.mock("@/wab/client/route/HistoryProvider", () => ({
  useHistory: () => ({ push: mocks.push }),
}));
vi.mock("@/wab/client/i18n", () => ({
  useI18n: () => ({ t: (message: string) => message }),
}));
afterEach(() => {
  cleanup();
  mocks.loading = false;
  vi.clearAllMocks();
});

it("keeps the creation drawer in the modal focus and shortcut lifecycle", () => {
  const rendered = render(
    <NewProjectModal
      onCancel={mocks.cancel}
      workspaceId={"personal" as WorkspaceId}
    />,
  );
  expect(screen.getByRole("dialog", { name: "New project" })).toBeTruthy();
  expect(isAnyModalOpen()).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(mocks.cancel).toHaveBeenCalledTimes(1);
  rendered.unmount();
  expect(isAnyModalOpen()).toBe(false);
});

it("still requires a name and creates a blank project in the selected workspace", async () => {
  mocks.create.mockResolvedValue({ project: { id: "new1" } });
  render(<NewProjectModal onCancel={mocks.cancel} />);
  expect(screen.getByText("My Playground")).toBeInTheDocument();
  expect(screen.queryByText("personal", { exact: true })).toBeNull();
  await vi.waitFor(() =>
    expect(
      (screen.getByRole("button", { name: "Create" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  expect(await screen.findByText("Enter a project name")).toBeTruthy();
  expect(mocks.create).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "  New example  " },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  await vi.waitFor(() =>
    expect(mocks.create).toHaveBeenCalledWith({
      name: "New example",
      workspaceId: "personal",
    }),
  );
  expect(mocks.push).toHaveBeenCalledWith("/projects/new1");
});

it("shows the destination name while project data is loading", () => {
  mocks.loading = true;
  render(<NewProjectModal onCancel={mocks.cancel} />);
  expect(screen.getByText("My Playground")).toBeInTheDocument();
  expect(screen.queryByText("personal", { exact: true })).toBeNull();
  expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
});

it("does not offer read-only destinations or create from an unselected template", async () => {
  render(<NewProjectModal onCancel={mocks.cancel} />);
  fireEvent.mouseDown(screen.getByLabelText("Workspace"));
  expect(screen.queryByText("Read only")).toBeNull();
  fireEvent.click(screen.getByRole("tab", { name: "Templates" }));
  expect(
    await screen.findByText("No templates available in this workspace."),
  ).toBeTruthy();
  expect(
    (screen.getByRole("button", { name: "Create" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});
