import { mkArenaFrame } from "@/wab/shared/Arenas";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import * as formMode from "@/wab/client/code-components/simplified-mode/Forms";
import { CanvasRegistrations } from "@/wab/client/components/canvas/canvas-registrations";
import type { CanvasCtx } from "@/wab/client/components/canvas/canvas-ctx";
import { SimplifiedCodeComponentModeSection } from "@/wab/client/components/sidebar-tabs/SimplifiedCodeComponentModeSection";
import type { SidebarSection } from "@/wab/client/components/sidebar/SidebarSection";
import type StyleSwitch from "@/wab/client/components/style-controls/StyleSwitch";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { ensureBaseVariantSetting, mkBaseVariant, mkVariantSetting } from "@/wab/shared/Variants";
import { CodeComponentsRegistry, mkCodeComponent, type ControlModePropType } from "@/wab/shared/code-components/code-components";
import { ensure } from "@/wab/shared/common";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { codeLit } from "@/wab/shared/core/exprs";
import { mkParam } from "@/wab/shared/core/lang";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplComponent } from "@/wab/shared/core/tpls";
import { Arg, CompositeExpr, TemplatedString, ensureKnownCustomCode } from "@/wab/shared/model/classes";
import { typeFactory } from "@/wab/shared/model/model-util";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { mock } from "vitest-mock-extended";
import { formComponentName } from "@plasmicpkgs/antd5/form-meta";

const painted = vi.hoisted(() => vi.fn());
vi.mock("@/wab/client/components/sidebar/SidebarSection", async (original) => ({
  ...await original<typeof import("@/wab/client/components/sidebar/SidebarSection")>(),
  SidebarSection: ({ children }: React.ComponentProps<typeof SidebarSection>) => <section>{typeof children === "function" ? null : children}</section>,
}));
vi.mock("@/wab/client/components/style-controls/StyleSwitch", () => ({
  default: ({ isChecked, onChange, children }: React.ComponentProps<typeof StyleSwitch>) => {
    painted();
    return <label><input type="checkbox" checked={isChecked} onChange={(event) => onChange?.(event.target.checked)} />{children}</label>;
  },
}));
const studios = new Set<StudioCtx>();
const registrations = new Set<CanvasRegistrations>();
const registryFrames = new Set<HTMLIFrameElement>();
afterEach(async () => {
  cleanup();
  registrations.forEach((owner) => owner.dispose()); registrations.clear();
  registryFrames.forEach((frame) => frame.remove()); registryFrames.clear();
  for (const studio of studios) { await studio.awaitEval(); studio.dispose(); }
  studios.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); painted.mockClear();
});

async function setup(name = "Modes") {
  const site = createSite();
  const component = mkCodeComponent(name, { name, importPath: "test", props: {} }, {});
  const param = mkParam({ name: "mode", type: typeFactory.text(), paramType: "prop", defaultExpr: codeLit("simplified") });
  const alternative = mkParam({ name: "alternative", type: typeFactory.text(), paramType: "prop", defaultExpr: codeLit("advanced") });
  component.params.push(param, alternative);
  const base = mkBaseVariant();
  const tpl = mkTplComponent(component, base);
  const owner = mkComponent({ name: "ModeOwner", type: ComponentType.Plain, variants: [base], tplTree: tpl });
  site.components.push(component, owner);
  const { studioCtx: studio } = fakeStudioCtx({ site, devFlagOverrides: { ccStubs: true } });
  studios.add(studio);
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  studio.observeComponents([component, owner]); studio.createViewStateUndoRecord();

  const props: Record<string, ControlModePropType<unknown> | "string"> = { mode: { type: "controlMode" } };
  const meta = { name, importPath: "test", props };
  const registryFrame = document.createElement("iframe");
  document.body.appendChild(registryFrame); registryFrames.add(registryFrame);
  const registryWindow = ensure(registryFrame.contentWindow, "Real frame registration window");
  Object.defineProperties(registryWindow, {
    __PlasmicComponentRegistry: { value: [{ component: () => null, meta }] },
    __PlasmicContextRegistry: { value: [] },
  });
  const registry = new CodeComponentsRegistry(registryWindow, {});
  const registration = new CanvasRegistrations(); registration.install(registry); registrations.add(registration);
  const canvas = mock<CanvasCtx>();
  Object.defineProperty(canvas, "registrations", { value: registration });
  canvas.getRegisteredCodeComponentsMap.mockImplementation(() => registry.getRegisteredCodeComponentsMap());
  const view = mock<ViewCtx>();
  Object.defineProperties(view, { studioCtx: { value: studio }, canvasCtx: { value: canvas }, disposeSignal: { value: new AbortController().signal } });
  view.getCodeComponentMeta.mockImplementation((value) => ViewCtx.prototype.getCodeComponentMeta.call(view, value));
  view.currentComponent.mockReturnValue(owner);
  view.getComponentEvalContext.mockReturnValue({ componentPropValues: {}, invalidArgs: [], ccContextData: undefined });
  view.change.mockImplementation((command) => { void studio.changeUnsafe(command); });
  return { studio, component, owner, tpl, param, alternative, meta, view, registry, registration,
    refresh: () => { registry.clear(); registration.refresh(); } };
}
function section(f: Awaited<ReturnType<typeof setup>>) {
  return <SimplifiedCodeComponentModeSection tpl={f.tpl} viewCtx={f.view} />;
}

