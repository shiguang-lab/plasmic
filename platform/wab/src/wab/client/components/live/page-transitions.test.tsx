import { PAGE_TRANSITION_PRESETS, runPageTransition } from "@plasmic-shared/preview";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { usePublishedRoute } from "../../../../../../preview/components/usePublishedRoute";

function mockTransitions(reducedMotion = false) {
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: query === "(prefers-reduced-motion: reduce)" && reducedMotion,
  } as MediaQueryList));
  const effects: { preset?: string; direction?: string; css: string }[] = [];
  const start = vi.fn((update: () => void | Promise<void>) => {
    const style = document.querySelector<HTMLStyleElement>("style[data-plasmic-page-transition]");
    effects.push({ preset: style?.dataset.plasmicPageTransition, direction: style?.dataset.direction, css: style?.textContent ?? "" });
    const updated = Promise.resolve().then(update);
    return { ready: updated, updateCallbackDone: updated, finished: updated, skipTransition: vi.fn() } as unknown as ViewTransition;
  });
  const original = document.startViewTransition;
  document.startViewTransition = start;
  return { start, effects, restore: () => { document.startViewTransition = original; } };
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("has only concrete presets and uses push-right when the action has no configured effect", async () => {
  expect(PAGE_TRANSITION_PRESETS).toEqual(["none", "fade", "push-right", "slide-up"]);
  const mock = mockTransitions();
  try {
    const update = vi.fn();
    await runPageTransition(document, update, { device: "phone" });
    expect(mock.effects[0].preset).toBe("push-right");
    expect(mock.effects[0].css).toContain("300ms");
    expect(update).toHaveBeenCalledOnce();
    expect(document.querySelector("[data-plasmic-page-transition]")).toBeNull();
  } finally { mock.restore(); }
});

it.each([
  { device: "desktop" as const, reducedMotion: false, preset: "fade" as const },
  { device: "custom" as const, reducedMotion: false, preset: "push-right" as const },
  { device: "phone" as const, reducedMotion: true, preset: "slide-up" as const },
  { device: "tablet" as const, reducedMotion: false, preset: "none" as const },
])("still commits without animation for %j", async ({ device, reducedMotion, preset }) => {
  const mock = mockTransitions(reducedMotion);
  try {
    const update = vi.fn();
    await runPageTransition(document, update, { preset, device });
    expect(update).toHaveBeenCalledOnce();
    expect(mock.start).not.toHaveBeenCalled();
  } finally { mock.restore(); }
});

it("updates without the browser API and does not animate a non-navigation render", async () => {
  const mock = mockTransitions();
  try {
    const update = vi.fn();
    await runPageTransition(document, update);
    document.startViewTransition = undefined as unknown as Document["startViewTransition"];
    await runPageTransition(document, update, { device: "phone" });
    expect(update).toHaveBeenCalledTimes(2);
    expect(mock.start).not.toHaveBeenCalled();
  } finally { mock.restore(); }
});

it("cleans failed transitions and allows the next navigation to complete", async () => {
  const mock = mockTransitions();
  try {
    await expect(runPageTransition(document, async () => { throw new Error("render failed"); }, { preset: "fade", device: "phone" })).rejects.toThrow("render failed");
    expect(document.querySelector("[data-plasmic-page-transition]")).toBeNull();
    const update = vi.fn();
    await runPageTransition(document, update, { preset: "slide-up", reverse: true, device: "tablet" });
    expect(update).toHaveBeenCalledOnce();
    expect(mock.effects[1]).toMatchObject({ preset: "slide-up", direction: "back" });
    expect(mock.effects[1].css).toContain("to { transform: translateY(100%) }");
  } finally { mock.restore(); }
});

it("serializes rapid navigations while allowing the previous animation to be skipped", async () => {
  const mock = mockTransitions();
  try {
    let finish: () => void = () => undefined;
    const order: string[] = [];
    const first = runPageTransition(document, () => new Promise<void>((resolve) => {
      order.push("first started");
      finish = () => { order.push("first committed"); resolve(); };
    }), { preset: "fade", device: "phone" });
    const second = runPageTransition(document, () => { order.push("second committed"); }, { preset: "push-right", device: "phone" });
    await Promise.resolve();
    expect(order).toEqual(["first started"]);
    finish();
    await Promise.all([first, second]);
    expect(order).toEqual(["first started", "first committed", "second committed"]);
  } finally { mock.restore(); }
});

it("published routes retain effects across back/forward and skip query/hash/initial navigation", async () => {
  const mock = mockTransitions();
  const pages = [{ id: "list", name: "List", path: "/list" }, { id: "detail", name: "Detail", path: "/detail" }];
  window.history.replaceState({ hostValue: "preserve" }, "", "/s/0123456789#/list");
  const hook = renderHook(() => usePublishedRoute("/list", pages, "tablet"));
  try {
    expect(hook.result.current.hash).toBe("#/list");
    expect(mock.start).not.toHaveBeenCalled();
    const browserBack = vi.spyOn(window.history, "back");
    act(() => hook.result.current.goBack());
    expect(browserBack).not.toHaveBeenCalled();
    await act(async () => hook.result.current.navigate("/s/0123456789#/detail", false, "slide-up"));
    expect(mock.effects).toMatchObject([{ preset: "slide-up", direction: "forward" }]);
    expect(window.history.state.hostValue).toBe("preserve");
    await act(async () => hook.result.current.goBack());
    await waitFor(() => expect(hook.result.current.hash).toBe("#/list"));
    expect(mock.effects[1]).toMatchObject({ preset: "slide-up", direction: "back" });
    await act(async () => { window.history.forward(); });
    await waitFor(() => expect(hook.result.current.hash).toBe("#/detail"));
    expect(mock.effects[2]).toMatchObject({ preset: "slide-up", direction: "forward" });
    await act(async () => hook.result.current.navigate("/s/0123456789#/detail?tab=2#field", false, "fade"));
    expect(mock.start).toHaveBeenCalledTimes(3);
    await act(async () => hook.result.current.navigate("/s/0123456789#/list", true, "none"));
    expect(hook.result.current.hash).toBe("#/list");
    expect(mock.start).toHaveBeenCalledTimes(3);
  } finally { hook.unmount(); mock.restore(); }
});
