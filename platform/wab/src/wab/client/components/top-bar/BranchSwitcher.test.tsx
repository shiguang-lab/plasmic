import BranchSwitcher from "@/wab/client/components/top-bar/BranchSwitcher";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";
import { SWRConfig } from "swr";

const mocks = vi.hoisted(() => ({
  current: undefined as { id: string; name: string } | undefined,
  live: false,
  editable: true,
  list: vi.fn(),
  switchBranch: vi.fn(),
  push: vi.fn(),
  unpublished: vi.fn(),
  releases: [] as object[],
  versionChoice: vi.fn(),
  promptName: vi.fn(),
  create: vi.fn(),
  showPublish: vi.fn(),
}));
vi.mock("@/wab/client/contexts/StudioContexts", () => ({
  useStudioCtx: () => ({
    siteInfo: { id: "project" },
    dbCtx: () => ({ branchInfo: mocks.current }),
    appCtx: {
      api: { listBranchesForProject: mocks.list, createBranch: mocks.create },
      appConfig: { disableBranching: false },
      history: {
        location: {
          pathname: "/projects/project/preview",
          search: "?width=390&height=844&viewport=phone",
          hash: "#/groups?branch=business",
        },
        push: mocks.push,
      },
    },
    releases: mocks.releases,
    canEditProject: () => mocks.editable,
    isLiveMode: mocks.live,
    switchToBranch: mocks.switchBranch,
    branchHasUnpublishedChanges: mocks.unpublished,
  }),
}));
vi.mock("@/wab/client/contexts/AppContexts", () => ({
  useTopFrameApi: () => ({ setShowPublishModal: mocks.showPublish }),
}));
vi.mock("@/wab/client/api", () => ({ apiKey: (...args: string[]) => args }));
vi.mock("@/wab/client/components/menu-builder", () => ({
  menuSection: (_key: string, ...items: React.ReactNode[]) => items,
}));
vi.mock("@/wab/client/components/quick-modals", () => ({
  reactConfirm: vi.fn(),
  reactPrompt: mocks.promptName,
}));
vi.mock("@/wab/client/components/view-common", () => ({
  Matcher: class {
    constructor(private query: string) {}
    matches(value: string) {
      return value.toLowerCase().includes(this.query.toLowerCase());
    }
    boldSnippets(value: string) {
      return value;
    }
  },
}));
vi.mock("@/wab/client/i18n", () => ({
  useI18n: () => ({ t: (text: string) => text }),
}));
vi.mock("@/wab/client/i18n/UiText", () => ({
  UiText: ({ message }: { message: string }) => <>{message}</>,
  UiLabel: ({ message }: { message: string }) => <>{message}</>,
}));

vi.mock(
  "@/wab/client/components/sidebar-tabs/ProjectPanel/BranchVersionDialog",
  () => ({ promptBranchVersion: mocks.versionChoice }),
);

function mount() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>
      <BranchSwitcher />
    </SWRConfig>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.current = undefined;
  mocks.live = false;
  mocks.editable = true;
  mocks.releases = [];
  mocks.versionChoice.mockResolvedValue(undefined);
  mocks.promptName.mockResolvedValue("new-branch");
  mocks.create.mockResolvedValue({ branch: { id: "new", name: "new-branch" } });
  mocks.list.mockResolvedValue({
    branches: [
      { id: "feature", name: "feature", status: "active" },
      { id: "old", name: "old", status: "merged" },
    ],
  });
});
afterEach(cleanup);

test("opens on click and switches without waiting for publication checks", async () => {
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Branches: main" }));
  expect(
    (await screen.findByRole("button", { name: "main" })).getAttribute(
      "aria-pressed",
    ),
  ).toBe("true");
  expect(mocks.unpublished).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "feature" }));
  await waitFor(() =>
    expect(mocks.switchBranch).toHaveBeenCalledWith(
      expect.objectContaining({ id: "feature" }),
    ),
  );
  await waitFor(() =>
    expect(
      screen
        .getByRole("button", { name: "Branches: main" })
        .getAttribute("aria-expanded"),
    ).toBe("false"),
  );
});

test("preview switches branch context without changing the business route", async () => {
  mocks.live = true;
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Branches: main" }));
  fireEvent.click(await screen.findByRole("button", { name: "feature" }));
  expect(mocks.push).toHaveBeenCalledWith({
    pathname: "/projects/project/preview",
    search: "?width=390&height=844&viewport=phone&branch=feature",
    hash: "#/groups?branch=business",
  });
  expect(mocks.switchBranch).not.toHaveBeenCalled();
  expect(
    screen.queryByRole("button", { name: /Create new branch/ }),
  ).toBeNull();
});

