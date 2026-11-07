import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import LeftProjectSettingsPanel from "@/wab/client/components/sidebar/LeftProjectSettingsPanel";
import { DataSourceEditor } from "@/wab/client/components/sidebar-tabs/ComponentPropsSection";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import type { TopFrameApi } from "@/wab/client/frame-ctx/top-frame-api";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { GetProjectResponse } from "@/wab/shared/ApiSchema";
import { Bundler } from "@/wab/shared/bundler";
import { mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { ensure } from "@/wab/shared/common";
import { mkParam } from "@/wab/shared/core/lang";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplComponent } from "@/wab/shared/core/tpls";
import { typeFactory } from "@/wab/shared/model/model-util";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

vi.mock("@/wab/client/contexts/AppContexts", async (original) => ({ ...(await original<typeof import("@/wab/client/contexts/AppContexts")>()), useDataSource: () => ({ data: undefined, isValidating: false }) }));
vi.mock("@/wab/client/plasmic/plasmic_kit_left_pane/PlasmicLeftSettingsPanel", () => ({ default: ({ content }: { content: { props: { children: React.ReactNode } } }) => <div>{content.props.children}</div> }));
vi.mock("@/wab/client/components/widgets/SimpleReorderableList", () => ({ SimpleReorderableList: ({ children }: React.PropsWithChildren) => <div>{children}</div> }));
vi.mock("@/wab/client/components/ListItem", () => ({ default: ({ children, onClickMain }: React.PropsWithChildren<{ onClickMain?: () => void }>) => <button onClick={onClickMain}>{children}</button> }));
vi.mock("@/wab/client/components/sidebar/SidebarModal", () => ({ SidebarModal: ({ title, show, onClose }: { title: React.ReactNode; show: boolean; onClose: () => void }) => show ? <section aria-label="Context props">{title}<button onClick={onClose}>Close context</button></section> : null }));

const studios = new Set<StudioCtx>();
afterEach(async () => {
  await act(async () => { cleanup(); });
  for (const studio of studios) { await studio.awaitEval(); studio.dispose(); }
  studios.clear(); vi.restoreAllMocks();
});
function siteFixture(prefix: string) {
  const site = createSite();
  const create = (name: string) => {
    const component = mkCodeComponent(name, { name, importPath: `./${name}`, props: { source: "string" } }, {});
    ensure(component.codeComponentMeta, "Code context metadata").isContext = true;
    component.params.push(mkParam({ name: "source", type: typeFactory.text(), paramType: "prop" }));
    site.components.push(component);
    const tpl = mkTplComponent(component, ensure(component.variants[0], "Context base variant"));
    return { component, tpl };
  };
  const first = create(`${prefix}First`), second = create(`${prefix}Second`);
  site.globalContexts.push(first.tpl);
  return { site, first, second };
}
async function setup(prefix = "Request") {
  const data = siteFixture(prefix), top = mock<TopFrameApi>();
  top.pickDataSource.mockResolvedValue("CANCELED");
  top.componentReuse.mockResolvedValue({ available: false });
  const f = fakeStudioCtx({ site: data.site, topFrameApi: top, devFlagOverrides: { ccStubs: true } });
  const studio = f.studioCtx; studios.add(studio);
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  studio.observeComponents([data.first.component, data.second.component]);
  studio.createViewStateUndoRecord();
  return { ...data, ...f, studio, top };
}
function wrap(f: Awaited<ReturnType<typeof setup>>, children: React.ReactNode) {
  return <AppCtxContext.Provider value={f.appCtx}><StudioCtxContext.Provider value={f.studio}>{children}</StudioCtxContext.Provider></AppCtxContext.Provider>;
}

it("opens the matching context before its prop editor mounts, then consumes the real picker request and allows repeat", async () => {
  const f = await setup(), changed = vi.fn();
  f.studio.forceOpenProp = [f.first.component, "source"];
  const pending = ensure(f.studio.forceOpenPropStore.getState(), "Pending prop request");
  expect(pending.component.uid).toBe(f.first.component.uid);
  expect(pending.prop).toBe("source");
  expect(Object.isFrozen(pending)).toBe(true);
  f.studio.forceOpenProp = [f.first.component, "source"];
  expect(f.studio.forceOpenPropStore.getState()).toBe(pending);
  const view = render(wrap(f, <LeftProjectSettingsPanel />));
  await waitFor(() => expect(screen.getByRole("region", { name: "Context props" }).textContent).toContain("RequestFirst props"));
  expect(f.studio.forceOpenPropStore.getState()).toBe(pending);
  f.top.pickDataSource.mockResolvedValueOnce({ sourceId: "selected" });
  view.rerender(wrap(f, <><LeftProjectSettingsPanel /><DataSourceEditor tpl={f.first.tpl} paramName="source" dataSourceType="airtable" value={{ id: "existing" }} onChange={changed} /></>));
  await waitFor(() => expect(changed).toHaveBeenCalledWith({ sourceId: "selected" }));
  expect(f.top.pickDataSource).toHaveBeenLastCalledWith({ sourceType: "airtable", existingSourceId: "existing" });
  expect(f.studio.forceOpenProp).toBeNull();
  act(() => { f.studio.forceOpenProp = [f.first.component, "source"]; });
  await waitFor(() => expect(f.top.pickDataSource).toHaveBeenCalledTimes(2));
  expect(changed).toHaveBeenCalledOnce();
  expect(f.studio.forceOpenPropStore.getState()).toBeNull();
});