it("follows literal/default and base argument expressions through real recorded transactions", async () => {
  const f = await setup();
  render(section(f));
  const input = screen.getByRole("checkbox");
  expect(input).toBeChecked();
  painted.mockClear();
  await act(async () => { await f.studio.changeUnsafe(() => { f.component.codeComponentMeta.description = "Unrelated metadata"; }); });
  expect(painted).not.toHaveBeenCalled();
  await act(async () => { await f.studio.changeUnsafe(() => { ensureKnownCustomCode(f.param.defaultExpr).code = '"advanced"'; }); });
  expect(input).not.toBeChecked();
  const expr = codeLit("simplified");
  await act(async () => { await f.studio.changeUnsafe(() => { ensureBaseVariantSetting(f.tpl).args.push(new Arg({ param: f.param, expr })); }); });
  expect(input).toBeChecked();
  await act(async () => { await f.studio.changeUnsafe(() => {
    ensureKnownCustomCode(f.param.defaultExpr).code = '"simplified"';
    expr.code = '("simplified")';
  }); });
  // An invalid/dynamic explicit arg never falls back to the simplified default.
  expect(input).not.toBeChecked();
  await act(async () => { await f.studio.changeUnsafe(() => { ensureBaseVariantSetting(f.tpl).args = []; }); });
  expect(input).toBeChecked();
  const text = new TemplatedString({ text: ["advanced"] });
  await act(async () => { await f.studio.changeUnsafe(() => { f.param.defaultExpr = text; }); });
  expect(input).not.toBeChecked();
  await act(async () => { await f.studio.changeUnsafe(() => { text.text[0] = "simplified"; }); });
  expect(input).toBeChecked();
  await act(async () => { await f.studio.changeUnsafe(() => { text.text.push(codeLit("simplified")); }); });
  expect(input).not.toBeChecked();
  await act(async () => { await f.studio.changeUnsafe(() => { f.param.defaultExpr = new CompositeExpr({ hostLiteral: '["simplified"]', substitutions: {} }); }); });
  expect(input).not.toBeChecked();
  await act(async () => { await f.studio.changeUnsafe(() => { f.param.defaultExpr = null; }); });
  expect(input).not.toBeChecked();
});

it("retargets params, variable names, argument params, and the selected base setting", async () => {
  const f = await setup(); render(section(f));
  const input = screen.getByRole("checkbox");
  await act(async () => { await f.studio.changeUnsafe(() => {
    f.param.variable.name = "formerMode";
    f.alternative.variable.name = "mode";
  }); });
  expect(input).not.toBeChecked();
  const arg = new Arg({ param: f.param, expr: codeLit("simplified") });
  await act(async () => { await f.studio.changeUnsafe(() => { ensureBaseVariantSetting(f.tpl).args.push(arg); }); });
  expect(input).not.toBeChecked();
  await act(async () => { await f.studio.changeUnsafe(() => { arg.param = f.alternative; }); });
  expect(input).toBeChecked();
  const previousBase = ensureBaseVariantSetting(f.tpl);
  const nextBase = mkVariantSetting({ variants: [...previousBase.variants], args: [new Arg({ param: f.alternative, expr: codeLit("advanced") })] });
  await act(async () => { await f.studio.changeUnsafe(() => { f.tpl.vsettings = [nextBase]; }); });
  expect(input).not.toBeChecked();
  await act(async () => { await f.studio.changeUnsafe(() => { f.tpl.vsettings = [previousBase]; }); });
  expect(input).toBeChecked();
});

