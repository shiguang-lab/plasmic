import type { CanvasEnv } from "@/wab/shared/eval";
import { mock } from "vitest-mock-extended";
import "@/wab/client/components/sidebar/MixinControls";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { ensureKnownCustomCode, TplTag } from "@/wab/shared/model/classes";
import { ensure } from "@/wab/shared/common";
import { InspectorSelection } from "@/wab/client/studio-ctx/inspector-selection";
import {
  PropEditorRow,
  PropValueEditorContext,
} from "@/wab/client/components/sidebar-tabs/PropEditorRow";
import { PropValueEditor } from "@/wab/client/components/sidebar-tabs/PropValueEditor";
import { generateActionMetaForGlobalAction } from "@/wab/client/state-management/interactions-meta";
import { FunctionArgumentsPropType } from "@/wab/shared/code-components/code-components";
import { codeLit } from "@/wab/shared/core/exprs";
import { mkParam } from "@/wab/shared/core/lang";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { typeFactory } from "@/wab/shared/model/model-util";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { vi } from "vitest";

vi.mock("@/wab/client/components/sidebar-tabs/ComponentProps/ChoicePropEditor", () => ({
  ChoicePropEditor: ({ attr, options, value }: { attr: string; options: string[]; value?: string }) => <select aria-label={attr} value={value} onChange={() => undefined}>{options.map((option) => <option key={option}>{option}</option>)}</select>,
}));
const studios: ReturnType<typeof fakeStudioCtx>["studioCtx"][] = [];
afterEach(() => { cleanup(); studios.splice(0).forEach((studio) => studio.dispose()); vi.restoreAllMocks(); });

function nativeView(getComponentEvalContext: (...args: any[]) => any, selected: TplTag) {
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  const site = createSite(), manager = new TplMgr({ site });
  const component = manager.addComponent({ name: "Arguments", type: ComponentType.Plain }); component.tplTree = selected;
  const frame = mkArenaFrame({ site, component, name: "Arguments", width: 400, height: 300 }); site.arenas.push(mkMixedArena("Arguments", [frame]));
  const { studioCtx: studio } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Arguments" }); studios.push(studio);
  const view = ensure(studio.tryGetViewCtxForFrame(frame), "Arguments view");
  vi.spyOn(view, "getComponentEvalContext").mockImplementation(getComponentEvalContext);
  vi.spyOn(view, "getCanvasEnvForTpl").mockReturnValue(mock<CanvasEnv>());
  vi.spyOn(view, "focusedCloneKey").mockReturnValue("committed-clone");
  const reads = new InspectorSelection(view, 1);
  vi.spyOn(view, "getInspectorReadOwner").mockReturnValue(reads);
  return { view, reads, studio };
}

function setup(contextName = "HelloGlobalContext") {
  const selected = mkTplTagX("div");
  const hello = { name: "hello canvas clone" };
  const other = { name: "other canvas clone" };
  const contexts = new Map([
    ["HelloGlobalContext", hello],
    ["OtherGlobalContext", other],
  ]);
  const data = new Map<any, any>([
    [selected, { names: ["selected element data"] }],
    [hello, { names: ["a", "b", "c"] }],
    [other, { names: ["other"] }],
  ]);
  const options = vi.fn((_props, ctx) => ctx?.names ?? ["dummy", "data"]);
  const meta = generateActionMetaForGlobalAction(
    { parameters: [{ name: "name", type: { type: "choice", options } }] },
    contextName,
  );
  const propType = {
    ...(meta.parameters.args as FunctionArgumentsPropType<any>),
    functionType: typeFactory.func(typeFactory.arg("name", typeFactory.text())),
  };
  const getComponentEvalContext = vi.fn((tpl) => ({
    invalidArgs: [],
    componentPropValues:
      tpl === selected
        ? { internalModel: "must not leak" }
        : { provider: tpl.name },
    ccContextData: data.get(tpl),
  }));
  const { view, reads, studio } = nativeView(getComponentEvalContext, selected);
  const context = {
    paramOwnerNames: [],
    tpl: selected,
    componentPropValues: { internalModel: "must not leak" },
    ccContextData: {
      names: ["selected element data"],
      viewCtx: {
        csEvaluator: {
          getGlobalContextTpl: (name: string) => contexts.get(name),
        },
      },
    },
    viewCtx: view,
    env: {},
  };
  const rendered = render(
    <StudioCtxContext.Provider value={studio}><PropValueEditorContext.Provider value={context as any}>
      <PropValueEditor
        propType={propType as any}
        attr="args"
        label="Arguments"
        value={undefined}
        onChange={vi.fn()}
      />
    </PropValueEditorContext.Provider></StudioCtxContext.Provider>,
  );
  return { ...rendered, data, hello, other, options, getComponentEvalContext, reads };
}

