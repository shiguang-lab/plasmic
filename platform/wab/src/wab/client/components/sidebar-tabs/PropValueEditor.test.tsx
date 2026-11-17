import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { SidebarModalProvider } from "@/wab/client/components/sidebar/SidebarModal";
import { mkTokenRef } from "@/wab/commons/StyleToken";
import { asCode, deserCompositeExpr } from "@/wab/shared/core/exprs";
import { ensureKnownCompositeExpr, ensureKnownStyleTokenRef } from "@/wab/shared/model/classes";
import { evalCodeWithEnv } from "@/wab/shared/eval";
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
import { ensureKnownCustomCode, ensureKnownObjectPath, Expr, isKnownExpr, ObjectPath, TplTag, VarRef } from "@/wab/shared/model/classes";
import { ensure } from "@/wab/shared/common";
import { InspectorSelection } from "@/wab/client/studio-ctx/inspector-selection";
import {
  PropEditorRow,
  PropValueEditorContext,
} from "@/wab/client/components/sidebar-tabs/PropEditorRow";
import { PropValueEditor } from "@/wab/client/components/sidebar-tabs/PropValueEditor";
import { generateActionMetaForGlobalAction } from "@/wab/client/state-management/interactions-meta";
import { FunctionArgumentsPropType } from "@/wab/shared/code-components/code-components";
import { codeLit, tryExtractJson } from "@/wab/shared/core/exprs";
import { mkParam } from "@/wab/shared/core/lang";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { typeFactory } from "@/wab/shared/model/model-util";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

it("edits registered semantic props at their native paths while preserving existing CSS keys", async () => {
  const tpl = mkTplTagX("div");
  const { studio, view } = nativeView(
    () => ({ invalidArgs: [], componentPropValues: {}, ccContextData: undefined }),
    tpl
  );
  const styleChanged = vi.fn();
  const classChanged = vi.fn();
  const deleteClasses = vi.fn();
  function Editors() {
    const [appearance, setAppearance] = React.useState<Expr | undefined>(
      codeLit({ popup: { listItem: { paddingBlock: 12, letterSpacing: "1px" } } })
    );
    const [classes, setClasses] = React.useState<Expr | undefined>();
    return (
      <StudioCtxContext.Provider value={studio}>
        <PropEditorRow
          tpl={tpl}
          viewCtx={view}
          attr="styles"
          label="Styles"
          propType={{
            type: "object", editor: "semantic",
            fields: { popup: { type: "object", fields: { listItem: { type: "object" } } } },
          }}
          expr={appearance}
          onChange={(next) => {
            if (isKnownExpr(next)) {
              styleChanged(tryExtractJson(next));
              setAppearance(next);
            }
          }}
        />
        <PropEditorRow
          tpl={tpl}
          viewCtx={view}
          attr="classNames"
          label="Class names"
          propType={{
            type: "object", editor: "semantic",
            fields: { popup: { type: "object", fields: { listItem: "string" } } },
          }}
          expr={classes}
          onDelete={() => {
            setClasses(undefined);
            deleteClasses();
          }}
          onChange={(next) => {
            if (isKnownExpr(next)) {
              classChanged(tryExtractJson(next));
              setClasses(next);
            }
          }}
        />
      </StudioCtxContext.Provider>
    );
  }

  const { container } = render(<Editors />);
  const styleEditor = ensure(
    container.querySelector<HTMLElement>('[data-plasmic-prop="styles"]'),
    "Missing inline Styles editor"
  );
  expect(styleEditor.querySelector("details")).toBeNull();
  fireEvent.click(within(styleEditor).getByText("popup", { exact: true }));
  fireEvent.click(within(styleEditor).getByText("listItem", { exact: true }));
  const padding = screen.getByRole("textbox", { name: "paddingBlock" });
  expect(padding.closest("details")).toBeNull();
  const addProperty = within(styleEditor).getByRole("button", { name: "Add CSS property" });
  expect(addProperty.parentElement).toBe(within(styleEditor).getByLabelText("2 configured").parentElement);
  expect(within(styleEditor).queryByRole("combobox", { name: "Add CSS property" })).toBeNull();
  fireEvent.click(addProperty);
  await screen.findByRole("menuitem", { name: "Horizontal padding · paddingInline" });
  expect(screen.queryByRole("menuitem", { name: "Vertical padding · paddingBlock" })).toBeNull();
  fireEvent.keyDown(document, { key: "Escape" });
  fireEvent.change(padding, { target: { value: "24" } });
  fireEvent.blur(padding);
  expect(styleChanged).toHaveBeenLastCalledWith({
    popup: { listItem: { paddingBlock: 24, letterSpacing: "1px" } },
  });
  fireEvent.click(screen.getByRole("button", { name: "Remove CSS property Vertical padding" }));
  expect(styleChanged).toHaveBeenLastCalledWith({
    popup: { listItem: { letterSpacing: "1px" } },
  });
  expect(within(styleEditor).getAllByLabelText("1 configured")).toHaveLength(2);
  fireEvent.click(addProperty);
  expect(await screen.findByRole("menuitem", { name: "Vertical padding · paddingBlock" })).toBeTruthy();
  fireEvent.click(screen.getByRole("menuitem", { name: "Horizontal padding · paddingInline" }));
  expect(styleChanged).toHaveBeenLastCalledWith({
    popup: { listItem: { letterSpacing: "1px", paddingInline: 0 } },
  });

  expect(within(styleEditor).getByLabelText("2 configured").textContent).toBe("2");
  fireEvent.click(addProperty);
  await screen.findByRole("menuitem", { name: "Vertical padding · paddingBlock" });
  expect(screen.queryByRole("menuitem", { name: "Horizontal padding · paddingInline" })).toBeNull();
  fireEvent.keyDown(document, { key: "Escape" });
  const valueButton = within(styleEditor).getByRole("button", {
    name: "View property value",
  });
  fireEvent.focus(valueButton);
  await waitFor(() => expect(document.querySelector(".ant-popover pre")?.textContent).toContain('"paddingInline": 0'));

  const classInput = screen.getByRole("textbox", { name: "listItem" });
  fireEvent.change(classInput, { target: { value: "custom-option" } });
  fireEvent.blur(classInput);
  expect(classChanged).toHaveBeenLastCalledWith({ popup: { listItem: "custom-option" } });
  fireEvent.change(classInput, { target: { value: "" } });
  fireEvent.blur(classInput);
  expect(deleteClasses).toHaveBeenCalledTimes(1);
});

