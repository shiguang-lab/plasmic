import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import LeftExprsSearchPanel from "@/wab/client/components/sidebar/LeftExprsSearchPanel";
import type { ModelCommit, StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { CustomCode, ensureKnownTplTag } from "@/wab/shared/model/classes";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";

const ui = vi.hoisted(() => ({ renders: vi.fn(), navigate: undefined as (() => Promise<void>) | undefined }));
vi.mock("@/wab/client/plasmic/plasmic_kit_left_pane/PlasmicLeftExprsSearchPanel", () => ({
  PlasmicLeftExprsSearchPanel: ({exprsText, content}: {exprsText: string; content: React.ReactNode}) => {
    ui.renders(); return <section><output>{exprsText}</output>{content}</section>;
  },
}));
vi.mock("@/wab/client/components/XMultiSelect", () => ({ XMultiSelect: () => null }));
vi.mock("@/wab/client/components/ListItem", () => ({ default: ({children, onClick}: {children: React.ReactNode; onClick: () => Promise<void>}) => {
  ui.navigate = onClick; return <button onClick={onClick}>{children}</button>;
} }));
vi.mock("@/wab/client/components/sidebar/VirtualGroupedList", () => ({
  VirtualGroupedList: ({items, renderItem}: {items: ({type: "group"; key: string; items: {key: string; item: unknown}[]} | {type: "item"; key: string; item: unknown})[]; renderItem: (item: unknown) => React.ReactNode}) => <div>{items.flatMap((item) => item.type === "group" ? item.items : [item]).map((item) => <div key={item.key}>{renderItem(item.item)}</div>)}</div>,
}));

beforeEach(() => {vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(400);});
afterEach(() => {cleanup(); ui.renders.mockClear(); ui.navigate = undefined;});
async function fixture(beforeRender?: (studio: StudioCtx) => void) {
  const site = createSite(), manager = new TplMgr({site});
  const component = manager.addComponent({name: "Expression owner", type: ComponentType.Plain});
  const tpl = ensureKnownTplTag(component.tplTree);
  const expr = new CustomCode({code: "(firstValue)", fallback: null});
  tpl.vsettings[0].attrs.title = expr;
  const {studioCtx} = fakeStudioCtx({site});
  await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
  studioCtx.dbCtx().maybeObserveComponents([component]);
  beforeRender?.(studioCtx);
  const view = render(<StudioCtxContext.Provider value={studioCtx}><LeftExprsSearchPanel /></StudioCtxContext.Provider>);
  return {studioCtx, component, tpl, expr, view};
}

it("refreshes expression text and locations on local model commits before saving, preserving navigation targets", async () => {
  const f = await fixture();
  const focus = vi.spyOn(f.studioCtx, "setStudioFocusOnTpl").mockResolvedValue(undefined);
  try {
    expect(screen.getByText("firstValue")).toBeTruthy();
    await act(async () => {await f.studioCtx.changeUnsafe(() => {f.expr.code = "(secondValue)"; f.component.name = "Renamed owner";});});
    expect(screen.queryByText("firstValue")).toBeNull();
    expect(screen.getByText("secondValue")).toBeTruthy();
    expect(screen.getByText(/Renamed owner/)).toBeTruthy();
    await act(async () => {fireEvent.click(screen.getByRole("button"));});
    expect(focus).toHaveBeenCalledWith(f.component, f.tpl, undefined);
    await act(async () => {await f.studioCtx.changeUnsafe(() => {delete f.tpl.vsettings[0].attrs.title;});});
    expect(screen.queryByText("secondValue")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("Found 0 expressions");
  } finally {f.view.unmount(); f.studioCtx.dispose();}
});

it("keeps unchanged search results stable and retires navigation when its mounted owner closes", async () => {
  const f = await fixture();
  const focus = vi.spyOn(f.studioCtx, "setStudioFocusOnTpl").mockResolvedValue(undefined);
  try {
    const renders = ui.renders.mock.calls.length;
    await act(async () => {await f.studioCtx.changeUnsafe(() => {f.tpl.vsettings[0].rs.values.opacity = "0.5";});});
    expect(ui.renders).toHaveBeenCalledTimes(renders);
    const retained = ensure(ui.navigate, "Rendered expression navigation");
    f.view.unmount();
    await retained();
    expect(focus).not.toHaveBeenCalled();
  } finally {f.view.unmount(); f.studioCtx.dispose();}
});


it("keeps a search already bound to the current world active during its completed replacement publication", async () => {
  let publish: ((event: ModelCommit) => void) | undefined;
  const f = await fixture((studio) => {
    const subscribe = studio.subscribeModelChanges.bind(studio);
    vi.spyOn(studio, "subscribeModelChanges").mockImplementation((listener) => {
      publish = listener;
      return subscribe(listener);
    });
  });
  try {
    // A newly attached catalog can receive the final publication for the world
    // it has just captured; that event must only retire departed owners.
    act(() => ensure(publish, "Search commit subscription")({type: "site-replaced", site: f.studioCtx.site}));
    expect(screen.getByText("firstValue")).toBeTruthy();
    await act(async () => {await f.studioCtx.changeUnsafe(() => {f.expr.code = "(currentWorldValue)";});});
    expect(screen.getByText("currentWorldValue")).toBeTruthy();
  } finally {f.view.unmount(); f.studioCtx.dispose();}
});
