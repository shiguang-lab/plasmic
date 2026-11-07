import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { InteractionPropEditor } from "@/wab/client/components/sidebar-tabs/ComponentPropsSection";
import InteractionsSection from "@/wab/client/components/sidebar-tabs/StateManagement/InteractionsSection";
import type { TplExpsProvider } from "@/wab/client/components/style-controls/StyleComponent";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewSelection } from "@/wab/client/studio-ctx/view-selection";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import type { GetProjectResponse } from "@/wab/shared/ApiSchema";
import { Bundler } from "@/wab/shared/bundler";
import { mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { ensure } from "@/wab/shared/common";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { mkParam } from "@/wab/shared/core/lang";
import { createSite } from "@/wab/shared/core/sites";
import { type EventHandlerKeyType, getEventHandlerByEventKey, mkTplComponent } from "@/wab/shared/core/tpls";
import { typeFactory } from "@/wab/shared/model/model-util";
import { ensureKnownEventHandler, ensureKnownFunctionType, ensureKnownTplComponent } from "@/wab/shared/model/classes";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

vi.mock("@/wab/client/components/sidebar/SidebarModal", () => ({ SidebarModal: ({ title, show, onClose, children }: React.PropsWithChildren<{ title: React.ReactNode; show: boolean; onClose: () => void }>) => show ? <section aria-label={String(title)}><button onClick={onClose}>Close interaction</button>{children}</section> : null }));
vi.mock("@/wab/client/components/sidebar-tabs/StateManagement/HandlerSection", () => ({ default: () => <div>Interaction handler</div> }));
vi.mock("@/wab/client/components/sidebar-tabs/StateManagement/ActionChip", () => ({ default: ({ onClick }: { onClick: () => void }) => <button onClick={onClick}>Edit interaction</button> }));
vi.mock("@/wab/client/components/sidebar/SidebarSection", async (original) => ({ ...(await original<typeof import("@/wab/client/components/sidebar/SidebarSection")>()), SidebarSection: ({ controls, children }: React.PropsWithChildren<{ controls: React.ReactNode }>) => <section>{controls}{children}</section> }));
vi.mock("@/wab/client/components/sidebar-tabs/PropEditorRow", () => ({ PropEditorRow: () => null }));
vi.mock("antd", async (original) => ({ ...(await original<typeof import("antd")>()), Select: ({ options, onSelect }: { options: { value: string; label: string }[]; onSelect: (value: string) => void }) => <button onClick={() => onSelect(ensure(options.find((option) => option.value === "onSubmit"), "Submit event option").value)}>Add submit interaction</button> }));

const studios = new Set<StudioCtx>(), selections = new Set<ViewSelection>();
afterEach(async () => {
  await act(async () => { cleanup(); });
  for (const selection of selections) { selection.dispose(); }
  selections.clear();
  for (const studio of studios) { await studio.awaitEval(); studio.dispose(); }
  studios.clear(); vi.restoreAllMocks();
});
function siteFixture(name: string) {
  const site = createSite();
  const component = mkCodeComponent(name, { name, importPath: `./${name}`, props: {} }, {});
  const param = mkParam({ name: "onSubmit", type: typeFactory.func(), paramType: "prop" });
  component.params.push(param); site.components.push(component);
  const tpl = mkTplComponent(component, ensure(component.variants[0], "Event component base"));
  const owner = mkComponent({ name: `${name}Owner`, type: ComponentType.Plain, tplTree: () => tpl });
  site.components.push(owner);
  return { site, component, owner, param, tpl };
}
async function setup(name = "Events") {
  const data = siteFixture(name), f = fakeStudioCtx({ site: data.site, devFlagOverrides: { ccStubs: true } });
  const studio = f.studioCtx; studios.add(studio);
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  studio.observeComponents([data.component, data.owner]); studio.createViewStateUndoRecord();
  const view = mock<ViewCtx>(), selection = new ViewSelection(() => studio.modelSnapshots);
  selections.add(selection);
  Object.defineProperties(view, { studioCtx: { value: studio }, selectionStore: { value: selection.store }, site: { get: () => studio.site } });
  view.currentComponent.mockReturnValue(data.owner);
  return { ...data, ...f, studio, view };
}
function editor(f: Awaited<ReturnType<typeof setup>>, key: EventHandlerKeyType, title = "Event editor") {
  return <InteractionPropEditor studioCtx={f.studio} viewCtx={f.view} tpl={f.tpl} component={f.owner} eventHandlerKey={key} value={undefined} modalTitle={title} forceOpen={false} onChange={vi.fn()} />;
}

it("consumes pending parameter requests before mount and repeats only after clearing", async () => {
  const f = await setup();
  f.studio.newlyAddedEventHandlerKey = { param: f.param };
  const request = ensure(f.studio.newlyAddedEventHandlerKeyStore.getState(), "Pending event request");
  expect(Object.isFrozen(request)).toBe(true);
  expect("param" in request && request.param.uid).toBe(f.param.uid);
  f.studio.newlyAddedEventHandlerKey = { param: f.param };
  expect(f.studio.newlyAddedEventHandlerKeyStore.getState()).toBe(request);
  render(editor(f, { param: f.param }));
  expect(await screen.findByRole("region", { name: "Event editor" })).toBeTruthy();
  expect(f.studio.newlyAddedEventHandlerKey).toBeUndefined();
  fireEvent.click(screen.getByRole("button", { name: "Close interaction" }));
  act(() => { f.studio.newlyAddedEventHandlerKey = { param: f.param }; });
  expect(await screen.findByRole("region", { name: "Event editor" })).toBeTruthy();
  expect(f.studio.newlyAddedEventHandlerKeyStore.getState()).toBeUndefined();
});

it("reads the latest layout-time request and detaches previous owners and unmounted editors", async () => {
  const first = await setup("First"), second = await setup("Second");
  first.studio.newlyAddedEventHandlerKey = { attr: "onBlur" };
  function ReplaceRequest() { React.useLayoutEffect(() => { first.studio.newlyAddedEventHandlerKey = { attr: "onClick" }; }, []); return null; }
  const view = render(<>{editor(first, { attr: "onClick" })}<ReplaceRequest /></>);
  expect(await screen.findByRole("region", { name: "Event editor" })).toBeTruthy();
  second.studio.newlyAddedEventHandlerKey = { attr: "onClick" };
  view.rerender(editor(second, { attr: "onClick" }));
  expect(second.studio.newlyAddedEventHandlerKey).toBeUndefined();
  act(() => { first.studio.newlyAddedEventHandlerKey = { attr: "onClick" }; });
  expect(first.studio.newlyAddedEventHandlerKey).toEqual({ attr: "onClick" });
  view.unmount();
  second.studio.newlyAddedEventHandlerKey = { attr: "onClick" };
  expect(second.studio.newlyAddedEventHandlerKey).toEqual({ attr: "onClick" });
});

it("keeps all canonical key branches and clears old refs before actual scope replacement and disposal", async () => {
  const f = await setup();
  f.studio.newlyAddedEventHandlerKey = { attr: "onClick" };
  const attr = f.studio.newlyAddedEventHandlerKeyStore.getState();
  f.studio.newlyAddedEventHandlerKey = { attr: "onClick" };
  expect(f.studio.newlyAddedEventHandlerKeyStore.getState()).toBe(attr);
  const functionKey = { funcType: ensureKnownFunctionType(f.param.type) };
  f.studio.newlyAddedEventHandlerKey = functionKey;
  const generic = f.studio.newlyAddedEventHandlerKeyStore.getState();
  expect(f.studio.newlyAddedEventHandlerKey).toEqual(functionKey);
  f.studio.newlyAddedEventHandlerKey = functionKey;
  expect(f.studio.newlyAddedEventHandlerKeyStore.getState()).toBe(generic);
  f.studio.newlyAddedEventHandlerKey = { param: f.param };
  const pending = ensure(f.studio.newlyAddedEventHandlerKeyStore.getState(), "Pending parameter request");
  const oldModels = f.studio.modelSnapshots, resolved = vi.spyOn(oldModels, "resolve");
  const next = siteFixture("Replacement");
  Object.assign(f.appCtx, { lastBundleVersion: "test" });
  const bundle = new Bundler().bundle(next.site, f.studio.siteInfo.id, "test");
  f.api.getSiteInfo.mockResolvedValueOnce(mock<GetProjectResponse>({ rev: { data: JSON.stringify(bundle), revision: 1 }, depPkgs: [] }));
  await f.studio["loadVersion"]();
  expect(f.studio.newlyAddedEventHandlerKeyStore.getState()).toBeUndefined();
  expect(f.studio.newlyAddedEventHandlerKey).toBeUndefined();
  expect(resolved.mock.calls.some(([ref]) => "param" in pending && ref === pending.param)).toBe(false);
  const tpl = ensureKnownTplComponent(ensure(f.studio.site.components.find((component) => component.name === "ReplacementOwner"), "Replacement owner").tplTree);
  const param = ensure(tpl.component.params.find((p) => p.variable.name === "onSubmit"), "Replacement event parameter");
  f.studio.newlyAddedEventHandlerKey = { param };
  expect(f.studio.newlyAddedEventHandlerKey).toEqual({ param });
  f.studio.dispose(); studios.delete(f.studio);
  expect(f.studio.newlyAddedEventHandlerKeyStore.getState()).toBeUndefined();
  expect(f.studio.newlyAddedEventHandlerKey).toBeUndefined();
});

it("preserves the actual add-interaction command and its pending open request", async () => {
  const f = await setup();
  const provider = mock<TplExpsProvider>();
  provider.effectiveVs.mockReturnValue(mock<ReturnType<TplExpsProvider["effectiveVs"]>>());
  const view = render(<InteractionsSection sc={f.studio} vc={f.view} component={f.owner} tpl={f.tpl} expsProvider={provider} />);
  fireEvent.click(screen.getByRole("button", { name: "Add submit interaction" }));
  await act(async () => { await f.studio.awaitEval(); });
  expect(f.studio.newlyAddedEventHandlerKey).toEqual({ param: f.param });
  expect(ensureKnownEventHandler(getEventHandlerByEventKey(f.owner, f.tpl, { param: f.param })).interactions).toHaveLength(1);
  view.rerender(editor(f, { param: f.param }));
  expect(await screen.findByRole("region", { name: "Event editor" })).toBeTruthy();
  expect(f.studio.newlyAddedEventHandlerKey).toBeUndefined();
});