it("subscribes to registration changes, catches a layout-time refresh, and keeps equal outputs quiet", async () => {
  const f = await setup();
  function RefreshBeforeSubscription() {
    React.useLayoutEffect(() => {
      delete f.meta.props.mode;
      f.meta.props.alternative = { type: "controlMode" };
      f.refresh();
    }, []);
    return null;
  }
  render(<>{section(f)}<RefreshBeforeSubscription /></>);
  const input = screen.getByRole("checkbox");
  expect(input).not.toBeChecked();
  painted.mockClear(); act(() => f.refresh());
  expect(painted).not.toHaveBeenCalled();
  act(() => { delete f.meta.props.alternative; f.meta.props.mode = { type: "controlMode" }; f.refresh(); });
  expect(input).toBeChecked();
});

it("dispatches the existing Form write command with the current parameter after an equal-output retarget", async () => {
  const f = await setup(formComponentName);
  const rewrite = vi.spyOn(formMode, "updateFormComponentMode").mockImplementation(() => undefined);
  await f.studio.changeUnsafe(() => { f.alternative.defaultExpr = codeLit("simplified"); });
  render(section(f));
  const input = screen.getByRole("checkbox");
  act(() => { delete f.meta.props.mode; f.meta.props.alternative = { type: "controlMode" }; f.refresh(); });
  expect(input).toBeChecked();
  fireEvent.click(input);
  await waitFor(() => expect(ensureBaseVariantSetting(f.tpl).args.find((arg) => arg.param === f.alternative)).toBeDefined());
  const arg = ensure(ensureBaseVariantSetting(f.tpl).args.find((value) => value.param === f.alternative), "Current mode argument");
  expect(ensureKnownCustomCode(arg.expr).code).toBe('"advanced"');
  expect(ensureBaseVariantSetting(f.tpl).args.some((value) => value.param === f.param)).toBe(false);
  expect(rewrite).toHaveBeenCalledWith(f.tpl, f.view, "advanced", undefined);
  expect(input).not.toBeChecked();
});

it("rebinds changed tpl/view props and releases inputs on unmount and abandoned render", async () => {
  const first = await setup("FirstModes"), second = await setup("SecondModes");
  await second.studio.changeUnsafe(() => { second.param.defaultExpr = codeLit("advanced"); });
  const firstField = first.studio.modelSnapshots.field(first.tpl, "component");
  const secondField = second.studio.modelSnapshots.field(second.tpl, "component");
  const subscribeFirst = firstField.subscribe.bind(firstField);
  const subscribeSecond = secondField.subscribe.bind(secondField);
  let firstListeners = 0, secondListeners = 0;
  let deliverFirstLate: (() => void) | undefined;
  const firstSubscribe = vi.spyOn(firstField, "subscribe").mockImplementation((notify) => {
    firstListeners++; const stop = subscribeFirst(notify);
    deliverFirstLate = () => notify(firstField.getState(), firstField.getState());
    return () => { firstListeners--; stop(); };
  });
  vi.spyOn(secondField, "subscribe").mockImplementation((notify) => {
    secondListeners++; const stop = subscribeSecond(notify);
    return () => { secondListeners--; stop(); };
  });
  const view = render(section(first));
  expect(screen.getByRole("checkbox")).toBeChecked();
  expect(firstListeners).toBe(1);
  view.rerender(section(second));
  expect(screen.getByRole("checkbox")).not.toBeChecked();
  expect(firstListeners).toBe(0); expect(secondListeners).toBe(1);
  deliverFirstLate?.();
  expect(firstListeners).toBe(0);
  painted.mockClear();
  await act(async () => { await first.studio.changeUnsafe(() => { ensureKnownCustomCode(first.param.defaultExpr).code = '"advanced"'; }); });
  expect(painted).not.toHaveBeenCalled();
  view.unmount();
  expect(firstListeners).toBe(0); expect(secondListeners).toBe(0);
  firstSubscribe.mockClear();
  const registrationSubscribe = vi.spyOn(first.registration.component(first.component.name), "subscribe");
  function Suspend(): React.ReactNode { throw new Promise<void>(() => undefined); }
  const abandoned = render(<React.Suspense fallback={<span>Suspended</span>}>{section(first)}<Suspend /></React.Suspense>);
  expect(screen.getByText("Suspended")).toBeTruthy();
  expect(firstSubscribe).not.toHaveBeenCalled(); expect(registrationSubscribe).not.toHaveBeenCalled();
  expect(firstListeners).toBe(0);
  abandoned.unmount(); painted.mockClear();
  act(() => { first.meta.props.other = "string"; first.refresh(); });
  await act(async () => { await second.studio.changeUnsafe(() => { ensureKnownCustomCode(second.param.defaultExpr).code = '"simplified"'; }); });
  expect(painted).not.toHaveBeenCalled();
});

