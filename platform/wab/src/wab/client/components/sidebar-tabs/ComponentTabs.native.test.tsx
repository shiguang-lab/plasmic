import "@/wab/client/components/sidebar/MixinControls";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { ComponentTab } from "@/wab/client/components/sidebar-tabs/ComponentTab/ComponentTab";
import { PageTab } from "@/wab/client/components/sidebar-tabs/PageTab/PageTab";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewportCtx, type DomActions } from "@/wab/client/studio-ctx/ViewportCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { deepMerged } from "@/wab/commons/collections";
import { TplMgr } from "@/wab/shared/TplMgr";
import { PublicStyleSection, type GetProjectResponse } from "@/wab/shared/ApiSchema";
import { assert, ensure } from "@/wab/shared/common";
import { ComponentType, isPageComponent, mkComponent } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { deepTrackComponents, mkTplTagX } from "@/wab/shared/core/tpls";
import type { UiConfig } from "@/wab/shared/ui-config-utils";
import { Box, Pt } from "@/wab/shared/geom";
import { PlumeInfo } from "@/wab/shared/model/classes";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import { mock } from "vitest-mock-extended";

// These panels retain their own model inputs. This suite exercises the two
// parent tabs' real permission/metadata sources and original header commands.
vi.mock("@/wab/client/components/sidebar-tabs/ComponentPropsDefinitionSection", async (original) => ({ ...await original<typeof import("@/wab/client/components/sidebar-tabs/ComponentPropsDefinitionSection")>(), ComponentPropsDefinitionSection: () => <span data-testid="native-tab-props" /> }));
vi.mock("@/wab/client/components/sidebar-tabs/StateManagement/VariablesSection", async (original) => ({ ...await original<typeof import("@/wab/client/components/sidebar-tabs/StateManagement/VariablesSection")>(), default: () => <span data-testid="native-tab-states" /> }));
vi.mock("@/wab/client/components/sidebar-tabs/component-data-queries-section", async (original) => ({ ...await original<typeof import("@/wab/client/components/sidebar-tabs/component-data-queries-section")>(), ComponentDataQueriesSection: () => <span data-testid="native-tab-data-queries" /> }));
vi.mock("@/wab/client/components/sidebar-tabs/server-queries-section", async (original) => ({ ...await original<typeof import("@/wab/client/components/sidebar-tabs/server-queries-section")>(), ServerQueriesSection: () => <span data-testid="native-tab-server-queries" /> }));
vi.mock("@/wab/client/components/variants/VariantsPanel", async (original) => ({ ...await original<typeof import("@/wab/client/components/variants/VariantsPanel")>(), VariantsPanel: () => <span data-testid="native-tab-variants" /> }));
vi.mock("@/wab/client/components/sidebar-tabs/PageMetaPanel", async (original) => ({ ...await original<typeof import("@/wab/client/components/sidebar-tabs/PageMetaPanel")>(), default: () => <span data-testid="native-tab-page-meta" /> }));
vi.mock("@/wab/client/components/sidebar-tabs/PageURLParametersSection", async (original) => ({ ...await original<typeof import("@/wab/client/components/sidebar-tabs/PageURLParametersSection")>(), PageURLParametersSection: () => null }));
vi.mock("@/wab/client/components/sidebar-tabs/PageMinRoleSection", async (original) => ({ ...await original<typeof import("@/wab/client/components/sidebar-tabs/PageMinRoleSection")>(), PageMinRoleSection: () => null }));
vi.mock("@/wab/client/components/plume/PlumeComponentPanel", async (original) => ({ ...await original<typeof import("@/wab/client/components/plume/PlumeComponentPanel")>(), PlumeMissingIngredientsPanel: () => null }));

