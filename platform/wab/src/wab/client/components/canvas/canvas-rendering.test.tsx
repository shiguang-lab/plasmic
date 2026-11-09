import { createCanvasComponentType } from "../../../../../../canvas-packages/src/canvas-component-type";
import * as ReactWebRuntime from "@plasmicapp/react-web";
import { CanvasObserver } from "../../../../../../canvas-packages/src/canvas-observer";
import { CanvasRichTextFrame } from "../../../../../../canvas-packages/src/canvas-rich-text-frame";
import { CanvasErrorBoundary, CanvasErrorDisplay } from "../../../../../../canvas-packages/src/canvas-error";
import { globalHookCtx } from "@/wab/client/react-global-hook/globalHook";
import { StudioRenderPolicy } from "@/wab/client/studio-ctx/studio-render-policy";
import { CanvasFrameInfoOwner } from "@/wab/client/components/canvas/canvas-frame-info";
import { mkArenaFrame } from "@/wab/shared/Arenas";
import { CanvasRenderOwner } from "@/wab/client/components/canvas/canvas-cache";
import { CanvasRegistrations } from "@/wab/client/components/canvas/canvas-registrations";
import { CodeComponentsRegistry } from "@/wab/shared/code-components/code-components";
import { ViewSelection } from "@/wab/client/studio-ctx/view-selection";
import { ViewVariantState } from "@/wab/client/studio-ctx/view-variant-state";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { createStore } from "zustand/vanilla";
import {
  _testOnlyUtils,
  mkEventHandlerEnv,
  renderTplNode,
  RenderingCtx,
} from "@/wab/client/components/canvas/canvas-rendering";
import { SubDeps } from "@/wab/client/components/canvas/subdeps";
import { applyCanvasSessionState, CanvasSessionState } from "@/wab/client/components/canvas/canvas-session-state";
import { setTplVisibility, TplVisibility } from "@/wab/shared/visibility-utils";
import { interpolatedStringToTemplatedString } from "@/wab/shared/copilot/dynamic-value-input";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { createExprForDataPickerValue } from "@/wab/shared/core/exprs";
import { asCode, codeLit } from "@/wab/shared/core/exprs";
import { mkParam, mkVar } from "@/wab/shared/core/lang";
import { createSite } from "@/wab/shared/core/sites";
import { initBuiltinActions, mkInteraction } from "@/wab/shared/core/states";
import { mkTplComponentX, mkTplTagX, mkSlot, deepTrackComponents, flattenTpls } from "@/wab/shared/core/tpls";
import { mkVariantSetting } from "@/wab/shared/Variants";
import { mkDataSourceTemplate } from "@/wab/shared/data-sources-meta/data-sources";
import {
  Arg,
  CodeComponentMeta,
  Component,
  ComponentDataQuery,
  ComponentServerQuery,
  CustomCode,
  CompositeExpr,
  FunctionExpr,
  MapExpr,
  CustomFunction,
  CustomFunctionExpr,
  DataSourceOpExpr,
  EventHandler,
  GenericEventHandler,
  FunctionArg,
  RenderExpr,
  Rep,
  TplNode,
} from "@/wab/shared/model/classes";
import { EffectiveVariantSetting } from "@/wab/shared/effective-variant-setting";
import { typeFactory } from "@/wab/shared/model/model-util";
import { ensure } from "@/wab/shared/common";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { canvasRefCommands, evalCodeWithEnv } from "@/wab/shared/eval";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { QueryComponentNode, usePlasmicQueries } from "@plasmicapp/data-sources";
import { $StateSpec, get, set, useDollarState, useDollarStateSnapshot, useDollarStateQueryInput, usePlasmicRefs, getStateCommandValue } from "@plasmicapp/react-web";
import { act, fireEvent, render } from "@testing-library/react";
import React from "react";
import { ConfigProvider, Table, Tooltip } from "antd";
import { waitFor } from "@testing-library/react";

import { CanvasQueriesRuntime } from "../../../../../../react-web-bundle/src/canvas-queries";
const queryRuntimeMock = vi.hoisted(() => ({ implementation: undefined as SubDeps["dataSources"] | undefined }));
vi.mock("@plasmicapp/react-web/lib/data-sources", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@plasmicapp/react-web/lib/data-sources")>();
  return {
    ...actual,
    usePlasmicQueries: (...args: Parameters<typeof actual.usePlasmicQueries>) => queryRuntimeMock.implementation?.usePlasmicQueries?.(...args) ?? actual.usePlasmicQueries(...args),
    usePlasmicDataOp: (...args: Parameters<typeof actual.usePlasmicDataOp>) => queryRuntimeMock.implementation?.usePlasmicDataOp?.(...args) ?? actual.usePlasmicDataOp(...args),
  };
});

const queryOutputs = new WeakMap<RenderingCtx, RenderingCtx>();
const renderedQueryEnv = (ctx: RenderingCtx) => ensure(queryOutputs.get(ctx), "The native query state view must render").env;
function NativeQueryHarness({ sub, ctx, component }: { sub: SubDeps; ctx: RenderingCtx; component: Component }) {
  queryRuntimeMock.implementation = sub.dataSources;
  const commands = useDollarState();
  const state = useDollarStateQueryInput(commands, ctx.env, ctx.stateSpecs);
  const context = { ...ctx, env: { ...ctx.env, $state: state }, wrappingEnv: { ...ctx.env, $state: state } };
  const base = _testOnlyUtils.createCanvasQueryController(ctx.viewCtx, component, _testOnlyUtils.serverQueryRegistrationKey(component));
  const controller = React.useMemo(() => ({ ...base, renderInput(current: RenderingCtx) {
    queryOutputs.set(ctx, current);
    return { getState: () => null, getInitialState: () => null, subscribe: () => () => undefined, commit() {}, dispose() {} };
  } }), [base, ctx]);
  return <CanvasQueriesRuntime controller={controller} context={context} />;
}

function installRenderOwner(view: ViewCtx, site: ReturnType<typeof createSite>, component: Component) {
  const models = new ModelSnapshots(), session = new CanvasSessionState();
  const owner = new CanvasRenderOwner(session), selection = new ViewSelection(() => models);
  const lifetime = new AbortController();
  const frame = mkArenaFrame({ site, component, name: "Render fixture", width: 800, height: 600 });
  const frameState = globalHookCtx.createFrameState({ uid: frame.uid, objectPrototype: Object.prototype });
  const variants = new ViewVariantState(() => models, () => frame, () => site, () => false, () => false);
  Object.assign(view.studioCtx, { site, modelSnapshots: models, draggingObjectStore: createStore(() => false),
    hasPendingModelChanges: () => false, subscribeModelChanges: () => () => undefined });
  Object.assign(view, { canvasRenderOwner: owner, canvasSessionState: session, site, component,
    disposeSignal: lifetime.signal, isDisposed: false, arenaFrame: () => frame,
    selectionStore: selection.store, variantStore: variants.store,
    frameState,
    currentComponent: () => component, valComponentStack: () => [], componentStackFrames: () => [], showDefaultSlotContents: () => false });
  return () => { lifetime.abort(); owner.dispose(); session.dispose(); selection.dispose(); variants.dispose(); models.dispose(); frameState.dispose(); };
}

