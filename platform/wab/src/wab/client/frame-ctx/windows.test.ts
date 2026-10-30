import { ensureCanvasRuntime } from "@/wab/client/components/studio/studio-bundles";
import { getRootSub, initRootCanvasPkgs } from "@/wab/client/frame-ctx/windows";

vi.unmock("@/wab/client/frame-ctx/windows");
vi.mock("@/wab/client/components/studio/studio-bundles", () => ({ ensureCanvasRuntime: vi.fn() }));

test("waits for the parent window runtime before exposing its dependencies", async () => {
  const parent = window.parent as Window & { __CanvasPkgs?: object };
  const pending = Promise.withResolvers<void>();
  vi.mocked(ensureCanvasRuntime).mockReturnValue(pending.promise);
  const done = vi.fn();
  const initialized = initRootCanvasPkgs().then(done);
  expect(ensureCanvasRuntime).toHaveBeenCalledExactlyOnceWith(parent);
  expect(done).not.toHaveBeenCalled();
  const runtime = { Antd6: {} };
  parent.__CanvasPkgs = runtime;
  try {
    pending.resolve();
    await initialized;
    expect(done).toHaveBeenCalledOnce();
    expect((getRootSub() as any).Antd6).toBe(runtime.Antd6);
  } finally {
    delete parent.__CanvasPkgs;
  }
});
