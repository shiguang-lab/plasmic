import { bindShortcutHandlers } from "@/wab/client/shortcuts/shortcut-handler";
import { Shortcuts } from "@/wab/client/shortcuts/shortcut";

vi.mock("@/wab/client/observability", () => ({ analytics: () => ({ track: vi.fn() }) }));

const shortcuts: Shortcuts<"close"> = {
  close: { action: "close", combos: ["esc"], description: "Close" },
};
function escape(target: Element | Document) {
  target.dispatchEvent(new KeyboardEvent("keydown", {
    key: "Escape", keyCode: 27, which: 27, bubbles: true, cancelable: true,
  }));
}

afterEach(() => vi.restoreAllMocks());

it("removes its native keyboard listeners on every bind/unbind cycle", () => {
  const target = document.createElement("div");
  const add = vi.spyOn(target, "addEventListener");
  const remove = vi.spyOn(target, "removeEventListener");
  const handler = vi.fn();
  for (let i = 0; i < 20; i++) {
    const dispose = bindShortcutHandlers(target, shortcuts, { close: handler });
    expect(target.addEventListener).toBe(add);
    escape(target);
    dispose();
    escape(target);
  }
  expect(handler).toHaveBeenCalledTimes(20);
  const nativeAdds = add.mock.calls.filter(([type]) => ["keydown", "keyup", "keypress"].includes(type));
  expect(nativeAdds).toHaveLength(60);
  for (const [type, listener, options] of nativeAdds) {
    expect(remove).toHaveBeenCalledWith(type, listener, options);
  }
});

it("preserves another active binding and unrelated listeners on the same target", () => {
  const target = document.createElement("div");
  const unrelated = vi.fn(), first = vi.fn(), second = vi.fn();
  target.addEventListener("keydown", unrelated);
  const disposeFirst = bindShortcutHandlers(target, shortcuts, { close: first });
  const disposeSecond = bindShortcutHandlers(target, shortcuts, { close: second });
  escape(target);
  disposeFirst();
  disposeFirst();
  escape(target);
  expect(first).toHaveBeenCalledOnce();
  expect(second).toHaveBeenCalledTimes(1);
  expect(unrelated).toHaveBeenCalledTimes(2);
  disposeSecond();
  escape(target);
  expect(second).toHaveBeenCalledTimes(1);
  expect(unrelated).toHaveBeenCalledTimes(3);
});

it("releases Document bindings and restores the original method descriptor", () => {
  const descriptor = Object.getOwnPropertyDescriptor(document, "addEventListener");
  const handler = vi.fn();
  const dispose = bindShortcutHandlers(document, shortcuts, { close: handler });
  expect(Object.getOwnPropertyDescriptor(document, "addEventListener")).toEqual(descriptor);
  escape(document);
  dispose();
  escape(document);
  expect(handler).toHaveBeenCalledOnce();
});

it("applies the mode guard to Escape and leaves composition and consumed keys alone", () => {
  const target = document.createElement("div"), handler = vi.fn(), guard = vi.fn(() => false);
  const dispose = bindShortcutHandlers(target, shortcuts, { close: handler }, guard);
  try {
    escape(target); expect(guard).toHaveBeenCalledOnce(); expect(handler).not.toHaveBeenCalled();
    guard.mockReturnValue(true);
    const composing = new KeyboardEvent("keydown", { key: "Escape", keyCode: 27, which: 27, isComposing: true, cancelable: true });
    target.dispatchEvent(composing); expect(handler).not.toHaveBeenCalled(); expect(composing.defaultPrevented).toBe(false);
    escape(target); expect(handler).toHaveBeenCalledOnce();
  } finally { dispose(); }
});