it.each([TplVisibility.NotRendered, TplVisibility.CustomExpr, TplVisibility.DisplayNone, "css-display-none"] as const)(
  "retains a selected hidden region across canvas modes and excludes it from exports: %s",
  (visibility) => {
    const site = createSite();
    const component = mkEmptyComponent();
    site.components.push(component);
    const node = component.tplTree;
    const base = [component.variants[0]];
    if (visibility === "css-display-none") {
      setTplVisibility(node, base, TplVisibility.Visible);
      node.vsettings[0].rs.values.display = "none";
    } else {
      setTplVisibility(node, base, visibility);
    }
    if (visibility === TplVisibility.CustomExpr) {node.vsettings[0].dataCond = codeLit(false);}
    const renderPolicy = new StudioRenderPolicy({ isLive: () => false, isDragging: () => false });
    let exporting = false;
    const snapshots = new ModelSnapshots();
    const selection = new ViewSelection(() => snapshots);
    const variants = new ViewVariantState(() => snapshots, () => { throw new Error("This isolated visibility test has no artboard"); }, () => site, () => false, () => false);
    selection.setTpls([node]);
    const session = new CanvasSessionState();
    const owner = new CanvasRenderOwner(session);
    const frame = mkArenaFrame({ site, component, width: 800, height: 600, name: "Visibility" });
    const viewCtx = {
      canvasSessionState: session, canvasRenderOwner: owner, get canvasExporting() { return exporting; },
      site, arenaFrame: () => frame,
      variantStore: variants.store,
      selection, selectionStore: selection.store, frameState: { valRootStore: createStore(() => null) },
      currentComponent: () => component, valComponentStack: () => [], componentStackFrames: () => [], showDefaultSlotContents: () => false,
      studioCtx: { draggingObjectStore: createStore<boolean>(() => false), modelSnapshots: snapshots, subscribeModelChanges: () => () => undefined, hasPendingModelChanges: () => false, renderPolicy, get isInteractiveMode() { return renderPolicy.interactive; }, isAutoOpenMode: true },
      focusedTplAncestorsThroughComponents: () => [{ node, layer: 0 }],
      canvasCtx: { win: () => window, frameInfo: () => frameInfo.store },
    } as unknown as ViewCtx;
    const frameInfo = new CanvasFrameInfoOwner(viewCtx);
    const ctx = { valKey: node.uuid, env: {}, viewCtx, site, ownerComponent: component, projectFlags: DEVFLAGS } as unknown as RenderingCtx;
    const read = () => _testOnlyUtils.determineAutoOpenState(ctx, node, new EffectiveVariantSetting(node, node.vsettings, site));
    const before = JSON.stringify(node.vsettings);
    expect(read().autoOpened).toBe(true);
    if (visibility === "css-display-none") {expect(read().style?.display).toBe("revert");}
    renderPolicy.interactive = true; renderPolicy.prepareInputs();
    expect(read().autoOpened).toBe(true);
    renderPolicy.interactive = false; renderPolicy.prepareInputs();
    expect(read().autoOpened).toBe(true);
    exporting = true; frameInfo.sync();
    expect(read().autoOpened).toBe(false);
    if (visibility === TplVisibility.DisplayNone || visibility === "css-display-none") {expect(read().style).toBeUndefined();}
    else {expect(read().rendered).toBe(false);}
    expect(JSON.stringify(node.vsettings)).toBe(before);
    exporting = false; frameInfo.sync();
    expect(read().autoOpened).toBe(true);
    frameInfo.dispose(); owner.dispose(); renderPolicy.dispose(); session.dispose(); selection.dispose(); variants.dispose(); snapshots.dispose();
  },
);

it("starts each root from its artboard variant and preserves runtime state when interaction is turned off", async () => {
  const site = createSite();
  const tplMgr = new TplMgr({ site });
  const component = tplMgr.addComponent({ name: "Tabs", type: ComponentType.Plain });
  const group = tplMgr.createVariantGroup({ component, name: "Tab" });
  tplMgr.createVariant(component, group, "First");
  tplMgr.createVariant(component, group, "Second");
  const state = ensure(group.linkedState, "Missing linked variant state");
  state.param.defaultExpr = new CustomCode({ code: '"first"', fallback: null });
  const exprCtx = { component, projectFlags: DEVFLAGS, inStudio: true };
  let interactive = true;
  const viewCtx = {
    component, currentComponent: () => component,
    studioCtx: { get isInteractiveMode() { return interactive; } },
    canvasCtx: { win: () => window }, site,
  } as unknown as ViewCtx;
  function Artboard({ preset }: { preset: string }) {
    const env = { $props: { tab: preset }, $ctx: {}, $queries: {}, $q: {} };
    const commands = useDollarState();
    const $state = useDollarStateSnapshot(commands, env, [{
      path: "tab", type: "private", variableType: "variant",
      initFunc: _testOnlyUtils.mkInitFunc(state, [], viewCtx, env, exprCtx),
      initFuncHash: _testOnlyUtils.mkInitFuncHash(state, [], viewCtx, exprCtx),
    }]);
    return <button onClick={() => { commands.tab = "first"; }}>{$state.tab}</button>;
  }
  const view = render(<Artboard preset="second" />);
  expect(view.getByRole("button").textContent).toBe("second");
  await act(async () => fireEvent.click(view.getByRole("button")));
  expect(view.getByRole("button").textContent).toBe("first");
  interactive = false;
  view.rerender(<Artboard preset="second" />);
  expect(view.getByRole("button").textContent).toBe("first");
  view.unmount();
});

function mkEmptyComponent(): Component {
  return mkComponent({
    name: "WithQueries",
    type: ComponentType.Plain,
    tplTree: (baseVariant) => mkTplTagX("div", { baseVariant }),
  });
}

/** A legacy dataQuery whose args read `binding`. */
function mkLegacyDataQuery(binding = "{{ $q.myQuery.data }}", name = "Legacy") {
  return new ComponentDataQuery({
    uuid: `dq-${name}`,
    name,
    op: new DataSourceOpExpr({
      parent: undefined,
      sourceId: "src1",
      opId: "op1",
      opName: "getList",
      templates: {
        filters: mkDataSourceTemplate({
          fieldType: "filter[]",
          value: interpolatedStringToTemplatedString(binding),
          bindings: null,
        }),
      },
      cacheKey: undefined,
      queryInvalidation: undefined,
      roleId: undefined,
    }),
  });
}

