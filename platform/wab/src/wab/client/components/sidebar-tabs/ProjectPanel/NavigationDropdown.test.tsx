import { NavigationDropdown } from "@/wab/client/components/sidebar-tabs/ProjectPanel/NavigationDropdown";
import { setLanguagePreference } from "@/wab/client/i18n";
import { languageOptions, translate } from "@/wab/client/i18n/locales";
import {
  promptComponentTemplate,
  promptPageTemplate,
} from "@/wab/client/prompts";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ARENAS_DESCRIPTION } from "@/wab/shared/Labels";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { Arena } from "@/wab/shared/model/classes";
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";

const fixture = vi.hoisted(() => ({ ctx: undefined as any }));
vi.mock("@/wab/client/contexts/StudioContexts", () => ({
  useStudioCtx: () => fixture.ctx,
}));
vi.mock(
  "@/wab/client/components/sidebar-tabs/ProjectPanel/NavigationRows",
  () => ({
    HEADER_HEIGHT: 28,
    ROW_HEIGHT: 30,
    getArenaDisplay: (type: string) => type,
    NavigationHeaderRow: ({ children }: React.PropsWithChildren) => (
      <>{children}</>
    ),
    NavigationFolderRow: () => null,
    NavigationArenaRow: () => null,
  }),
);
vi.mock("@/wab/client/components/widgets/ListStack", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/wab/client/components/widgets/ListStack")
  >()),
  // jsdom has no layout; give the real virtual tree a visible viewport.
  ListSpace: ({
    children,
  }: {
    children: (size: { height: number }) => React.ReactNode;
  }) => children({ height: 500 }),
}));
vi.mock(
  "@/wab/client/components/sidebar-tabs/ProjectPanel/ArenaContextMenu",
  () => ({ deleteArenas: vi.fn() }),
);
vi.mock("@/wab/client/prompts", () => ({
  promptComponentTemplate: vi.fn(),
  promptPageTemplate: vi.fn(),
}));
vi.mock(
  "@/wab/client/components/sidebar-tabs/DataSource/DataSourceOpPicker",
  () => ({
    getOpIdForDataSourceOpExpr: vi.fn(),
    orderFieldsByRanking: vi.fn(),
    useSource: vi.fn(),
    useSourceSchemaData: vi.fn(),
  }),
);
vi.mock(
  "@/wab/client/components/sidebar-tabs/DataSource/DataSourceTablePicker",
  () => ({
    DataSourceTablePicker: () => null,
    INVALID_DATA_SOURCE_MESSAGE: { dynamicPages: "" },
  }),
);
vi.mock("@/wab/client/insertable-templates", () => ({
  buildInsertableExtraInfo: vi.fn(),
  getScreenVariantToInsertableTemplate: vi.fn(),
  replaceWithPageTemplate: vi.fn(),
}));
vi.mock("@/wab/client/components/quick-modals", () => ({
  showTemporaryPrompt: vi.fn(),
}));
vi.mock("@/wab/client/components/modals/folderDeletionModal", () => ({
  promptDeleteFolder: vi.fn(),
}));
beforeAll(() =>
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    },
  ),
);
afterAll(() => vi.unstubAllGlobals());
afterEach(async () => {
  cleanup();
  await act(async () => await setLanguagePreference("en"));
});

function Directory() {
  const [expanded, setExpanded] = React.useState(true);
  return (
    <NavigationDropdown
      expanded={expanded}
      onExpandedChange={setExpanded}
      onClose={() => undefined}
    />
  );
}
beforeEach(async () => {
  await setLanguagePreference("en");
  const arena = new Arena({ name: "Customer overview", children: [] });
  fixture.ctx = {
    site: createSite(),
    currentArena: arena,
    contentEditorMode: false,
    navigationPanel: "outline",
    projectSearchInputRef: React.createRef<HTMLInputElement>(),
    getSortedMixedArenas: () => [arena],
    getSortedPageArenas: () => [],
    getSortedComponentArenas: () => [],
    changeUnsafe: vi.fn(async (change: () => unknown) => change()),
    addArena: vi.fn(),
    addComponent: vi.fn((name: string, opts: { type: ComponentType }) =>
      new TplMgr({ site: fixture.ctx.site }).addComponent({
        name,
        type: opts.type,
      }),
    ),
    setNavigationPanel: vi.fn((panel) => {
      fixture.ctx.navigationPanel = panel;
    }),
  };
});