it("uses the semantic header menu for object bindings and keeps the binding when the last fallback field is removed", async () => {
  const tpl = mkTplTagX("div");
  const effective = { header: { paddingBlock: 12 } };
  const { studio, view } = nativeView(
    () => ({
      invalidArgs: [],
      componentPropValues: { styles: effective },
      ccContextData: undefined,
    }),
    tpl,
  );
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const parentStyle = mkParam({
    name: "headerAppearance",
    type: typeFactory.any(),
    paramType: "prop",
  });
  await studio.changeUnsafe(() => {
    view.currentComponent().params.push(parentStyle);
    studio.tplMgr().addDataToken({ name: "Number only", value: "14" });
    studio.tplMgr().addDataToken({
      name: "Header appearance",
      value: JSON.stringify(effective),
    });
  });

  const changes = vi.fn();
  const onDelete = vi.fn();
  const propType = {
    type: "object",
    editor: "semantic",
    fields: { header: { type: "object" } },
  } as const;

  function TestEditor({ initial }: { initial: Expr }) {
    const [expr, setExpr] = React.useState<Expr | undefined>(initial);
    return (
      <StudioCtxContext.Provider value={studio}>
        <PropEditorRow
          tpl={tpl}
          viewCtx={view}
          env={{ $ctx: { appearance: effective } }}
          attr="styles"
          label="Styles"
          propType={propType}
          expr={expr}
          onChange={(next) => {
            changes(next);
            setExpr(next);
          }}
          onDelete={onDelete}
        />
      </StudioCtxContext.Provider>
    );
  }

  const literal = codeLit(effective);
  const mounted = render(<TestEditor key="literal" initial={literal} />);
  fireEvent.click(screen.getByRole("button", { name: "More actions" }));
  expect(await screen.findByText("Use dynamic value")).toBeTruthy();
  expect(screen.getByText("Allow external access")).toBeTruthy();
  fireEvent.mouseEnter(screen.getByRole("menuitem", { name: /Use data token/ }));
  const numberToken = await screen.findByRole("menuitem", { name: /Number only/ });
  expect(numberToken.getAttribute("aria-disabled")).toBe("true");
  fireEvent.click(screen.getByRole("menuitem", { name: /Header appearance/ }));
  expect(await screen.findByText("Data token", { exact: true })).toBeTruthy();
  const tokenBinding = ensureKnownObjectPath(changes.mock.lastCall?.[0]);
  expect(tryExtractJson(ensure(tokenBinding.fallback, "Expected the static styles as fallback"))).toEqual(effective);

  const editor = ensure(
    mounted.container.querySelector<HTMLElement>('[data-plasmic-prop="styles"]'),
    "Missing semantic header",
  );
  for (const element of editor.querySelectorAll("details")) {
    element.open = true;
  }
  fireEvent.click(within(editor).getByRole("button", { name: "Remove CSS property Vertical padding" }));
  await waitFor(() => expect(ensureKnownObjectPath(changes.mock.lastCall?.[0]).fallback).toBeUndefined());
  expect(ensureKnownObjectPath(changes.mock.lastCall?.[0]).path).toEqual(tokenBinding.path);
  expect(onDelete).not.toHaveBeenCalled();

  mounted.rerender(
    <TestEditor key="dynamic" initial={new ObjectPath({ path: ["$ctx", "appearance"], fallback: literal })} />,
  );
  expect(screen.getByText("Dynamic value", { exact: true })).toBeTruthy();
  expect(screen.getByText("Preview value")).toBeTruthy();

  mounted.rerender(
    <TestEditor
      key="missing"
      initial={new ObjectPath({ path: ["$ctx", "missing", "styles"], fallback: literal })}
    />,
  );
  expect(screen.getByText("Using fallback")).toBeTruthy();

  mounted.rerender(
    <TestEditor key="linked" initial={new VarRef({ variable: parentStyle.variable })} />,
  );
  expect(screen.getByText("Linked", { exact: true })).toBeTruthy();
  expect(screen.getByText("Arguments.headerAppearance")).toBeTruthy();
});