function mkFetchFunction() {
  return new CustomFunction({
    importPath: "@plasmicpkgs/fetch",
    importName: "fetch",
    defaultExport: false,
    namespace: "plasmic",
    displayName: "Fetch",
    params: [typeFactory.arg("url", typeFactory.text())],
    isQuery: true,
    isMutation: false,
  });
}

/** A server query backed by a custom function, i.e. one needing a registration. */
function mkFunctionServerQuery(fn: CustomFunction) {
  return new ComponentServerQuery({
    uuid: "sq1",
    name: "My Query",
    op: new CustomFunctionExpr({
      func: fn,
      args: [
        new FunctionArg({
          uuid: "fa1",
          argType: fn.params[0],
          expr: interpolatedStringToTemplatedString("{{ $ctx.api }}"),
        }),
      ],
    }),
  });
}

function mkEnv() {
  return {
    $props: {},
    $ctx: {},
    $$: {},
    $queries: {},
    $q: {},
    $state: {},
  } as any;
}

function mkCtx(
  env: ReturnType<typeof mkEnv>,
  registeredFunctions: Map<string, any>,
  stateSpecs: $StateSpec<any>[] = [],
) {
  const registrations = new CanvasRegistrations();
  const source = Object.assign(new CodeComponentsRegistry(globalThis, {}), {
    getRegisteredFunctionsMap: vi.fn().mockReturnValue(registeredFunctions),
    getRegisteredComponentsAndContextsMap: vi.fn().mockReturnValue(new Map()),
    getRegisteredLibrariesMap: vi.fn().mockReturnValue(new Map()),
  });
  registrations.install(source);
  return {
    env,
    projectFlags: {},
    stateSpecs,
    setDollarQ: vi.fn(),
    setDollarQueries: vi.fn(),
    viewCtx: {
      isDisposed: false,
      disposeSignal: new AbortController().signal,
      canvasCtx: {
        registrations,
        win: () => window,
        getRegisteredFunctionsMap: () => registeredFunctions,
      },
      studioCtx: {
        renderPolicy: new StudioRenderPolicy({ isLive: () => false, isDragging: () => false }),
        executeServerQuery: (_id: string, fn: any, ...args: any[]) =>
          fn(...args),
      },
    },
  } as unknown as RenderingCtx;
}

