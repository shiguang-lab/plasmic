import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { CanvasFrameLoad } from "@/wab/client/components/canvas/canvas-frame-load";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplTag } from "@/wab/shared/core/tpls";

async function fixture() {
  const site = createSite();
  const component = mkComponent({ name: "Queued page", type: ComponentType.Plain, tplTree: mkTplTag("div") });
  site.components.push(component);
  const frame = mkArenaFrame({ site, component, name: "Queued frame", width: 800, height: 600, left: 0, top: 0 });
  const target = mkArenaFrame({ site, component, name: "Selected frame", width: 800, height: 600, left: 0, top: 0 });
  const empty = mkMixedArena("Empty");
  const arena = mkMixedArena("Loading", [frame, target]);
  const other = mkMixedArena("Other");
  site.arenas.push(empty, arena, other);
  const { studioCtx } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Empty" });
  // This exercises the real queue and Arena lifetime, without a host renderer.
  vi.spyOn(studioCtx, "tryGetViewCtxForFrame").mockReturnValue(undefined);
  await vi.waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
  return { studioCtx, arena, frame, target, other };
}

afterEach(() => vi.restoreAllMocks());

it("isolates a failed background load and still opens the selected artboard", async () => {
  const { studioCtx, arena, frame, target } = await fixture();
  studioCtx.currentArena = arena;
  vi.spyOn(studioCtx, "activeCanvasFrame", "get").mockReturnValue(undefined);
  vi.spyOn(studioCtx, "activeCanvasReady", "get").mockReturnValue(true);
  const error = new Error("Background component library unavailable");
  const load = vi.fn(async () => { throw error; });
  try {
    const waiting = expect(studioCtx.awaitViewCtxForFrame(frame)).rejects.toThrow(error.message);
    studioCtx.queueCanvasFrame({ arena, frame, name: "Background", load });
    await waiting;
    expect(studioCtx.canvasFrameError(frame)).toBe(error.message);
    expect(studioCtx.canvasLoadStore.getState().error).toBeUndefined();
    studioCtx.setStudioFocusOnFrame({ frame: target });
    vi.spyOn(studioCtx, "activeCanvasFrame", "get").mockReturnValue(target);
    const selected = vi.fn(async () => undefined);
    studioCtx.queueCanvasFrame({ arena, frame: target, name: "Selected", load: selected });
    await vi.waitFor(() => expect(selected).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(studioCtx["canvasLoadQueue"].idle()).toBe(true));
    expect(load).toHaveBeenCalledOnce();
  } finally { studioCtx.dispose(); }
});

it.each(["same arena", "different arena"])("cancels a slow attempt before starting the selected target in a %s", async (location) => {
  const { studioCtx, arena, frame, target, other } = await fixture();
  studioCtx.currentArena = arena;
  vi.spyOn(studioCtx, "activeCanvasReady", "get").mockReturnValue(true);
  const lease = new CanvasFrameLoad(studioCtx.arenaState.lifetime(), () => true);
  const order: string[] = [];
  const slow = vi.fn(() => new Promise<void>((resolve, reject) => {
    order.push("slow started");
    lease.begin(resolve, reject);
    lease.own(() => order.push("slow released"));
  }));
  try {
    studioCtx.queueCanvasFrame({ arena, frame, name: "Slow", load: slow, cancel: () => lease.cancel() });
    await vi.waitFor(() => expect(slow).toHaveBeenCalledOnce());
    if (location === "different arena") {
      await studioCtx.changeUnsafe(() => {
        arena.children.splice(arena.children.indexOf(target), 1);
        other.children.push(target);
      });
      studioCtx.currentArena = other;
    }
    studioCtx.setStudioFocusOnFrame({ frame: target });
    const selected = vi.fn(async () => { order.push("selected started"); });
    studioCtx.queueCanvasFrame({ arena: studioCtx.currentArena ?? arena, frame: target, name: "Selected", load: selected });
    await vi.waitFor(() => expect(selected).toHaveBeenCalledOnce());
    expect(order).toEqual(["slow started", "slow released", "selected started"]);
    expect(studioCtx.canvasLoadStore.getState().error).toBeUndefined();
  } finally { lease.cancel(); studioCtx.dispose(); }
});

it("releases the real dequeued request on owner abort without removing it twice or reporting a load failure", async () => {
  const { studioCtx, arena, frame } = await fixture();
  studioCtx.currentArena = arena;
  const signal = studioCtx.arenaState.lifetime();
  const lease = new CanvasFrameLoad(signal, () => studioCtx.arenaState.isCurrentLifetime(signal));
  let pending: Promise<void> | undefined;
  const load = vi.fn(() => {
    const promise = new Promise<void>((resolve, reject) => lease.begin(resolve, reject));
    pending = promise;
    return promise;
  });
  const request = { arena, frame, name: "Dequeued frame", load };
  const off = vi.fn(studioCtx.queueCanvasFrame(request));
  lease.own(off);
  try {
    await vi.waitFor(() => expect(load).toHaveBeenCalledOnce());
    expect(studioCtx["canvasLoadRequests"]).not.toContain(request);
    studioCtx.arenaState.reset();
    await expect(pending).resolves.toBeUndefined();
    expect(off).toHaveBeenCalledOnce();
    expect(lease.isActive()).toBe(false);
    expect(() => off()).not.toThrow();
    expect(studioCtx.canvasLoadStore.getState().error).toBeUndefined();
  } finally {
    lease.cancel();
    studioCtx.dispose();
  }
});

it("cancels only its queued request and permits repeated cancellation before and after owner shutdown", async () => {
  const { studioCtx, arena, frame } = await fixture();
  const first = { arena, frame, name: "First queued", load: vi.fn(async () => undefined) };
  const sibling = { arena, frame, name: "Sibling queued", load: vi.fn(async () => undefined) };
  const off = studioCtx.queueCanvasFrame(first);
  const offSibling = studioCtx.queueCanvasFrame(sibling);
  try {
    expect(studioCtx["canvasLoadRequests"]).toEqual([first, sibling]);
    off();
    off();
    expect(studioCtx["canvasLoadRequests"]).toEqual([sibling]);
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
    expect(first.load).not.toHaveBeenCalled();
    expect(sibling.load).not.toHaveBeenCalled();
    studioCtx.dispose();
    expect(() => { off(); offSibling(); offSibling(); }).not.toThrow();
  } finally { studioCtx.dispose(); }
});
