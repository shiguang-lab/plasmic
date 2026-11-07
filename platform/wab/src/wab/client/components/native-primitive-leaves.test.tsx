import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import type ListItem from "@/wab/client/components/ListItem";
import { MixinRow } from "@/wab/client/components/sidebar/MixinControls";
import type { SidebarSection } from "@/wab/client/components/sidebar/SidebarSection";
import { NonBaseTplSlotDescendantMessage } from "@/wab/client/components/sidebar-tabs/style-tab";
import { DataSourceOpExprSummary } from "@/wab/client/components/sidebar-tabs/DataSource/DataSourceOpPicker";
import { Matcher } from "@/wab/client/components/view-common";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { ComponentLink } from "@/wab/client/linting/lint-issue-row";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import type { ApiDataSource } from "@/wab/shared/ApiSchema";
import { ComponentType } from "@/wab/shared/core/components";
import { mkParam } from "@/wab/shared/core/lang";
import { mkSlot, mkTplTag } from "@/wab/shared/core/tpls";
import { ComponentDataQuery, DataSourceOpExpr, Var } from "@/wab/shared/model/classes";
import { typeFactory } from "@/wab/shared/model/model-util";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { SWRConfig } from "swr";
import { mock } from "vitest-mock-extended";

const painted = vi.hoisted(() => vi.fn());
vi.mock("@/wab/client/components/ListItem", () => ({
  default: ({children,onClick,menu}: React.ComponentProps<typeof ListItem>) => {
    painted();
    return <section><button onClick={onClick}>Open {children}</button>{typeof menu === "function" ? menu() : menu}</section>;
  },
}));
vi.mock("@/wab/client/components/sidebar/SidebarSection", async (original) => ({
  ...(await original<typeof import("@/wab/client/components/sidebar/SidebarSection")>()),
  SidebarSection: ({children}: React.ComponentProps<typeof SidebarSection>) => <section>{typeof children === "function" ? null : children}</section>,
}));
const studios = new Set<StudioCtx>();
afterEach(async () => {
  cleanup();
  for (const studio of studios) {await studio.awaitEval();studio.dispose();}
  studios.clear();vi.restoreAllMocks();painted.mockClear();
});
async function setup() {
  const result=fakeStudioCtx({devFlagOverrides:{ccStubs:true}});
  studios.add(result.studioCtx);
  await waitFor(() => expect(result.studioCtx.initialRouteReady).toBe(true));
  return {...result,studio:result.studioCtx};
}
async function addComponent(studio: StudioCtx, name="Card") {
  const component=await studio.changeUnsafe(() => studio.tplMgr().addComponent({name,type:ComponentType.Plain}));
  studio.observeComponents([component]);studio.createViewStateUndoRecord();
  return component;
}

it("updates only the mixin name field and preserves row callbacks and owner rebinding", async () => {
  const {studio}=await setup();
  const first=await studio.changeUnsafe(() => studio.tplMgr().addMixin("Spacing"));
  const second=await studio.changeUnsafe(() => studio.tplMgr().addMixin("Typography"));
  const clicked=vi.fn(),references=vi.fn(),duplicate=vi.fn(),removed=vi.fn();
  const contents=(mixin=first) => <MixinRow sc={studio} mixin={mixin} matcher={new Matcher("")} onClick={clicked} onFindReferences={references} onDuplicate={duplicate} onDelete={removed} />;
  const view=render(contents());
  painted.mockClear();
  await act(async () => {await studio.changeUnsafe(() => {first.preview="Unrelated preview";});});
  expect(painted).not.toHaveBeenCalled();
  await act(async () => {await studio.changeUnsafe(() => {first.name="Updated spacing";});});
  expect(screen.getByRole("button",{name:"Open Updated spacing"})).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"Open Updated spacing"}));expect(clicked).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("menuitem",{name:"Find all references"}));expect(references).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("menuitem",{name:"Duplicate"}));expect(duplicate).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("menuitem",{name:"Delete"}));expect(removed).toHaveBeenCalledOnce();
  view.rerender(contents(second));painted.mockClear();
  await act(async () => {await studio.changeUnsafe(() => {first.name="Old mixin";});});
  expect(painted).not.toHaveBeenCalled();
  expect(screen.getByRole("button",{name:"Open Typography"})).toBeTruthy();
  await act(async () => {await studio.changeUnsafe(() => {second.name="Current mixin";});});
  expect(screen.getByRole("button",{name:"Open Current mixin"})).toBeTruthy();
});

