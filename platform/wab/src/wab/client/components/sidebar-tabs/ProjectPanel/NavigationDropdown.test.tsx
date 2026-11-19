import { createViewportFixture } from "@/wab/client/__testonly__/viewport";
import { PageOverview } from "@/wab/client/components/studio/PageOverview";
import { createStudioUiEnvironmentFixture } from "@/wab/client/__testonly__/studio-ui-environment";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { StudioArenaState } from "@/wab/client/studio-ctx/studio-arena-state";
import { NavigationDropdown } from "@/wab/client/components/sidebar-tabs/ProjectPanel/NavigationDropdown";
import { PreviewCtx } from "@/wab/client/components/live/PreviewCtx";
import type { HostFrameCtx } from "@/wab/client/frame-ctx/host-frame-ctx";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { DomActions, ViewportCtx } from "@/wab/client/studio-ctx/ViewportCtx";
import { setLanguagePreference } from "@/wab/client/i18n";
import { languageOptions, translate } from "@/wab/client/i18n/locales";
import {
  promptComponentTemplate,
  promptPageTemplate,
} from "@/wab/client/prompts";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ARENAS_DESCRIPTION } from "@/wab/shared/Labels";
import { componentsReferencerToPageHref } from "@/wab/shared/cached-selectors";
import { toOpaque } from "@/wab/commons/types";
import { ensure } from "@/wab/shared/common";
import { ComponentType, isPageComponent } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { Box, Pt } from "@/wab/shared/geom";
import { Arena } from "@/wab/shared/model/classes";
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import React from "react";
import { createStore } from "zustand/vanilla";
import { mock } from "vitest-mock-extended";

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
    NavigationArenaRow: ({ arena, name, onClick }: import("./NavigationRows").NavigationArenaRowProps) => (
      <button onClick={() => onClick(arena)}>{name}</button>
    ),
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
  const arena = new Arena({ metadata: {}, name: "Customer overview", children: [] });
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
    pageOverviewOpenStore: createStore(() => false),
    openPageOverview: vi.fn(),
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

