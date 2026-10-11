import { AntdConfigProvider } from "@/wab/client/antd-theme";
import WorkspaceSection from "@/wab/client/components/dashboard/WorkspaceSection";
import { Matcher } from "@/wab/client/components/view-common";
import { setLanguagePreference } from "@/wab/client/i18n";
import { HistoryProvider } from "@/wab/client/route/HistoryProvider";
import {
  ApiTeam,
  ApiWorkspace,
  TeamId,
  WorkspaceId,
} from "@/wab/shared/ApiSchema";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createMemoryHistory } from "history";
import * as React from "react";
import { mock } from "vitest-mock-extended";

const mocks = vi.hoisted(() => ({
  listDataSources: vi.fn(),
  accessLevel: "editor",
  setQuery: vi.fn(),
  promptNewDatabase: vi.fn(),
}));
vi.mock("@/wab/client/contexts/AppContexts", () => ({
  useAppCtx: () => ({ api: mocks, selfInfo: null }),
}));
vi.mock("@/wab/shared/perms", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/wab/shared/perms")>()),
  getAccessLevelToResource: () => mocks.accessLevel,
  filterDirectResourcePerms: () => [],
}));
vi.mock("@/wab/client/components/dashboard/dashboard-actions", () => ({
  promptNewDatabase: mocks.promptNewDatabase,
  WorkspaceMenu: () => null,
}));
vi.mock("@/wab/client/components/dashboard/WorkspaceDataSources", () => ({
  default: () => <div>Connections</div>,
}));
vi.mock("@/wab/client/components/NewProjectModal", () => ({
  default: ({ workspaceId }) => (
    <div role="dialog">Create in {workspaceId}</div>
  ),
}));

beforeEach(() => {
  setLanguagePreference("en");
  mocks.accessLevel = "editor";
  mocks.listDataSources.mockResolvedValue([{ dataSources: [] }]);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function setup() {
  const history = createMemoryHistory({ initialEntries: ["/playground"] });
  const view = render(
    <AntdConfigProvider productUI>
      <HistoryProvider history={history}>
        <WorkspaceSection
          personalWorkspace
          workspace={mock<ApiWorkspace>({
            id: "personal" as WorkspaceId,
            name: "Personal title",
            team: mock<ApiTeam>({ id: "team" as TeamId }),
          })}
          projects={[]}
          databases={[]}
          perms={[]}
          onUpdate={vi.fn().mockResolvedValue(undefined)}
          matcher={new Matcher("")}
          filterProps={{
            query: "",
            setQuery: mocks.setQuery,
            orderBy: "updatedAt",
            setOrderBy: vi.fn(),
          }}
        />
      </HistoryProvider>
    </AntdConfigProvider>,
  );
  return { history, ...view };
}

it("puts filters and creation in the tab bar without a workspace title", async () => {
  const { container } = setup();
  await waitFor(() =>
    expect(mocks.listDataSources).toHaveBeenCalledWith("personal"),
  );
  expect(screen.queryByText("Personal title")).toBeNull();
  const bar = container.querySelector(".ant-tabs-nav");
  expect(bar?.contains(screen.getByPlaceholderText("Search…"))).toBe(true);
  expect(
    bar?.contains(screen.getByRole("combobox", { name: "Order by" })),
  ).toBe(true);
  expect(
    bar?.contains(screen.getByRole("button", { name: "New project" })),
  ).toBe(true);
  expect(bar?.contains(screen.getByRole("radio", { name: "List" }))).toBe(true);
  fireEvent.change(screen.getByPlaceholderText("Search…"), {
    target: { value: "query" },
  });
  expect(mocks.setQuery).toHaveBeenCalledWith("query");
  fireEvent.click(screen.getByRole("button", { name: "New project" }));
  expect(screen.getByRole("dialog").textContent).toContain("personal");
});

it("switches tab content through the URL and restores it with back navigation", async () => {
  const { history } = setup();
  fireEvent.click(screen.getByRole("tab", { name: "Data sources" }));
  expect(history.location.hash).toBe("#tab=dataSources");
  expect(await screen.findByText("Connections")).toBeTruthy();
  expect(
    screen.getByRole("tabpanel").contains(screen.getByText("Connections")),
  ).toBe(true);
  expect(screen.queryByRole("button", { name: "New project" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "New CMS" }));
  expect(mocks.promptNewDatabase).toHaveBeenCalledWith(
    expect.anything(),
    history,
    "personal",
  );
  await act(async () => history.back());
  expect(
    screen.getByRole("tab", { name: "Projects", selected: true }),
  ).toBeTruthy();
  expect(screen.getByText("This workspace has no projects.")).toBeTruthy();
  expect(screen.queryByText("Connections")).toBeNull();
});

it("keeps creation controls hidden for a read-only workspace", async () => {
  mocks.accessLevel = "viewer";
  setup();
  await waitFor(() => expect(mocks.listDataSources).toHaveBeenCalled());
  expect(screen.queryByRole("button", { name: "New project" })).toBeNull();
  fireEvent.click(screen.getByRole("tab", { name: "Data sources" }));
  expect(screen.queryByRole("button", { name: "New CMS" })).toBeNull();
});
