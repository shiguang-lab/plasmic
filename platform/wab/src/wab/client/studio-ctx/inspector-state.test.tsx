import { InspectorSelection } from "@/wab/client/studio-ctx/inspector-selection";
import { useInspectorComponentEvalContext, useInspectorPending } from "@/wab/client/studio-ctx/inspector-state";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { act, cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { createStore } from "zustand/vanilla";

afterEach(cleanup);

it("renders native Inspector subscribers, defers pending reads, and detaches replaced selections", () => {
  const tpl = mkTplTagX("div");
  let value = "first";
  const evaluate = vi.fn(() => ({ componentPropValues: { value }, ccContextData: undefined, invalidArgs: [] }));
  const store = createStore<{ selection: InspectorSelection | undefined; pending: boolean }>(() => ({ selection: undefined, pending: false }));
  const studio = { inspectorStore: store } as unknown as StudioCtx;
  const view = {
    studioCtx: studio,
    currentComponentCtx: () => null,
    focusedTpl: () => tpl,
    focusedTpls: () => [tpl],
    focusedSelectable: () => null,
    focusedCloneKey: () => undefined,
    getComponentEvalContext: evaluate,
    maybeTpl2ValsInContext: () => [],
    getInspectorReadOwner: () => store.getState().selection,
  } as unknown as ViewCtx;
  const first = new InspectorSelection(view, 1);
  store.setState({ selection: first });
  function PropertyValue() {
    const context = useInspectorComponentEvalContext(view, tpl);
    return <span>{context.componentPropValues.value}</span>;
  }
  function Pending() {
    return <output>{String(useInspectorPending(studio))}</output>;
  }
  render(<><PropertyValue /><PropertyValue /><Pending /></>);
  expect(evaluate).toHaveBeenCalledTimes(2);
  expect(screen.getAllByText("first")).toHaveLength(2);
  act(() => { first.pause(); store.setState({ pending: true }); value = "pending"; first.syncCanvas(); });
  expect(screen.getByText("true")).toBeTruthy();
  expect(screen.getAllByText("first")).toHaveLength(2);
  expect(evaluate).toHaveBeenCalledTimes(2);
  const second = new InspectorSelection(view, 2);
  act(() => { store.setState({ selection: second, pending: false }); first.dispose(); });
  expect(screen.getAllByText("pending")).toHaveLength(2);
  expect(evaluate).toHaveBeenCalledTimes(4);
  act(() => { value = "updated"; second.syncCanvas(); });
  expect(screen.getAllByText("updated")).toHaveLength(2);
  expect(evaluate).toHaveBeenCalledTimes(5);
  act(() => { value = "disposed"; first.syncCanvas(); });
  expect(screen.queryByText("disposed")).toBeNull();
  second.dispose();
});
