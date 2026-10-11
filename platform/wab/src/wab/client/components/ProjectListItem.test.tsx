import ProjectListItem from "@/wab/client/components/ProjectListItem";
import { ApiProject } from "@/wab/shared/ApiSchema";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";

const mocks = vi.hoisted(() => ({
  access: "owner",
  parent: "editor",
  rename: vi.fn(),
  report: vi.fn(),
  push: vi.fn(),
  prompt: vi.fn(),
  clone: vi.fn(),
  userId: undefined as string | undefined,
}));
vi.mock("@/wab/client/contexts/AppContexts", () => ({
  useAppCtx: () => ({
    selfInfo: { id: mocks.userId },
    workspaces: [],
    ops: { renameSite: mocks.rename },
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
vi.mock("@/wab/client/ErrorNotifications", () => ({
  reportError: mocks.report,
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
  mocks.userId = undefined;
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it("keeps the skeleton inside the thumbnail while project metadata remains visible", () => {
  const previewEnabled = DEVFLAGS.dashboardCanvasPreview;
  DEVFLAGS.dashboardCanvasPreview = true;
  mocks.userId = "user";
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {
        /* Preview stays queued in this test. */
      }
      disconnect() {
        /* No native observer resources. */
      }
    },
  );
  try {
    const { container } = render(
      <ProjectListItem project={project} perms={[]} showWorkspace />,
    );
    const card = screen.getByRole("link", {
      name: "Open project: Example project",
    });
    const thumbnail = card.firstElementChild;
    const skeleton = container.querySelector(".ant-skeleton-node");
    expect(skeleton).not.toBeNull();
    expect(thumbnail?.contains(skeleton)).toBe(true);
    expect(thumbnail?.textContent).toBe("");
    for (const content of [
      screen.getByText("Example project"),
      screen.getByText("Workspace one"),
      screen.getByText(/Updated/),
    ]) {
      expect(thumbnail?.contains(content)).toBe(false);
    }
    fireEvent.click(card);
    expect(mocks.push).toHaveBeenCalledWith("/projects/project1");
  } finally {
    DEVFLAGS.dashboardCanvasPreview = previewEnabled;
  }
});

it("opens the project directly from the cover, card, or keyboard without a separate action", () => {
  render(<ProjectListItem project={project} perms={[]} />);
  const card = screen.getByRole("link", {
    name: "Open project: Example project",
  });
  fireEvent.click(card.firstElementChild as HTMLElement);
  fireEvent.click(card);
  fireEvent.keyDown(card, { key: "Enter" });
  expect(mocks.push).toHaveBeenCalledTimes(3);
  expect(mocks.push).toHaveBeenCalledWith("/projects/project1");
  expect(screen.queryByRole("button", { name: "Open project" })).toBeNull();
});

it("keeps editor and owner menu actions without opening the project", async () => {
  render(<ProjectListItem project={project} perms={[]} workspaces />);
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
  if (DEVFLAGS.demo) {
    expect(
      screen.getByRole("menuitem", { name: "Download project" }),
    ).toBeTruthy();
  }
  expect(mocks.push).not.toHaveBeenCalled();
});

it("does not expose editor or owner actions to a viewer", async () => {
  mocks.access = "viewer";
  mocks.parent = "viewer";
  render(<ProjectListItem project={project} perms={[]} workspaces />);
  fireEvent.click(screen.getByRole("button", { name: "More" }));
  expect(
    await screen.findByRole("menuitem", { name: "Duplicate project" }),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Rename project" })).toBeNull();
  for (const label of [
    "Configure project",
    "Move to workspace",
    "Set as workspace starter",
    "Delete project",
    "Remove from dashboard",
  ]) {
    expect(screen.queryByRole("menuitem", { name: label })).toBeNull();
  }
});

it("preserves removal from the dashboard for a project without inherited workspace access", async () => {
  mocks.access = "viewer";
  mocks.parent = "blocked";
  render(<ProjectListItem project={project} perms={[]} workspaces />);
  fireEvent.click(screen.getByRole("button", { name: "More" }));
  expect(
    await screen.findByRole("menuitem", { name: "Remove from dashboard" }),
  ).toBeTruthy();
  expect(screen.queryByRole("menuitem", { name: "Delete project" })).toBeNull();
});

it("duplicates from the menu with the same name and workspace contract", async () => {
  mocks.prompt.mockResolvedValue({
    result: "workspace",
    workspace: { id: "destination" },
    name: "Copy name",
  });
  mocks.clone.mockResolvedValue({ projectId: "copy1" });
  render(<ProjectListItem project={project} perms={[]} />);
  fireEvent.click(screen.getByRole("button", { name: "More" }));
  fireEvent.click(
    await screen.findByRole("menuitem", { name: "Duplicate project" }),
  );
  await vi.waitFor(() =>
    expect(mocks.clone).toHaveBeenCalledWith("project1", {
      workspaceId: "destination",
      name: "Copy name",
    }),
  );
  expect(mocks.push).toHaveBeenCalledWith("/projects/copy1");
});

it("saves a trimmed name once when Enter and blur happen together, without navigating", async () => {
  let complete: () => void = () => {};
  mocks.rename.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        complete = resolve;
      }),
  );
  const item = { ...project };
  render(<ProjectListItem project={item} perms={[]} />);
  fireEvent.click(screen.getByRole("button", { name: "Rename project" }));
  const input = screen.getByRole("textbox", { name: "Rename project" });
  fireEvent.change(input, { target: { value: "  Renamed project  " } });
  fireEvent.keyDown(input, { key: "Enter", code: "Enter", charCode: 13 });
  fireEvent.blur(input);
  expect(mocks.rename).toHaveBeenCalledTimes(1);
  expect(mocks.rename).toHaveBeenCalledWith("project1", "Renamed project");
  complete();
  await vi.waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
  expect(item.name).toBe("Renamed project");
  expect(mocks.push).not.toHaveBeenCalled();
});

it.each(["", "   ", "Example project"])(
  "preserves the name when the draft is %j",
  (draft) => {
    render(<ProjectListItem project={{ ...project }} perms={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Rename project" }));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: draft } });
    fireEvent.blur(input);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(mocks.rename).not.toHaveBeenCalled();
  },
);

it("cancels editing on Escape and keeps failed edits available for retry", async () => {
  render(<ProjectListItem project={{ ...project }} perms={[]} />);
  fireEvent.click(screen.getByRole("button", { name: "Rename project" }));
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "Changed" },
  });
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
  expect(mocks.rename).not.toHaveBeenCalled();
  expect(screen.queryByRole("textbox")).toBeNull();
  mocks.rename.mockRejectedValueOnce(new Error("Rename failed"));
  fireEvent.click(screen.getByRole("button", { name: "Rename project" }));
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "Changed" } });
  fireEvent.blur(input);
  await vi.waitFor(() => expect(mocks.report).toHaveBeenCalledTimes(1));
  expect(screen.getByRole("textbox")).toBeTruthy();
  expect(mocks.push).not.toHaveBeenCalled();
});

it("enables marquee only for overflowing names and updates it after a rename", () => {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(100);
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(
    function () {
      return this.textContent === "Short" ? 80 : 280;
    },
  );
  const { container, rerender } = render(
    <ProjectListItem
      project={{ ...project, name: "Long project name" }}
      perms={[]}
    />,
  );
  expect(
    container.querySelectorAll('[title="Long project name"].overflowingTitle'),
  ).toHaveLength(2);
  rerender(
    <ProjectListItem project={{ ...project, name: "Short" }} perms={[]} />,
  );
  expect(container.querySelectorAll(".overflowingTitle")).toHaveLength(0);
});