it.each(["registration", "param"] as const)("keeps the original missing %s error", async (missing) => {
  const f = await setup();
  if (missing === "registration") { delete f.meta.props.mode; f.refresh(); }
  else { await f.studio.changeUnsafe(() => { f.component.params = []; }); }
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  expect(() => render(section(f))).toThrow(missing === "registration" ? `missing the control mode prop type for the component ${f.component.name}` : "component should have a mode param");
});


it.each([false, true])("seals the mounted control at actual View disposal before registration cleanup (beforeSubscribe=%s)", async (beforeSubscribe) => {
  const f = await setup();
  const frame = mkArenaFrame({ site: f.studio.site, component: f.owner, name: "Mode lifecycle", width: 300, height: 200 });
  const actualView = ensure(f.studio.tryGetViewCtxForFrame(frame), "Actual mode ViewCtx");
  const registration = actualView.canvasCtx.registrations;
  registration.install(f.registry);
  vi.mocked(actualView.canvasCtx.getRegisteredCodeComponentsMap).mockImplementation(() => f.view.canvasCtx.getRegisteredCodeComponentsMap());
  const field = f.studio.modelSnapshots.field(f.tpl, "component");
  const registrationInput = registration.component(f.component.name);
  const subscribeField = field.subscribe.bind(field);
  const subscribeRegistration = registrationInput.subscribe.bind(registrationInput);
  let fields = 0, keys = 0;
  let deliverLate: (() => void) | undefined;
  vi.spyOn(field, "subscribe").mockImplementation((notify) => {
    fields++; const stop = subscribeField(notify);
    return () => { fields--; stop(); };
  });
  vi.spyOn(registrationInput, "subscribe").mockImplementation((notify) => {
    keys++; const stop = subscribeRegistration(notify);
    deliverLate = () => notify(registrationInput.getState(), registrationInput.getState());
    return () => { keys--; stop(); };
  });
  const originalDispose = vi.mocked(actualView.canvasCtx.dispose).getMockImplementation();
  const disposedCanvas = vi.mocked(actualView.canvasCtx.dispose).mockImplementation(() => {
    // Actual ViewCtx aborts its lifetime before it disposes Canvas registrations.
    registration.dispose();
    deliverLate?.();
    originalDispose?.();
  });
  function DisposeBeforeSubscription() {
    React.useLayoutEffect(() => { actualView.dispose(); }, []);
    return null;
  }
  const contents = <><SimplifiedCodeComponentModeSection tpl={f.tpl} viewCtx={actualView} />{beforeSubscribe && <DisposeBeforeSubscription />}</>;
  const mounted = render(contents);
  if (!beforeSubscribe) {
    expect(fields).toBe(1); expect(keys).toBe(1);
    expect(() => actualView.dispose()).not.toThrow();
  }
  expect(actualView.disposeSignal.aborted).toBe(true);
  expect(disposedCanvas).toHaveBeenCalledOnce();
  expect(fields).toBe(0); expect(keys).toBe(0);
  expect(screen.getByRole("checkbox")).toBeChecked();
  const readFields = vi.spyOn(f.studio.modelSnapshots, "field");
  expect(() => deliverLate?.()).not.toThrow();
  mounted.rerender(contents);
  expect(screen.getByRole("checkbox")).toBeChecked();
  expect(readFields).not.toHaveBeenCalled();
  expect(fields).toBe(0); expect(keys).toBe(0);
  mounted.unmount();
});
