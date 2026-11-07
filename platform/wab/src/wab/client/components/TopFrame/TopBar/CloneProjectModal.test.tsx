import { CloneProjectModal } from "@/wab/client/components/TopFrame/TopBar/CloneProjectModal";
import { toOpaque } from "@/wab/commons/types";
import { ApiProject } from "@/wab/shared/ApiSchema";
import { cleanup, render, waitFor } from "@testing-library/react";
import * as React from "react";
import { mock } from "vitest-mock-extended";

const mocks = vi.hoisted(() => ({
  promptMoveToWorkspace: vi.fn(),
  parseProjectLocation: vi.fn(),
  cloneProject: vi.fn(),
  withSpinner: vi.fn(),
}));

vi.mock("@/wab/client/components/dashboard/dashboard-actions", () => ({
  promptMoveToWorkspace: mocks.promptMoveToWorkspace,
}));
vi.mock("@/wab/client/cli-routes", () => ({
  parseProjectLocation: mocks.parseProjectLocation,
}));
vi.mock("@/wab/client/contexts/AppContexts", () => ({
  useAppCtx: () => ({
    api: { cloneProject: mocks.cloneProject },
    app: { withSpinner: mocks.withSpinner },
    history: { location: { pathname: "/projects/source-project" } },
  }),
}));

const project = mock<ApiProject>({
  id: toOpaque("source-project"),
  name: "Source project",
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.withSpinner.mockImplementation(
    (action: Promise<unknown>) => action,
  );
  mocks.cloneProject.mockResolvedValue({ projectId: "cloned-project" });
  vi.spyOn(window, "open").mockReturnValue(null);
});
afterEach(cleanup);

test("cancelling workspace selection closes the modal without cloning", async () => {
  mocks.promptMoveToWorkspace.mockResolvedValue(undefined);
  const setShowCloneProjectModal = vi.fn().mockResolvedValue(undefined);

  render(
    <CloneProjectModal
      project={project}
      showCloneProjectModal
      setShowCloneProjectModal={setShowCloneProjectModal}
    />,
  );

  await waitFor(() =>
    expect(setShowCloneProjectModal).toHaveBeenCalledExactlyOnceWith(false),
  );
  expect(mocks.cloneProject).not.toHaveBeenCalled();
  expect(window.open).not.toHaveBeenCalled();
});

test("clones into the selected workspace and preserves the source branch", async () => {
  mocks.promptMoveToWorkspace.mockResolvedValue({
    result: "workspace",
    workspace: { id: "target-workspace" },
    name: "Cloned project",
  });
  mocks.parseProjectLocation.mockReturnValue({ branchName: "feature-x" });
  const setShowCloneProjectModal = vi.fn().mockResolvedValue(undefined);

  render(
    <CloneProjectModal
      project={project}
      showCloneProjectModal
      setShowCloneProjectModal={setShowCloneProjectModal}
    />,
  );

  await waitFor(() => expect(window.open).toHaveBeenCalledOnce());
  expect(mocks.promptMoveToWorkspace).toHaveBeenCalledWith(
    expect.anything(),
    null,
    false,
    "Duplicate",
    "Source project",
  );
  expect(mocks.cloneProject).toHaveBeenCalledExactlyOnceWith(
    "source-project",
    {
      workspaceId: "target-workspace",
      name: "Cloned project",
      branchName: "feature-x",
    },
  );
  expect(window.open).toHaveBeenCalledExactlyOnceWith(
    "/projects/cloned-project",
    "_blank",
  );
  expect(setShowCloneProjectModal).not.toHaveBeenCalled();
});
