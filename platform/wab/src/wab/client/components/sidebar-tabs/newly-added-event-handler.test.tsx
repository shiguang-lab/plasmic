import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { PopoverFrameProvider } from "@/wab/client/components/sidebar/PopoverFrame";
import { InteractionPropEditor } from "@/wab/client/components/sidebar-tabs/ComponentPropsSection";
import InteractionsSection from "@/wab/client/components/sidebar-tabs/StateManagement/InteractionsSection";
import type { TplExpsProvider } from "@/wab/client/components/style-controls/StyleComponent";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
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

vi.mock("@/wab/client/components/sidebar-tabs/StateManagement/HandlerSection", () => ({ default: () => <div>Interaction handler</div> }));
vi.mock("@/wab/client/components/sidebar-tabs/StateManagement/ActionChip", () => ({ default: ({ onClick, ref }: { onClick: () => void; ref: React.Ref<HTMLDivElement> }) => <div ref={ref}><button onClick={onClick}>Edit interaction</button></div> }));
vi.mock("@/wab/client/components/sidebar/SidebarSection", async (original) => ({ ...(await original<typeof import("@/wab/client/components/sidebar/SidebarSection")>()), SidebarSection: ({ controls, children }: React.PropsWithChildren<{ controls: React.ReactNode }>) => <section>{controls}{children}</section> }));
vi.mock("@/wab/client/components/sidebar-tabs/PropEditorRow", () => ({ PropEditorRow: () => null }));

const studios = new Set<StudioCtx>();
afterEach(async () => {
  await act(async () => { cleanup(); });
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
  const frame = mkArenaFrame({ site, component: owner, name, width: 400, height: 300 }); site.arenas.push(mkMixedArena(name, [frame]));
  return { site, component, owner, param, tpl, frame };
}
async function setup(name = "Events") {
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined); vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  const data = siteFixture(name), f = fakeStudioCtx({ site: data.site, initialUrl: `/projects/test?arena_type=custom&arena=${name}`, devFlagOverrides: { ccStubs: true } });
  const studio = f.studioCtx; studios.add(studio);
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  studio.observeComponents([data.component, data.owner]); studio.createViewStateUndoRecord();
  const view = ensure(studio.tryGetViewCtxForFrame(data.frame), "Event owner view");
  return { ...data, ...f, studio, view };
}
function editor(f: Awaited<ReturnType<typeof setup>>, key: EventHandlerKeyType, title = "Event editor", forceOpen = false) {
  return <PopoverFrameProvider containerSelector="#interaction-test-sidebar"><div id="interaction-test-sidebar"><InteractionPropEditor valuePath={["onSubmit"]} studioCtx={f.studio} viewCtx={f.view} tpl={f.tpl} component={f.owner} eventHandlerKey={key} value={undefined} popoverTitle={title} forceOpen={forceOpen} onChange={vi.fn()} /></div></PopoverFrameProvider>;
}

it("consumes pending parameter requests before mount and repeats only after clearing", async () => {
  const f = await setup();
  f.studio.setNewlyAddedEventHandlerKey({ param: f.param });
  const request = ensure(f.studio.newlyAddedEventHandlerKeyStore.getState(), "Pending event request");
  expect(Object.isFrozen(request)).toBe(true);
  expect("param" in request && request.param.uid).toBe(f.param.uid);
  f.studio.setNewlyAddedEventHandlerKey({ param: f.param });
  expect(f.studio.newlyAddedEventHandlerKeyStore.getState()).toBe(request);
  render(editor(f, { param: f.param }));
  expect(await screen.findByText("Interaction handler")).toBeTruthy();
  expect(f.studio.newlyAddedEventHandlerKey).toBeUndefined();
  fireEvent.click(ensure(document.querySelector<HTMLElement>('[data-test-id="close-popover-frame"]'), "Close popover"));
  act(() => { f.studio.setNewlyAddedEventHandlerKey({ param: f.param }); });
  expect(await screen.findByText("Interaction handler")).toBeTruthy();
  expect(f.studio.newlyAddedEventHandlerKeyStore.getState()).toBeUndefined();
});

