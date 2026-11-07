import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { ComponentDataQueriesSection } from "@/wab/client/components/sidebar-tabs/component-data-queries-section";
import { DataPickerEditor } from "@/wab/client/components/sidebar-tabs/ComponentProps/DataPickerEditor";
import type DataPicker from "@/wab/client/components/sidebar-tabs/DataBinding/DataPicker";
import type { useDataSourceOpExprBottomModal } from "@/wab/client/components/sidebar-tabs/DataSource/DataSourceOpPicker";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewSelection } from "@/wab/client/studio-ctx/view-selection";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import type { GetProjectResponse } from "@/wab/shared/ApiSchema";
import { Bundler } from "@/wab/shared/bundler";
import { ensure } from "@/wab/shared/common";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplComponent, mkTplTagX } from "@/wab/shared/core/tpls";
import { ComponentDataQuery } from "@/wab/shared/model/classes";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

type OpenProps = Parameters<ReturnType<typeof useDataSourceOpExprBottomModal>["open"]>[0];
const calls = vi.hoisted(() => ({ open: vi.fn<(key: string, props: OpenProps) => void>(), row: vi.fn<(label: React.ReactNode) => void>() }));
vi.mock("@/wab/client/components/sidebar-tabs/DataSource/DataSourceOpPicker", async (original) => ({ ...(await original<typeof import("@/wab/client/components/sidebar-tabs/DataSource/DataSourceOpPicker")>()), useDataSourceOpExprBottomModal: (key: string) => ({ open: (props: OpenProps) => calls.open(key, props), close: vi.fn() }) }));
vi.mock("@/wab/client/contexts/AppContexts", async (original) => ({ ...(await original<typeof import("@/wab/client/contexts/AppContexts")>()), useDataSource: () => ({ data: undefined, error: undefined, isLoading: false }) }));
vi.mock("@/wab/client/components/ContextMenu", async (original) => ({ ...(await original<typeof import("@/wab/client/components/ContextMenu")>()), WithContextMenu: ({ children }: React.PropsWithChildren) => children }));
vi.mock("@/wab/client/components/sidebar/SidebarSection", async (original) => ({ ...(await original<typeof import("@/wab/client/components/sidebar/SidebarSection")>()), SidebarSection: ({ controls, children }: React.PropsWithChildren<{ controls: React.ReactNode }>) => <section>{controls}{children}</section> }));
vi.mock("@/wab/client/components/widgets/LabeledListItem", () => ({ LabeledListItem: ({ label, children, onClick }: React.PropsWithChildren<{ label: React.ReactNode; onClick: () => void }>) => { calls.row(label); return <div><button onClick={onClick}>{label}</button>{children}</div>; } }));
vi.mock("@/wab/client/components/sidebar-tabs/DataBinding/DataPicker", async (original) => ({ ...(await original<typeof import("@/wab/client/components/sidebar-tabs/DataBinding/DataPicker")>()), default: ({ onAddQuery, withAddQuery }: React.ComponentProps<typeof DataPicker>) => withAddQuery ? <button onClick={onAddQuery}>Add query from picker</button> : null }));

const studios = new Set<StudioCtx>(), selections = new Set<ViewSelection>();
afterEach(async () => {
  await act(async () => { cleanup(); });
  for (const selection of selections) { selection.dispose(); }
  selections.clear();
  for (const studio of studios) { await studio.awaitEval(); studio.dispose(); }
  studios.clear(); calls.open.mockClear(); calls.row.mockClear(); vi.restoreAllMocks();
});
function siteFixture(name: string, withQueries: boolean) {
  const site = createSite();
  const component = mkComponent({ name, type: ComponentType.Plain, tplTree: (baseVariant) => mkTplTagX("div", { baseVariant }) });
  site.components.push(component);
  if (withQueries) {
    component.dataQueries.push(new ComponentDataQuery({ uuid: `${name}-first`, name: "FirstQuery", op: undefined }), new ComponentDataQuery({ uuid: `${name}-other`, name: "OtherQuery", op: undefined }));
  }
  return { site, component };
}
function viewFixture(studio: StudioCtx, component: ReturnType<typeof siteFixture>["component"]) {
  const selection = new ViewSelection(() => studio.modelSnapshots); selections.add(selection);
  const view = mock<ViewCtx>();
  Object.defineProperties(view, { studioCtx: { value: studio }, component: { value: component }, selectionStore: { value: selection.store }, site: { get: () => studio.site }, siteInfo: { get: () => studio.siteInfo } });
  view.getCanvasEnvForTpl.mockReturnValue({ $ctx: {}, $props: {}, $state: {}, $queries: {}, $q: {}, $refs: {}, $$: {} });
  view.customFunctionsSchema.mockReturnValue({});
  view.currentCtxTplRoot.mockReturnValue(component.tplTree);
  view.currentTplComponent.mockReturnValue(mkTplComponent(component, ensure(component.variants[0], "Query component base")));
  return view;
}
async function setup(name = "Queries", withQueries = true) {
  const data = siteFixture(name, withQueries), f = fakeStudioCtx({ site: data.site, devFlagOverrides: { ccStubs: true } });
  const studio = f.studioCtx; studios.add(studio);
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  studio.observeComponents([data.component]); studio.createViewStateUndoRecord();
  return { ...data, ...f, studio, view: viewFixture(studio, data.component) };
}
const section = (f: Awaited<ReturnType<typeof setup>>) => <ComponentDataQueriesSection component={f.component} viewCtx={f.view} isDeprecated={false} />;
const wrap = (f: Awaited<ReturnType<typeof setup>>, children: React.ReactNode) => <AppCtxContext.Provider value={f.appCtx}><StudioCtxContext.Provider value={f.studio}>{children}</StudioCtxContext.Provider></AppCtxContext.Provider>;

