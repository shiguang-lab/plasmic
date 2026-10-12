import { getCanvasPkgs } from "@/wab/client/components/studio/studio-bundles";
import { scriptExec } from "@/wab/client/dom-utils";
import { getRootSub, initRootCanvasPkgs } from "@/wab/client/frame-ctx/windows";

vi.unmock("@/wab/client/frame-ctx/windows");
vi.mock("@/wab/client/components/studio/studio-bundles", () => ({ getCanvasPkgs: vi.fn() }));
vi.mock("@/wab/client/dom-utils", () => ({ scriptExec: vi.fn() }));

test("concurrent and repeated initialization execute the shared runtime only once per host window", async () => {
  const parent = window.parent as Window & { __CanvasPkgs?: object };
  delete parent.__CanvasPkgs;
  let release!: (source: string) => void;
  const bundle = new Promise<string>((resolve) => { release = resolve; });
  vi.mocked(getCanvasPkgs).mockReturnValue(bundle);
  const runtime = { Antd6: {} };
  vi.mocked(scriptExec).mockImplementation(() => { parent.__CanvasPkgs = runtime; });
  try {
    const initializations = [initRootCanvasPkgs(), initRootCanvasPkgs()];
    release("runtime");
    await Promise.all(initializations);
    expect(scriptExec).toHaveBeenCalledExactlyOnceWith(parent, "runtime");
    await initRootCanvasPkgs();
    expect(scriptExec).toHaveBeenCalledOnce();
    expect(getCanvasPkgs).toHaveBeenCalledTimes(2);
    expect((getRootSub() as any).Antd6).toBe(runtime.Antd6);
  } finally {
    delete parent.__CanvasPkgs;
  }
});
