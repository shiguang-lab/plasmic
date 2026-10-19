import { prepare } from "@/wab/client/components/dashboard/preview/renderer";
import { getArenaFrames } from "@/wab/shared/Arenas";
import type { Bundle } from "@/wab/shared/bundler";
import { DEVFLAGS } from "@/wab/shared/devflags";
import fs from "fs";
import path from "path";

afterEach(() => vi.unstubAllGlobals());

it.each(["counters-test", "global-variant-test", "style-token-overrides", "imported-project-default-theme-styles"])("builds Dashboard artboards with the real shared compiler: %s", async (name) => {
  const bundles = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../../../shared/codegen/__testonly__/bundles/${name}.json`), "utf8")) as [string, Bundle][];
  const [id, bundle] = bundles[bundles.length - 1];
  const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({
    project: { id, name: "Dashboard fixture" },
    rev: { revision: 42, data: JSON.stringify(bundle) },
    depPkgs: bundles.slice(0, -1).map(([depId, model]) => ({ id: depId, model })),
  }) }));
  vi.stubGlobal("fetch", fetcher);
  const output = await prepare({ projectId: id, revision: 42, flags: DEVFLAGS, staticBaseUrl: "http://localhost/" });
  expect(fetcher).toHaveBeenCalledExactlyOnceWith(`/api/v1/projects/${id}?revisionNum=42`);
  const free = output.site.arenas.find((a) => a.children.length > 0);
  const expected = free ? free.children : output.site.pageArenas.map((a) => getArenaFrames(a, true).sort((a, b) => b.width - a.width)[0]).filter(Boolean);
  expect(output.pages.map((p) => p.uuid)).toEqual(expected.map((f) => f.uuid));
  expect(output.pages.length).toBeGreaterThan(0);
  expect(new Set(output.modules.map((m) => m.name)).size).toBe(output.modules.length);
  const cover = output.modules.find((m) => m.name === "./cover-root.tsx");
  expect(cover?.source).toContain("window.__renderCover=");
  expect(cover?.source).toContain("board.variants");
  for (const page of output.pages) {
    expect(cover?.source).toContain(page.uuid);
    expect(cover?.source).toContain(page.componentId);
  }
  const { transform } = await import("sucrase");
  const generated = transform(cover?.source ?? "", { transforms: ["typescript", "jsx", "imports"] }).code;
  const commit = Promise.withResolvers<void>();
  const dispose = vi.fn();
  let renderError: (error: Error) => void;
  const host = {
    __Sub: { hostUtils: { registerRenderErrorListener: vi.fn((listener) => { renderError = listener; return dispose; }) } },
    __plasmicLive: { renderRoot: vi.fn(() => commit.promise) },
  } as any;
  const moduleExports: any = {};
  const imported = new Proxy({}, { get: () => () => null });
  new Function("require", "exports", "window", generated)((name: string) => name === "react" ? { __esModule: true, default: { createElement: (...args: any[]) => args } } : imported, moduleExports, host);
  moduleExports.__run();
  let committed = false;
  const rendering = host.__renderCover(output.pages[0].uuid).then(() => { committed = true; });
  await Promise.resolve();
  expect(committed).toBe(false);
  expect(dispose).not.toHaveBeenCalled();
  commit.resolve(); await rendering;
  expect(committed).toBe(true);
  expect(dispose).toHaveBeenCalledOnce();
  host.__plasmicLive.renderRoot.mockImplementationOnce(async () => { renderError(new Error("Component failed")); });
  await expect(host.__renderCover(output.pages[0].uuid)).rejects.toThrow("Component failed");
  expect(dispose).toHaveBeenCalledTimes(2);
  for (const module of output.modules.filter((m) => m.lang !== "css")) {
    expect(() => transform(module.source, { transforms: ["typescript", "jsx", "imports"], jsxPragma: module.jsxPragma })).not.toThrow();
  }
});

it("rejects stale revisions before unbundling or producing a cover", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ rev: { revision: 43, data: "invalid bundle" } }) })));
  await expect(prepare({ projectId: "stale", revision: 42, flags: DEVFLAGS, staticBaseUrl: "http://localhost/" })).rejects.toThrow("Preview revision changed");
});

it("preserves authorization errors without generating a thumbnail", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 403, json: async () => ({ error: { name: "ForbiddenError", message: "Private project" } }) })));
  await expect(prepare({ projectId: "private", revision: 42, flags: DEVFLAGS, staticBaseUrl: "http://localhost/" })).rejects.toMatchObject({ name: "ForbiddenError" });
});