test("searches archived branches and handles empty results and Escape", async () => {
  mount();
  const trigger = screen.getByRole("button", { name: "Branches: main" });
  fireEvent.click(trigger);
  const search = await screen.findByRole("textbox", {
    name: "Search branches",
  });
  fireEvent.change(search, { target: { value: "missing" } });
  expect(await screen.findByText("No branches found")).toBeTruthy();
  fireEvent.change(search, { target: { value: "old" } });
  expect(await screen.findByRole("button", { name: "old" })).toBeTruthy();
  fireEvent.keyDown(search, { key: "Escape" });
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
});

test("failed loading offers retry instead of leaving the spinner forever", async () => {
  mocks.list.mockRejectedValueOnce(new Error("offline"));
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Branches: main" }));
  fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
  expect(await screen.findByRole("button", { name: "feature" })).toBeTruthy();
});

test("branch actions remain reachable inside the popover", async () => {
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Branches: main" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Branch actions: feature" }),
  );
  expect(await screen.findByRole("menuitem", { name: /Rename/ })).toBeTruthy();
  expect(screen.getByRole("menuitem", { name: /Duplicate/ })).toBeTruthy();
  expect(screen.getByRole("menuitem", { name: /Archive/ })).toBeTruthy();
});

test("outside click closes the popover and read-only viewers cannot manage branches", async () => {
  mocks.editable = false;
  mount();
  const trigger = screen.getByRole("button", { name: "Branches: main" });
  fireEvent.click(trigger);
  await screen.findByRole("textbox", { name: "Search branches" });
  expect(
    screen.queryByRole("button", { name: /Create new branch/ }),
  ).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Branch actions: main" }),
  ).toBeNull();
  fireEvent.pointerDown(document.body);
  fireEvent.mouseDown(document.body);
  fireEvent.click(document.body);
  await waitFor(() =>
    expect(trigger.getAttribute("aria-expanded")).toBe("false"),
  );
});

test("canvas iframe interactions close the branch panel", async () => {
  mount();
  const trigger = screen.getByRole("button", { name: "Branches: main" });
  fireEvent.click(trigger);
  await screen.findByRole("textbox", { name: "Search branches" });
  fireEvent.mouseDown(document.body);
  fireEvent.mouseUp(document.body);
  fireEvent.click(document.body);
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
});

test("canvas interactions close the panel even when bubbling is stopped", async () => {
  mount();
  render(
    <div
      data-testid="canvas"
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    />,
  );
  const trigger = screen.getByRole("button", { name: "Branches: main" });
  fireEvent.click(trigger);
  await screen.findByRole("textbox", { name: "Search branches" });
  const canvas = screen.getByTestId("canvas");
  fireEvent.mouseDown(canvas, { button: 0 });
  fireEvent.mouseUp(canvas, { button: 0 });
  fireEvent.click(canvas);
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
});

test("creating the first branch opens version saving and does not create prematurely", async () => {
  mocks.versionChoice.mockResolvedValue("save");
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Branches: main" }));
  fireEvent.click(
    await screen.findByRole("button", { name: /Create new branch/ }),
  );
  await waitFor(() => expect(mocks.showPublish).toHaveBeenCalledWith(true));
  expect(mocks.versionChoice).toHaveBeenCalledWith(false);
  expect(mocks.create).not.toHaveBeenCalled();
});

test("dismissing the version dialog does not silently create from an old version", async () => {
  mocks.releases = [{}];
  mocks.unpublished.mockResolvedValue(true);
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Branches: main" }));
  fireEvent.click(
    await screen.findByRole("button", { name: /Create new branch/ }),
  );
  await waitFor(() => expect(mocks.versionChoice).toHaveBeenCalledWith(true));
  expect(mocks.promptName).not.toHaveBeenCalled();
  expect(mocks.create).not.toHaveBeenCalled();
});

test("explicitly choosing the saved version continues branch creation", async () => {
  mocks.releases = [{}];
  mocks.unpublished.mockResolvedValue(true);
  mocks.versionChoice.mockResolvedValue("use-last");
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Branches: main" }));
  fireEvent.click(
    await screen.findByRole("button", { name: /Create new branch/ }),
  );
  await waitFor(() =>
    expect(mocks.create).toHaveBeenCalledWith("project", {
      name: "new-branch",
      sourceBranchId: undefined,
    }),
  );
  expect(mocks.showPublish).not.toHaveBeenCalled();
});