it("passes the invoked provider's props and context to argument options", () => {
  const { options, hello, getComponentEvalContext } = setup();
  expect(getComponentEvalContext).toHaveBeenCalledWith(hello, undefined, { anchorCloneKey: "committed-clone", ignoreFocusedCloneKey: true });
  expect(options).toHaveBeenLastCalledWith(
    { provider: "hello canvas clone" },
    { names: ["a", "b", "c"] },
    { path: ["name"] },
  );
  expect(screen.getAllByRole("option").map((el) => el.textContent)).toEqual([
    "a",
    "b",
    "c",
  ]);
});

it("isolates the invoked provider from the selection and other providers", () => {
  const { options, other, getComponentEvalContext } =
    setup("OtherGlobalContext");
  expect(getComponentEvalContext).toHaveBeenCalledWith(other, undefined, { anchorCloneKey: "committed-clone", ignoreFocusedCloneKey: true });
  expect(options).toHaveBeenLastCalledWith(
    { provider: "other canvas clone" },
    { names: ["other"] },
    { path: ["name"] },
  );
});

it("reacts to provider data changes and preserves absent-context fallback", async () => {
  const { data, hello, options, reads } = setup();
  await act(() => { data.set(hello, { names: ["updated"] }); reads.syncCanvas(); });
  expect(screen.getAllByRole("option").map((el) => el.textContent)).toEqual([
    "updated",
  ]);
  await act(() => { data.delete(hello); reads.syncCanvas(); });
  expect(options).toHaveBeenLastCalledWith(
    { provider: "hello canvas clone" },
    undefined,
    { path: ["name"] },
  );
  expect(screen.getAllByRole("option").map((el) => el.textContent)).toEqual([
    "dummy",
    "data",
  ]);
});

it("keeps fallback options when the registered provider is not on the canvas", () => {
  const { getComponentEvalContext, options } = setup("MissingGlobalContext");
  expect(getComponentEvalContext).not.toHaveBeenCalled();
  expect(options).toHaveBeenLastCalledWith({}, undefined, { path: ["name"] });
});

it("uses the selected component context when overrides are omitted", () => {
  const tpl = mkTplTagX("div");
  const componentPropValues = { selected: true };
  const ccContextData = { names: ["selected element data"] };
  const getComponentEvalContext = vi.fn(() => ({
    invalidArgs: [],
    componentPropValues,
    ccContextData,
  }));
  const options = vi.fn((_props, ctx) => ctx.names);
  const { view, studio } = nativeView(getComponentEvalContext, tpl);
  render(
    <StudioCtxContext.Provider value={studio}><PropEditorRow
      tpl={tpl}
      expr={undefined}
      viewCtx={view}
      env={{}}
      schema={{}}
      attr="name"
      label="Name"
      propType={{ type: "choice", options }}
      onChange={vi.fn()}
    /></StudioCtxContext.Provider>,
  );
  expect(getComponentEvalContext).toHaveBeenCalledWith(tpl, undefined, { anchorCloneKey: "committed-clone", ignoreFocusedCloneKey: true });
  expect(options).toHaveBeenLastCalledWith(componentPropValues, ccContextData, { path: ["name"] });
});

it("refreshes a literal editor after its existing expression is edited and retires its model view", async () => {
  const selected = mkTplTagX("div"), { view, studio } = nativeView(() => ({ invalidArgs: [], componentPropValues: {}, ccContextData: undefined }), selected);
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const component = view.currentComponent(), expr = codeLit("First");
  await studio.changeUnsafe(() => { component.params.push(mkParam({ name: "choice", type: typeFactory.text(), paramType: "prop", defaultExpr: expr })); });
  const onChange = vi.fn();
  const mounted = render(<StudioCtxContext.Provider value={studio}><PropValueEditorContext.Provider value={{ paramOwnerNames: [], tpl: selected, viewCtx: view, componentPropValues: {}, ccContextData: undefined, env: {}, exprCtx: { component, projectFlags: studio.projectFlags(), inStudio: true } }}>
    <PropValueEditor attr="choice" label="Choice" propType={{ type: "choice", options: ["First", "Second"] }} value={expr} onChange={onChange} />
  </PropValueEditorContext.Provider></StudioCtxContext.Provider>);
  expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("First");
  await act(async () => { await studio.changeUnsafe(() => { ensureKnownCustomCode(expr).code = '"Second"'; }); });
  expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("Second");
  act(() => view.dispose());
  expect(mounted.container.textContent).toBe("");
});
