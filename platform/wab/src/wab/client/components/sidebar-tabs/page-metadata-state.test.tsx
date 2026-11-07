import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import PageMetaPanel from "@/wab/client/components/sidebar-tabs/PageMetaPanel";
import PageParamsPanel from "@/wab/client/components/sidebar-tabs/PageParamsPanel";
import { usePageDetailsSpec } from "@/wab/client/components/sidebar-tabs/page-details-state";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { ensure } from "@/wab/shared/common";
import { ComponentType, mkComponent, mkPageMeta } from "@/wab/shared/core/components";
import { tryExtractJson } from "@/wab/shared/core/exprs";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplTag } from "@/wab/shared/core/tpls";
import { mkDataSourceOpExpr } from "@/wab/shared/data-sources-meta/data-sources";
import { ComponentDataQuery, DataSourceTemplate, Expr, ObjectPath } from "@/wab/shared/model/classes";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import React from "react";

vi.mock("@/wab/client/components/sidebar/SidebarSection", () => ({
  SidebarSection: ({ children }: React.PropsWithChildren) => <section>{children}</section>,
}));
vi.mock("@/wab/client/components/sidebar/sidebar-helpers", () => ({
  LabeledItemRow: ({ label, children }: React.PropsWithChildren<{ label: string }>) => <label>{label}{children}</label>,
}));
vi.mock("@/wab/client/components/widgets/LabelWithDetailedTooltip", () => ({
  LabelWithDetailedTooltip: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
}));
vi.mock("@/wab/client/components/sidebar-tabs/ComponentProps/StringPropEditor", () => ({
  StringPropEditor: ({ value, onChange }: { value: string; onChange(value: string): void }) => <input value={value} onChange={(event) => onChange(event.target.value)} />,
  isTemplatedStringEditorValue: () => true,
}));
vi.mock("@/wab/client/components/sidebar-tabs/PropEditorRow", () => ({
  PropEditorRow: ({ expr }: { expr: Expr | undefined }) => <output aria-label="title">{expr ? String(tryExtractJson(expr)) : ""}</output>,
}));

afterEach(cleanup);

async function fixture() {
  const site = createSite();
  const page = mkComponent({ name: "Details", type: ComponentType.Page, tplTree: mkTplTag("div"),
    pageMeta: mkPageMeta({ path: "/items/[id]/[[...rest]]", params: { id: "first", "...rest": "more" }, title: "Original" }),
  });
  site.components.push(page);
  const native = fakeStudioCtx({ site });
  await waitFor(() => expect(native.studioCtx.initialRouteReady).toBe(true));
  native.studioCtx.createViewStateUndoRecord();
  return { ...native, page, meta: ensure(page.pageMeta, "Page metadata") };
}

it("updates native page fields after commit, undo and redo while unrelated fields leave parameters alone", async () => {
  const f = await fixture();
  const parameterCommits = vi.fn();
  const view = render(<StudioCtxContext.Provider value={f.studioCtx}>
    <PageMetaPanel page={f.page as Parameters<typeof PageMetaPanel>[0]["page"]} viewCtx={{} as ViewCtx} />
    <React.Profiler id="params" onRender={parameterCommits}><PageParamsPanel page={f.page} /></React.Profiler>
  </StudioCtxContext.Provider>);
  try {
    expect((screen.getByLabelText("id") as HTMLInputElement).value).toBe("first");
    expect((screen.getByLabelText("...rest") as HTMLInputElement).value).toBe("more");
    const input = screen.getByLabelText("id") as HTMLInputElement;
    parameterCommits.mockClear();
    await act(async () => { await f.studioCtx.changeUnsafe(() => { f.meta.title = "Renamed"; }); });
    expect(screen.getByLabelText("title").textContent).toBe("Renamed");
    expect(parameterCommits).not.toHaveBeenCalled();
    await act(async () => { await f.studioCtx.changeUnsafe(() => {
      f.meta.params.id = "committed";
      expect(input.value).toBe("first");
    }); });
    expect(input.value).toBe("committed");
    await act(async () => { await f.studioCtx.undo(); });
    expect(input.value).toBe("first");
    await act(async () => { await f.studioCtx.redo(); });
    expect(input.value).toBe("committed");
    await act(async () => { fireEvent.change(input, { target: { value: "typed" } }); });
    await waitFor(() => expect(f.meta.params.id).toBe("typed"));
    expect(screen.getByLabelText("id")).toBe(input);
    await act(async () => { await f.studioCtx.changeUnsafe(() => {
      f.page.pageMeta = mkPageMeta({ path: "/new/[slug]", params: { slug: "replacement" }, title: "Replacement" });
    }); });
    expect(screen.queryByLabelText("id")).toBeNull();
    expect((screen.getByLabelText("slug") as HTMLInputElement).value).toBe("replacement");
    expect(screen.getByLabelText("title").textContent).toBe("Replacement");
  } finally { view.unmount(); f.studioCtx.dispose(); }
});