it("follows the slot-param-variable field chain and sends the unchanged slot handle to its command", async () => {
  const {studio}=await setup();
  const param=mkParam({name:"children",type:typeFactory.renderable(),paramType:"slot"});
  const slot=mkSlot(param);
  await studio.changeUnsafe(() => {
    const owner=studio.tplMgr().addComponent({name:"Slot owner",type:ComponentType.Plain,rootTpl:mkTplTag("div",slot)});
    owner.params.push(param);
    // fakeStudioCtx has no window.studioCtx: install real tplTree observation
    // before this transaction's prune checks the SlotParam's weak slot ref.
    studio.observeComponents([owner]);
    return owner;
  });
  studio.createViewStateUndoRecord();
  const viewCtx=Object.assign(mock<ViewCtx>(),{studioCtx:studio});
  viewCtx.change.mockImplementation(command => studio.changeSpawn(command));
  const view=render(<NonBaseTplSlotDescendantMessage viewCtx={viewCtx} slot={slot} />);
  expect(view.container.querySelector("code")).toHaveTextContent("children");
  await act(async () => {await studio.changeUnsafe(() => {param.variable.name="header";});});
  expect(view.container.querySelector("code")).toHaveTextContent("header");
  const previous=param.variable;
  const next=new Var({name:"replacement",uuid:"slot-replacement-variable"});
  await act(async () => {await studio.changeUnsafe(() => {param.variable=next;});});
  expect(view.container.querySelector("code")).toHaveTextContent("replacement");
  await act(async () => {await studio.changeUnsafe(() => {previous.name="Old variable";});});
  expect(view.container.querySelector("code")).toHaveTextContent("replacement");
  await act(async () => {await studio.changeUnsafe(() => {next.name="Current variable";});});
  expect(view.container.querySelector("code")).toHaveTextContent("Current variable");
  fireEvent.click(screen.getByText("on the slot target instead"));
  await waitFor(() => expect(viewCtx.setStudioFocusByTpl).toHaveBeenCalledExactlyOnceWith(slot));
});

it("updates the component caption and name, but reads the latest root only when navigating", async () => {
  const {studio}=await setup();const component=await addComponent(studio);
  const focus=vi.spyOn(studio,"setStudioFocusOnTpl").mockResolvedValue(undefined);
  render(<StudioCtxContext.Provider value={studio}><ComponentLink component={component} /></StudioCtxContext.Provider>);
  expect(screen.getByText("Component Card")).toBeTruthy();
  await act(async () => {await studio.changeUnsafe(() => {component.name="Page name";studio.tplMgr().convertComponentToPage(component);});});
  expect(screen.getByText("Page Page name")).toBeTruthy();
  const replacement=mkTplTag("main");
  await act(async () => {await studio.changeUnsafe(() => {component.tplTree=replacement;});});
  fireEvent.click(screen.getByText("Page Page name"));
  expect(focus).toHaveBeenCalledExactlyOnceWith(component,replacement);
});

it("feeds native operation fields into the unchanged SWR source/meta hook and ignores an older source response", async () => {
  const {studio,api}=await setup();const component=await addComponent(studio,"Query owner");
  const expr=new DataSourceOpExpr({parent:undefined,sourceId:"source-a",opId:"operation",opName:"get",templates:{},cacheKey:undefined,queryInvalidation:undefined,roleId:undefined});
  await studio.changeUnsafe(() => {component.dataQueries.push(new ComponentDataQuery({uuid:"query",name:"Query",op:expr}));});
  const first=Promise.withResolvers<ApiDataSource>(),older=Promise.withResolvers<ApiDataSource>(),latest=Promise.withResolvers<ApiDataSource>();
  api.getDataSourceById.mockReturnValueOnce(first.promise).mockReturnValueOnce(older.promise).mockReturnValueOnce(latest.promise);
  render(<AppCtxContext.Provider value={studio.appCtx}><StudioCtxContext.Provider value={studio}><SWRConfig value={{provider:() => new Map(),dedupingInterval:0,revalidateOnFocus:false,shouldRetryOnError:false}}><DataSourceOpExprSummary expr={expr} /></SWRConfig></StudioCtxContext.Provider></AppCtxContext.Provider>);
  expect(screen.getByText("Loading...")).toBeTruthy();
  await waitFor(() => expect(api.getDataSourceById).toHaveBeenCalledExactlyOnceWith("source-a"));
  await act(async () => {await studio.changeUnsafe(() => {expr.opName="post";});});
  await act(async () => {first.resolve(mock<ApiDataSource>({id:"source-a",source:"http",name:"Orders"}));});
  expect(await screen.findByText("Orders: POST")).toBeTruthy();
  expect(api.getDataSourceById).toHaveBeenCalledOnce();
  await act(async () => {await studio.changeUnsafe(() => {expr.sourceId="source-b";});});
  await waitFor(() => expect(api.getDataSourceById).toHaveBeenLastCalledWith("source-b"));
  await act(async () => {await studio.changeUnsafe(() => {expr.sourceId="source-c";expr.opName="get";});});
  await waitFor(() => expect(api.getDataSourceById).toHaveBeenLastCalledWith("source-c"));
  await act(async () => {latest.resolve(mock<ApiDataSource>({id:"source-c",source:"http",name:"Current source"}));});
  expect(await screen.findByText("Current source: GET")).toBeTruthy();
  await act(async () => {older.resolve(mock<ApiDataSource>({id:"source-b",source:"http",name:"Old source"}));});
  expect(screen.getByText("Current source: GET")).toBeTruthy();
  expect(screen.queryByText("Old source: POST")).toBeNull();
});
