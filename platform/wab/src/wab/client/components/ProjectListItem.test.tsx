import ProjectListItem from "@/wab/client/components/ProjectListItem";
import { ApiProject } from "@/wab/shared/ApiSchema";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";

const mocks = vi.hoisted(() => ({
  access: "owner",
  parent: "editor",
  select: vi.fn(),
  push: vi.fn(),
  prompt: vi.fn(),
  clone: vi.fn(),
}));
vi.mock("@/wab/client/contexts/AppContexts", () => ({
  useAppCtx: () => ({
    selfInfo: {},
    workspaces: [],
    ops: {},
    api: { cloneProject: mocks.clone },
    app: { withSpinner: (promise: Promise<unknown>) => promise },
  }),
}));
vi.mock("@/wab/shared/perms", () => ({
  getAccessLevelToResource: () => mocks.access,
  getAccessLevelToParent: () => mocks.parent,
}));
vi.mock("@/wab/client/route/HistoryProvider", () => ({
  useHistory: () => ({ push: mocks.push }),
}));
vi.mock("@/wab/client/components/dashboard/dashboard-actions", () => ({
  promptMoveToWorkspace: mocks.prompt,
}));
vi.mock("@/wab/client/components/HostConfig", () => ({
  HostConfig: () => <div>Host configuration</div>,
}));
vi.mock("@/wab/client/components/modals/PricingModal", () => ({
  maybeShowPaywall: vi.fn(),
}));
vi.mock("@/wab/client/components/quick-modals", () => ({
  reactConfirm: vi.fn(),
}));
vi.mock("@/wab/client/components/widgets", () => ({
  ClickStopper: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("@/wab/client/components/EditableResourceName", () => ({
  default: ({ name, cantEdit }: { name: string; cantEdit?: boolean }) => (
    <span data-editable={String(!cantEdit)}>{name}</span>
  ),
}));
vi.mock("@/wab/client/components/PublicLink", () => ({
  PublicLink: (props: React.ComponentProps<"a">) => <a {...props} />,
}));
vi.mock("@/wab/client/i18n", () => ({
  useI18n: () => ({ t: (message: string) => message, locale: "en" }),
}));

const project = {
  id: "project1",
  name: "Example project",
  workspaceId: "workspace1",
  workspaceName: "Workspace one",
  updatedAt: "2026-10-01",
} as ApiProject;
afterEach(() => {
  cleanup();
  mocks.access = "owner";
  mocks.parent = "editor";
  vi.clearAllMocks();
});

it("selects a project with the cover and retains a direct editor link", () => {
  render(
    <ProjectListItem project={project} perms={[]} onSelect={mocks.select} />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Project details: Example project" }),
  );
  expect(mocks.select).toHaveBeenCalledTimes(1);
  expect(mocks.push).not.toHaveBeenCalled();
  expect(
    screen.getByRole("link", { name: "Open project" }).getAttribute("href"),
  ).toBe("/projects/project1");
});

it.each(["card", "details"] as const)(
  "keeps editor and owner actions in the %s presentation",
  async (presentation) => {
    render(
      <ProjectListItem
        project={project}
        perms={[]}
        workspaces
        presentation={presentation}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    for (const label of [
      "Configure project",
      "Duplicate project",
      "Move to workspace",
      "Set as workspace starter",
      "Delete project",
    ]) {
      expect(await screen.findByRole("menuitem", { name: label })).toBeTruthy();
    }
    if (DEVFLAGS.demo)
      expect(
        screen.getByRole("menuitem", { name: "Download project" }),
      ).toBeTruthy();
  },
);

it("does not expose editor or owner actions to a viewer", async () => {
  mocks.access = "viewer";
  mocks.parent = "viewer";
  render(
    <ProjectListItem
      project={project}
      perms={[]}
      workspaces
      presentation="details"
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "More" }));
  expect(
    await screen.findByRole("menuitem", { name: "Duplicate project" }),
  ).toBeTruthy();
  for (const label of [
    "Configure project",
    "Move to workspace",
    "Set as workspace starter",
    "Delete project",
    "Remove from dashboard",
  ])
    expect(screen.queryByRole("menuitem", { name: label })).toBeNull();
});

it("preserves removal from the dashboard for a project without inherited workspace access", async () => {
  mocks.access = "viewer";
  mocks.parent = "blocked";
  render(
    <ProjectListItem
      project={project}
      perms={[]}
      workspaces
      presentation="details"
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "More" }));
  expect(
    await screen.findByRole("menuitem", { name: "Remove from dashboard" }),
  ).toBeTruthy();
  expect(screen.queryByRole("menuitem", { name: "Delete project" })).toBeNull();
});

it("duplicates from the details button with the same name and workspace contract", async () => {
  mocks.prompt.mockResolvedValue({
    result: "workspace",
    workspace: { id: "destination" },
    name: "Copy name",
  });
  mocks.clone.mockResolvedValue({ projectId: "copy1" });
  render(
    <ProjectListItem project={project} perms={[]} presentation="details" />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Duplicate project" }));
  await vi.waitFor(() =>
    expect(mocks.clone).toHaveBeenCalledWith("project1", {
      workspaceId: "destination",
      name: "Copy name",
    }),
  );
  expect(mocks.push).toHaveBeenCalledWith("/projects/copy1");
});