it("localizes the cached directory tooltip and updates it while open", async () => {
  const { container } = render(<Directory />);
  fireEvent.click(
    ensure(
      container.querySelector('[data-test-id="info-tooltip-trigger"]'),
      "The directory header must expose its info tooltip",
    ),
  );
  await waitFor(() => expect(screen.getByText(ARENAS_DESCRIPTION)).toBeVisible());

  for (const { value } of languageOptions) {
    await act(async () => await setLanguagePreference(value));
    await waitFor(() =>
      expect(screen.getByText(translate(value, ARENAS_DESCRIPTION))).toBeVisible(),
    );
    if (value !== "en") {
      expect(screen.queryByText(ARENAS_DESCRIPTION)).not.toBeInTheDocument();
    }
  }
  expect(fixture.ctx.currentArena.name).toBe("Customer overview");
});

it("toggles the whole directory repeatedly and shows the current object without changing selection", () => {
  const { container } = render(<Directory />);
  const arena = fixture.ctx.currentArena;
  const content = container.querySelector("#project-directory-content");
  for (let attempt = 0; attempt < 3; attempt++) {
    fireEvent.click(screen.getByRole("button", { name: "Project directory" }));
    expect(content).not.toBeVisible();
    expect(
      screen.getByRole("button", { name: "Project directory" }),
    ).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(screen.getByRole("button", { name: "Customer overview" }));
    expect(content).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Project directory" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(fixture.ctx.currentArena).toBe(arena);
  }
});

it("expands for search and retains the query when the title is collapsed and reopened", () => {
  render(<Directory />);
  fireEvent.click(screen.getByRole("button", { name: "Project directory" }));
  fireEvent.click(screen.getByRole("button", { name: "Search" }));
  const input = screen.getByRole("textbox", { name: "Go to page/component" });
  expect(input).toHaveFocus();
  fireEvent.change(input, { target: { value: "Customers" } });
  fireEvent.click(screen.getByRole("button", { name: "Project directory" }));
  expect(input).not.toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Project directory" }));
  expect(input).toBeVisible();
  expect(input).toHaveValue("Customers");
});

it("expands the directory when its create menu is opened", async () => {
  render(<Directory />);
  fireEvent.click(screen.getByRole("button", { name: "Project directory" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Create a page, component or arena" }),
  );
  expect(
    screen.getByRole("button", { name: "Project directory" }),
  ).toHaveAttribute("aria-expanded", "true");
  await waitFor(() => expect(screen.getByText("New page")).toBeVisible());
});

it("retains a shortcut-opened search when the directory is collapsed and reopened", () => {
  fixture.ctx.navigationPanel = "pages";
  render(<Directory />);
  const input = screen.getByRole("textbox", { name: "Go to page/component" });
  fireEvent.change(input, { target: { value: "Customers" } });
  fireEvent.click(screen.getByRole("button", { name: "Project directory" }));
  expect(input).not.toBeVisible();
  expect(fixture.ctx.setNavigationPanel).toHaveBeenCalledWith("outline");
  fireEvent.click(screen.getByRole("button", { name: "Project directory" }));
  expect(input).toBeVisible();
  expect(input).toHaveValue("Customers");
});

it.each([
  {
    label: "New page",
    name: "Customers",
    setup: () =>
      vi
        .mocked(promptPageTemplate)
        .mockResolvedValueOnce({ type: "blank", name: "Customers" }),
    type: ComponentType.Page,
  },
  {
    label: "New component",
    name: "CustomerCard",
    setup: () =>
      vi
        .mocked(promptComponentTemplate)
        .mockResolvedValueOnce({ name: "CustomerCard" }),
    type: ComponentType.Plain,
  },
])(
  "creates through the top menu's $label action",
  async ({ label, setup, name, type }) => {
    setup();
    render(<Directory />);
    fireEvent.click(
      screen.getByRole("button", { name: "Create a page, component or arena" }),
    );
    fireEvent.click(await screen.findByText(label));
    await waitFor(() =>
      expect(fixture.ctx.addComponent).toHaveBeenCalledWith(
        name,
        expect.objectContaining({ type }),
      ),
    );
  },
);

it("creates an artboard group through the top menu", async () => {
  render(<Directory />);
  fireEvent.click(
    screen.getByRole("button", { name: "Create a page, component or arena" }),
  );
  fireEvent.click(await screen.findByText("New custom arena"));
  await waitFor(() => expect(fixture.ctx.addArena).toHaveBeenCalledOnce());
});
