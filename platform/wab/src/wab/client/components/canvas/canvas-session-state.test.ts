import { applyCanvasSessionState, CanvasSessionState } from "@/wab/client/components/canvas/canvas-session-state";

it("preserves arbitrary registered state through both modes without invoking business handlers", () => {
  const session = new CanvasSessionState();
  const handler = vi.fn(), redraw = vi.fn();
  const specs = [{ valueProp: "expandedIds", onChangeProp: "onExpand", initialValueProp: "initialIds", controlled: false }];
  const render = (interactive: boolean) => {
    const props: Record<string, any> = { initialIds: ["a"], onExpand: handler };
    const bindings = applyCanvasSessionState(session, "instance[0]", props, specs, interactive, redraw);
    return { props, bindings };
  };
  let view = render(false);
  view.bindings.expandedIds.reveal(["b"]);
  expect(render(true).props.expandedIds).toEqual(["b"]);
  expect(render(false).props.expandedIds).toEqual(["b"]);
  expect(handler).not.toHaveBeenCalled();
  view = render(true);
  view.props.onExpand(["c"]);
  expect(handler).toHaveBeenCalledExactlyOnceWith(["c"]);
  expect(render(false).props.expandedIds).toEqual(["c"]);
  expect(render(true).props.expandedIds).toEqual(["c"]);
  render(false).props.onExpand(["a"]);
  expect(handler).toHaveBeenCalledTimes(1);
  expect(render(true).props.expandedIds).toEqual(["a"]);
});

it("honors changed business values and defaults without reapplying stale selection", () => {
  const session = new CanvasSessionState();
  session.resolve("instance", "value", "a", "a");
  session.reveal("instance", "value", "b");
  expect(session.resolve("instance", "value", "c", "a")).toBe("c");
  expect(session.reveal("instance", "value", "b")).toBe("c");
  expect(session.reveal("instance", "value", "d")).toBe("d");
  expect(session.resolve("instance", "value", "c", "e")).toBe("c");
  session.resolve("uncontrolled", "value", undefined, ["a"]);
  session.set("uncontrolled", "value", ["b"]);
  expect(session.resolve("uncontrolled", "value", undefined, ["a"])).toEqual(["b"]);
  expect(session.resolve("uncontrolled", "value", undefined, ["c"])).toEqual(["c"]);
});

it("isolates instances, repeats, state names and artboards and disposes all retained state", () => {
  const first = new CanvasSessionState(), second = new CanvasSessionState();
  first.resolve("row[0]", "open", false);
  first.resolve("row[1]", "open", false);
  first.resolve("row[0]", "checked", false);
  second.resolve("row[0]", "open", false);
  first.reveal("row[0]", "open", true);
  expect(first.get("row[1]", "open")).toBe(false);
  expect(first.get("row[0]", "checked")).toBe(false);
  expect(second.get("row[0]", "open")).toBe(false);
  first.clear();
  expect(first.resolve("row[0]", "open", false)).toBe(false);
});

it("retains hidden-region reveals until dismissed or the business condition changes", () => {
  const session = new CanvasSessionState();
  expect(session.resolve("region", "$visibility", false, "customExpr")).toBe(false);
  expect(session.reveal("region", "$visibility", true)).toBe(true);
  expect(session.resolve("region", "$visibility", false, "customExpr")).toBe(true);
  expect(session.hasReveals).toBe(true);
  session.hideReveals();
  expect(session.reveal("region", "$visibility", true)).toBe(false);
  expect(session.hasReveals).toBe(false);
  expect(session.resolve("region", "$visibility", true, "customExpr")).toBe(true);
  expect(session.resolve("region", "$visibility", false, "customExpr")).toBe(false);
});

it.each([false, true])("updates all states sharing an event and calls business handlers only in interactive mode: %s", (interactive) => {
  const session = new CanvasSessionState();
  const onSelect = vi.fn();
  const props = { selected: undefined, selectedRecords: undefined, onSelect };
  applyCanvasSessionState(session, "tree", props, [
    { valueProp: "selected", onChangeProp: "onSelect", controlled: false },
    { valueProp: "selectedRecords", onChangeProp: "onSelect", controlled: false, onChangeArgsToValue: (_keys, info) => info.nodes },
  ], interactive, vi.fn());
  props.onSelect(["key"], { nodes: ["record"] });
  expect(session.get("tree", "selected")).toEqual(["key"]);
  expect(session.get("tree", "selectedRecords")).toEqual(["record"]);
  expect(onSelect).toHaveBeenCalledTimes(interactive ? 1 : 0);
});

it("returns control to explicit business bindings on real events", () => {
  const session = new CanvasSessionState();
  const callback = vi.fn();
  const props = { open: false, onOpenChange: callback };
  const bindings = applyCanvasSessionState(session, "overlay", props, [
    { valueProp: "open", onChangeProp: "onOpenChange", controlled: true },
  ], true, vi.fn());
  bindings.open.reveal(true);
  props.onOpenChange(false);
  expect(session.get("overlay", "open")).toBe(false);
  expect(callback).toHaveBeenCalledExactlyOnceWith(false);
});

it.each([null, false, 0, ""])("preserves explicit native values instead of substituting defaults: %s", (value) => {
  const session = new CanvasSessionState();
  expect(session.resolve("instance", "value", value, "default")).toBe(value);
});

it("keeps an explicit canvas visibility choice across selection changes, including before first render", () => {
  const session = new CanvasSessionState();
  session.set("overlay", "open", true, true);
  expect(session.resolve("overlay", "open", false)).toBe(true);
  expect(session.reveal("overlay", "open", false)).toBe(true);
  session.hideReveals();
  expect(session.reveal("overlay", "open", true)).toBe(false);
  expect(session.resolve("overlay", "open", true)).toBe(true);
});