it("reacts to a changed target component and param while preserving the latest picker props", async () => {
  const f = await setup(), oldChange = vi.fn(), nextChange = vi.fn();
  f.studio.forceOpenProp = [f.second.component, "later"];
  const view = render(wrap(f, <DataSourceEditor tpl={f.first.tpl} paramName="source" dataSourceType="airtable" value={{ id: "old" }} onChange={oldChange} />));
  expect(f.top.pickDataSource).not.toHaveBeenCalled();
  await act(async () => { await f.studio.changeUnsafe(() => { f.first.tpl.component = f.second.component; }); });
  expect(f.top.pickDataSource).not.toHaveBeenCalled();
  f.top.pickDataSource.mockResolvedValueOnce({ sourceId: "updated" });
  view.rerender(wrap(f, <DataSourceEditor tpl={f.first.tpl} paramName="later" dataSourceType="postgres" value={{ id: "new" }} onChange={nextChange} />));
  await waitFor(() => expect(nextChange).toHaveBeenCalledWith({ sourceId: "updated" }));
  expect(f.top.pickDataSource).toHaveBeenLastCalledWith({ sourceType: "postgres", existingSourceId: "new" });
  expect(oldChange).not.toHaveBeenCalled();
  expect(f.studio.forceOpenPropStore.getState()).toBeNull();
});

it("reads the current effect-time request after a layout effect replaces the pending request", async () => {
  const f = await setup();
  await f.studio.changeUnsafe(() => { f.site.globalContexts.push(f.second.tpl); });
  f.studio.forceOpenProp = [f.first.component, "source"];
  function UpdateRequest() {
    React.useLayoutEffect(() => { f.studio.forceOpenProp = [f.second.component, "source"]; }, []);
    return null;
  }
  render(wrap(f, <><DataSourceEditor tpl={f.second.tpl} paramName="source" dataSourceType="airtable" value={undefined} onChange={vi.fn()} /><UpdateRequest /></>));
  await waitFor(() => expect(f.top.pickDataSource).toHaveBeenCalledOnce());
  expect(f.studio.forceOpenPropStore.getState()).toBeNull();
});

it("unsubscribes from an old Studio and preserves requests while the editor is unmounted", async () => {
  const first = await setup("Old"), second = await setup("New");
  const view = render(wrap(first, <DataSourceEditor tpl={first.first.tpl} paramName="source" dataSourceType="airtable" value={undefined} onChange={vi.fn()} />));
  second.studio.forceOpenProp = [second.first.component, "source"];
  view.rerender(wrap(second, <DataSourceEditor tpl={second.first.tpl} paramName="source" dataSourceType="airtable" value={undefined} onChange={vi.fn()} />));
  await waitFor(() => expect(second.top.pickDataSource).toHaveBeenCalledOnce());
  act(() => { first.studio.forceOpenProp = [first.first.component, "source"]; });
  expect(first.top.pickDataSource).not.toHaveBeenCalled();
  expect(first.studio.forceOpenPropStore.getState()).not.toBeNull();
  view.unmount();
  act(() => { second.studio.forceOpenProp = [second.first.component, "source"]; });
  expect(second.studio.forceOpenPropStore.getState()).not.toBeNull();
  expect(second.top.pickDataSource).toHaveBeenCalledOnce();
});

it("clears pending model refs before actual loadVersion/dispose and accepts requests from the new scope", async () => {
  const f = await setup();
  f.studio.forceOpenProp = [f.first.component, "source"];
  const pending = ensure(f.studio.forceOpenPropStore.getState(), "Pending prop request");
  const oldModels = f.studio.modelSnapshots, resolved = vi.spyOn(oldModels, "resolve");
  const next = siteFixture("Replacement");
  Object.assign(f.appCtx, { lastBundleVersion: "test" });
  const bundle = new Bundler().bundle(next.site, f.studio.siteInfo.id, "test");
  f.api.getSiteInfo.mockResolvedValueOnce(mock<GetProjectResponse>({ rev: { data: JSON.stringify(bundle), revision: 1 }, depPkgs: [] }));
  await f.studio["loadVersion"]();
  expect(f.studio.modelSnapshots).not.toBe(oldModels);
  expect(f.studio.forceOpenPropStore.getState()).toBeNull();
  expect(f.studio.forceOpenProp).toBeNull();
  expect(resolved.mock.calls.some(([ref]) => ref === pending.component)).toBe(false);
  const tpl = ensure(f.studio.site.globalContexts[0], "New-scope context");
  const view = render(wrap(f, <DataSourceEditor tpl={tpl} paramName="source" dataSourceType="airtable" value={undefined} onChange={vi.fn()} />));
  act(() => { f.studio.forceOpenProp = [tpl.component, "source"]; });
  await waitFor(() => expect(f.top.pickDataSource).toHaveBeenCalledOnce());
  view.unmount();
  f.studio.forceOpenProp = [tpl.component, "source"];
  f.studio.dispose(); studios.delete(f.studio);
  expect(f.studio.forceOpenPropStore.getState()).toBeNull();
  expect(f.studio.forceOpenProp).toBeNull();
});
