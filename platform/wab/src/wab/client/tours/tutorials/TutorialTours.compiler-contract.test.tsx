import { transformSync } from "@babel/core";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import * as Signals from "signals";
import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StudioTutorialTours, TopFrameTours, type TopFrameTourState } from "@/wab/client/tours/tutorials/TutorialTours";
import { StudioLeftPanelState } from "@/wab/client/studio-ctx/left-panel-state";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { AppCtx } from "@/wab/client/app-ctx";
import type { TopFrameApi } from "@/wab/client/frame-ctx/top-frame-api";
import { ensure } from "@/wab/shared/common";
import type { ProjectId } from "@/wab/shared/ApiSchema";
import { TutorialEventsType, type TutorialEvent } from "@/wab/client/tours/tutorials/tutorials-events";
import { reactCompilerOptions } from "../../../../../tools/react-compiler.mjs";

const fixture = vi.hoisted(() => ({
  studio: undefined as unknown as StudioCtx,
  topSignals: undefined as unknown as Signals.Signal<TutorialEvent>,
  track: vi.fn(), next: vi.fn(), waitNext: vi.fn(),
  api: {getStorageItem: vi.fn(), addStorageItem: vi.fn()},
  topFrameApi: {setKeepPublishModalOpen: vi.fn()},
}));
vi.mock("@/wab/client/contexts/StudioContexts", () => ({useStudioCtx: () => fixture.studio}));
vi.mock("@/wab/client/contexts/AppContexts", () => ({useApi: () => fixture.api, useTopFrameApi: () => fixture.topFrameApi}));
vi.mock("@/wab/client/components/TopFrame/TopFrameChrome", () => ({get topFrameTourSignals() {return fixture.topSignals;}}));
vi.mock("@/wab/client/tracking", () => ({trackEvent: fixture.track}));
vi.mock("@/wab/client/ErrorNotifications", () => ({reportError: vi.fn()}));
vi.mock("@/wab/client/components/widgets/Button", () => ({default: ({children, ...props}: React.ComponentProps<"button">) => <button {...props}>{children}</button>}));
vi.mock("@/wab/client/components/widgets/IconButton", () => ({default: ({children, onClick}: React.ComponentProps<"button">) => <button onClick={onClick}>{children}</button>}));
vi.mock("@/wab/client/utils/StandardMarkdown", () => ({StandardMarkdown: ({children}: {children: React.ReactNode}) => <>{children}</>}));
vi.mock("@/wab/client/components/quick-modals", () => ({reactConfirm: async () => false}));
vi.mock("@/wab/client/tours/tutorials/tutorials-helpers", () => ({waitElementToBeVisible: async () => undefined}));
vi.mock("react-joyride", () => ({Joyride: ({steps, stepIndex}: {steps: {content: React.ReactNode}[]; stepIndex: number}) => <div data-testid="compiled-tour-step">{steps[stepIndex]?.content}</div>}));
vi.mock("@/wab/client/tours/tutorials/tutorials-meta", () => {
  const steps = [
    {name: "contract-first", target: "#compiled-tour-target", content: "Contract first", nextButtonText: "Proceed", onNext: (...args: unknown[]) => fixture.next(...args)},
    {name: "contract-second", target: "#compiled-tour-target", content: "Contract second", nextButtonText: "Finish", waitFor: (...args: unknown[]) => fixture.waitNext(...args)},
  ];
  return {STUDIO_ONBOARDING_TUTORIALS: {contract: steps}, TOPFRAME_ONBOARDING_TUTORIALS: {contract: steps}};
});

const dispose: (() => void)[] = [];
beforeEach(() => {
  fixture.track.mockClear(); fixture.next.mockReset().mockResolvedValue(undefined); fixture.waitNext.mockReset().mockResolvedValue(undefined);
  fixture.api.getStorageItem.mockReset().mockResolvedValue(true);
  fixture.api.addStorageItem.mockReset().mockResolvedValue(undefined);
  fixture.topFrameApi.setKeepPublishModalOpen.mockReset().mockResolvedValue(undefined);
  fixture.topSignals = new Signals.Signal();
  const target = document.createElement("div"); target.id = "compiled-tour-target"; document.body.append(target);
  vi.spyOn(target, "getBoundingClientRect").mockReturnValue({width: 100, height: 40} as DOMRect);
  dispose.push(() => target.remove());
});
afterEach(() => {cleanup(); dispose.splice(0).forEach(stop => stop()); vi.restoreAllMocks();});