it("reads the latest layout-time request and detaches previous owners and unmounted editors", async () => {
  const first = await setup("First"), second = await setup("Second");
  first.studio.setNewlyAddedEventHandlerKey({ attr: "onBlur" });
  function ReplaceRequest() { React.useLayoutEffect(() => { first.studio.setNewlyAddedEventHandlerKey({ attr: "onClick" }); }, []); return null; }
  const view = render(<>{editor(first, { attr: "onClick" })}<ReplaceRequest /></>);
  expect(await screen.findByText("Interaction handler")).toBeTruthy();
  second.studio.setNewlyAddedEventHandlerKey({ attr: "onClick" });
  view.rerender(editor(second, { attr: "onClick" }));
  expect(second.studio.newlyAddedEventHandlerKey).toBeUndefined();
  act(() => { first.studio.setNewlyAddedEventHandlerKey({ attr: "onClick" }); });
  expect(first.studio.newlyAddedEventHandlerKey).toEqual({ attr: "onClick" });
  view.unmount();
  second.studio.setNewlyAddedEventHandlerKey({ attr: "onClick" });
  expect(second.studio.newlyAddedEventHandlerKey).toEqual({ attr: "onClick" });
});

it("keeps all canonical key branches and clears old refs before actual scope replacement and disposal", async () => {
  const f = await setup();
  f.studio.setNewlyAddedEventHandlerKey({ attr: "onClick" });
  const attr = f.studio.newlyAddedEventHandlerKeyStore.getState();
  f.studio.setNewlyAddedEventHandlerKey({ attr: "onClick" });
  expect(f.studio.newlyAddedEventHandlerKeyStore.getState()).toBe(attr);
  const functionKey = { funcType: ensureKnownFunctionType(f.param.type) };
  f.studio.setNewlyAddedEventHandlerKey(functionKey);
  const generic = f.studio.newlyAddedEventHandlerKeyStore.getState();
  expect(f.studio.newlyAddedEventHandlerKey).toEqual(functionKey);
  f.studio.setNewlyAddedEventHandlerKey(functionKey);
  expect(f.studio.newlyAddedEventHandlerKeyStore.getState()).toBe(generic);
  f.studio.setNewlyAddedEventHandlerKey({ param: f.param });
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
  f.studio.setNewlyAddedEventHandlerKey({ param });
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
  expect(screen.queryByRole("combobox")).toBeNull();
  expect(screen.queryByRole("menu")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Add event handler" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: /submit/i }));
  await act(async () => { await f.studio.awaitEval(); });
  expect(f.studio.newlyAddedEventHandlerKey).toEqual({ param: f.param });
  expect(ensureKnownEventHandler(getEventHandlerByEventKey(f.owner, f.tpl, { param: f.param })).interactions).toHaveLength(1);
  view.rerender(editor(f, { param: f.param }));
  expect(await screen.findByText("Interaction handler")).toBeTruthy();
  expect(f.studio.newlyAddedEventHandlerKey).toBeUndefined();
});

it("opens the action editor in an anchored popover and closes on Escape", async () => {
  const f = await setup();
  render(editor(f, { param: f.param }));
  fireEvent.click(screen.getByRole("button", { name: "Edit interaction" }));
  const handler = await screen.findByText("Interaction handler");
  const popup = ensure(document.querySelector("#props-popover"), "Interaction popover");
  expect(popup.contains(handler)).toBe(true);
  expect(popup.closest("#interaction-test-sidebar")).toBeNull();
  fireEvent.keyDown(handler, { key: "Escape" });
  await waitFor(() => expect(document.querySelector("#props-popover")).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "Edit interaction" }));
  expect(await screen.findByText("Interaction handler")).toBeTruthy();
});

it("allows a requested interaction popover to close without reopening on rerender", async () => {
  const f = await setup();
  const mounted = render(editor(f, { param: f.param }, "Event editor", true));
  const handler = await screen.findByText("Interaction handler");
  fireEvent.keyDown(handler, { key: "Escape" });
  await waitFor(() => expect(document.querySelector("#props-popover")).toBeNull());
  mounted.rerender(editor(f, { param: f.param }, "Event editor", true));
  expect(document.querySelector("#props-popover")).toBeNull();
});