class VisibleIntersectionObserver {
  readonly root = null;
  readonly rootMargin = "0px";
  readonly scrollMargin = "0px";
  readonly thresholds = [0];
  readonly delay = 0;
  readonly trackVisibility = false;
  constructor(private readonly callback: IntersectionObserverCallback) {}
  observe(target: Element) {
    const rect = target.getBoundingClientRect();
    // A real DOM target carries React's cyclic bookkeeping. It is opaque to
    // the observer protocol, so never pass it through recursive mock merging.
    const entry: IntersectionObserverEntry = {
      target, boundingClientRect: rect, intersectionRect: rect,
      intersectionRatio: 1, isIntersecting: true, rootBounds: null,
      time: performance.now(),
    };
    this.callback([entry], this);
  }
  disconnect() { return undefined; }
  unobserve() { return undefined; }
  takeRecords(): IntersectionObserverEntry[] { return []; }
}
const studios = new Set<StudioCtx>();
const viewports = new Set<ViewportCtx>();
beforeEach(() => vi.stubGlobal("IntersectionObserver", VisibleIntersectionObserver));
afterEach(async () => {
  cleanup();
  try {
    for (const studio of studios) { try { await studio.awaitEval(); } finally { studio.dispose(); } }
  } finally {
    studios.clear(); viewports.forEach((viewport) => viewport.dispose()); viewports.clear();
    vi.restoreAllMocks(); vi.unstubAllGlobals();
  }
});
async function setup() {
  // Only the Inspector is mounted, without an iframe evaluator. Match the
  // existing flex/outline property-panel fixture boundary before views exist:
  // awaitSync() deliberately resumes paused queues, so isVisible=false alone
  // would still evaluate the mock CanvasCtx while cleanup awaits that queue.
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  const site = createSite(), info = new PlumeInfo({ type: "button" });
  const component = mkComponent({ name: "Native component", type: ComponentType.Plain, plumeInfo: info, tplTree: (base) => mkTplTagX("div", { baseVariant: base }) });
  const second = mkComponent({ name: "Another component", type: ComponentType.Plain, tplTree: (base) => mkTplTagX("div", { baseVariant: base }) });
  site.components.push(component, second);
  deepTrackComponents(site);
  const mgr = new TplMgr({ site }), page = mgr.addComponent({ type: ComponentType.Page, name: "Native page" }); mgr.rebuildDedicatedArenas(); assert(isPageComponent(page), "Real page component");
  const f = fakeStudioCtx({ site, devFlagOverrides: { enableDataQueries: true } }); studios.add(f.studioCtx); await waitFor(() => expect(f.studioCtx.initialRouteReady).toBe(true));
  const studio = f.studioCtx;
  const viewport = new ViewportCtx({ dom: mock<DomActions>(), initialArena: studio.currentArena,
    initialClipperBox: new Box(0, 0, 1000, 800), initialClipperScroll: Pt.zero() });
  viewports.add(viewport); studio.viewportCtx = viewport;
  studio.observeComponents([component, second, page]); studio.createViewStateUndoRecord();
  await studio.changeUnsafe(() => studio.switchToComponentArena(component)); const view = ensure(studio.focusedOrFirstViewCtx(), "Real component view");
  const wrap = (children: React.ReactNode) => <StudioCtxContext.Provider value={studio}>{children}</StudioCtxContext.Provider>;
  const refresh = async (config: UiConfig) => {
    f.api.getSiteInfo.mockResolvedValueOnce(Object.assign(mock<GetProjectResponse>(), { project: { ...studio.siteInfo, uiConfig: config }, perms: studio.siteInfo.perms, owner: undefined, latestRevisionSynced: 0, hasAppAuth: false, appAuthProvider: undefined, isMainBranchProtected: false }));
    await act(async () => { await studio.refreshSiteInfo(); });
  };
  return { ...f, studio, site, component, second, page, info, view, wrap, refresh };
}