it("publishes record lookup inputs from nested query commits and releases the native model subscription", async () => {
  const f = await fixture();
  const op = mkDataSourceOpExpr({ sourceId: "source", opId: "operation", opName: "getList", templates: {
    resource: new DataSourceTemplate({ fieldType: "table", value: JSON.stringify("items"), bindings: null }),
    filters: new DataSourceTemplate({ fieldType: "filter[]", value: JSON.stringify({ tree: { combinator: "and", rules: [{ field: "id", operator: "=", value: "binding" }] }, fields: [{ name: "id" }] }),
      bindings: { binding: new ObjectPath({ path: ["$ctx", "params", "id"], fallback: null }) } }),
  } });
  await f.studioCtx.changeUnsafe(() => {
    f.meta.path = "/items/[id]";
    f.page.dataQueries.push(new ComponentDataQuery({ uuid: "lookup", name: "Lookup", op }));
  });
  const subscribeModel = f.studioCtx.subscribeModelChanges.bind(f.studioCtx);
  const stops: (() => void)[] = [];
  const subscribe = vi.spyOn(f.studioCtx, "subscribeModelChanges").mockImplementation((listener) => {
    const unsubscribe = subscribeModel(listener);
    const stop = vi.fn<() => void>(() => { unsubscribe(); });
    stops.push(stop);
    return stop;
  });
  const view = renderHook(() => usePageDetailsSpec(f.studioCtx, f.page));
  try {
    expect(view.result.current).toEqual({ sourceId: "source", tableId: "items", pathParams: ["id"] });
    const initial = view.result.current;
    expect(Object.isFrozen(initial)).toBe(true);
    expect(Object.isFrozen(initial?.pathParams)).toBe(true);
    await act(async () => { await f.studioCtx.changeUnsafe(() => { f.meta.title = "Unrelated"; }); });
    expect(view.result.current).toBe(initial);
    await act(async () => { await f.studioCtx.changeUnsafe(() => { op.templates.resource.value = JSON.stringify("other"); }); });
    expect(view.result.current?.tableId).toBe("other");
    await act(async () => { await f.studioCtx.changeUnsafe(() => { op.opName = "create"; }); });
    expect(view.result.current).toBeUndefined();
    expect(subscribe).toHaveBeenCalledOnce();
    await act(async () => { await f.studioCtx.changeUnsafe(() => { op.opName = "getList"; }); });
    expect(view.result.current?.tableId).toBe("other");
    await act(async () => { await f.studioCtx.changeUnsafe(() => { f.studioCtx.site.components.splice(f.studioCtx.site.components.indexOf(f.page), 1); }); });
    expect(view.result.current).toBeUndefined();
    view.unmount();
    expect(stops[0]).toHaveBeenCalledOnce();
    await f.studioCtx.changeUnsafe(() => { op.opName = "getList"; });
    expect(subscribe).toHaveBeenCalledOnce();
  } finally { view.unmount(); f.studioCtx.dispose(); }
});