it("opens the fixed overview above groups, includes ungrouped pages once, and returns with Back", async () => {
  const site = createSite();
  const mgr = new TplMgr({ site });
  const group = mgr.addArena("Fitness");
  const plan = mgr.addComponent({ name: "Training plan", type: ComponentType.Page, pageMeta: { path: "/plan" } });
  mgr.addComponent({ name: "Activity", type: ComponentType.Page, pageMeta: { path: "/activity" } });
  for (let i = 0; i < 2; i++) {
    mgr.addNewMixedArenaFrame(group, plan.name, plan, { insertPt: Pt.zero() });
  }
  const { studioCtx, history } = fakeStudioCtx({ site, initialUrl: "/projects/test?view=pages" });
  studioCtx.viewportCtx = createViewportFixture().viewportCtx;
  try {
    fixture.ctx = studioCtx;
    await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
    expect(studioCtx.pageOverviewOpenStore.getState()).toBe(true);
    render(<><Directory /><PageOverview studio={studioCtx} /></>);
    const entry = screen.getByRole("button", { name: /Pages overview.*2/ });
    expect(entry.compareDocumentPosition(screen.getByRole("button", { name: "Fitness" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const gallery = within(screen.getByRole("region", { name: "Pages overview" }));
    expect(gallery.getAllByRole("button")).toHaveLength(2);
    fireEvent.click(gallery.getByRole("button", { name: "Training plan" }));
    await waitFor(() => expect(studioCtx.currentArena === studioCtx.getDedicatedArena(plan)).toBe(true));
    expect(entry).toHaveAttribute("aria-pressed", "false");
    act(() => history.back());
    await waitFor(() => expect(entry).toHaveAttribute("aria-pressed", "true"));
    fireEvent.click(screen.getByRole("button", { name: "Fitness" }));
    await waitFor(() => expect(studioCtx.currentArena === group).toBe(true));
    fireEvent.click(entry);
    await waitFor(() => expect(studioCtx.pageOverviewOpenStore.getState()).toBe(true));
    expect(group.children).toHaveLength(2);
  } finally {
    cleanup();
    studioCtx.dispose();
  }
});

it("opens a published page with no inbound links from the directory and previews that page", async () => {
  const site = createSite();
  const tplMgr = new TplMgr({ site });
  const home = tplMgr.addComponent({ name: "Home", type: ComponentType.Page, pageMeta: { path: "/" } });
  const standalone = tplMgr.addComponent({
    name: "Standalone calculator",
    type: ComponentType.Page,
    pageMeta: { path: "/calculator" },
  });
  expect(isPageComponent(standalone) && componentsReferencerToPageHref(site, standalone).size).toBe(0);
  const { studioCtx, history, api, appCtx } = fakeStudioCtx({
    site,
    initialUrl: "/projects/template?publishedTemplate=true",
    siteInfo: { id: toOpaque("template"), isTemplate: true, publishedTemplateVersion: "1.0.0" },
  });
  appCtx.selfInfo = mock<NonNullable<typeof appCtx.selfInfo>>({ isAdmin: true });
  fixture.ctx = studioCtx;
  const viewport = new ViewportCtx({
    dom: mock<DomActions>(),
    initialArena: ensure(studioCtx.getDedicatedArena(home), "Home page arena"),
    initialClipperBox: new Box(0, 0, 1000, 800),
    initialClipperScroll: Pt.zero(),
  });
  studioCtx.viewportCtx = viewport;
  const host = mock<HostFrameCtx>();
  Object.defineProperty(host, "history", { value: history });
  const preview = new PreviewCtx(host, studioCtx);
  try {
    await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
    expect(studioCtx.leftTabKey).toBe("outline");
    expect(studioCtx.currentArena).toBe(studioCtx.getDedicatedArena(home));
    render(<Directory />);
    expect(studioCtx.canEditProject()).toBe(false);
    expect(screen.queryByRole("button", { name: "Create a page, component or arena" })).toBeNull();
    studioCtx.setBlockChanges(false);
    expect(studioCtx.blockChanges).toBe(true);
    studioCtx.switchLeftTab("versions");
    expect(studioCtx.leftTabKey).toBe("outline");
    const publishedLocation = history.location;
    studioCtx.switchToRevision("draft-revision");
    studioCtx.switchToBranchVersion(undefined);
    expect(history.location).toBe(publishedLocation);
    const publishedName = standalone.name;
    await expect(studioCtx.changeUnsafe(() => {
      standalone.name = "Unpublished rename";
    }, { noUndoRecord: true })).rejects.toThrow("Published templates are read-only.");
    expect(standalone.name).toBe(publishedName);
    expect(studioCtx.hasUnsavedChanges()).toBe(false);
    await expect(studioCtx.save()).resolves.toBe("StopSaving");
    expect(api.saveProjectRevChanges).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: standalone.name }));
    await waitFor(() => expect(studioCtx.currentArena).toBe(studioCtx.getDedicatedArena(standalone)));
    const selectedUrl = history.location;
    expect(new URLSearchParams(selectedUrl.search).get("publishedTemplate")).toBe("true");
    await act(async () => { await preview.toggleLiveMode(); });
    expect(history.location.pathname).toBe("/projects/template/preview");
    expect(history.location.hash).toBe("#/calculator");
    expect(new URLSearchParams(history.location.search).get("publishedTemplate")).toBe("true");
    expect(preview.component).toBe(standalone);
    await act(async () => { await preview.stopLiveMode(); });
    expect(history.location.search).toBe(selectedUrl.search);
    expect(studioCtx.site).toBe(site);
    expect(api.getSiteInfo).not.toHaveBeenCalled();
  } finally {
    preview.dispose();
    studioCtx.dispose();
    viewport.dispose();
  }
});

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