it("renders array items below their heading with the add button in that heading", () => {
  const tpl = mkTplTagX("div");
  const { view, studio } = nativeView(() => ({ invalidArgs: [], componentPropValues: {}, ccContextData: undefined }), tpl);
  const { container } = render(
    <StudioCtxContext.Provider value={studio}>
      <PropEditorRow tpl={tpl} viewCtx={view} env={{}} schema={{}} attr="items" label="Menu items"
        expr={codeLit([{ name: "First" }, { name: "Second" }])}
        propType={{ type: "array", itemType: { type: "object", fields: { name: "string" }, nameFunc: (item) => item?.name } }}
        onChange={vi.fn()} />
    </StudioCtxContext.Provider>
  );
  const add = screen.getByRole("button", { name: "Add item" });
  const label = screen.getByText("Menu items").closest("label");
  expect(label?.contains(add)).toBe(false);
  expect(container.querySelector('[data-test-id="items-header-actions"]')?.contains(add)).toBe(true);
  expect(add.textContent).toBe("");
  expect(container.querySelectorAll(".with-connector-line")).toHaveLength(2);
  expect(screen.getByText("First")).toBeTruthy();
  expect(screen.getByText("Second")).toBeTruthy();
});


it("edits semantic colors in a swatch popover and preserves theme token references", async () => {
  vi.stubGlobal("IntersectionObserver", class { observe() { return undefined; } unobserve() { return undefined; } disconnect() { return undefined; } });
  const tpl = mkTplTagX("div");
  const { studio, view } = nativeView(() => ({ invalidArgs: [], componentPropValues: {}, ccContextData: undefined }), tpl);
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const token = await studio.changeUnsafe(() => studio.tplMgr().addStyleToken({ name: "Accent", tokenType: "Color", value: "#112233" }));
  const changed = vi.fn();
  function Editor({ initial }: { initial: Expr }) {
    const [expr, setExpr] = React.useState<Expr>(initial);
    return <StudioCtxContext.Provider value={studio}>
      <PropEditorRow tpl={tpl} viewCtx={view} attr="styles" label="Styles"
        propType={{ type: "object", editor: "semantic", fields: { root: { type: "object" } } }}
        expr={expr} onChange={(next) => { if (isKnownExpr(next)) { changed(next); setExpr(next); } }} />
    </StudioCtxContext.Provider>;
  }
  try {
    const initial = codeLit({ root: { color: "#abcdef", paddingBlock: 12 } });
    const mounted = render(<Editor initial={initial} />);
    const swatch = screen.getByRole("button", { name: "color" });
    expect(swatch.textContent).toBe("");
    expect(swatch.querySelector("[data-color-swatch]")).toBeTruthy();
    fireEvent.click(swatch);
    const popover = await screen.findByRole("dialog", { name: "color" });
    fireEvent.click(await within(popover).findByRole("button", { name: /Accent/ }));
    await waitFor(() => expect(changed).toHaveBeenCalled());
    const saved = ensureKnownCompositeExpr(changed.mock.lastCall?.[0]);
    expect(ensureKnownStyleTokenRef(saved.substitutions['["root"]["color"]']).token).toBe(token);
    fireEvent.keyDown(document, { key: "Escape" });
    const padding = screen.getByRole("textbox", { name: "paddingBlock" });
    fireEvent.change(padding, { target: { value: "24" } });
    fireEvent.blur(padding);
    const edited = ensureKnownCompositeExpr(changed.mock.lastCall?.[0]);
    expect(ensureKnownStyleTokenRef(edited.substitutions['["root"]["color"]']).token).toBe(token);
    expect(deserCompositeExpr(edited)).toMatchObject({ root: { paddingBlock: 24 } });
    expect(evalCodeWithEnv(asCode(edited, { component: view.currentComponent(), projectFlags: studio.projectFlags(), inStudio: false }).code, {})).toEqual({ root: { color: mkTokenRef(token), paddingBlock: 24 } });
    mounted.rerender(<Editor key="reopened" initial={edited} />);
    const reopened = screen.getByRole("button", { name: "color" });
    expect(reopened.querySelector<HTMLElement>("[data-color-swatch]")?.style.backgroundColor).toBe("rgb(17, 34, 51)");
    await act(async () => { await studio.changeUnsafe(() => { token.value = "#445566"; }); });
    await waitFor(() => expect(reopened.querySelector<HTMLElement>("[data-color-swatch]")?.style.backgroundColor).toBe("rgb(68, 85, 102)"));
    fireEvent.click(reopened);
    fireEvent.click(await screen.findByRole("button", { name: "Remove token" }));
    await waitFor(() => expect(tryExtractJson(changed.mock.lastCall?.[0])).toEqual({ root: { color: "#445566", paddingBlock: 24 } }));
  } finally {
    vi.unstubAllGlobals();
  }
});