describe("native component query fibers", () => {
  it("retains the ref command capability through server and legacy queries into the final state commit", async () => {
    const component = mkEmptyComponent();
    component.serverQueries.push(new ComponentServerQuery({ uuid: "ref-query", name: "My Query", op: new CustomCode({ code: "(async () => [1, 2])", fallback: null }) }));
    component.dataQueries.push(mkLegacyDataQuery());
    const mutated = vi.fn();
    const base = mkCtx(mkEnv(), new Map(), [{ path: "data", type: "private", variableType: "object", initVal: { count: 0 }, refName: "target", onMutate: (value, ref) => mutated(value.count, ref.label) }]);
    const legacyInputs = vi.fn();
    const sub = { React, dataSources: {
      usePlasmicQueries: () => ({ myQuery: { data: [1, 2], isLoading: false } }),
      usePlasmicDataOp: (evaluate: (() => any) | undefined) => { legacyInputs(evaluate?.()); return { isLoading: false, data: undefined }; },
    } } as unknown as SubDeps;
    const Child = React.forwardRef<{ label: string }, { label: string }>(function Child({ label }, ref) {
      React.useImperativeHandle(ref, () => ({ label }));
      return null;
    });
    let context: RenderingCtx | undefined;
    function Harness({ label }: { label: string }) {
      const { getRefs, registerRef } = usePlasmicRefs();
      const ctx = React.useMemo(() => ({ ...base, getRefs }), [getRefs]);
      context = ctx;
      return <><Child label={label} ref={registerRef("target")} /><NativeQueryHarness sub={sub} ctx={ctx} component={component} /></>;
    }
    const mounted = render(<React.StrictMode><Harness label="first" /></React.StrictMode>);
    const commands = getStateCommandValue(renderedQueryEnv(ensure(context, "Query context did not render")).$state);
    await act(async () => { commands.data.count = 1; });
    expect(mutated).toHaveBeenLastCalledWith(1, "first");
    mounted.rerender(<React.StrictMode><Harness label="second" /></React.StrictMode>);
    await act(async () => { commands.data.count = 2; });
    expect(mutated).toHaveBeenLastCalledWith(2, "second");
    expect(renderedQueryEnv(ensure(context, "Query context did not render")).$state.data.count).toBe(2);
    expect(legacyInputs).toHaveBeenCalled();
    expect(renderedQueryEnv(ensure(context, "Query context did not render")).getRefs).toBeUndefined();
  });

  it("seeds $q before initializing states that read it, and both before legacy ops", async () => {
    const component = mkEmptyComponent();
    component.serverQueries.push(
      new ComponentServerQuery({
        uuid: "sq1",
        name: "My Query",
        op: new CustomCode({ code: "(async () => [1, 2])", fallback: null }),
      }),
    );
    // A mid-migrating project with a legacy op that reads a migrated server query.
    component.dataQueries.push(mkLegacyDataQuery());

    const resolved: { op?: any; err?: unknown }[] = [];
    const env = mkEnv();
    // A supported state initializer that reads a server query result.
    const stateSpecs: $StateSpec<any>[] = [
      {
        path: "fromQuery",
        type: "private",
        variableType: "array",
        initFunc: ({ $q }) => $q.myQuery.data,
      },
    ];
    const ctx = mkCtx(env, new Map(), stateSpecs);

    const sub = {
      React,
      dataSources: {
        // The server query has already settled by the time this renders.
        usePlasmicQueries: () => ({
          myQuery: { data: [1, 2], isLoading: false },
        }),
        // Mirrors resolveDataOp() in @plasmicapp/data-sources: it evaluates the
        // op during render and swallows any throw into a null op.
        usePlasmicDataOp: (dataOp: (() => any) | undefined) => {
          try {
            resolved.push({ op: dataOp?.() });
          } catch (err) {
            resolved.push({ err });
          }
          return { isLoading: false, data: undefined };
        },
      },
    } as unknown as SubDeps;

    function Harness() {
      return <NativeQueryHarness sub={sub} ctx={ctx} component={component} />;
    }
    await act(async () => {
      render(<Harness />);
    });

    // The state initializer saw the settled query rather than an empty $q.
    expect(renderedQueryEnv(ctx).$state.fromQuery).toEqual([1, 2]);
    // ...and so did the legacy op, which runs after both, on every render.
    expect(resolved.map((r) => r.err)).toEqual(resolved.map(() => undefined));
    expect(resolved[resolved.length - 1].op).toMatchObject({
      sourceId: "src1",
      opId: "op1",
      userArgs: { filters: [[1, 2]] },
    });
    expect(renderedQueryEnv(ctx).$q).toEqual({ myQuery: { data: [1, 2], isLoading: false } });
    expect(ctx.setDollarQ).toHaveBeenCalledWith({
      myQuery: { data: [1, 2], isLoading: false },
    });
  });

  it("seeds $queries before initializing a state that reads it, while the legacy op still reads $state", async () => {
    const component = mkEmptyComponent();
    component.dataQueries.push(mkLegacyDataQuery("{{ $state.filter }}"));

    const resolved: { op?: any; err?: unknown }[] = [];
    const env = mkEnv();
    const stateSpecs: $StateSpec<any>[] = [
      {
        path: "filter",
        type: "private",
        variableType: "text",
        initFunc: () => "sport",
      },
      {
        path: "fromLegacy",
        type: "private",
        variableType: "array",
        initFunc: ({ $queries }) => $queries.legacy.data,
      },
    ];
    const ctx = mkCtx(env, new Map(), stateSpecs);

    const sub = {
      React,
      dataSources: {
        usePlasmicQueries: () => ({}),
        usePlasmicDataOp: (dataOp: (() => any) | undefined) => {
          try {
            resolved.push({ op: dataOp?.() });
          } catch (err) {
            resolved.push({ err });
          }
          return { isLoading: false, data: [3, 4] };
        },
      },
    } as unknown as SubDeps;

    function Harness() {
      return <NativeQueryHarness sub={sub} ctx={ctx} component={component} />;
    }
    await act(async () => {
      render(<Harness />);
    });

    // The state initializer saw the seeded legacy query rather than an empty
    // $queries, which would have made `.data` a TypeError and killed the render.
    expect(renderedQueryEnv(ctx).$state.fromLegacy).toEqual([3, 4]);
    // The op read $state through the lazily-initializing proxy.
    expect(resolved.map((r) => r.err)).toEqual(resolved.map(() => undefined));
    expect(resolved[resolved.length - 1].op).toMatchObject({
      userArgs: { filters: ["sport"] },
    });
  });

  it("gives a legacy op the results of the legacy queries before it", async () => {
    const component = mkEmptyComponent();
    component.dataQueries.push(
      mkLegacyDataQuery("{{ $state.filter }}", "First"),
    );
    component.dataQueries.push(
      mkLegacyDataQuery("{{ $queries.first.data }}", "Second"),
    );

    const resolved: { op?: any; err?: unknown }[] = [];
    const env = mkEnv();
    const stateSpecs: $StateSpec<any>[] = [
      {
        path: "filter",
        type: "private",
        variableType: "text",
        initFunc: () => "sport",
      },
    ];
    const ctx = mkCtx(env, new Map(), stateSpecs);

    const sub = {
      React,
      dataSources: {
        usePlasmicQueries: () => ({}),
        usePlasmicDataOp: (dataOp: (() => any) | undefined) => {
          const idx = resolved.length;
          try {
            resolved.push({ op: dataOp?.() });
          } catch (err) {
            resolved.push({ err });
          }
          return { isLoading: false, data: [`q${idx}`] };
        },
      },
    } as unknown as SubDeps;

    function Harness() {
      return <NativeQueryHarness sub={sub} ctx={ctx} component={component} />;
    }
    await act(async () => {
      render(<Harness />);
    });

    // Second read First's result from this same render, not the previous one's.
    expect(resolved.map((r) => r.err)).toEqual(resolved.map(() => undefined));
    expect(resolved[0].op).toMatchObject({ userArgs: { filters: ["sport"] } });
    expect(resolved[1].op).toMatchObject({ userArgs: { filters: [["q0"]] } });
  });

  describe("late custom function registration", () => {
    /**
     * Renders through the real `usePlasmicQueries`, which runs a `usePlasmicQuery`
     * (and therefore React hooks) per query in the tree.
     */
    function setup() {
      const component = mkEmptyComponent();
      component.serverQueries.push(mkFunctionServerQuery(mkFetchFunction()));

      // Empty on a cold load: the host hasn't run its registrations yet.
      const registeredFunctions = new Map<string, any>();
      const env = mkEnv();
      const ctx = mkCtx(env, registeredFunctions);

      const sub = {
        React,
        dataSources: {
          usePlasmicQueries,
          usePlasmicDataOp: () => ({ isLoading: false, data: undefined }),
        },
      } as unknown as SubDeps;

      function Fetcher() {
        return <NativeQueryHarness sub={sub} ctx={ctx} component={component} />;
      }

      return {
        component,
        ctx,
        env,
        Fetcher,
        register: () => {
          registeredFunctions.set("plasmic.fetch", { function: async () => [1, 2], meta: { name: "fetch", params: [] } });
          ctx.viewCtx.canvasCtx.registrations.refresh();
        },
      };
    }

    it("adds a newly registered query on its native executor fiber", async () => {
      const { ctx, Fetcher, register } = setup();

      // Native query execution owns the identity of its query set.
      function Harness() {
        return (
          <Fetcher />
        );
      }

      const { rerender } = render(<Harness />);
      expect(Object.keys(renderedQueryEnv(ctx).$q)).toEqual([]);

      // The registration completes and the canvas re-renders.
      act(() => register());
      await act(async () => {
        rerender(<Harness />);
      });
      expect(Object.keys(renderedQueryEnv(ctx).$q)).toEqual(["myQuery"]);
    });

    it("keeps Hook order when the outer fetcher retains its identity", () => {
      // Same component instance across both renders, i.e. no remount.
      const { ctx, Fetcher, register } = setup();
      const { rerender } = render(<Fetcher />);

      act(() => register());
      // The inner executor mounts its new Hook shape while this outer fiber stays mounted.
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      try {
        expect(() => rerender(<Fetcher />)).not.toThrow();
        expect(Object.keys(renderedQueryEnv(ctx).$q)).toEqual(["myQuery"]);
        expect(consoleError.mock.calls.flat().join("\n")).not.toMatch(
          /change in the order of Hooks/,
        );
      } finally {
        consoleError.mockRestore();
      }
    });

    it("remounts through native registration notifications without an external rerender", async () => {
      const { ctx, Fetcher, register } = setup();
      function Harness() {
        return <Fetcher />;
      }
      const view = render(<Harness />);
      expect(Object.keys(renderedQueryEnv(ctx).$q)).toEqual([]);
      await act(async () => { register(); ctx.viewCtx.canvasCtx.registrations.refresh(); });
      expect(Object.keys(renderedQueryEnv(ctx).$q)).toEqual(["myQuery"]);
      view.unmount(); ctx.viewCtx.canvasCtx.registrations.dispose();
    });
  });

  it("rebuilds a same-id query's captured implementation and detaches its keyed subscription", async () => {
    const component = mkEmptyComponent(); component.serverQueries.push(mkFunctionServerQuery(mkFetchFunction()));
    const first = vi.fn(async () => ["first"]), second = vi.fn(async () => ["second"]);
    const registrations = new Map([ ["plasmic.fetch", { function: first, meta: { name: "fetch", params: [] } }] ]);
    const ctx = mkCtx(mkEnv(), registrations);
    const queryTrees = vi.fn((tree: QueryComponentNode) => { void tree; return {}; });
    const sub = { React, dataSources: { usePlasmicQueries: queryTrees } } as unknown as SubDeps;
    function Harness() { return <NativeQueryHarness sub={sub} ctx={ctx} component={component} />; }
    const view = render(<Harness />);
    const before = ensure(queryTrees.mock.lastCall?.[0], "The query tree must be supplied");
    await expect(before.queries.myQuery.fn()).resolves.toEqual(["first"]);
    registrations.set("plasmic.fetch", { function: second, meta: { name: "fetch", params: [] } });
    act(() => ctx.viewCtx.canvasCtx.registrations.refresh());
    const after = ensure(queryTrees.mock.lastCall?.[0], "The replacement query tree must be supplied");
    expect(after).not.toBe(before);
    await expect(after.queries.myQuery.fn()).resolves.toEqual(["second"]);
    expect(first).toHaveBeenCalledTimes(1); expect(second).toHaveBeenCalledTimes(1);
    const count = queryTrees.mock.calls.length;
    act(() => ctx.viewCtx.canvasCtx.registrations.refresh());
    expect(queryTrees).toHaveBeenCalledTimes(count);
    view.unmount();
    registrations.set("plasmic.fetch", { function: first, meta: { name: "fetch", params: [] } });
    ctx.viewCtx.canvasCtx.registrations.refresh();
    expect(queryTrees).toHaveBeenCalledTimes(count);
    ctx.viewCtx.canvasCtx.registrations.dispose();
  });
});

