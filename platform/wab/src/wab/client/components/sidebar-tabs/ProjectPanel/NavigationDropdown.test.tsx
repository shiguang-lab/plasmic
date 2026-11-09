import { createStudioUiEnvironmentFixture } from "@/wab/client/__testonly__/studio-ui-environment";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { StudioArenaState } from "@/wab/client/studio-ctx/studio-arena-state";
import { NavigationDropdown } from "@/wab/client/components/sidebar-tabs/ProjectPanel/NavigationDropdown";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
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
import { createStore } from "zustand/vanilla";

const fixture = vi.hoisted(() => ({ ctx: undefined as any }));
const studios = new Set<StudioCtx>();
const ownerDisposals = new Set<() => void>();
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
  await act(async () => { cleanup(); });
  for (const studio of studios) { await studio.awaitEval(); studio.dispose(); }
  studios.clear();
  for (const dispose of ownerDisposals) { dispose(); }
  ownerDisposals.clear();
  vi.restoreAllMocks();
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
  const navigationPanelStore = createStore<"pages" | "outline">(
    () => "outline",
  );
  const arena = new Arena({ name: "Customer overview", children: [] });
  const site = createSite();
  site.arenas.push(arena);
  const modelSnapshots = new ModelSnapshots();
  const arenaState = new StudioArenaState({site,modelSnapshots});
  arenaState.setCurrent(arena);
  ownerDisposals.add(() => { arenaState.dispose(); modelSnapshots.dispose(); });
  const projectSearchInputRef = React.createRef<HTMLInputElement>();
  fixture.ctx = {
    ...createStudioUiEnvironmentFixture(),
    site,
    modelSnapshots,
    arenaState,
    get currentArena() { return arenaState.currentArena(); },
    contentEditorMode: false,
    navigationPanelStore,
    get navigationPanel() {
      return navigationPanelStore.getState();
    },
    projectSearchInputRef,
    focusOnProjectSearchInput: () => projectSearchInputRef.current?.focus(),
    bindProjectSearchInput: (input: HTMLInputElement | null) => {
      projectSearchInputRef.current = input;
    },
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
    setNavigationPanel: vi.fn((panel: "pages" | "outline") => {
      navigationPanelStore.setState(panel, true);
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
  fixture.ctx.navigationPanelStore.setState("pages", true);
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

async function actualStudio() {
  const { studioCtx } = fakeStudioCtx({ devFlagOverrides: { ccStubs: true } });
  studios.add(studioCtx);
  await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
  return studioCtx;
}

it("retains an actual focus command before DOM mount, focuses immediately after mount and clears on detach/dispose", async () => {
  const studio = await actualStudio();
  const focus = vi.spyOn(HTMLInputElement.prototype, "focus");
  const stableRef = studio.projectSearchInputRef;
  const stableBinding = studio.bindProjectSearchInput;
  studio.focusOnProjectSearchInput();
  studio.focusOnProjectSearchInput();
  expect(focus).not.toHaveBeenCalled();
  const view = render(<input aria-label="Actual pending search" ref={stableBinding} />);
  const input = screen.getByRole("textbox", { name: "Actual pending search" });
  expect(studio.projectSearchInputRef).toBe(stableRef);
  expect(studio.bindProjectSearchInput).toBe(stableBinding);
  expect(stableRef.current).toBe(input);
  expect(input).toHaveFocus();
  expect(focus).toHaveBeenCalledOnce();
  studio.focusOnProjectSearchInput();
  expect(focus).toHaveBeenCalledTimes(2);
  view.unmount();
  expect(stableRef.current).toBeNull();
  const remounted = render(<input aria-label="Reopened search" ref={stableBinding} />);
  expect(focus).toHaveBeenCalledTimes(2);
  remounted.unmount();
  studio.focusOnProjectSearchInput();
  studio.dispose(); studios.delete(studio);
  const disposedInput = document.createElement("input");
  document.body.append(disposedInput);
  stableBinding(disposedInput);
  studio.focusOnProjectSearchInput();
  expect(focus).toHaveBeenCalledTimes(2);
  expect(stableRef.current).toBeNull();
  stableBinding(null); disposedInput.remove();
});

it("connects the actual directory callback ref and detaches the old Studio when ownership changes", async () => {
  const first = await actualStudio(), second = await actualStudio();
  fixture.ctx = first;
  first.setNavigationPanel("pages");
  first.focusOnProjectSearchInput();
  const view = render(<Directory />);
  const input = screen.getByRole("textbox", { name: "Go to page/component" });
  expect(first.projectSearchInputRef.current).toBe(input);
  expect(input).toHaveFocus();
  second.setNavigationPanel("pages");
  second.focusOnProjectSearchInput();
  fixture.ctx = second;
  view.rerender(<Directory />);
  expect(first.projectSearchInputRef.current).toBeNull();
  expect(second.projectSearchInputRef.current).toBe(input);
  expect(input).toHaveFocus();
  const focus = vi.spyOn(input, "focus");
  first.focusOnProjectSearchInput();
  expect(focus).not.toHaveBeenCalled();
  second.focusOnProjectSearchInput();
  expect(focus).toHaveBeenCalledOnce();
  view.unmount();
  expect(second.projectSearchInputRef.current).toBeNull();
  second.focusOnProjectSearchInput();
  expect(focus).toHaveBeenCalledOnce();
});
