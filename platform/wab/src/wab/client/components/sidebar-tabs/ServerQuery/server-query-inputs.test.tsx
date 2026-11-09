import { QueryDataTokenNames, ServerFunctionCatalogInputs, ServerQueryInputs, ServerQueryListInputs, useQueryDataTokenNames, useServerFunctionCatalog } from "@/wab/client/components/sidebar-tabs/ServerQuery/server-query-inputs";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { StudioArenaState } from "@/wab/client/studio-ctx/studio-arena-state";
import type { StudioCtx, ModelCommit } from "@/wab/client/studio-ctx/StudioCtx";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { TplMgr } from "@/wab/shared/TplMgr";
import { mkCustomFunction } from "@/wab/shared/__testonly__/site-tests-utils";
import { ensure } from "@/wab/shared/common";
import { mkDataToken } from "@/wab/commons/DataToken";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { ComponentServerQuery, CustomCode, isKnownCustomCode } from "@/wab/shared/model/classes";
import { act, cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { mock } from "vitest-mock-extended";

const disposals: (() => void)[] = [];
afterEach(() => {cleanup(); disposals.splice(0).forEach((stop) => stop());});
function fixture() {
  const context = {site: createSite(), modelSnapshots: new ModelSnapshots()};
  const arenaState = new StudioArenaState(context), studio = mock<StudioCtx>();
  const modelCommits = new Set<(event: ModelCommit) => void>();
  studio.subscribeModelChanges.mockImplementation((listener) => { modelCommits.add(listener); return () => { modelCommits.delete(listener); }; });
  Object.defineProperties(studio, {site: {get: () => context.site}, modelSnapshots: {get: () => context.modelSnapshots}, arenaState: {value: arenaState}});
  const manager = new TplMgr({site: context.site}), component = manager.addComponent({name: "Queries", type: ComponentType.Plain});
  const recorder = new ChangeRecorder({inst: context.site, _instUtil: instUtil});
  const controller = new AbortController(), view = mock<ViewCtx>();
  Object.defineProperty(view, "disposeSignal", {value: controller.signal});
  const edit = (command: () => void) => context.modelSnapshots.sync(recorder.withRecording(command).changes);
  disposals.push(() => {controller.abort(); arenaState.dispose(); context.modelSnapshots.dispose(); recorder.dispose();});
  return {context, arenaState, studio, manager, component, recorder, edit, view, modelCommits};
}

it("publishes original query handles, nested operation edits and query-copy catalog changes", () => {
  const f = fixture(), op = new CustomCode({code: "1", fallback: null});
  const query = new ComponentServerQuery({uuid: "query", name: "First", op});
  f.edit(() => f.component.serverQueries.push(query));
  const row = new ServerQueryInputs(f.studio, query, f.view), list = new ServerQueryListInputs(f.studio, f.component, f.view);
  const changed = vi.fn(), off = row.subscribe(changed), offList = list.subscribe(vi.fn());
  disposals.push(off, offList);
  const before = row.getSnapshot();
  expect(row.resolve(ensure(before.op, "Query operation"))).toBe(op);
  f.edit(() => {op.code = "2"; query.name = "Renamed";});
  expect(row.getSnapshot().name).toBe("Renamed");
  expect(row.getSnapshot().version).not.toBe(before.version);
  expect(changed).toHaveBeenCalledOnce();
  f.edit(() => {
    const other = f.manager.addComponent({name: "Other", type: ComponentType.Plain});
    other.serverQueries.push(new ComponentServerQuery({uuid: "copy", name: "Copy me", op: new CustomCode({code: "3", fallback: null})}));
  });
  expect(list.getSnapshot().other[0].queries[0].name).toBe("Copy me");
  const expression = row.resolve(ensure(row.getSnapshot().op, "Query operation"));
  expect(isKnownCustomCode(expression)).toBe(true);
  f.edit(() => {f.component.name = "Unrelated heading";});
  expect(changed).toHaveBeenCalledOnce();
});

it("updates function metadata and token names through completed finite field publications", () => {
  const f = fixture(), func = mkCustomFunction({importName: "load", namespace: "api"});
  const token = mkDataToken({name: "Before", value: "1"});
  f.edit(() => {f.context.site.customFunctions.push(func); f.context.site.dataTokens.push(token);});
  const functions = new ServerFunctionCatalogInputs(f.studio), names = new QueryDataTokenNames(f.studio);
  const changed = vi.fn(), renamed = vi.fn(), offFunctions = functions.subscribe(changed), offNames = names.subscribe(renamed);
  disposals.push(offFunctions, offNames);
  const before = functions.getSnapshot();
  f.edit(() => {func.isQuery = true; func.displayName = "Load data"; token.name = "After";});
  expect(functions.getSnapshot()).not.toBe(before);
  expect(functions.resolve(functions.getSnapshot().functions[0])).toBe(func);
  expect(names.getSnapshot()).toEqual([{uid: token.uid, name: "After"}]);
  expect(changed).toHaveBeenCalledOnce(); expect(renamed).toHaveBeenCalledOnce();
});

it("rebinds live function/token catalogs after a model-world replacement while old query props stay retired", () => {
  const f = fixture(), first = mkCustomFunction({importName: "first", namespace: "api"});
  f.edit(() => {f.context.site.customFunctions.push(first); f.context.site.dataTokens.push(mkDataToken({name: "First", value: "1"}));});
  const query = new ComponentServerQuery({uuid: "departed", name: "Old query", op: new CustomCode({code: "1", fallback: null})});
  f.edit(() => f.component.serverQueries.push(query));
  const old = new ServerQueryInputs(f.studio, query), off = old.subscribe(vi.fn()); disposals.push(off);
  function Catalog() {
    const {snapshot, source} = useServerFunctionCatalog(f.studio);
    const tokens = useQueryDataTokenNames(f.studio);
    return <output>{snapshot.functions.map((ref) => source.resolve(ref).importName).join(",")}:{tokens.map((token) => token.name).join(",")}</output>;
  }
  render(<Catalog />); expect(screen.getByRole("status").textContent).toBe("first:First");
  const departed = f.context.modelSnapshots;
  const next = createSite(); next.customFunctions.push(mkCustomFunction({importName: "second", namespace: "api"}));
  next.dataTokens.push(mkDataToken({name: "Second", value: "2"}));
  const nextModels = new ModelSnapshots(), fields = vi.spyOn(nextModels, "declaredField");
  act(() => {
    f.arenaState.reset();
    f.context.site = next; f.context.modelSnapshots = nextModels;
    f.arenaState.attachSite();
    f.modelCommits.forEach((listener) => listener({ type: "site-replaced", site: next }));
  });
  expect(screen.getByRole("status").textContent).toBe("second:Second");
  expect(old.getSnapshot().op).toBeUndefined();
  expect(fields.mock.calls.some(([model]) => model === query)).toBe(false);
  departed.dispose();
});