describe("code component slot defaults on canvas", () => {
  it.each([ComponentType.Code, ComponentType.Plain])(
    "preserves empty-slot semantics for %s and explicit null",
    (type) => {
      const param = mkParam({
        name: "suffixIcon",
        type: typeFactory.renderable(),
        paramType: "slot",
      });
      const component = mkComponent({
        name: "Select",
        type,
        params: [param],
        codeComponentMeta:
          type === ComponentType.Code
            ? ({
                importPath: "antd",
                importName: "Select",
                defaultExport: false,
              } as CodeComponentMeta)
            : null,
        tplTree: (baseVariant) => mkTplTagX("div", { baseVariant }),
      });
      const tpl = mkTplComponentX({
        component,
        baseVariant: component.variants[0],
        args: { suffixIcon: new RenderExpr({ tpl: [] }) },
      });
      const ctx = mkCtx(mkEnv(), new Map());
      Object.assign(ctx.viewCtx, {
        componentArgsContainer: () => undefined,
        componentStackFrames: () => [],
      });
      Object.assign(ctx.viewCtx.canvasCtx, {
        getRegisteredCodeComponentsAndContextsMap: () => new Map(),
      });
      const empty = _testOnlyUtils.computeTplComponentArgs(
        tpl,
        { args: tpl.vsettings[0].args, attrs: {} } as any,
        ctx,
      );
      expect(empty.suffixIcon).toBe(
        type === ComponentType.Code ? undefined : null,
      );
      tpl.vsettings[0].args[0].expr = new CustomCode({
        code: "(null)",
        fallback: null,
      });
      const explicit = _testOnlyUtils.computeTplComponentArgs(
        tpl,
        { args: tpl.vsettings[0].args, attrs: {} } as any,
        ctx,
      );
      expect(explicit.suffixIcon).toBeNull();
      tpl.vsettings[0].args[0].expr = codeLit("新建模板");
      const primitive = _testOnlyUtils.computeTplComponentArgs(
        tpl,
        { args: tpl.vsettings[0].args, attrs: {} } as any,
        ctx,
      );
      expect(primitive.suffixIcon).toBe("新建模板");
    },
  );
});