function owner() {
  const accountListeners = new Set<() => void>();
  const app = {selfInfo: {displayName: "Tour reader"}, appConfig: {templateTours: undefined, plasmicHostingSubdomainSuffix: "example.invalid"},
    subscribeUiEnvironmentInputs: (listener: () => void) => {accountListeners.add(listener); return () => {accountListeners.delete(listener);};},
  } as unknown as AppCtx;
  const panel = new StudioLeftPanelState();
  const signals: Signals.Signal<TutorialEvent> = new Signals.Signal();
  const setState = vi.fn((state: Parameters<StudioLeftPanelState["setOnboardingTourState"]>[0]) => panel.setOnboardingTourState(state));
  const studio = {appCtx: app, siteInfo: {id: "tour-project", clonedFromProjectId: undefined}, leftPanelState: panel,
    previewOwnerStore: createStore(() => undefined), tourActionEvents: signals,
    get onboardingTourState() {return panel.onboardingTourState;}, setOnboardingTourState: setState,
  } as unknown as StudioCtx;
  fixture.studio = studio;
  return {app, studio, panel, signals, setState, accountListeners};
}

it("actually compiles both Studio and top-frame entry fibers", () => {
  const filename = path.resolve(__dirname, "TutorialTours.tsx"), names: (string | null)[] = [];
  transformSync(fs.readFileSync(filename, "utf8"), {filename, babelrc: false, configFile: false, parserOpts: {plugins: ["typescript", "jsx"]},
    plugins: [["babel-plugin-react-compiler", reactCompilerOptions({logEvent: (_file, event) => {if (event.kind === "CompileSuccess") { names.push(event.fnName); }}})]],
  });
  expect(names).toEqual(expect.arrayContaining(["StudioTutorialTours", "TopFrameTours"]));
});

it("renders an inactive or invalid Studio tour without touching an absent step, then advances the real compiled popup and releases its signal", async () => {
  const state = owner();
  const mounted = render(<React.Suspense fallback={null}><StudioTutorialTours /></React.Suspense>);
  expect(mounted.container.textContent).toBe("");
  act(() => state.panel.setOnboardingTourState({tour: "missing", run: true, stepIndex: 0, flags: {}, triggers: []}));
  expect(mounted.container.textContent).toBe("");
  act(() => state.panel.setOnboardingTourState({tour: "contract", run: true, stepIndex: 99, flags: {}, triggers: []}));
  act(() => state.signals.dispatch({type: TutorialEventsType.FinishClicked, params: {}}));
  expect(mounted.container.textContent).toBe("");
  act(() => state.panel.setOnboardingTourState({tour: "contract", run: true, stepIndex: 0, flags: {}, triggers: []}));
  await waitFor(() => expect(screen.getByText("Contract first")).toBeDefined());
  expect(state.signals.getNumListeners()).toBe(1);
  fireEvent.click(ensure(document.querySelector<HTMLButtonElement>("#tour-primary-btn"), "Expected the active tour button"));
  await waitFor(() => expect(screen.getByText("Contract second")).toBeDefined());
  expect(fixture.next).toHaveBeenCalledOnce();
  expect(fixture.track).toHaveBeenCalledWith("studio-tour", expect.objectContaining({status: "completed", stepName: "contract-first"}));
  fireEvent.click(ensure(document.querySelector<HTMLButtonElement>("#tour-primary-btn"), "Expected the final tour button"));
  await waitFor(() => expect(state.panel.onboardingTourState.tour).toBe(""));
  expect(fixture.track).toHaveBeenCalledWith("studio-tour", expect.objectContaining({status: "finish", stepName: "contract-second"}));
  mounted.unmount(); expect(state.signals.getNumListeners()).toBe(0); expect(state.accountListeners.size).toBe(0);
});

