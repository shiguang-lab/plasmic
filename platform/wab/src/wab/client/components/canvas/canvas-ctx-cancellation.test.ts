import { CanvasCtx } from "@/wab/client/components/canvas/canvas-ctx";
import { globalHookCtx } from "@/wab/client/react-global-hook/globalHook";
import { StudioLoadTimings } from "@/wab/client/studio-ctx/studio-load-timings";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { mkArenaFrame } from "@/wab/shared/Arenas";
import { ensure } from "@/wab/shared/common";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplTag } from "@/wab/shared/core/tpls";
import $ from "jquery";
import { mock } from "vitest-mock-extended";

async function fixture() {
  const iframe = document.createElement("iframe");
  document.body.append(iframe);
  const doc = ensure(iframe.contentDocument, "Canvas iframe document");
  const canvas = new CanvasCtx({ $viewport: $(iframe), name: "Cancelled" });
  const site = createSite();
  const component = mkComponent({ name: "Page", type: ComponentType.Plain, tplTree: mkTplTag("div") });
  const frame = mkArenaFrame({ site, component, name: "Cancelled", width: 800, height: 600 });
  const studio = mock<StudioCtx>();
  Object.defineProperty(studio, "loadTimings", { value: new StudioLoadTimings() });
  const init = canvas.initViewPort($(iframe), frame, studio);
  expect(await init.next()).toEqual({ value: "user-body-wait", done: false });
  return { canvas, iframe, doc, frame, studio, init };
}

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); document.body.replaceChildren(); });

it("cancels every pending body observer and fallback interval and resolves their waiters", async () => {
  vi.useFakeTimers();
  const { canvas, doc } = await fixture();
  const disconnect = vi.spyOn(MutationObserver.prototype, "disconnect");
  const first = canvas["waitForUserBody"]();
  const second = canvas["waitForUserBody"]();
  expect(vi.getTimerCount()).toBe(2);
  canvas.dispose();
  await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined]);
  expect(disconnect).toHaveBeenCalledTimes(2);
  expect(vi.getTimerCount()).toBe(0);
  const body = doc.createElement("div"); body.className = "__wab_user-body"; doc.body.append(body);
  await expect(canvas["waitForUserBody"]()).resolves.toBeUndefined();
  expect(vi.getTimerCount()).toBe(0);
});

it("ends a real viewport initializer after cancellation instead of installing runtime inputs in a departed world", async () => {
  const { canvas, frame, studio, init } = await fixture();
  const waiting = init.next();
  expect(globalHookCtx.frames.has(frame.uid)).toBe(true);
  canvas.dispose();
  await expect(waiting).resolves.toEqual({ value: undefined, done: true });
  expect(globalHookCtx.frames.has(frame.uid)).toBe(false);
  expect(studio.subscribeModelChanges).not.toHaveBeenCalled();
});
