import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { RepeatingElementSection } from "@/wab/client/components/sidebar-tabs/RepeatingElementSection";
import ImplicitVariablesSection from "@/wab/client/components/sidebar-tabs/StateManagement/ImplicitVariablesSection";
import VariableEditingForm from "@/wab/client/components/sidebar-tabs/StateManagement/VariableEditingForm";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { RepeatingElementInputs } from "@/wab/client/studio-ctx/state-management-inputs";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { CodeComponentsRegistry, mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { assert, ensure } from "@/wab/shared/common";
import { ComponentType, isCodeComponent, mkComponent } from "@/wab/shared/core/components";
import { codeLit, tryExtractJson } from "@/wab/shared/core/exprs";
import { mkParamsForState, mkVar } from "@/wab/shared/core/lang";
import { createSite } from "@/wab/shared/core/sites";
import { addComponentState, ensureCorrectImplicitStates, mkNamedState } from "@/wab/shared/core/states";
import { mkTplComponent, mkTplTagX } from "@/wab/shared/core/tpls";
import { ObjectPath, Rep, ensureKnownTplTag, isKnownObjectPath, type Component, type TplComponent } from "@/wab/shared/model/classes";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import { type CodeComponentMeta } from "@plasmicapp/host/registerComponent";

vi.mock("@/wab/client/components/sidebar-tabs/ComponentProps/DataPickerEditor", () => ({ DataPickerEditor: ({value, onChange}: any) => <><output data-testid="collection">{JSON.stringify(value)}</output><button onClick={() => onChange("items.filter(Boolean)")}>Change collection</button></> }));
vi.mock("@/wab/client/components/sidebar-tabs/ComponentProps/StringPropEditor", () => ({ StringPropEditor: ({value, onChange}: any) => <input value={value ?? ""} onChange={(event) => onChange(event.target.value)} /> }));
vi.mock("@/wab/client/components/sidebar-tabs/PropEditorRow", () => ({ PropEditorRow: ({attr, expr, onChange}: any) => <div data-testid={attr}><output>{expr ? JSON.stringify(tryExtractJson(expr)) : "unset"}</output><button onClick={() => onChange(codeLit(7))}>Set {attr}</button></div> }));
vi.mock("@/wab/client/components/sidebar-tabs/StateManagement/ImplicitVariableRow", () => ({ default: ({state}: any) => <output data-testid={`implicit-${state.uid}`}>Implicit value</output> }));
afterEach(() => {cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals();});

function namedState(name: string, accessType: "private" | "readonly" = "private") {
  const {valueParam, onChangeParam} = mkParamsForState({name, variableType: "text", accessType, onChangeProp: `on${name}Change`, defaultExpr: codeLit(1)});
  return mkNamedState({name, param: valueParam, onChangeParam, variableType: "text", accessType});
}
async function setup(componentFactory?: (manager: TplMgr) => Component) {
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  const site = createSite(), manager = new TplMgr({site});
  const component = componentFactory ? componentFactory(manager) : manager.addComponent({name: "State editors", type: ComponentType.Plain});
  const frame = mkArenaFrame({site, component, name: "State editors", width: 400, height: 200});
  site.arenas.push(mkMixedArena("State editors", [frame]));
  const f = fakeStudioCtx({site, devFlagOverrides: {ccStubs: true}, initialUrl: "/projects/test?arena_type=custom&arena=State%20editors"});
  await waitFor(() => expect(f.studioCtx.initialRouteReady).toBe(true));
  const view = ensure(f.studioCtx.tryGetViewCtxForFrame(frame), "Editor view");
  return {...f, site, manager, component, view};
}
function providers(f: Awaited<ReturnType<typeof setup>>, children: React.ReactNode) {
  return <AppCtxContext.Provider value={f.appCtx}><StudioCtxContext.Provider value={f.studioCtx}>{children}</StudioCtxContext.Provider></AppCtxContext.Provider>;
}

it("publishes nested repetition expression/variable edits and keeps commands on the original Rep", async () => {
  const f = await setup(), tpl = ensureKnownTplTag(f.component.tplTree);
  const rep = new Rep({collection: new ObjectPath({path: ["items"], fallback: null}), element: mkVar("item"), index: mkVar("index")});
  await f.studioCtx.changeUnsafe(() => {tpl.vsettings[0].dataRep = rep;});
  const source = new RepeatingElementInputs(f.view, f.component, tpl), changed = vi.fn(), off = source.subscribe(changed);
  const before = source.getSnapshot();
  const mounted = render(providers(f, <RepeatingElementSection tpl={tpl} viewCtx={f.view} />));
  try {
    expect(screen.getByTestId("collection").textContent).toBe('["items"]');
    await act(async () => {await f.studioCtx.changeUnsafe(() => {
      const collection = rep.collection;
      if (!isKnownObjectPath(collection)) {throw new Error("Expected ObjectPath");}
      collection.path.push("rows"); rep.element.name = "entry";
    });});
    expect(source.getSnapshot()).not.toBe(before);
    expect(changed).toHaveBeenCalledOnce();
    expect(screen.getByDisplayValue("entry")).toBeTruthy();
    expect(screen.getByTestId("collection").textContent).toBe('["items","rows"]');
    fireEvent.click(screen.getByText("Change collection"));
    await waitFor(() => expect(tpl.vsettings[0].dataRep).toBe(rep));
    await waitFor(() => expect(screen.getByTestId("collection").textContent).toContain("items.filter(Boolean)"));
  } finally {mounted.unmount(); off(); await f.studioCtx.awaitEval(); f.studioCtx.dispose();}
});

it("updates implicit-state visibility from native code-component evaluation and follows node renames", async () => {
  let tpl: TplComponent | undefined;
  const meta: CodeComponentMeta<any> = {name: "ConditionalState", importPath: "conditional-state", props: {hidden: "boolean"}, states: {value: {type: "readonly", variableType: "text", onChangeProp: "onValueChange", hidden: (props) => props.hidden}}};
  vi.stubGlobal("__PlasmicComponentRegistry", [{component: () => null, meta}]);
  vi.stubGlobal("__PlasmicContextRegistry", []);
  vi.stubGlobal("__PlasmicFunctionsRegistry", []);
  vi.stubGlobal("__PlasmicLibraryRegistry", []);
  const registry = new CodeComponentsRegistry(globalThis, {});
  const f = await setup((manager) => {
    const child = mkCodeComponent(meta.name, meta, {});
    child._meta = meta;
    addComponentState(manager.site(), child, namedState("value", "readonly"));
    manager.attachComponent(child);
    const owner = mkComponent({name: "State editors", type: ComponentType.Plain, tplTree: (base) => {
      tpl = mkTplComponent(child, base); tpl.name = "Conditional";
      return mkTplTagX("div", {baseVariant: base}, tpl);
    }});
    manager.attachComponent(owner);
    ensureCorrectImplicitStates(manager.site(), owner, ensure(tpl, "Code instance"));
    return owner;
  });
  const node = ensure(tpl, "Code instance");
  assert(isCodeComponent(node.component), "Expected registered code component");
  node.component._meta = meta;
  f.view.canvasCtx.registrations.install(registry);
  let hidden = false;
  vi.spyOn(f.view, "getComponentEvalContext").mockImplementation(() => ({componentPropValues: {hidden}, ccContextData: undefined, invalidArgs: []}));
  const state = ensure(f.component.states.find((candidate) => candidate.tplNode === node), "Implicit state");
  const mounted = render(providers(f, <ImplicitVariablesSection sc={f.studioCtx} viewCtx={f.view} component={f.component} tpl={node} />));
  const owner = f.view.getInspectorReadOwner();
  act(() => owner.resume());
  try {
    expect(screen.getByTestId(`implicit-${state.uid}`)).toBeTruthy();
    act(() => {hidden = true; owner.syncCanvas();});
    expect(screen.queryByTestId(`implicit-${state.uid}`)).toBeNull();
    act(() => {hidden = false; owner.syncCanvas();});
    expect(screen.getByTestId(`implicit-${state.uid}`)).toBeTruthy();
    act(() => {hidden = true; owner.syncCanvas();});
    expect(screen.queryByTestId(`implicit-${state.uid}`)).toBeNull();
    act(() => {
      ensure(meta.states, "Registered state contract").value.hidden = () => false;
      registry.clear(); f.view.canvasCtx.registrations.refresh();
    });
    expect(screen.getByTestId(`implicit-${state.uid}`)).toBeTruthy();
    await act(async () => {await f.studioCtx.changeUnsafe(() => {node.name = "Renamed";});});
    expect(screen.getByText("Renamed")).toBeTruthy();
  } finally {mounted.unmount(); await f.studioCtx.awaitEval(); f.studioCtx.dispose();}
});

it("edits detached new-state drafts without querying a canvas runtime or mutating the Site", async () => {
  const f = await setup(), draft = namedState("draft");
  vi.spyOn(f.view, "getCanvasStateValue").mockImplementation(() => {throw new Error("New drafts have no runtime state");});
  vi.spyOn(f.view, "getStateCurrentInitialValue").mockImplementation(() => {throw new Error("New drafts have no initial runtime state");});
  const update = vi.fn(), before = [...f.component.states];
  const mounted = render(providers(f, <VariableEditingForm component={f.component} state={draft} studioCtx={f.studioCtx} viewCtx={f.view} mode="new" onDraftChange={update} />));
  try {
    expect(screen.queryByTestId("preview-value")).toBeNull();
    fireEvent.click(screen.getByText("Set initial-value"));
    expect(update).toHaveBeenCalledOnce();
    expect(tryExtractJson(update.mock.calls[0][0].initialValue)).toBe(7);
    expect(f.component.states).toEqual(before);
  } finally {mounted.unmount(); await f.studioCtx.awaitEval(); f.studioCtx.dispose();}
});
