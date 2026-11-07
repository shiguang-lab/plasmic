import { applyCanvasSessionState, canvasSessionInstanceKey, CanvasSessionState } from "@/wab/client/components/canvas/canvas-session-state";

it("observes native overlay events without an implicit state and isolates editing reveals", () => {
  const session = new CanvasSessionState();
  const onOpenChange = vi.fn();
  session.resolve("tooltip[0]", "open", undefined, false);
  session.reveal("tooltip[0]", "open", true);
  const render = vi.fn(() => {
    const props: Record<string, any> = { defaultOpen: false, onOpenChange };
    const states = applyCanvasSessionState(session, "tooltip[0]", props, [], true, vi.fn(), true);
    props.__canvas.states = states;
    return props;
  });
  let result: ReturnType<typeof render> | undefined;
  const store = session.instanceStore("tooltip[0]");
  const stop = store.subscribe(() => { result = undefined; });
  const cached = { get: () => result ?? (result = render()) };
  expect(cached.get().open).toBe(false);
  expect(cached.get().__canvas.getState("open").value).toBe(false);
  expect(session.get("tooltip[0]", "open")).toBe(true);
  expect(onOpenChange).not.toHaveBeenCalled();
  cached.get().onOpenChange(true);
  expect(cached.get().open).toBe(true);
  cached.get().onOpenChange(false);
  expect(cached.get().open).toBe(false);
  expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
  expect(render).toHaveBeenCalledTimes(3);
  stop();
});

it.each([undefined, false, true])("overlay defaults and controlled open retain native ownership: %s", (open) => {
  const session = new CanvasSessionState();
  const callback = vi.fn();
  const render = (interactive: boolean) => {
    const props = { open, defaultOpen: true, onOpenChange: callback };
    applyCanvasSessionState(session, "overlay", props, [], interactive, vi.fn(), true);
    return props;
  };
  const editing = render(false);
  session.reveal("overlay", "open", false);
  expect(render(false).open).toBe(false);
  expect(render(true).open).toBe(open ?? true);
  render(true).onOpenChange(false);
  expect(render(true).open).toBe(open ?? false);
  expect(callback).toHaveBeenCalledExactlyOnceWith(false);
  expect(editing.defaultOpen).toBe(true);
});

it.each([undefined, true])("delayed overlay close updates runtime without dismissing the editing reveal or invoking business callbacks: %s", (open) => {
  const session = new CanvasSessionState();
  const callback = vi.fn();
  const render = (interactive: boolean) => {
    const props: Record<string, any> = { open, defaultOpen: false, onOpenChange: callback };
    applyCanvasSessionState(session, "overlay", props, [], interactive, vi.fn(), true);
    return props;
  };
  render(true).onOpenChange(true);
  session.reveal("overlay", "open", true);
  render(false).onOpenChange(false);
  expect(render(false).open).toBe(true);
  expect(render(true).open).toBe(open ?? false);
  expect(callback).toHaveBeenCalledExactlyOnceWith(true);
});

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


it("isolates render-slot clones despite shared generated implicit-state props", () => {
  const session = new CanvasSessionState();
  let implicitOpen = false;
  const callback = vi.fn((open: boolean) => { implicitOpen = open; });
  const render = (scope: string, controlled = false) => {
    const props: Record<string, any> = { open: implicitOpen, onOpenChange: callback };
    applyCanvasSessionState(session, canvasSessionInstanceKey("column.tooltip[0]", scope), props,
      [{ valueProp: "open", onChangeProp: "onOpenChange", controlled }], true, vi.fn(), true,
      controlled ? { open: implicitOpen } : {});
    return props;
  };
  const first = render("row-a");
  expect(first.open).toBeUndefined();
  first.onOpenChange(true);
  expect(implicitOpen).toBe(true);
  expect(render("row-a").open).toBe(true);
  expect(render("row-b").open).toBeUndefined();
  expect(render("row-b", true).open).toBe(true);
  render("row-a").onOpenChange(false);
  expect(render("row-a").open).toBe(false);
  expect(render("row-b").open).toBeUndefined();
  expect(callback.mock.calls).toEqual([[true], [false]]);
  expect(first.__canvas.instance).toBe(canvasSessionInstanceKey("column.tooltip[0]", "row-a"));
});

it("publishes shallow readonly runtime views only for changed instances and retains no-op identities", () => {
  const session = new CanvasSessionState();
  session.resolve("first", "selected", undefined, ["a"]);
  session.resolve("first", "open", false);
  session.resolve("second", "open", false);
  const first = session.instanceStore("first"), second = session.instanceStore("second");
  const notify = vi.fn(), other = vi.fn();
  const stop = first.subscribe(notify), stopOther = second.subscribe(other);
  const before = first.getState(), untouched = second.getState();
  session.resolve("first", "selected", undefined, ["a"]);
  session.set("first", "selected", ["a"]);
  expect(first.getState()).toBe(before);
  expect(notify).not.toHaveBeenCalled();
  const selected = ["b"];
  session.set("first", "selected", selected);
  selected.push("uncommitted");
  expect(first.getState().selected.value).toEqual(["b"]);
  expect(first.getState().open).toBe(before.open);
  expect(second.getState()).toBe(untouched);
  expect(notify).toHaveBeenCalledTimes(1);
  expect(other).not.toHaveBeenCalled();
  stop(); stopOther();
  session.dispose();
});

it("invalidates the owning render before publishing an instance snapshot and stops on disposal", () => {
  const session = new CanvasSessionState();
  session.resolve("instance", "open", false);
  const order: string[] = [];
  session.subscribeToChanges((key) => { order.push(`invalidate:${key}`); });
  const stop = session.instanceStore("instance").subscribe(() => order.push("publish"));
  session.set("instance", "open", true);
  expect(order).toEqual(["invalidate:instance", "publish"]);
  stop();
  session.dispose();
  order.length = 0;
  session.set("instance", "open", false);
  expect(order).toEqual([]);
});
