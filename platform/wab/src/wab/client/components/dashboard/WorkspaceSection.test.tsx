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
import { Select } from "antd";
import { createMemoryHistory } from "history";
import * as React from "react";
import { mock } from "vitest-mock-extended";

const mocks = vi.hoisted(() => ({
  listDataSources: vi.fn(),
  accessLevel: "editor",
  setQuery: vi.fn(),
  promptNewDatabase: vi.fn(),
  shareContent: vi.fn(),
  enableDataQueries: false,
}));
vi.mock("@/wab/client/contexts/AppContexts", () => ({
  useAppCtx: () => ({
    api: mocks,
    selfInfo: null,
    appConfig: { enableDataQueries: mocks.enableDataQueries },
  }),
}));
vi.mock("@/wab/shared/perms", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/wab/shared/perms")>()),
  getAccessLevelToResource: () => mocks.accessLevel,
  filterDirectResourcePerms: () => [],
}));
vi.mock(
  "@/wab/client/components/dashboard/dashboard-actions",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/wab/client/components/dashboard/dashboard-actions")
    >()),
    promptNewDatabase: mocks.promptNewDatabase,
  }),
);
vi.mock("@/wab/client/components/widgets/plasmic/ShareDialogContent", () => ({
  default: (props) => {
    mocks.shareContent(props);
    return props.renderDialog(
      <div>
        <input aria-label="Invite email" />
        <Select
          aria-label="Invite permission"
          defaultValue="editor"
          options={[
            { value: "editor", label: "Developer" },
            { value: "viewer", label: "Viewer" },
          ]}
        />
        <button onClick={props.closeDialog}>Close sharing</button>
      </div>,
      null,
    );
  },
}));
vi.mock("@/wab/client/components/dashboard/WorkspaceDataSources", () => ({
  default: () => <div>Connections</div>,
}));
vi.mock("@/wab/client/components/modals/DataSourceModal", () => ({
  DataSourceModal: ({ editingDataSource, onDone }) => (
    <div role="dialog">
      Connection {editingDataSource}
      <button onClick={onDone}>Done</button>
    </div>
  ),
}));
vi.mock("@/wab/client/components/NewProjectModal", () => ({
  default: ({ workspaceId }) => (
    <div role="dialog">Create in {workspaceId}</div>
  ),
}));

