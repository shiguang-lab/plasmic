import HandlerSection from "@/wab/client/components/sidebar-tabs/StateManagement/HandlerSection";
import VariablesSection from "@/wab/client/components/sidebar-tabs/StateManagement/VariablesSection";
import type { VariableRowProps } from "@/wab/client/components/sidebar-tabs/StateManagement/VariableRow";
import type { ImplicitVariablesSectionProps } from "@/wab/client/components/sidebar-tabs/StateManagement/ImplicitVariablesSection";
import type { ActionBuilderProps } from "@/wab/client/components/sidebar-tabs/StateManagement/ActionBuilder";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import * as React from "react";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { HandlerListInputs, VariableRosterInputs } from "@/wab/client/studio-ctx/state-management-inputs";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { mkParam, mkParamsForState } from "@/wab/shared/core/lang";
import { createSite } from "@/wab/shared/core/sites";
import { addComponentState, ensureCorrectImplicitStates, mkInteraction, mkNamedState } from "@/wab/shared/core/states";
import { mkSlot, mkTplComponent, mkTplTagX, setEventHandlerByEventKey } from "@/wab/shared/core/tpls";
import { EventHandler, type TplNode, type TplComponent, type Variant } from "@/wab/shared/model/classes";
import { typeFactory } from "@/wab/shared/model/model-util";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/wab/client/components/sidebar-tabs/StateManagement/VariableRow", () => ({ default: ({ state }: VariableRowProps) => <span data-testid={`regular-${state.uid}`} /> }));
vi.mock("@/wab/client/components/sidebar-tabs/StateManagement/ImplicitVariablesSection", () => ({ default: ({ tpl }: ImplicitVariablesSectionProps) => <span data-testid={`implicit-${tpl.uid}`} /> }));
vi.mock("@/wab/client/components/sidebar-tabs/StateManagement/VariableEditingModal", () => ({ VariableEditingModal: () => null }));
vi.mock("@/wab/client/components/sidebar-tabs/StateManagement/ActionBuilder", () => ({ default: ({ interaction, menu }: ActionBuilderProps) => <div data-testid={`interaction-${interaction.uid}`}>{menu}</div> }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function namedState(name: string) {
  const { valueParam, onChangeParam } = mkParamsForState({ name, variableType: "text", accessType: "private", onChangeProp: `on ${name} change` });
  return mkNamedState({ name, param: valueParam, onChangeParam, variableType: "text" });
}
async function setup(root?: TplNode | ((base: Variant) => TplNode), site = createSite()) {
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  vi.spyOn(ViewCtx.prototype, "awaitSync").mockResolvedValue(undefined);
  const manager = new TplMgr({ site });
  const component = typeof root === "function"
    ? mkComponent({ name: "State lists", type: ComponentType.Plain, tplTree: root })
    : manager.addComponent({ name: "State lists", type: ComponentType.Plain, rootTpl: root ?? mkTplTagX("div") });
  if (typeof root === "function") { manager.attachComponent(component); }
  const first = namedState("first"); addComponentState(site, component, first);
  const frame = mkArenaFrame({ site, component, name: "State lists", width: 600, height: 300 }); site.arenas.push(mkMixedArena("State lists", [frame]));
  const f = fakeStudioCtx({ site, devFlagOverrides: { ccStubs: true }, initialUrl: "/projects/test?arena_type=custom&arena=State%20lists" });
  await waitFor(() => expect(f.studioCtx.initialRouteReady).toBe(true));
  return { ...f, site, component, first, view: ensure(f.studioCtx.tryGetViewCtxForFrame(frame), "Actual state view") };
}

it("uses the original state classification/grouping, installed fields before any subscriber, and quiet unrelated changes", async () => {
  const a = mkTplTagX("input", { name: "FirstInput" }), b = mkTplTagX("input", { name: "SecondInput" });
  const f = await setup(mkTplTagX("div", {}, a, b));
  await f.studioCtx.changeUnsafe(() => { ensureCorrectImplicitStates(f.site, f.component, a); ensureCorrectImplicitStates(f.site, f.component, b); });
  const source = new VariableRosterInputs(f.view, f.component), before = source.getSnapshot();
  expect(before.regular.map((ref) => source.resolve(ref))).toEqual([f.first]);
  expect(before.implicit.map((ref) => source.resolve(ref))).toEqual([a, b]);
  const readEarly = vi.fn(() => source.getSnapshot()), changed = vi.fn();
  const offField = f.studioCtx.modelSnapshots.field(f.component, "states").subscribe(readEarly), off = source.subscribe(changed);
  try {
    const second = namedState("second");
    await f.studioCtx.changeUnsafe(() => {
      addComponentState(f.site, f.component, second); b.name = a.name;
      expect(source.getSnapshot()).toBe(before);
    });
    const next = source.getSnapshot();
    expect(next.regular.map((ref) => source.resolve(ref))).toEqual([f.first, second]);
    expect(next.implicit.map((ref) => source.resolve(ref))).toEqual([a]);
    expect(readEarly).toHaveReturnedWith(next); expect(changed).toHaveBeenCalledOnce();
    changed.mockClear();
    await f.studioCtx.changeUnsafe(() => { f.component.name = "Renamed component"; f.first.param.variable.name = "renamed variable"; });
    expect(source.getSnapshot()).toBe(next); expect(changed).not.toHaveBeenCalled();
  } finally { off(); offField(); await f.studioCtx.awaitEval(); f.studioCtx.dispose(); }
});

it("keeps original interaction handles and form warning semantics across parent/contract edits", async () => {
  const site = createSite(), onClick = mkParam({ name: "onClick", type: typeFactory.func(), paramType: "prop" });
  const manager = new TplMgr({ site });
  const buttonComponent = manager.addComponent({ name: "SubmitButton", type: ComponentType.Plain, rootTpl: mkTplTagX("button") });
  buttonComponent.params.push(onClick);
  const children = mkParam({ name: "children", type: typeFactory.renderable(), paramType: "slot" });
  const formComponent = manager.addComponent({ name: "plasmic-antd5-form", type: ComponentType.Plain, rootTpl: mkTplTagX("div", {}, mkSlot(children)) });
  formComponent.params.push(children);
  let buttonNode: TplComponent | undefined;
  const f = await setup((base) => {
    buttonNode = mkTplComponent(buttonComponent, base);
    return mkTplComponent(formComponent, base, {}, [buttonNode]);
  }, site);
  const button = ensure(buttonNode, "Button instance in the owner component's Base variant"), handler = new EventHandler({ interactions: [] });
  const interaction = mkInteraction(handler, "updateVariable", "Original", {});
  await f.studioCtx.changeUnsafe(() => { handler.interactions.push(interaction); setEventHandlerByEventKey(button, { param: onClick }, handler); });
  const source = new HandlerListInputs(f.view, f.component, button, handler, { param: onClick });
  const before = source.getSnapshot(), changed = vi.fn(), off = source.subscribe(changed);
  expect(before.formSubmissionWarning).toBe(true); expect(source.resolve(ensure(before.interactions[0], "Original interaction ref"))).toBe(interaction);
  try {
    const second = mkInteraction(handler, "updateVariable", "Second", {});
    await f.studioCtx.changeUnsafe(() => {
      handler.interactions.unshift(second); formComponent.name = "OtherForm";
      expect(source.getSnapshot()).toBe(before);
    });
    expect(source.getSnapshot().interactions.map((ref) => source.resolve(ref))).toEqual([second, interaction]);
    expect(source.getSnapshot().formSubmissionWarning).toBe(false); expect(changed).toHaveBeenCalledOnce();
    await f.studioCtx.changeUnsafe(() => { formComponent.name = "plasmic-antd5-form"; });
    expect(source.getSnapshot().formSubmissionWarning).toBe(true);
    await f.studioCtx.changeUnsafe(() => { onClick.variable.name = "onFocus"; });
    expect(source.getSnapshot().formSubmissionWarning).toBe(false);
  } finally { off(); await f.studioCtx.awaitEval(); f.studioCtx.dispose(); }
});

it("has zero abandoned-render leases, releases last/late listeners, and closes old view resources without admitting foreign models", async () => {
  const f = await setup(), source = new VariableRosterInputs(f.view, f.component);
  const prepared = vi.spyOn(f.studioCtx.modelSnapshots, "subscribePreparedField");
  source.getSnapshot(); expect(prepared).not.toHaveBeenCalled();
  const changed = vi.fn(), off = source.subscribe(changed); expect(prepared).toHaveBeenCalled();
  off(); changed.mockClear();
  await f.studioCtx.changeUnsafe(() => { addComponentState(f.site, f.component, namedState("second")); });
  expect(changed).not.toHaveBeenCalled();
  const offAgain = source.subscribe(changed); source.getSnapshot(); changed.mockClear();
  const foreign = mkComponent({ name: "Foreign", type: ComponentType.Plain, tplTree: mkTplTagX("div") });
  const fields = vi.spyOn(f.studioCtx.modelSnapshots, "declaredField");
  expect(() => new VariableRosterInputs(f.view, foreign)).toThrow("another model world"); expect(fields).not.toHaveBeenCalled();
  f.view.dispose();
  expect(source.getSnapshot()).toEqual({ regular: [], implicit: [], emptyBody: true }); expect(changed).toHaveBeenCalledOnce();
  fields.mockClear(); new VariableRosterInputs(f.view, f.component).getSnapshot(); expect(fields).not.toHaveBeenCalled();
  const late = vi.fn(), offLate = source.subscribe(late); expect(late).not.toHaveBeenCalled(); offLate(); offAgain();
  await f.studioCtx.awaitEval(); f.studioCtx.dispose();
});

it("updates both real sidebar parents, preserves original add/remove handler identity and exits mounted lists on view disposal", async () => {
  const root = mkTplTagX("div"), f = await setup(root), handler = new EventHandler({ interactions: [] });
  await f.studioCtx.changeUnsafe(() => setEventHandlerByEventKey(root, { attr: "onClick" }, handler));
  const onChange = vi.fn(), firstInteraction = mkInteraction(handler, "updateVariable", "First", {});
  await f.studioCtx.changeUnsafe(() => handler.interactions.push(firstInteraction));
  const mounted = render(<AppCtxContext.Provider value={f.appCtx}><StudioCtxContext.Provider value={f.studioCtx}>
    <VariablesSection component={f.component} viewCtx={f.view} />
    <HandlerSection sc={f.studioCtx} vc={f.view} component={f.component} tpl={root} keyedEventHandler={{ key: { attr: "onClick" }, handler }} onChange={onChange} />
  </StudioCtxContext.Provider></AppCtxContext.Provider>);
  try {
    expect(screen.getByTestId(`regular-${f.first.uid}`)).toBeTruthy();
    const next = namedState("next");
    await act(async () => { await f.studioCtx.changeUnsafe(() => addComponentState(f.site, f.component, next)); });
    expect(screen.getByTestId(`regular-${next.uid}`)).toBeTruthy();
    expect(screen.getByTestId(`interaction-${firstInteraction.uid}`)).toBeTruthy();
    fireEvent.click(screen.getByText("Remove"));
    await waitFor(() => expect(handler.interactions).toHaveLength(0));
    expect(screen.queryByTestId(`interaction-${firstInteraction.uid}`)).toBeNull();
    fireEvent.click(ensure(mounted.container.querySelector<HTMLElement>('[data-test-id="add-new-action"]'), "Original add interaction button"));
    await waitFor(() => expect(handler.interactions).toHaveLength(1));
    expect(onChange).toHaveBeenCalledWith(handler);
    expect(screen.getByTestId(`interaction-${handler.interactions[0].uid}`)).toBeTruthy();
    act(() => f.view.dispose());
    expect(screen.queryAllByTestId(/^regular-/)).toHaveLength(0); expect(screen.queryAllByTestId(/^interaction-/)).toHaveLength(0);
  } finally { mounted.unmount(); await f.studioCtx.awaitEval(); f.studioCtx.dispose(); }
});
