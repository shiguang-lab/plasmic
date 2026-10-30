import { prepare } from "@/wab/client/components/dashboard/preview/renderer";
import { getArenaFrames } from "@/wab/shared/Arenas";
import type { Bundle } from "@/wab/shared/bundler";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { PageParamsProvider, useDataEnv } from "@plasmicapp/host";
import fs from "fs";
import path from "path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

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
  const host = {
    __Sub: {},
    __plasmicLive: { beginRender: vi.fn(), getDiagnostics: vi.fn(() => ({ errors: [] })), renderRoot: vi.fn(() => commit.promise) },
  } as any;
  const moduleExports: any = {};
  const imported = new Proxy({}, { get: () => () => null });
  new Function("require", "exports", "window", generated)((name: string) => name === "react" ? { __esModule: true, default: { createElement: (...args: any[]) => args } } : imported, moduleExports, host);
  moduleExports.__run();
  let committed = false;
  const rendering = host.__renderCover(output.pages[0].uuid).then(() => { committed = true; });
  await Promise.resolve();
  expect(committed).toBe(false);
  expect(host.__plasmicLive.getDiagnostics).not.toHaveBeenCalled();
  commit.resolve(); await rendering;
  expect(committed).toBe(true);
  expect(host.__plasmicLive.beginRender).toHaveBeenCalledWith(output.pages[0].componentId);
  host.__plasmicLive.getDiagnostics.mockReturnValueOnce({ errors: [new Error("Component failed")] });
  await expect(host.__renderCover(output.pages[0].uuid)).rejects.toThrow("Component failed");
  for (const module of output.modules.filter((m) => m.lang !== "css")) {
    expect(() => transform(module.source, { transforms: ["typescript", "jsx", "imports"], jsxPragma: module.jsxPragma })).not.toThrow();
  }
});

it.each([
  { path: "/batches/detail/[id]", params: { id: "BATCH-2026-001" }, query: { tab: "receipts" } },
  { path: "/coupons", params: {}, query: {} },
])("renders saved page context for $path", async (pageMeta) => {
  const bundles = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../../../shared/codegen/__testonly__/bundles/counters-test.json"), "utf8")) as [string, Bundle][];
  const [id, bundle] = bundles[bundles.length - 1];
  const savedPageMeta = Object.values(bundle.map).find((value) => value.__type === "PageMeta");
  if (!savedPageMeta) { throw new Error("Expected page fixture"); }
  Object.assign(savedPageMeta, pageMeta);
  const saved = JSON.stringify(bundle);
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({
    project: { id, name: "Page context fixture" },
    rev: { revision: 42, data: saved },
    depPkgs: bundles.slice(0, -1).map(([depId, model]) => ({ id: depId, model })),
  }) })));
  const output = await prepare({ projectId: id, revision: 42, flags: DEVFLAGS, staticBaseUrl: "http://localhost/" });
  const cover = output.modules.find((module) => module.name === "./cover-root.tsx");
  if (!cover) { throw new Error("Expected cover module"); }
  const { transform } = await import("sucrase");
  const generated = transform(cover.source, { transforms: ["typescript", "jsx", "imports"] }).code;
  const observed: unknown[] = [];
  const Root = ({ children }: { children?: React.ReactNode }) => {
    const context = useDataEnv();
    if (children) { return children; }
    observed.push(context);
    // This is the detail-page access that failed in the isolated renderer.
    return React.createElement("span", null, context?.params.id ?? "No record");
  };
  const host = {
    __Sub: { PageParamsProvider, hostUtils: { registerRenderErrorListener: () => () => {} } },
    __plasmicLive: { beginRender: () => {}, getDiagnostics: () => ({ errors: [] }), renderRoot: async (node: React.ReactElement) => { renderToStaticMarkup(node); } },
  } as any;
  const moduleExports: any = {};
  new Function("require", "exports", "window", generated)((name: string) => name === "react" ? React : { __esModule: true, default: Root }, moduleExports, host);
  moduleExports.__run();
  for (const page of output.pages) { await host.__renderCover(page.uuid); }
  expect(observed.length).toBeGreaterThan(0);
  for (const context of observed) {
    expect(context).toMatchObject({ pageRoute: pageMeta.path, params: pageMeta.params, query: pageMeta.query });
  }
  expect(JSON.stringify(bundle)).toBe(saved);
});

it("rejects stale revisions before unbundling or producing a cover", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ rev: { revision: 43, data: "invalid bundle" } }) })));
  await expect(prepare({ projectId: "stale", revision: 42, flags: DEVFLAGS, staticBaseUrl: "http://localhost/" })).rejects.toThrow("Preview revision changed");
});

it("preserves authorization errors without generating a thumbnail", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 403, json: async () => ({ error: { name: "ForbiddenError", message: "Private project" } }) })));
  await expect(prepare({ projectId: "private", revision: 42, flags: DEVFLAGS, staticBaseUrl: "http://localhost/" })).rejects.toMatchObject({ name: "ForbiddenError" });
});
