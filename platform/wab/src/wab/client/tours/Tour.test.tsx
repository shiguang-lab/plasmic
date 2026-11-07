import { tourSeenTopProjectNavKey } from "@/wab/client/LocalStorageKey";
import { Tour } from "@/wab/client/tours/Tour";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { Signal } from "signals";

const fixture = vi.hoisted(() => ({
  api: { getStorageItem: vi.fn(), addStorageItem: vi.fn() },
  studioCtx: { appCtx: { selfInfo: {} as object | undefined }, showProjectPanel: vi.fn() },
}));
vi.mock("@/wab/client/contexts/AppContexts", () => ({ useApi: () => fixture.api }));
vi.mock("@/wab/client/contexts/StudioContexts", () => ({ useStudioCtx: () => fixture.studioCtx }));

vi.mock("@/wab/client/components/widgets/Button", () => ({
  default: ({ children, onClick }: React.PropsWithChildren<{ onClick: () => void }>) => <button onClick={onClick}>{children}</button>,
}));

let target: HTMLElement;
let signal: Signal;
beforeEach(() => {
  vi.clearAllMocks();
  // jsdom 22 has no browser top layer. NWSAPI 2.2.27 delegates these native
  // pseudo-states back to Element.matches(), recursively re-entering itself.
  // Supply only those native states; retain real matching for every other selector.
  const matches = Element.prototype.matches;
  vi.spyOn(Element.prototype, "matches").mockImplementation(function (this: Element, selector: string) {
    if (selector === ":fullscreen") { return this.ownerDocument.fullscreenElement === this; }
    if (selector === ":modal") { return false; }
    return matches.call(this, selector);
  });
  fixture.api.getStorageItem.mockResolvedValue(undefined);
  fixture.api.addStorageItem.mockResolvedValue(undefined);
  fixture.studioCtx.appCtx.selfInfo = {};
  signal = new Signal();
  target = document.createElement("button");
  target.id = "tour-target";
  document.body.append(target);
  // jsdom has no layout; exercise real Joyride with a measurable native target.
  vi.spyOn(target, "getBoundingClientRect").mockReturnValue({ x: 30, y: 30, left: 30, top: 30, right: 110, bottom: 60, width: 80, height: 30, toJSON() { return { x:30, y:30, width:80, height:30 }; } });
});
afterEach(() => { cleanup(); target.remove(); vi.restoreAllMocks(); vi.useRealTimers(); });

function openTour() {
  return render(<React.Suspense fallback={null}><Tour
    seenStateKey={tourSeenTopProjectNavKey}
    onlyUsersCreatedBefore="2022-11-01"
    targetSelector="#tour-target"
    didActionSignal={signal}
    content={<p>Navigation help</p>}
  /></React.Suspense>);
}
function expectNoTour() {
  expect(document.querySelector(".react-joyride__loader")).toBeNull();
  expect(document.querySelector(".react-joyride__overlay")).toBeNull();
  expect(screen.queryByText("Navigation help")).toBeNull();
}

it.each(["missing", "hidden", "hidden-parent"])("does not block the editor for a %s target and shows help when it becomes visible", async (state) => {
  // Drive target polling independently of the real Joyride loader/transition timers.
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  const wrapper = document.createElement("div");
  document.body.append(wrapper);
  if (state === "missing") {target.remove();}
  if (state === "hidden") {target.style.visibility = "hidden";}
  if (state === "hidden-parent") { wrapper.style.display = "none"; wrapper.append(target); }
  const view = openTour();
  await waitFor(() => expect(fixture.api.getStorageItem).toHaveBeenCalled());
  // Cover the new v3 default loader delay (300ms) and missing-target timeout (1s).
  await act(() => new Promise((resolve) => setTimeout(resolve, 1200)));
  expectNoTour();
  expect(fixture.api.addStorageItem).not.toHaveBeenCalled();
  target.style.visibility = "visible";
  wrapper.style.display = "block";
  if (state === "missing") {document.body.append(target);}
  await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
  await screen.findByText("Navigation help", {}, { timeout: 2200 });
  fireEvent.click(screen.getByRole("button", { name: /Got it/ }));
  await waitFor(() => expectNoTour());
  expect(fixture.studioCtx.showProjectPanel).toHaveBeenCalledTimes(1);
  expect(fixture.api.addStorageItem).toHaveBeenCalledExactlyOnceWith(tourSeenTopProjectNavKey, "true");
  view.unmount(); wrapper.remove();
}, 30000);

it.each(["signal", "escape"])("dismisses visible help using %s and releases listeners on unmount", async (action) => {
  const view = openTour();
  await screen.findByText("Navigation help");
  if (action === "signal") {act(() => signal.dispatch());}
  else {fireEvent.keyDown(document.body, { key: "Escape" });}
  await waitFor(() => expectNoTour());
  expect(fixture.api.addStorageItem).toHaveBeenCalledExactlyOnceWith(tourSeenTopProjectNavKey, "true");
  view.unmount();
  expect(signal.getNumListeners()).toBe(0);
});

it.each(["seen", "anonymous"])("does not start for an %s user", async (state) => {
  if (state === "seen") {fixture.api.getStorageItem.mockResolvedValue("true");}
  else {fixture.studioCtx.appCtx.selfInfo = undefined;}
  openTour();
  await act(async () => { await Promise.resolve(); });
  expectNoTour();
});

it("removes the overlay when the target disappears and does not mark the help as read", async () => {
  const view = openTour();
  await screen.findByText("Navigation help");
  target.remove();
  await waitFor(() => expectNoTour(), { timeout: 2200 });
  expect(fixture.api.addStorageItem).not.toHaveBeenCalled();
  document.body.append(target);
  await screen.findByText("Navigation help", {}, { timeout: 2200 });
  view.unmount();
  expectNoTour();
  expect(signal.getNumListeners()).toBe(0);
// jsdom's CSS selector/style resolver is slow across both tooltip mounts;
// the actual browser checks use native layout and their own short deadlines.
}, 60000);
