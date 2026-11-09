import { mkTplTagX } from "@/wab/shared/core/tpls";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import ImplicitVariableRow from "@/wab/client/components/sidebar-tabs/StateManagement/ImplicitVariableRow";
import VariableRow from "@/wab/client/components/sidebar-tabs/StateManagement/VariableRow";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { VariableRowInputs } from "@/wab/client/studio-ctx/state-management-inputs";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { mkParamsForState } from "@/wab/shared/core/lang";
import { createSite } from "@/wab/shared/core/sites";
import { addComponentState, ensureCorrectImplicitStates, mkNamedState } from "@/wab/shared/core/states";
import * as ReactWeb from "@plasmicapp/react-web";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import * as React from "react";

vi.mock("@/wab/client/components/sidebar-tabs/StateManagement/VariableEditingModal", () => ({ VariableEditingModal: () => null }));
vi.mock("@/wab/client/components/sidebar-tabs/StateManagement/VariableEditingForm", () => ({
  PREVIEW_DISABLED_TOOLTIP_MESSAGE: { private: "private", readonly: "readonly", writable: "writable" },
  VariableValueEditor: () => null,
}));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

async function setup(withInput = false) {
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  const site = createSite(), manager = new TplMgr({ site });
  const input = mkTplTagX("input", { name: "Field" });
  const component = manager.addComponent({ name: "Variables", type: ComponentType.Plain, ...(withInput ? { rootTpl: mkTplTagX("div", {}, input) } : {}) });
  if (withInput) {ensureCorrectImplicitStates(site, component, input);}
  const { valueParam, onChangeParam } = mkParamsForState({ name: "first", variableType: "text", accessType: "private", onChangeProp: "onFirstChange" });
  const state = mkNamedState({ name: "first", param: valueParam, onChangeParam, variableType: "text" });
  addComponentState(site, component, state);
  const frame = mkArenaFrame({ site, component, name: "Variables", width: 200, height: 100 });
  site.arenas.push(mkMixedArena("Variables", [frame]));
  const f = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Variables" });
  await waitFor(() => expect(f.studioCtx.initialRouteReady).toBe(true));
  const view = ensure(f.studioCtx.tryGetViewCtxForFrame(frame), "State view");
  Object.defineProperty(view.canvasCtx.Sub, "reactWeb", { value: ReactWeb });
  return { ...f, site, component, state, view, input };
}

it("updates real variable rows from native runtime values and committed model metadata", async () => {
  const f = await setup();
  let runtime: any;
  function Runtime() {
    runtime = ReactWeb.useDollarState();
    ReactWeb.useDollarStateSnapshot(runtime, { $props: {} }, [{ path: "first", type: "private", variableType: "text", initFunc: () => "initial" }]);
    return null;
  }
  vi.spyOn(f.view, "getCanvasEnvForTpl").mockImplementation(() => ({ $state: runtime, $ctx: {}, $props: {}, $queries: {}, $q: {}, $refs: {}, $$: {} }));
  f.studioCtx.setStudioFocusOnViewCtxContent(f.view);
  const source = new VariableRowInputs(f.view, f.component, f.state);
  const mounted = render(<AppCtxContext.Provider value={f.appCtx}><StudioCtxContext.Provider value={f.studioCtx}>
    <Runtime /><VariableRow component={f.component} state={f.state} viewCtx={f.view} sc={f.studioCtx} />
  </StudioCtxContext.Provider></AppCtxContext.Provider>);
  const owner = f.view.getInspectorReadOwner();
  act(() => owner.resume());
  try {
    const row = ensure(mounted.container.querySelector('[data-test-id="first"]'), "Original row");
    expect(row.textContent).toContain("initial");
    const valueStore = owner.stateValueStore(f.state);
    expect(valueStore.getState().hasTempValue).toBe(false);
    act(() => { runtime.first = "edited"; owner.syncCanvas(); });
    expect(row.textContent).toContain("edited");
    expect(valueStore.getState().hasTempValue).toBe(true);
    act(() => { ReactWeb.resetToInitialValue(runtime, ["first"]); owner.syncCanvas(); });
    expect(row.textContent).toContain("initial");
    expect(valueStore.getState().hasTempValue).toBe(false);
    const changed = vi.fn(), stop = source.subscribe(changed);
    try {
      await act(async () => { await f.studioCtx.changeUnsafe(() => {
        f.state.param.variable.name = "renamed"; f.state.accessType = "writable"; f.state.variableType = "number";
      }); });
      expect(mounted.container.querySelector('[data-test-id="renamed"]')).toBeTruthy();
      expect(source.getSnapshot()).toMatchObject({ name: "Renamed", parameterName: "renamed", isExternal: true, variableType: "number" });
      expect(changed).toHaveBeenCalledOnce();
      changed.mockClear();
      await f.studioCtx.changeUnsafe(() => { f.component.name = "Unrelated title"; });
      expect(changed).not.toHaveBeenCalled();
    } finally { stop(); }
  } finally { mounted.unmount(); await f.studioCtx.awaitEval(); f.studioCtx.dispose(); }
});


it("keeps implicit variable values and their named-node paths reactive", async () => {
  const f = await setup(true);
  const state = ensure(f.component.states.find((candidate) => candidate.tplNode === f.input), "Input state");
  let runtime: any;
  function Runtime() {
    runtime = ReactWeb.useDollarState();
    ReactWeb.useDollarStateSnapshot(runtime, { $props: {} }, [{ path: "field.value", type: "private", variableType: "text", initFunc: () => "initial" }]);
    return null;
  }
  vi.spyOn(f.view, "getCanvasEnvForTpl").mockImplementation(() => ({ $state: runtime, $ctx: {}, $props: {}, $queries: {}, $q: {}, $refs: {}, $$: {} }));
  f.studioCtx.setStudioFocusOnViewCtxContent(f.view);
  const mounted = render(<AppCtxContext.Provider value={f.appCtx}><StudioCtxContext.Provider value={f.studioCtx}>
    <Runtime /><ImplicitVariableRow component={f.component} state={state} viewCtx={f.view} sc={f.studioCtx} />
  </StudioCtxContext.Provider></AppCtxContext.Provider>);
  const owner = f.view.getInspectorReadOwner();
  act(() => owner.resume());
  try {
    const row = ensure(mounted.container.querySelector('[data-test-id="field.value"]'), "Implicit row");
    expect(row.textContent).toContain("initial");
    act(() => { runtime.field.value = "edited"; owner.syncCanvas(); });
    expect(row.textContent).toContain("edited");
    expect(owner.stateValueStore(state).getState().hasTempValue).toBe(true);
    await act(async () => { await f.studioCtx.changeUnsafe(() => {f.input.name = "RenamedField";}); });
    expect(mounted.container.querySelector('[data-test-id="renamedField.value"]')).toBeTruthy();
    expect(row.textContent).not.toContain("edited");
  } finally { mounted.unmount(); await f.studioCtx.awaitEval(); f.studioCtx.dispose(); }
});