it("keeps automatic Studio startup in the inactive owner and ignores a storage result after unmount", async () => {
  const state = owner();
  state.app.appConfig.templateTours = {"template-project": "contract"};
  state.studio.siteInfo.clonedFromProjectId = "template-project" as ProjectId;
  let complete: ((value: boolean) => void) | undefined;
  fixture.api.getStorageItem.mockImplementation(() => new Promise<boolean>(resolve => {complete = resolve;}));
  const mounted = render(<StudioTutorialTours />);
  await waitFor(() => expect(fixture.api.getStorageItem).toHaveBeenCalledOnce());
  mounted.unmount(); state.setState.mockClear();
  await act(async () => {complete?.(false); await Promise.resolve();});
  expect(state.setState).not.toHaveBeenCalled(); expect(state.accountListeners.size).toBe(0);
});

it("renders inactive/invalid top-frame tours and advances an active top-frame fiber without stale subscriptions", async () => {
  const state = owner();
  const store = createStore<TopFrameTourState>(() => ({tour: "", run: false, stepIndex: 0}));
  const changeTourState = vi.fn(async (next: TopFrameTourState) => {store.setState(next, true);});
  function Owner() {
    const tourState = useStore(store);
    return <React.Suspense fallback={null}><TopFrameTours appCtx={state.app} tourState={tourState} topFrameApi={fixture.topFrameApi as unknown as TopFrameApi} changeTourState={changeTourState} projectId={"tour-project" as ProjectId} /></React.Suspense>;
  }
  const mounted = render(<Owner />);
  expect(mounted.container.textContent).toBe("");
  act(() => store.setState({tour: "contract", run: true, stepIndex: 99}, true));
  act(() => fixture.topSignals.dispatch({type: TutorialEventsType.FinishClicked, params: {}}));
  expect(mounted.container.textContent).toBe("");
  act(() => store.setState({tour: "contract", run: true, stepIndex: 0}, true));
  await waitFor(() => expect(screen.getByText("Contract first")).toBeDefined());
  expect(fixture.topSignals.getNumListeners()).toBe(1);
  fireEvent.click(ensure(document.querySelector<HTMLButtonElement>("#tour-primary-btn"), "Expected the active tour button"));
  await waitFor(() => expect(screen.getByText("Contract second")).toBeDefined());
  expect(fixture.track).toHaveBeenCalledWith("studio-tour", expect.objectContaining({status: "completed", stepName: "contract-first"}));
  fireEvent.click(ensure(document.querySelector<HTMLButtonElement>("#tour-primary-btn"), "Expected the final top-frame tour button"));
  await waitFor(() => expect(store.getState().tour).toBe(""));
  expect(fixture.track).toHaveBeenCalledWith("studio-tour", expect.objectContaining({status: "finish", stepName: "contract-second"}));
  mounted.unmount(); expect(fixture.topSignals.getNumListeners()).toBe(0);
});

it("does not execute a next-step wait command after the top-frame RPC outlives its tour", async () => {
  const state = owner();
  const store = createStore<TopFrameTourState>(() => ({tour: "contract", run: true, stepIndex: 0}));
  let acknowledge: (() => void) | undefined;
  const pending = new Promise<void>(resolve => {acknowledge = resolve;});
  const changeTourState = vi.fn(async (next: TopFrameTourState) => {store.setState(next, true); if (!next.run) {await pending;}});
  function Owner() {
    const tourState = useStore(store);
    return <React.Suspense fallback={null}><TopFrameTours appCtx={state.app} tourState={tourState} topFrameApi={fixture.topFrameApi as unknown as TopFrameApi} changeTourState={changeTourState} projectId={"tour-project" as ProjectId} /></React.Suspense>;
  }
  const mounted = render(<Owner />);
  await waitFor(() => expect(screen.getByText("Contract first")).toBeDefined());
  fireEvent.click(ensure(document.querySelector<HTMLButtonElement>("#tour-primary-btn"), "Expected the active top-frame tour button"));
  await waitFor(() => expect(store.getState()).toEqual({tour: "contract", run: false, stepIndex: 1}));
  act(() => store.setState({tour: "", run: false, stepIndex: 0}, true));
  expect(fixture.topSignals.getNumListeners()).toBe(0);
  await act(async () => {ensure(acknowledge, "Expected the held RPC completion")(); await Promise.resolve();});
  expect(fixture.waitNext).not.toHaveBeenCalled();
  expect(changeTourState).toHaveBeenCalledTimes(1);
  expect(store.getState()).toEqual({tour: "", run: false, stepIndex: 0});
  mounted.unmount();
});