describe("authored canvas click interactions", () => {
  beforeEach(() => {
    vi.stubGlobal("__PLASMIC_CACHE_EVENT_ARGS", vi.fn());
    vi.stubGlobal("__PLASMIC_CACHE_$STEP_VALUE", vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  function setup() {
    const env = mkEnv();
    env.$state.basicOpen = false;
    env.$state.viewer = { id: "operator", role: "operator" };
    const ctx = mkCtx(env, new Map());
    initBuiltinActions({ projectId: "canvas-click", platform: "react", projectFlags: ctx.projectFlags, inStudio: true });
    Object.assign(ctx, { sub: { reactWeb: ReactWebRuntime } });
    Object.assign(ctx.viewCtx.studioCtx, {
      executePlasmicDataOp: vi.fn(),
      tplMgr: () => ({ findInteractionByUuid: () => undefined }),
    });
    Object.defineProperty(ctx.viewCtx.studioCtx, "isInteractiveMode", { get: () => ctx.viewCtx.studioCtx.renderPolicy.interactive, set: (value: boolean) => { ctx.viewCtx.studioCtx.renderPolicy.interactive = value; ctx.viewCtx.studioCtx.renderPolicy.prepareInputs(); } });
    Object.assign(ctx.viewCtx, {
      componentArgsContainer: () => undefined,
      componentStackFrames: () => [],
    });
    Object.assign(ctx.viewCtx.canvasCtx, {
      getRegisteredCodeComponentsAndContextsMap: () => new Map(),
    });
    const handler = new EventHandler({ interactions: [] });
    handler.interactions.push(mkInteraction(handler, "customFunction", "Open create", {
      customFunction: createExprForDataPickerValue('const viewer = $state.viewer; if (!viewer.id || !["operator", "strategist"].includes(viewer.role)) return; $state.basicOpen = true;', null, true, []),
    }));
    return { ctx, env, handler };
  }

  it("creates nested event handlers without reading refs and resolves parameter shadowing when they run", async () => {
    const { ctx, env } = setup();
    env.item = "original";
    env.$state.observed = [];
    const refs = { target: { read: () => "first" } };
    const readRefs = vi.fn(() => refs);
    Object.assign(ctx, { getRefs: readRefs });
    env[canvasRefCommands] = readRefs;
    const handler = new GenericEventHandler({ interactions: [], handlerType: typeFactory.func(typeFactory.arg("event", typeFactory.any())) });
    handler.interactions.push(mkInteraction(handler, "customFunction", "Read ref", {
      customFunction: createExprForDataPickerValue("$state.observed.push([item, $refs.target.read()]);", null, true, []),
    }));
    const expression = new FunctionExpr({ argNames: ["item"], bodyExpr: new FunctionExpr({
      argNames: ["item"], bodyExpr: new CompositeExpr({
        hostLiteral: '{"label": null, "events": null}',
        substitutions: { label: new CustomCode({ code: "(item)", fallback: null }), events: new MapExpr({ mapExpr: { click: handler } }) },
      }),
    }) });
    const param = mkParam({ name: "renderItem", type: typeFactory.any(), paramType: "prop" });
    const component = mkComponent({ name: "Nested", type: ComponentType.Code, params: [param],
      codeComponentMeta: { importPath: "./Nested", importName: "Nested", defaultExport: false } as CodeComponentMeta,
      tplTree: (baseVariant) => mkTplTagX("div", { baseVariant }),
    });
    const tpl = mkTplComponentX({ component, baseVariant: component.variants[0], args: { renderItem: expression } });
    ctx.ownerComponent = mkComponent({ name: "Page", type: ComponentType.Plain, tplTree: tpl });
    const props = _testOnlyUtils.computeTplComponentArgs(tpl, { args: tpl.vsettings[0].args, attrs: {} } as any, ctx);
    const inner = props.renderItem("outer"), row = inner("inner");
    expect(row.label).toBe("inner");
    expect(env.item).toBe("original");
    expect(readRefs).not.toHaveBeenCalled();
    expect(Object.keys(env)).not.toContain("getRefs");
    expect(Object.keys(env)).not.toContain("$refs");
    refs.target = { read: () => "latest" };
    await row.events.click(new MouseEvent("click", { metaKey: true, ctrlKey: true }));
    expect(env.$state.observed).toEqual([["inner", "latest"]]);
    expect(readRefs).toHaveBeenCalledTimes(1);
    const commandEnv = mkEventHandlerEnv({ ...env }, ctx.viewCtx.studioCtx, ReactWebRuntime, ctx.plasmicInvalidate, window);
    expect(commandEnv.$refs).toBe(refs);
  });

  it("preserves ordinary function callbacks' lexical realm and input identity", () => {
    const { ctx, env } = setup();
    env.arguments = ["lexical arguments"];
    const param = mkParam({ name: "transform", type: typeFactory.any(), paramType: "prop" });
    const expression = new FunctionExpr({ argNames: ["item"], bodyExpr: new CustomCode({ code: "({ item, scope: this, params: arguments })", fallback: null }) });
    const component = mkComponent({ name: "Callback", type: ComponentType.Code, params: [param],
      codeComponentMeta: { importPath: "./Callback", importName: "Callback", defaultExport: false } as CodeComponentMeta,
      tplTree: (baseVariant) => mkTplTagX("div", { baseVariant }),
    });
    const tpl = mkTplComponentX({ component, baseVariant: component.variants[0], args: { transform: expression } });
    ctx.ownerComponent = mkComponent({ name: "Page", type: ComponentType.Plain, tplTree: tpl });
    const readRefs = vi.fn();
    Object.assign(ctx, { getRefs: readRefs });
    const props = _testOnlyUtils.computeTplComponentArgs(tpl, { args: tpl.vsettings[0].args, attrs: {} } as any, ctx);
    const input = { id: "same object" }, receiver = { different: true };
    const expectedCallback = evalCodeWithEnv(asCode(expression, { component: ctx.ownerComponent, projectFlags: ctx.projectFlags, inStudio: true }).code, env, window);
    const expected = expectedCallback.call(receiver, input);
    const actual = props.transform.call(receiver, input);
    expect(actual.item).toBe(input);
    expect(props.transform.call({ other: true }, input).scope).toBe(actual.scope);
    expect(expectedCallback.call({ other: true }, input).scope).toBe(expected.scope);
    expect(Object.getPrototypeOf(actual.scope)).toBe(Object.getPrototypeOf(expected.scope));
    expect(actual.scope).not.toBe(receiver);
    expect(actual.params).toBe(env.arguments);
    expect(actual.params).toBe(expected.params);
    expect(readRefs).not.toHaveBeenCalled();
  });

  it("retains the code component click handler but runs it only for the platform modifier", async () => {
    const { ctx, env, handler } = setup();
    const param = mkParam({ name: "onClick", type: typeFactory.func(typeFactory.arg("event", typeFactory.any())), paramType: "prop" });
    const component = mkComponent({
      name: "Button", type: ComponentType.Code, params: [param],
      codeComponentMeta: { importPath: "antd", importName: "Button", defaultExport: false } as CodeComponentMeta,
      tplTree: (baseVariant) => mkTplTagX("button", { baseVariant }),
    });
    const tpl = mkTplComponentX({ component, baseVariant: component.variants[0] });
    tpl.vsettings[0].args.push(new Arg({ param, expr: handler }));
    ctx.ownerComponent = mkComponent({ name: "Page", type: ComponentType.Plain, tplTree: tpl });
    const props = _testOnlyUtils.computeTplComponentArgs(tpl, {
      args: tpl.vsettings[0].args, attrs: {},
    } as any, ctx);
    expect(props.onClick).toBeTypeOf("function");
    await props.onClick(new MouseEvent("click", { button: 0 }));
    expect(env.$state.basicOpen).toBe(false);
    await props.onClick(new MouseEvent("click", { button: 0, metaKey: true, ctrlKey: true }));
    expect(env.$state.basicOpen).toBe(true);
    expect(ctx.viewCtx.studioCtx.isInteractiveMode).toBe(false);
    env.$state.basicOpen = false;
    env.$state.viewer.role = "reviewer";
    await props.onClick(new MouseEvent("click", { button: 0, metaKey: true, ctrlKey: true }));
    expect(env.$state.basicOpen).toBe(false);
  });

  it("gates native tag handlers too, without enabling initialization or unrelated events", async () => {
    const { ctx, env, handler } = setup();
    const component = mkEmptyComponent();
    ctx.ownerComponent = component;
    ctx.site = createSite();
    const tag = mkTplTagX("button", { baseVariant: component.variants[0], attrs: { onClick: handler } });
    component.tplTree = tag;
    const { evaledAttrs } = _testOnlyUtils.computeActiveVariantsForMaybeDisabledTag(
      tag, ctx, tag.vsettings,
      new EffectiveVariantSetting(tag, tag.vsettings, ctx.site),
    );
    const onClick = evaledAttrs.onClick;
    expect(onClick).toBeTypeOf("function");
    await onClick();
    expect(env.$state.basicOpen).toBe(false);
    await onClick(new MouseEvent("change", { metaKey: true, ctrlKey: true }));
    expect(env.$state.basicOpen).toBe(false);
    const view = render(<button onClick={onClick}>New template</button>);
    await act(async () => { fireEvent.click(view.getByRole("button"), { metaKey: true, ctrlKey: true }); });
    expect(env.$state.basicOpen).toBe(true);
    env.$state.basicOpen = false;
    ctx.viewCtx.studioCtx.isInteractiveMode = true;
    await act(async () => { fireEvent.click(view.getByRole("button")); });
    expect(env.$state.basicOpen).toBe(true);
  });
});


it("keeps one native Table render-slot tooltip open and retains RichText classes on hover", async () => {
  const lifetime = new AbortController();
  const site = createSite();
  const node = mkTplTagX("span");
  const viewCtx = {
    disposeSignal: lifetime.signal,
    studioCtx: { isDevMode: true, renderPolicy: new StudioRenderPolicy({ isLive: () => false, isDragging: () => false }) },
    canvasCtx: { Sub: { DataContext: React.createContext({}) } },
    trackCanvasObserver: vi.fn(), commitCanvasObserver: vi.fn(),
    disposeCanvasObserver: (reaction: any) => reaction.dispose(),
    addRerenderObserver: (rerender: () => void) => rerender(),
  } as unknown as ViewCtx;
  const component = mkComponent({ name: "Tooltip", type: ComponentType.Plain, tplTree: node });
  site.components.push(component);
  const disposeOwner = installRenderOwner(viewCtx, site, component);
  const ctx = {
    viewCtx, site, ownersStack: [], ownerComponent: component, env: { $ctx: {} }, valKey: "table.column.tooltip",
    sub: { React, createCanvasComponentType, CanvasObserver, CanvasRichTextFrame, CanvasErrorBoundary, CanvasErrorDisplay, reactWeb: { ...ReactWebRuntime, createPlasmicElementProxy: (tag: any, { __plasmicRichText, ...props }: any) => React.createElement(tag, props) } },
    reactHookSpecs: [],
  } as unknown as RenderingCtx;
  Object.assign(viewCtx.canvasCtx.Sub, ctx.sub);
  Object.assign(viewCtx, { subscribeToCanvasChanges: () => () => undefined });
  const RichText = _testOnlyUtils.mkRichText(ctx.sub);
  const session = new CanvasSessionState();
  const callback = vi.fn();
  function Cell({ text, implicitOpen, onChange }: { text: string; implicitOpen: boolean; onChange: (open: boolean) => void }) {
    const scope = React.useId();
    const [, redraw] = React.useReducer((value) => value + 1, 0);
    const props: Record<string, any> = { open: implicitOpen, onOpenChange: (open: boolean) => { onChange(open); callback(text, open); } };
    applyCanvasSessionState(session, _testOnlyUtils.computeCanvasSessionKey({ ...ctx, renderSlotInstance: scope }),
      props, [{ valueProp: "open", onChangeProp: "onOpenChange", controlled: false }], true, redraw, true, {});
    const { __canvas, ...nativeProps } = props;
    return <Tooltip title={text} mouseEnterDelay={0} mouseLeaveDelay={0} {...nativeProps}>
      <RichText ctx={ctx} node={node as any} tag="span" effectiveVs={new EffectiveVariantSetting(node, node.vsettings, site)}
        attrs={{ className: "authored-device-text", children: <span className="__wab_rich_text">{text}</span> }} />
    </Tooltip>;
  }
  const rows = ["Xiaomi Redmi Note 12", "Motorola Moto G54", "TECNO Spark 20", "Samsung Galaxy A54", "Xiaomi Redmi Note 12"].map((text, id) => ({ id, text }));
  function Harness() {
    const [implicitOpen, setImplicitOpen] = React.useState(false);
    return <ConfigProvider theme={{ token: { motion: false } }}><Table pagination={false} rowKey="id" dataSource={rows}
      columns={[{ dataIndex: "text", width: 124, ellipsis: { showTitle: false }, render: (text: string) => <Cell text={text} implicitOpen={implicitOpen} onChange={setImplicitOpen} /> }]} /></ConfigProvider>;
  }
  const view = render(<Harness />);
  const cells = view.container.querySelectorAll("td > .authored-device-text");
  expect(cells).toHaveLength(5);
  let previous: Element | null = null;
  for (const index of [4, 3, 2, 1, 0, 1]) {
    if (previous) {
      fireEvent.mouseOut(previous, { relatedTarget: cells[index] });
      fireEvent.mouseOver(cells[index], { relatedTarget: previous });
    } else {
      fireEvent.mouseOver(cells[index], { relatedTarget: document.body });
    }
    await waitFor(() => expect(document.querySelectorAll(".ant-tooltip:not(.ant-tooltip-hidden)")).toHaveLength(1));
    await waitFor(() => expect(cells[index].classList.contains("ant-tooltip-open")).toBe(true));
    expect(cells[index].classList.contains("__wab_text")).toBe(true);
    expect(cells[index].classList.contains("authored-device-text")).toBe(true);
    previous = cells[index];
  }
  fireEvent.mouseOut(ensure(previous, "Last hovered cell"), { relatedTarget: document.body });
  await waitFor(() => expect(document.querySelectorAll(".ant-tooltip:not(.ant-tooltip-hidden)")).toHaveLength(0));
  for (const open of [true, false]) {
    expect(callback.mock.calls.filter(([, value]) => value === open)).toEqual([4, 3, 2, 1, 0, 1].map((index) => [rows[index].text, open]));
  }
  expect([...view.container.querySelectorAll("td > .authored-device-text")]).toEqual([...cells]);
  view.unmount(); lifetime.abort(); disposeOwner();
});

it.each([false, true])("keeps a render-slot callback callable when its component provides data: %s", (providesData) => {
  const param = mkParam({
    name: "renderItem",
    type: typeFactory.renderFunc({ params: [typeFactory.arg("item", typeFactory.any())], allowed: [], allowRootWrapper: undefined }),
    paramType: "slot",
  });
  const component = mkComponent({
    name: "DataList", type: ComponentType.Code, params: [param],
    codeComponentMeta: { importPath: "./DataList", importName: "DataList", defaultExport: false, providesData } as CodeComponentMeta,
    tplTree: (baseVariant) => mkTplTagX("div", { baseVariant }),
  });
  const tpl = mkTplComponentX({ component, baseVariant: component.variants[0], args: { renderItem: new RenderExpr({ tpl: [mkTplTagX("span")] }) } });
  const ctx = mkCtx(mkEnv(), new Map());
  const site = createSite();
  const parent = mkComponent({ name: "Slot parent", type: ComponentType.Plain, tplTree: tpl });
  site.components.push(parent, component);
  const disposeOwner = installRenderOwner(ctx.viewCtx, site, parent);
  Object.assign(ctx, { site, ownersStack: [], ownerComponent: parent, sub: { React, CanvasObserver, DataCtxReader: () => null }, valKey: "list", renderSlotInstance: "parent" });
  Object.assign(ctx.viewCtx, { componentArgsContainer: () => undefined, componentStackFrames: () => [], trackCanvasObserver: vi.fn(), commitCanvasObserver: vi.fn(), disposeCanvasObserver: (source: { dispose(): void }) => source.dispose() });
  Object.assign(ctx.viewCtx.canvasCtx, { getRegisteredCodeComponentsAndContextsMap: () => new Map() });
  const before = tpl.vsettings[0].args[0].expr;
  const props = _testOnlyUtils.computeTplComponentArgs(tpl, { args: tpl.vsettings[0].args, attrs: {} } as any, ctx);
  expect(props.renderItem).toBeTypeOf("function");
  const first = props.renderItem({ id: "row-1" });
  const second = props.renderItem({ id: "row-2" });
  expect(React.isValidElement(first)).toBe(true);
  expect(React.isValidElement(second)).toBe(true);
  // Native Table callbacks run outside the model observer. Their React type
  // must remain stable when another row's hover state rerenders the table.
  expect(second.type).toBe(first.type);
  expect(props.renderItem({ id: "row-1" }).type).toBe(first.type);
  expect(tpl.vsettings[0].args[0].expr).toBe(before);
  disposeOwner();
});


describe("template render context ownership", () => {
  function setup(root: TplNode) {
    const site = createSite();
    const component = mkComponent({ name: "Context owner", type: ComponentType.Plain, tplTree: root });
    site.components.push(component);
    for (const node of flattenTpls(root)) {
      node.vsettings.push(mkVariantSetting({ variants: [component.variants[0]] }));
    }
    deepTrackComponents(site);
    const ctx = mkCtx(mkEnv(), new Map());
    const disposeOwner = installRenderOwner(ctx.viewCtx, site, component);
    const sub = { React, CanvasErrorDisplay, reactWeb: ReactWebRuntime };
    Object.assign(ctx, {
      site, sub, ownerComponent: component, valKey: root.uuid, ownersStack: [],
      activeVariants: new Set([component.variants[0]]),
      wrappingEnv: { ...mkEnv(), $ctx: { outer: "first" } },
      reactHookSpecs: [], triggerProps: {}, overrides: {}, $stateSnapshot: {},
      $ccVariants: {}, stateInitializers: [],
    });
    Object.assign(ctx.viewCtx.canvasCtx, { Sub: sub });
    const environments = vi.spyOn(ctx.viewCtx.canvasRenderOwner, "retainEnvironment");
    return { ctx, component, environments, dispose() {
      environments.mockRestore(); disposeOwner();
      ctx.viewCtx.canvasCtx.registrations.dispose(); ctx.viewCtx.studioCtx.renderPolicy.dispose();
    } };
  }

  it("keeps disabled activation local while preserving the original wrapping environment as a cache input", () => {
    const child = mkTplTagX("input");
    const root = mkTplTagX("button", {}, child);
    const f = setup(root);
    root.vsettings[0].attrs.disabled = codeLit(true);
    const originalVariants = f.ctx.activeVariants;
    const first = renderTplNode(root, f.ctx);
    expect(React.isValidElement(first) && first.type).toBe("button");
    const contexts = f.environments.mock.calls.map(([ctx]) => ctx);
    expect(contexts).toHaveLength(2);
    for (const ctx of contexts) {
      expect(ctx).not.toBe(f.ctx);
      expect(ctx.activeVariants).not.toBe(originalVariants);
      expect([...ctx.activeVariants]).toEqual([...originalVariants]);
      expect(ctx.wrappingEnv).toBe(f.ctx.env);
      expect(ctx.overrides).toBe(f.ctx.overrides);
      expect(ctx.triggerProps).toBe(f.ctx.triggerProps);
    }
    expect(f.ctx.activeVariants).toBe(originalVariants);
    expect([...originalVariants]).toEqual([f.component.variants[0]]);
    expect(renderTplNode(root, f.ctx)).toBe(first);
    expect(f.environments).toHaveBeenCalledTimes(2);
    f.ctx.wrappingEnv.$ctx.outer = "second";
    expect(renderTplNode(root, f.ctx)).not.toBe(first);
    expect([...originalVariants]).toEqual([f.component.variants[0]]);
    f.dispose();
  });

  it("gives repeated items independent disabled variants and the shared outer wrapping environment", () => {
    const root = mkTplTagX("input");
    const f = setup(root);
    root.vsettings[0].attrs.disabled = new CustomCode({ code: "(item.disabled)", fallback: null });
    root.vsettings[0].dataRep = new Rep({
      collection: codeLit([{ disabled: true }, { disabled: false }]), element: mkVar("item"), index: mkVar("index"),
    });
    const output = renderTplNode(root, f.ctx);
    expect(React.isValidElement(output) && output.type).toBe(React.Fragment);
    const contexts = f.environments.mock.calls.map(([ctx]) => ctx);
    expect(contexts).toHaveLength(2);
    expect(contexts[0]).not.toBe(contexts[1]);
    expect(contexts[0].env.item).toEqual({ disabled: true });
    expect(contexts[1].env.item).toEqual({ disabled: false });
    expect(contexts[0].activeVariants).not.toBe(f.ctx.activeVariants);
    expect(contexts[1].activeVariants).toBe(f.ctx.activeVariants);
    expect([...contexts[0].activeVariants]).toEqual([...f.ctx.activeVariants]);
    for (const ctx of contexts) {
      expect(ctx.wrappingEnv).toBe(f.ctx.env);
      expect(ctx.overrides).toBe(f.ctx.overrides);
    }
    expect(f.ctx.env.item).toBeUndefined();
    expect(renderTplNode(root, f.ctx)).toBe(output);
    expect(f.environments).toHaveBeenCalledTimes(2);
    f.dispose();
  });

  it("retains explicit slot content and invalidates it when the props record changes", () => {
    const param = mkParam({ name: "content", type: typeFactory.renderable(), paramType: "slot" });
    const root = mkSlot(param);
    const f = setup(root);
    f.component.params.push(param);
    const content = React.createElement("span", {}, "first");
    f.ctx.env.$props.content = content;
    const first = renderTplNode(root, f.ctx);
    expect(React.isValidElement(first) && first.type).toBe(React.Fragment);
    expect(React.isValidElement<{ children?: React.ReactNode }>(first) && first.props.children).toBe(content);
    expect(renderTplNode(root, f.ctx)).toBe(first);
    const replacement = React.createElement("span", {}, "second");
    f.ctx.env.$props.content = replacement;
    const next = renderTplNode(root, f.ctx);
    expect(next).not.toBe(first);
    expect(React.isValidElement<{ children?: React.ReactNode }>(next) && next.props.children).toBe(replacement);
    f.dispose();
  });
});