it("uses Design dimension menus for semantic CSS units, keywords, and typed tokens", async () => {
  vi.stubGlobal("IntersectionObserver", class { observe() { return undefined; } unobserve() { return undefined; } disconnect() { return undefined; } });
  const tpl = mkTplTagX("div");
  const { studio, view } = nativeView(() => ({ invalidArgs: [], componentPropValues: {}, ccContextData: undefined }), tpl);
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const font = await studio.changeUnsafe(() => studio.tplMgr().addStyleToken({ name: "Body size", tokenType: "FontSize", value: "16px" }));
  const gap = await studio.changeUnsafe(() => studio.tplMgr().addStyleToken({ name: "Space", tokenType: "Spacing", value: "8px" }));
  const changed = vi.fn();
  function Editor() {
    const [expr, setExpr] = React.useState<Expr>(codeLit({ root: { fontSize: "inherit", paddingBlock: 12, fontWeight: 400, borderWidth: 1 } }));
    return <AppCtxContext.Provider value={studio.appCtx}><StudioCtxContext.Provider value={studio}><SidebarModalProvider>
      <PropEditorRow tpl={tpl} viewCtx={view} attr="styles" label="Styles"
        propType={{ type: "object", editor: "semantic", fields: { root: { type: "object" } } }}
        expr={expr} onChange={(next) => { if (isKnownExpr(next)) { changed(next); setExpr(next); } }} />
    </SidebarModalProvider></StudioCtxContext.Provider></AppCtxContext.Provider>;
  }
  const current = () => ensureKnownCompositeExpr(changed.mock.lastCall?.[0]);
  const input = (name: string) => screen.getByRole("textbox", { name });
  try {
    render(<Editor />);
    const size = input("fontSize");
    const row = ensure(size.closest<HTMLElement>(".cssInput"), "Dimension control");
    fireEvent.click(within(row).getByRole("button"));
    expect(await screen.findByRole("listbox")).toBeTruthy();
    fireEvent.change(size, { target: { value: "initial" } });
    expect(await screen.findByRole("option", { name: "initial" })).toBeTruthy();
    fireEvent.change(size, { target: { value: "Space" } });
    expect(screen.queryByRole("option", { name: "Space" })).toBeNull();
    fireEvent.change(size, { target: { value: "Body size" } });
    expect(await screen.findByRole("option", { name: "Body size" })).toBeTruthy();
    fireEvent.change(size, { target: { value: "larger" } });
    fireEvent.click(await screen.findByRole("option", { name: "larger" }));
    expect(tryExtractJson(changed.mock.lastCall?.[0])).toMatchObject({ root: { fontSize: "larger" } });
    fireEvent.change(size, { target: { value: "18" } });
    fireEvent.keyDown(size, { key: "Enter" });
    expect(tryExtractJson(changed.mock.lastCall?.[0])).toMatchObject({ root: { fontSize: 18 } });
    fireEvent.change(size, { target: { value: "18rem" } });
    fireEvent.keyDown(size, { key: "Enter" });
    expect(tryExtractJson(changed.mock.lastCall?.[0])).toMatchObject({ root: { fontSize: "18rem" } });
    fireEvent.change(size, { target: { value: "calc(1rem + 2px)" } });
    fireEvent.keyDown(size, { key: "Enter" });
    expect(tryExtractJson(changed.mock.lastCall?.[0])).toMatchObject({ root: { fontSize: "calc(1rem + 2px)" } });
    fireEvent.change(size, { target: { value: "Body size" } });
    fireEvent.click(await screen.findByRole("option", { name: "Body size" }));
    expect(ensureKnownStyleTokenRef(current().substitutions['["root"]["fontSize"]']).token).toBe(font);
    fireEvent.click(input("paddingBlock"));
    fireEvent.click(await screen.findByRole("option", { name: "12em" }));
    expect(deserCompositeExpr(current())).toMatchObject({ root: { paddingBlock: "12em" } });
    fireEvent.change(input("paddingBlock"), { target: { value: "Body size" } });
    expect(screen.queryByRole("option", { name: "Body size" })).toBeNull();
    fireEvent.change(input("paddingBlock"), { target: { value: "Space" } });
    fireEvent.click(await screen.findByRole("option", { name: "Space" }));
    expect(ensureKnownStyleTokenRef(current().substitutions['["root"]["paddingBlock"]']).token).toBe(gap);
    expect(ensureKnownStyleTokenRef(current().substitutions['["root"]["fontSize"]']).token).toBe(font);
    fireEvent.change(input("fontWeight"), { target: { value: "Bold" } });
    fireEvent.click(await screen.findByRole("option", { name: "700" }));
    expect(deserCompositeExpr(current())).toMatchObject({ root: { fontWeight: 700 } });
    fireEvent.click(input("borderWidth"));
    expect(screen.queryByRole("option", { name: "1%" })).toBeNull();
    fireEvent.click(await screen.findByRole("option", { name: "thin" }));
    expect(deserCompositeExpr(current())).toMatchObject({ root: { borderWidth: "thin" } });
    fireEvent.change(input("paddingBlock"), { target: { value: "20" } });
    fireEvent.keyDown(input("paddingBlock"), { key: "Enter" });
    expect(deserCompositeExpr(current())).toMatchObject({ root: { paddingBlock: 20 } });
    expect(current().substitutions['["root"]["paddingBlock"]']).toBeUndefined();
    expect(ensureKnownStyleTokenRef(current().substitutions['["root"]["fontSize"]']).token).toBe(font);
  } finally { vi.unstubAllGlobals(); }
});