beforeEach(async () => {
  await setLanguagePreference("en");
  mocks.accessLevel = "editor";
  mocks.enableDataQueries = false;
  mocks.listDataSources.mockResolvedValue([{ dataSources: [] }]);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function setup(personalWorkspace = true, inTeamPage = false) {
  const history = createMemoryHistory({ initialEntries: ["/playground"] });
  const onUpdate = vi.fn().mockResolvedValue(undefined);
  const view = render(
    <AntdConfigProvider productUI>
      <HistoryProvider history={history}>
        <WorkspaceSection
          personalWorkspace={personalWorkspace}
          inTeamPage={inTeamPage}
          workspace={mock<ApiWorkspace>({
            id: "personal" as WorkspaceId,
            name: "Personal title",
            team: mock<ApiTeam>({ id: "team" as TeamId }),
          })}
          projects={[]}
          databases={[]}
          perms={[]}
          onUpdate={onUpdate}
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
  return { history, onUpdate, ...view };
}

it.each([
  ["editor", false],
  ["viewer", false],
  ["editor", true],
  ["viewer", true],
])(
  "keeps workspace sharing in More actions for %s (team page: %s)",
  async (accessLevel, inTeamPage) => {
    mocks.accessLevel = accessLevel;
    const { onUpdate } = setup(false, inTeamPage);
    await waitFor(() => expect(mocks.listDataSources).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Share" })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Share" }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(mocks.shareContent).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: {
          type: "workspace",
          resource: expect.objectContaining({ id: "personal" }),
        },
        perms: [],
        reloadPerms: onUpdate,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Close sharing" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  },
);

it("keeps sharing open during content interaction and preserves its state after closing", async () => {
  setup(false);
  const openSharing = async () => {
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Share" }));
    return await screen.findByRole("dialog");
  };
  const dialog = await openSharing();
  const email = screen.getByRole("textbox", { name: "Invite email" });
  fireEvent.mouseDown(email);
  fireEvent.mouseUp(email);
  fireEvent.click(email);
  fireEvent.change(email, { target: { value: "member@example.com" } });
  const permission = screen.getByRole("combobox", {
    name: "Invite permission",
  });
  fireEvent.mouseDown(permission);
  const viewer = await screen.findByText("Viewer");
  fireEvent.click(viewer);
  expect(screen.getByRole("dialog")).toBe(dialog);
  const container = dialog.querySelector(".ant-modal-container");
  expect(container?.contains(email)).toBe(true);
  expect(dialog.querySelector(".ant-modal-footer")).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(email.isConnected).toBe(true);
  await openSharing();
  expect(screen.getByRole("textbox", { name: "Invite email" })).toBe(email);
  expect((email as HTMLInputElement).value).toBe("member@example.com");
  expect(permission.closest(".ant-select")?.textContent).toContain("Viewer");

  const mask = dialog.closest(".ant-modal-wrap");
  expect(mask).toBeTruthy();
  fireEvent.mouseDown(mask as Element);
  fireEvent.mouseUp(mask as Element);
  fireEvent.click(mask as Element);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(email.isConnected).toBe(true);
});

it.each([true, false])(
  "puts filters and creation in the tab bar (personal: %s)",
  async (personal) => {
    const { container } = setup(personal);
    await waitFor(() =>
      expect(mocks.listDataSources).toHaveBeenCalledWith("personal"),
    );
    if (personal) {
      expect(screen.queryByText("Personal title")).toBeNull();
    } else {
      expect(screen.getByText("Personal title")).toBeTruthy();
      expect(
        container
          .querySelector("header")
          ?.contains(screen.getByPlaceholderText("Search…")),
      ).toBe(false);
    }
    const bar = container.querySelector(".ant-tabs-nav")?.parentElement;
    expect(bar?.contains(screen.getByPlaceholderText("Search…"))).toBe(true);
    expect(
      bar?.contains(screen.getByRole("combobox", { name: "Order by" })),
    ).toBe(true);
    expect(
      bar?.contains(screen.getByRole("button", { name: "New project" })),
    ).toBe(true);
    expect(bar?.contains(screen.getByRole("radio", { name: "List" }))).toBe(
      true,
    );
    fireEvent.change(screen.getByPlaceholderText("Search…"), {
      target: { value: "query" },
    });
    expect(mocks.setQuery).toHaveBeenCalledWith("query");
    fireEvent.click(screen.getByRole("button", { name: "New project" }));
    expect(screen.getByRole("dialog").textContent).toContain("personal");
  },
);

it.each([true, false])(
  "switches tab content through the URL and restores it with back navigation (personal: %s)",
  async (personal) => {
    const { history } = setup(personal);
    fireEvent.click(screen.getByRole("tab", { name: "Data sources" }));
    expect(history.location.hash).toBe("#tab=dataSources");
    expect(await screen.findByText("Connections")).toBeTruthy();
    expect(
      screen.getByRole("tabpanel").contains(screen.getByText("Connections")),
    ).toBe(true);
    expect(screen.queryByRole("button", { name: "New project" })).toBeNull();
    expect(screen.queryByRole("radio", { name: "List" })).toBeNull();
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
  },
);

it("keeps creation controls hidden for a read-only workspace", async () => {
  mocks.accessLevel = "viewer";
  setup();
  await waitFor(() => expect(mocks.listDataSources).toHaveBeenCalled());
  expect(screen.queryByRole("button", { name: "New project" })).toBeNull();
  fireEvent.click(screen.getByRole("tab", { name: "Data sources" }));
  expect(screen.queryByRole("button", { name: "New CMS" })).toBeNull();
});

it.each([true, false])(
  "puts data creation in the top toolbar without content headings (personal: %s)",
  async (personal) => {
    const { container, history } = setup(personal);
    fireEvent.click(screen.getByRole("tab", { name: "Data sources" }));
    await screen.findByText("Connections");
    const button = screen.getByRole("button", { name: "New CMS" });
    expect(screen.getByRole("tabpanel").contains(button)).toBe(false);
    expect(
      container.querySelector(".ant-tabs-nav")?.parentElement?.contains(button),
    ).toBe(true);
    expect(container.querySelector("h3")).toBeNull();
    expect(screen.queryByText("Content Management Systems (CMS)")).toBeNull();
    fireEvent.click(button);
    expect(mocks.promptNewDatabase).toHaveBeenCalledWith(
      expect.anything(),
      history,
      "personal",
    );
  },
);

it("offers CMS and integrations through the top data creation menu", async () => {
  mocks.enableDataQueries = true;
  setup();
  fireEvent.click(screen.getByRole("tab", { name: "Data sources" }));
  const button = screen.getByRole("button", { name: "New data source" });
  expect(screen.getByRole("tabpanel").contains(button)).toBe(false);
  fireEvent.click(button);
  expect(await screen.findByRole("menuitem", { name: "New CMS" })).toBeTruthy();
  fireEvent.click(
    await screen.findByRole("menuitem", { name: "Integrations" }),
  );
  expect(await screen.findByRole("dialog")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});
