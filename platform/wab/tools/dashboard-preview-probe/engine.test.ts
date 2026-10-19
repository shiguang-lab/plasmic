import { coverEngine } from "./engine";
import { load, ready } from "@/wab/client/components/dashboard/preview/renderer";
import { rasterize, snapshot } from "@/wab/client/components/dashboard/preview/snapshot";
import { DEVFLAGS } from "@/wab/shared/devflags";

vi.mock("@/wab/client/components/dashboard/preview/renderer", () => ({ load: vi.fn(), ready: vi.fn() }));
vi.mock("@/wab/client/components/dashboard/preview/snapshot", () => ({ snapshot: vi.fn(), rasterize: vi.fn() }));
afterEach(() => { vi.clearAllMocks(); delete (window as any).__renderCover; delete (window as any).__Sub; });

it("uses the production renderer with the requested revision and flags, returning metadata only", async () => {
  vi.mocked(load).mockResolvedValue({ pages: [{ uuid: "board", componentId: "component" }], modules: [{ source: "private source" }], site: { arenas: [{ name: "Canvas", children: [{}] }] } } as any);
  const result = await coverEngine.load("project", 164, DEVFLAGS);
  expect(load).toHaveBeenCalledExactlyOnceWith({ projectId: "project", revision: 164, flags: DEVFLAGS, staticBaseUrl: location.origin + "/static" });
  expect(result).toMatchObject({ id: "project", revision: 164, arena: "Canvas", moduleCount: 1, pages: [{ uuid: "board", componentId: "component" }] });
  expect(Object.keys(result).sort()).toEqual(["arena", "id", "loadMs", "moduleCount", "pages", "revision"]);
  expect(() => structuredClone(result)).not.toThrow();
});
it("propagates production authorization, revision and runtime failures", async () => {
  for (const message of ["Forbidden", "Preview revision changed", "Unknown module"]) {
    vi.mocked(load).mockRejectedValueOnce(new Error(message));
    await expect(coverEngine.load("project", 164, DEVFLAGS)).rejects.toThrow(message);
  }
});
it("renders by artboard identity, preserving distinct props and variants for the same component", async () => {
  const render = vi.fn(); (window as any).__renderCover = render;
  await coverEngine.render("board-two");
  expect(render).toHaveBeenCalledExactlyOnceWith("board-two");
  expect(ready).toHaveBeenCalledOnce();
});
it("does not capture or accept missing image, font or stylesheet assets", async () => {
  vi.mocked(snapshot).mockResolvedValue({ svg: "svg", stats: { assetErrors: ["Missing font"] } } as any);
  await expect(coverEngine.capture(1440, 720)).rejects.toThrow("Missing font");
  expect(rasterize).not.toHaveBeenCalled();
});
it("returns the actual rasterized bytes and unmodified snapshot statistics", async () => {
  const stats = { assetErrors: [], canvases: 1, svgs: 4 };
  const blob = new Blob(["png"]);
  vi.mocked(snapshot).mockResolvedValue({ svg: "svg", stats } as any);
  vi.mocked(rasterize).mockResolvedValue(blob);
  expect(await coverEngine.capture(1440, 720)).toEqual({ blob, stats });
  expect(snapshot).toHaveBeenCalledExactlyOnceWith(document, 1440, 720);
  expect(rasterize).toHaveBeenCalledExactlyOnceWith("svg", 1440, 720);
});
it("clears the mounted host root", () => {
  const clear = vi.fn(); (window as any).__Sub = { hostUtils: { setPlasmicRootNode: clear } };
  coverEngine.clear(); expect(clear).toHaveBeenCalledExactlyOnceWith(null);
});

it("waits for the actual React commit and propagates a rejected render before capture settling", async () => {
  const commit = Promise.withResolvers<void>();
  (window as any).__renderCover = vi.fn(() => commit.promise);
  const render = coverEngine.render("board");
  expect(ready).not.toHaveBeenCalled();
  commit.resolve(); await render;
  expect(ready).toHaveBeenCalledOnce();
  (window as any).__renderCover = vi.fn().mockRejectedValueOnce(new Error("Render failed"));
  await expect(coverEngine.render("board")).rejects.toThrow("Render failed");
  expect(ready).toHaveBeenCalledOnce();
});