it("consumes a pending query before mount, permits repeats and only updates the requested row", async () => {
  const f = await setup(), first = ensure(f.component.dataQueries[0], "First query"), other = ensure(f.component.dataQueries[1], "Other query");
  f.studio.newlyAddedQuery = first;
  const pending = f.studio.newlyAddedQueryStore.getState();
  f.studio.newlyAddedQuery = first;
  expect(f.studio.newlyAddedQueryStore.getState()).toBe(pending);
  expect(Object.isFrozen(pending)).toBe(true);
  render(wrap(f, section(f)));
  await waitFor(() => expect(calls.open).toHaveBeenCalledWith(first.uuid, expect.objectContaining({ parent: first, readOpsOnly: true })));
  expect(f.studio.newlyAddedQuery).toBeUndefined();
  const otherRenders = calls.row.mock.calls.filter(([label]) => label === other.name).length;
  act(() => { f.studio.newlyAddedQuery = first; });
  await waitFor(() => expect(calls.open).toHaveBeenCalledTimes(2));
  expect(calls.row.mock.calls.filter(([label]) => label === other.name)).toHaveLength(otherRenders);
  expect(f.studio.newlyAddedQueryStore.getState()).toBeUndefined();
});

it("keeps the section add-query command on the actual component and opens its new query", async () => {
  const f = await setup("Section", false);
  render(wrap(f, section(f)));
  fireEvent.click(ensure(document.getElementById("data-queries-add-btn"), "Add query button"));
  await act(async () => { await f.studio.awaitEval(); });
  const query = ensure(f.component.dataQueries[0], "Created component query");
  expect(f.component.dataQueries).toHaveLength(1);
  await waitFor(() => expect(calls.open).toHaveBeenCalledWith(query.uuid, expect.objectContaining({ parent: query, value: undefined })));
  expect(f.studio.newlyAddedQuery).toBeUndefined();
});

it("keeps the actual DataPickerEditor add-query writer and its deferred open command", async () => {
  const f = await setup("Picker", false), visible = vi.fn();
  const view = render(wrap(f, <DataPickerEditor viewCtx={f.view} value={undefined} onChange={vi.fn()} visible setVisible={visible} />));
  fireEvent.click(await screen.findByRole("button", { name: "Add query from picker" }));
  await act(async () => { await f.studio.awaitEval(); });
  const query = ensure(f.component.dataQueries[0], "Picker-created query");
  expect(f.studio.newlyAddedQuery).toBe(query);
  expect(f.studio.newlyAddedQueryStore.getState()?.uid).toBe(query.uid);
  expect(visible).toHaveBeenCalledWith(false);
  view.rerender(wrap(f, section(f)));
  await waitFor(() => expect(calls.open).toHaveBeenCalledWith(query.uuid, expect.objectContaining({ parent: query })));
  expect(f.studio.newlyAddedQuery).toBeUndefined();
});

it("detaches old owners and clears refs before actual loadVersion/dispose while accepting new-scope requests", async () => {
  const first = await setup("Old"), second = await setup("New");
  const query = ensure(second.component.dataQueries[0], "New owner query"), oldQuery = ensure(first.component.dataQueries[0], "Old owner query");
  const view = render(wrap(first, section(first)));
  second.studio.newlyAddedQuery = query;
  view.rerender(wrap(second, section(second)));
  await waitFor(() => expect(calls.open).toHaveBeenCalledWith(query.uuid, expect.objectContaining({ parent: query })));
  const opened = calls.open.mock.calls.length;
  act(() => { first.studio.newlyAddedQuery = oldQuery; });
  expect(first.studio.newlyAddedQuery).toBe(oldQuery);
  expect(calls.open).toHaveBeenCalledTimes(opened);
  view.unmount();
  second.studio.newlyAddedQuery = query;
  expect(second.studio.newlyAddedQuery).toBe(query);
  const pending = ensure(second.studio.newlyAddedQueryStore.getState(), "Pending query ref"), oldModels = second.studio.modelSnapshots, resolved = vi.spyOn(oldModels, "resolve");
  const replacement = siteFixture("Replacement", true);
  Object.assign(second.appCtx, { lastBundleVersion: "test" });
  const bundle = new Bundler().bundle(replacement.site, second.studio.siteInfo.id, "test");
  second.api.getSiteInfo.mockResolvedValueOnce(mock<GetProjectResponse>({ rev: { data: JSON.stringify(bundle), revision: 1 }, depPkgs: [] }));
  await second.studio["loadVersion"]();
  expect(second.studio.modelSnapshots).not.toBe(oldModels);
  expect(second.studio.newlyAddedQuery).toBeUndefined();
  expect(resolved.mock.calls.some(([ref]) => ref === pending)).toBe(false);
  const component = ensure(second.studio.site.components[0], "Replacement component"), current = ensure(component.dataQueries[0], "Replacement query");
  const rebound = { ...second, component, view: viewFixture(second.studio, component) };
  const remount = render(wrap(rebound, section(rebound)));
  act(() => { second.studio.newlyAddedQuery = current; });
  await waitFor(() => expect(calls.open).toHaveBeenCalledWith(current.uuid, expect.objectContaining({ parent: current })));
  remount.unmount(); second.studio.newlyAddedQuery = current;
  second.studio.dispose(); studios.delete(second.studio);
  expect(second.studio.newlyAddedQuery).toBeUndefined();
});
