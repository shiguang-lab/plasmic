import DocsPortal from "@/wab/client/components/docs/DocsPortal";
import { useDocsPortalCtx } from "@/wab/client/components/docs/DocsPortalCtx";
import { createDocsModelFixture } from "@/wab/client/components/docs/__testonly__/model-fixture";
import { HistoryProvider } from "@/wab/client/route/HistoryProvider";
import type { ModelFieldStore } from "@/wab/client/studio-ctx/model-snapshots";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { ImageAssetType } from "@/wab/shared/core/image-asset-type";
import { mkImageAsset } from "@/wab/shared/core/image-assets";
import { createSite } from "@/wab/shared/core/sites";
import { asSvgDataUrl } from "@/wab/shared/data-urls";
import { cleanup, render, screen } from "@testing-library/react";
import { createMemoryHistory } from "history";
import React from "react";
import { mock } from "vitest-mock-extended";
import { useStore } from "zustand";

const state = { suspend: false, beforeSubscribe: undefined as (() => void) | undefined, renders: 0 };
const pending = new Promise<never>(() => undefined);

vi.mock("@/wab/client/components/docs/DocsLayout.styles", () => ({ useDocsLayoutStyles: () => ({ styles: { root: "docs" } }) }));
vi.mock("@/wab/client/components/docs/DocsPortalBranches", () => ({ default: () => null }));
vi.mock("@/wab/client/components/BottomModal", () => ({ BottomModalsProvider: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/wab/client/components/studio/TopFrameObserver", () => ({ TopFrameObserver: () => null }));
vi.mock("@/wab/client/dom-utils", async (original) => ({ ...(await original<typeof import("@/wab/client/dom-utils")>()), fixStudioIframePositionAndOverflow: vi.fn() }));
vi.mock("@/wab/client/plasmic/plasmic_kit_docs_portal/PlasmicDocsPortal", () => ({ PlasmicDocsPortal: () => <ModelConsumer /> }));

function ModelConsumer() {
  const docs = useDocsPortalCtx();
  const component = ensure(docs.studioCtx.site.components[0], "Lifecycle component");
  const icon = ensure(docs.studioCtx.site.imageAssets[0], "Lifecycle icon");
  const directory = useStore(docs.models.getDirectoryStore());
  const model = useStore(docs.models.getComponentStore(docs.models.snapshots.ref(component)));
  const iconModel = useStore(docs.models.getIconModelStore(docs.models.snapshots.ref(icon)));
  useStore(docs.models.siteStore);
  React.useLayoutEffect(() => {
    const update = state.beforeSubscribe;
    state.beforeSubscribe = undefined;
    update?.();
  }, []);
  state.renders++;
  if (state.suspend) { throw pending; }
  return <><output aria-label="directory">{directory.components[0]?.name}</output><output aria-label="component">{model.name}</output><output aria-label="icon">{iconModel.name}</output></>;
}

function trackSubscriptions<T>(store: ModelFieldStore<T>) {
  let subscriptions = 0;
  const subscribe = store.subscribe;
  vi.spyOn(store, "subscribe").mockImplementation((listener) => {
    const stop = subscribe(listener);
    subscriptions++;
    return () => { subscriptions--; stop(); };
  });
  return () => subscriptions;
}

function setup() {
  const site = createSite();
  const component = new TplMgr({ site }).addComponent({ name: "Before", type: ComponentType.Plain });
  const icon = mkImageAsset({ name: "BeforeIcon", type: ImageAssetType.Icon, dataUri: asSvgDataUrl('<svg xmlns="http://www.w3.org/2000/svg"/>') });
  site.imageAssets.push(icon);
  const fixture = createDocsModelFixture(site);
  const snapshots = fixture.studio.modelSnapshots;
  const activeFields = [
    trackSubscriptions(snapshots.field(site, "components")),
    trackSubscriptions(snapshots.field(site, "imageAssets")),
    ...(["uuid", "name", "type", "superComp"] as const).map((field) => trackSubscriptions(snapshots.field(component, field))),
    ...(["uuid", "name", "type", "dataUri"] as const).map((field) => trackSubscriptions(snapshots.field(icon, field))),
  ];
  const history = createMemoryHistory({ initialEntries: ["/projects/docs-test/docs/components/Before"] });
  const tree = <React.StrictMode><HistoryProvider history={history}><React.Suspense fallback={<p>Loading docs</p>}><DocsPortal studioCtx={fixture.studio} hostFrameCtx={mock()} /></React.Suspense></HistoryProvider></React.StrictMode>;
  return { ...fixture, component, icon, tree, fieldSubscriptions: () => activeFields.reduce((sum, active) => sum + active(), 0) };
}

beforeEach(() => { state.suspend = false; state.beforeSubscribe = undefined; state.renders = 0; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("does not connect model or field listeners for a suspended render abandoned before commit", () => {
  const fixture = setup();
  state.suspend = true;
  const view = render(fixture.tree);
  expect(screen.getByText("Loading docs")).toBeTruthy();
  expect(state.renders).toBeGreaterThan(0);
  expect(fixture.listeners.size).toBe(0);
  expect(fixture.fieldSubscriptions()).toBe(0);
  view.unmount();
  expect(fixture.listeners.size).toBe(0);
  expect(fixture.fieldSubscriptions()).toBe(0);
  fixture.component.name = "After abandonment";
  fixture.commit(fixture.component, "name", [fixture.component]);
  expect(fixture.listeners.size).toBe(0);
});

it("reconnects StrictMode owners and synchronously releases listeners on actual unmount", () => {
  const fixture = setup();
  const view = render(fixture.tree);
  expect(screen.getByLabelText("component").textContent).toBe("Before");
  expect(fixture.listeners.size).toBe(1);
  expect(fixture.fieldSubscriptions()).toBeGreaterThan(0);
  view.unmount();
  expect(fixture.listeners.size).toBe(0);
  expect(fixture.fieldSubscriptions()).toBe(0);
});

it("catches model changes between render and subscription for directory, component and icon projections", () => {
  const fixture = setup();
  state.beforeSubscribe = () => {
    expect(fixture.listeners.size).toBe(0);
    fixture.component.name = "Committed before subscribe";
    fixture.icon.name = "Icon before subscribe";
    fixture.commit(fixture.component, "name", [fixture.component]);
    fixture.commit(fixture.icon, "name");
  };
  const view = render(fixture.tree);
  expect(screen.getByLabelText("directory").textContent).toBe("Committed before subscribe");
  expect(screen.getByLabelText("component").textContent).toBe("Committed before subscribe");
  expect(screen.getByLabelText("icon").textContent).toBe("Icon before subscribe");
  view.unmount();
  expect(fixture.listeners.size).toBe(0);
  expect(fixture.fieldSubscriptions()).toBe(0);
});