it("updates the real component name/plume fields and original content-role permissions with quiet unrelated metadata", async () => {
  const f = await setup(), mounted = render(f.wrap(<ComponentTab component={f.component} studioCtx={f.studio} viewCtx={f.view} />));
  expect(screen.getByDisplayValue("Native component")).toBeTruthy(); expect(screen.getByText("Button")).toBeTruthy(); expect(screen.getByTestId("native-tab-props")).toBeTruthy(); expect(screen.getByTestId("native-tab-states")).toBeTruthy();
  await act(async () => { await f.studio.changeUnsafe(() => { f.component.name = "Renamed native component"; f.info.type = "checkbox"; }); });
  expect(screen.getByDisplayValue("Renamed native component")).toBeTruthy(); expect(screen.getByText("Checkbox")).toBeTruthy();
  const permissions = f.studio.uiEnvironment.store.getState().componentSectionPermissions;
  await f.refresh(deepMerged(f.studio.getCurrentUiConfig(), { leftTabs: { fonts: "readable" }, styleSectionVisibilities: { [PublicStyleSection.Background]: false } }));
  expect(f.studio.uiEnvironment.store.getState().componentSectionPermissions).toBe(permissions);
  await f.refresh(deepMerged(f.studio.getCurrentUiConfig(), { styleSectionVisibilities: { [PublicStyleSection.ComponentProps]: false, [PublicStyleSection.States]: false } }));
  expect(screen.queryByTestId("native-tab-props")).toBeNull(); expect(screen.queryByTestId("native-tab-states")).toBeNull(); expect(screen.getByTestId("native-tab-server-queries")).toBeTruthy();
  await act(async () => { f.studio.toggleContentEditorMode(); }); expect(screen.queryByDisplayValue("Renamed native component")).toBeNull();
  await act(async () => { f.studio.toggleContentEditorMode(); }); expect(screen.getByDisplayValue("Renamed native component")).toBeTruthy();
  mounted.rerender(f.wrap(<ComponentTab component={f.second} studioCtx={f.studio} viewCtx={f.view} />)); expect(screen.getByDisplayValue("Another component")).toBeTruthy(); expect(screen.queryByText("Checkbox")).toBeNull(); mounted.unmount();
});

it("updates the real page settings button on metadata permission changes and keeps its original command and app-config source", async () => {
  const f = await setup(); await f.studio.changeUnsafe(() => f.studio.switchToComponentArena(f.page)); const pageView = ensure(f.studio.focusedOrFirstViewCtx(), "Real page view");
  const mounted = render(f.wrap(<PageTab page={f.page} studioCtx={f.studio} viewCtx={pageView} />));
  expect(screen.getByRole("button", { name: "Page settings" })).toBeTruthy(); expect(screen.getByTestId("native-tab-page-meta")).toBeTruthy(); expect(screen.getByTestId("native-tab-data-queries")).toBeTruthy();
  await f.refresh(deepMerged(f.studio.getCurrentUiConfig(), { styleSectionVisibilities: { [PublicStyleSection.PageMeta]: false, [PublicStyleSection.DataQueries]: false } }));
  expect(screen.queryByRole("button", { name: "Page settings" })).toBeNull(); expect(screen.queryByTestId("native-tab-page-meta")).toBeNull(); expect(screen.queryByTestId("native-tab-server-queries")).toBeNull();
  await f.refresh(deepMerged(f.studio.getCurrentUiConfig(), { styleSectionVisibilities: { [PublicStyleSection.PageMeta]: true, [PublicStyleSection.DataQueries]: true } }));
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Page settings" })); }); expect(f.studio.pageSettingsPage).toBe(f.page); expect(f.studio.pageSettingsOpen).toBe(true);
  await act(async () => { f.appCtx.appConfig.enableDataQueries = false; f.appCtx.publishUiEnvironmentInputs(); });
  expect(screen.queryByTestId("native-tab-data-queries")).toBeNull(); expect(screen.getByTestId("native-tab-server-queries")).toBeTruthy();
  const snapshot = f.studio.uiEnvironment.store.getState(), changed = vi.fn(), stop = f.studio.uiEnvironment.store.subscribe(changed);
  await act(async () => f.appCtx.publishUiEnvironmentInputs()); expect(f.studio.uiEnvironment.store.getState()).toBe(snapshot); expect(changed).not.toHaveBeenCalled(); stop(); mounted.unmount();
});
