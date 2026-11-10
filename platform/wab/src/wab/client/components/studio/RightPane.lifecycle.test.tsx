import type { AppCtx } from "@/wab/client/app-ctx";
import "@testing-library/jest-dom/vitest";
import { toOpaque } from "@/wab/commons/types";
import type { DesktopDraft } from "@/wab/shared/desktop-drafts";
import { mock } from "vitest-mock-extended";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { RightPane } from "@/wab/client/components/studio/RightPane";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { RightTabKey } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import React from "react";

vi.mock("@/wab/client/components/sidebar-tabs/PageURLParametersSection", () => ({ PageURLParametersSection: () => null }));
vi.mock("@/wab/client/components/sidebar-tabs/PageMinRoleSection", () => ({ PageMinRoleSection: () => null }));
vi.mock("@/wab/client/components/sidebar-tabs/StateManagement/VariablesSection", () => ({ default: () => null }));
vi.mock("@/wab/client/components/sidebar-tabs/component-data-queries-section", async (original) => ({ ...await original<typeof import("@/wab/client/components/sidebar-tabs/component-data-queries-section")>(), ComponentDataQueriesSection: () => null }));
vi.mock("@/wab/client/components/sidebar-tabs/server-queries-section", async (original) => ({ ...await original<typeof import("@/wab/client/components/sidebar-tabs/server-queries-section")>(), ServerQueriesSection: () => null }));
vi.mock("@/wab/client/components/variants/VariantsPanel", async (original) => ({ ...await original<typeof import("@/wab/client/components/variants/VariantsPanel")>(), VariantsPanel: () => null }));
vi.mock("@/wab/client/components/sidebar-tabs/PropEditorRow", async (original) => ({ ...await original<typeof import("@/wab/client/components/sidebar-tabs/PropEditorRow")>(), PropEditorRow: () => <span data-testid="page-title-control" /> }));
vi.mock("@/wab/client/components/dev", () => ({ DevContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/wab/client/components/style-controls/StyleComponent", async (original) => ({ ...await original<typeof import("@/wab/client/components/style-controls/StyleComponent")>(), providesSidebarPopupSetting: () => (children: React.ReactNode) => children }));

class VisibleIntersectionObserver {
  readonly root = null;
  readonly rootMargin = "0px";
  readonly scrollMargin = "0px";
  readonly thresholds = [0];
  readonly delay = 0;
  readonly trackVisibility = false;
  constructor(private readonly callback: IntersectionObserverCallback) {}
  observe(target: Element) {
    const entry = mock<IntersectionObserverEntry>({ isIntersecting: true });
    Object.defineProperty(entry, "target", { value: target });
    this.callback([entry], this);
  }
  disconnect() { return undefined; }
  unobserve() { return undefined; }
  takeRecords(): IntersectionObserverEntry[] { return []; }
}
beforeEach(() => vi.stubGlobal("IntersectionObserver", VisibleIntersectionObserver));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("collapses only the right pane, retains selection and tab, and reopens through its edge button or a tab command", async () => {
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  const { studioCtx: studio } = fakeStudioCtx();
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const page = await studio.changeUnsafe(() => studio.addComponent("Inspector", { type: ComponentType.Page }));
  const view = ensure(studio.focusedOrFirstViewCtx(), "Page view");
  studio.setStudioFocusOnFrameContents(view.arenaFrame());
  studio.switchRightTab(RightTabKey.component);
  const selection = studio.selectionStore.getState();
  const leftPanel = studio.leftPanelState.store.getState();
  const metadata = studio.modelSnapshots.field(page, "pageMeta"), subscribe = metadata.subscribe;
  const released = vi.fn();
  const connections = vi.spyOn(metadata, "subscribe").mockImplementation((listener) => {
    const stop = subscribe(listener);
    return () => { stop(); released(); };
  });
  const { container, unmount } = render(<StudioCtxContext.Provider value={studio}><RightPane studioCtx={studio} canvasLoading={false} /></StudioCtxContext.Provider>);
  const shell = () => container.querySelector('[data-test-id="right-panel-shell"]');
  try {
    await waitFor(() => expect(container.querySelector('[data-test-id="page-panel"]')).not.toBeNull());
    expect(connections).toHaveBeenCalled();
    const contents = container.querySelector('[data-test-id="page-panel"]');
    fireEvent.click(ensure(container.querySelector<HTMLButtonElement>('.editor-panel-header button'), "Inspector collapse button"));
    expect(shell()?.getAttribute("data-open")).toBe("false");
    expect(studio.rightTabKey).toBe(RightTabKey.component);
    expect(studio.selectionStore.getState()).toBe(selection);
    expect(studio.leftPanelState.store.getState()).toBe(leftPanel);
    await waitFor(() => expect(released).toHaveBeenCalledTimes(connections.mock.calls.length));
    expect(contents).not.toBeVisible();
    expect(container.querySelector('[data-test-id="page-panel"]')).toBe(contents);
    fireEvent.click(ensure(container.querySelector<HTMLButtonElement>('.editor-inspector-reopen button'), "Inspector expand button"));
    expect(shell()?.getAttribute("data-open")).toBe("true");
    expect(studio.rightTabKey).toBe(RightTabKey.component);
    await waitFor(() => expect(container.querySelector('[data-test-id="page-panel"]')).not.toBeNull());
    expect(container.querySelector('[data-test-id="page-panel"]')).toBe(contents);
    expect(contents).toBeVisible();
    act(() => studio.collapseRightPanel());
    act(() => studio.switchRightTab(RightTabKey.component));
    expect(shell()?.getAttribute("data-open")).toBe("true");
    expect(container.querySelector('.editor-inspector-reopen')).toBeNull();
    expect(studio.selectionStore.getState()).toBe(selection);
    act(() => { studio.collapseRightPanel(); studio.toggleCommentsPanel(); });
    expect(studio.showCommentsPanel).toBe(true);
    expect(studio.rightPanelStore.getState().collapsed).toBe(false);
  } finally { unmount(); studio.dispose(); }
});

it.each([false, true])("detaches the mounted real PageTab and metadata before disposing its model owner (focused=%s)", async (focused) => {
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  const { studioCtx: studio } = fakeStudioCtx();
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const page = await studio.changeUnsafe(() => studio.addComponent("Lifecycle", { type: ComponentType.Page }));
  studio.setStudioFocusOnFrame({ frame: undefined, autoZoom: false });
  const view = ensure(studio.focusedOrFirstViewCtx(), "The dedicated arena must provide its page view");
  if (focused) { studio.setStudioFocusOnFrameContents(view.arenaFrame()); }
  studio.switchRightTab(RightTabKey.component);
  const pageMetaSubscribe = vi.spyOn(studio.modelSnapshots.field(page, "pageMeta"), "subscribe");
  const field = vi.spyOn(studio.modelSnapshots, "field");
  const errors = vi.spyOn(console, "error");
  const { container, unmount } = render(<StudioCtxContext.Provider value={studio}><RightPane studioCtx={studio} canvasLoading={false} /></StudioCtxContext.Provider>);
  try {
    await waitFor(() => expect(container.querySelector('[data-test-id="page-panel"]')).not.toBeNull());
    expect(container.querySelector('[data-testid="page-title-control"]')).not.toBeNull();
    expect(pageMetaSubscribe).toHaveBeenCalled();
    // Queue a real native metadata refresh and close the owner before React consumes it.
    await act(async () => {
      await studio.changeUnsafe(() => { ensure(page.pageMeta, "Page metadata").title = "Queued title"; });
      studio.dispose();
    });
    expect(container.querySelector('[data-test-id="page-panel"]')).toBeNull();
    expect(studio.selectionStore.getState().view).toBeUndefined();
    expect(studio.inspectorSelection).toBeUndefined();
    expect(studio.focusedOrFirstViewCtx()).toBeUndefined();
    const closedReads = field.mock.calls.length;
    expect(errors).not.toHaveBeenCalled();
    // Repeated close and already queued view notifications cannot revive a model consumer.
    await act(async () => { studio.dispose(); await Promise.resolve(); });
    expect(container.querySelector('[data-test-id="page-panel"]')).toBeNull();
    expect(field.mock.calls).toHaveLength(closedReads);
    expect(errors).not.toHaveBeenCalled();
  } finally { unmount(); studio.dispose(); }
});

it("releases the mounted old PageTab before a real draft load replaces models and mounts the restored page", async () => {
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  const { studioCtx: studio, appCtx } = fakeStudioCtx({ devFlagOverrides: { ccStubs: true } });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const page = await studio.changeUnsafe(() => studio.addComponent("Draft lifecycle", { type: ComponentType.Page }));
  studio.switchRightTab(RightTabKey.component);
  const oldModels = studio.modelSnapshots; const oldArena = ensure(studio.currentArena, "Current page arena"); const oldStatus = studio.arenaState.statusStore(oldArena);
  studio.dbCtx().revisionNum = 10;
  appCtx.selfInfo = mock<NonNullable<AppCtx["selfInfo"]>>({ id: toOpaque<string, "UserId">("draft-owner") });
  const bundle = structuredClone(appCtx.bundler.bundle(studio.site, studio.siteInfo.id, appCtx.lastBundleVersion));
  const metadataAddress = ensure(appCtx.bundler.addrOf(ensure(page.pageMeta, "Page metadata")), "Metadata bundle address");
  bundle.map[metadataAddress.iid].title = "Restored metadata owner";
  const draft: DesktopDraft = { format: 1, id: "arena-lifecycle-draft", projectId: studio.siteInfo.id, projectName: "Draft lifecycle", branchId: null, baseRevision: 10, sequence: 3, savedAt: 1, modelVersion: studio.dbCtx().modelVersion, hostlessDataVersion: studio.dbCtx().hostlessDataVersion, bundle, dependencies: [] };
  const topApi = mock<NonNullable<AppCtx["topFrameApi"]>>(); topApi.openDesktopDrafts.mockResolvedValue({ handle: "arena-draft-handle", drafts: [draft] }); topApi.readDesktopDraft.mockResolvedValue(draft); topApi.writeDesktopDraft.mockResolvedValue(undefined); appCtx.topFrameApi = topApi;
  const field = vi.spyOn(oldModels, "field"); const destroy = oldModels.dispose.bind(oldModels); let readsAtClose = 0;
  const disposed = vi.spyOn(oldModels, "dispose").mockImplementation(() => {
    expect(studio.arenaState.store.getState().current).toBeNull(); expect(studio.selectionStore.getState().view).toBeUndefined(); expect(studio.inspectorSelection).toBeUndefined(); expect(studio.commentsCtx.dialogStore.getState()).toEqual({}); expect(oldStatus.getState()).toBe("dead");
    readsAtClose = field.mock.calls.length; destroy();
  });
  const errors = vi.spyOn(console, "error");
  const { container, unmount } = render(<StudioCtxContext.Provider value={studio}><RightPane studioCtx={studio} canvasLoading={false} /></StudioCtxContext.Provider>);
  try {
    await waitFor(() => expect(container.querySelector('[data-test-id="page-panel"]')).not.toBeNull());
    await act(async () => { await studio.initializeDesktopDrafts(); });
    expect(disposed).toHaveBeenCalledOnce(); expect(studio.modelSnapshots).not.toBe(oldModels); expect(field.mock.calls).toHaveLength(readsAtClose);
    const restored = ensure(studio.site.components.find((component) => component.uuid === page.uuid), "Restored page");
    expect(restored).not.toBe(page); expect(ensure(restored.pageMeta, "Restored metadata").title).toBe("Restored metadata owner"); expect(studio.currentArena).not.toBe(oldArena); expect(oldStatus.getState()).toBe("dead");
    await waitFor(() => expect(container.querySelector('[data-test-id="page-panel"]')).not.toBeNull());
    expect(container.querySelector('[data-testid="page-title-control"]')).not.toBeNull(); expect(errors).not.toHaveBeenCalled();
  } finally { unmount(); studio.dispose(); }
});
