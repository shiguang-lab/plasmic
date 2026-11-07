import { useTourStepTargetVisibility } from "@/wab/client/tours/useTourStepTargetVisibility";
import { act, cleanup, renderHook } from "@testing-library/react";

let target: HTMLButtonElement;
beforeEach(() => {
  vi.useFakeTimers();
  target = document.createElement("button");
  target.id = "target";
  document.body.append(target);
  vi.spyOn(target, "getBoundingClientRect").mockReturnValue({ width: 80, height: 30 } as DOMRect);
});
afterEach(() => { cleanup(); target.remove(); vi.restoreAllMocks(); vi.useRealTimers(); });

it("checks each new step's target before allowing its tour to mount", () => {
  const changed = vi.fn();
  const view = renderHook(({ selector }) => useTourStepTargetVisibility(true, selector, changed), {
    initialProps: { selector: "#target" },
  });
  expect(view.result.current.isTargetVisible).toBe(true);
  view.rerender({ selector: "#next-target" });
  expect(view.result.current.isTargetVisible).toBe(false);
  expect(changed.mock.calls).toEqual([[true], [false]]);
  target.id = "next-target";
  act(() => vi.advanceTimersByTime(1500));
  expect(view.result.current.isTargetVisible).toBe(true);
  expect(changed.mock.calls).toEqual([[true], [false], [true]]);
});

it("pauses checks while a tutorial step is being prepared and releases its timer on unmount", () => {
  const changed = vi.fn();
  const view = renderHook(({ run }) => useTourStepTargetVisibility(run, "#target", changed), { initialProps: { run: true } });
  expect(view.result.current.isTargetVisible).toBe(true);
  view.rerender({ run: false });
  target.style.display = "none";
  act(() => vi.advanceTimersByTime(3000));
  expect(view.result.current.isTargetVisible).toBe(false);
  expect(changed.mock.calls).toEqual([[true]]);
  view.rerender({ run: true });
  expect(view.result.current.isTargetVisible).toBe(false);
  expect(changed.mock.calls).toEqual([[true], [false]]);
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it("requires a layout box before showing a tour", () => {
  const changed = vi.fn();
  vi.mocked(target.getBoundingClientRect).mockReturnValue({ width: 0, height: 0 } as DOMRect);
  const view = renderHook(() => useTourStepTargetVisibility(true, "#target", changed));
  expect(view.result.current.isTargetVisible).toBe(false);
  expect(changed).not.toHaveBeenCalled();
});
