import { genLoaderHtmlBundle } from "@/wab/server/loader/gen-html-bundle";
import { initPlasmicLoader, renderToString, extractPlasmicQueryDataFromElement } from "@plasmicapp/loader-react";
vi.mock("@plasmicapp/loader-react", () => ({ initPlasmicLoader: vi.fn(), renderToString: vi.fn(), extractPlasmicQueryDataFromElement: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CODEGEN_HOST", "https://public.example.test/codegen");
  vi.stubEnv("CODEGEN_ORIGIN_HOST", "http://internal.example.test");
  vi.mocked(initPlasmicLoader).mockReturnValue({ fetchComponentData: vi.fn().mockResolvedValue({ entryCompMetas: [], bundle: {} }) } as any);
  vi.mocked(renderToString).mockReturnValue('<main data-published="true">SSR</main>');
  vi.mocked(extractPlasmicQueryDataFromElement).mockResolvedValue({ empty: false });
});
afterEach(() => vi.unstubAllEnvs());
it("emits the public API host independently of the internal SSR origin", async () => {
  const { html } = await genLoaderHtmlBundle({ projectId: "project", projectToken: "fixture-token", component: "PublishedPage", version: "1.2.3", hydrate: true, embedHydrate: false });
  expect(html).toContain('data-plasmic-host="https://public.example.test/codegen"');
  expect(html).toContain('src="https://public.example.test/codegen/static/js/loader-hydrate.js"');
  expect(html).not.toContain("internal.example.test");
  expect(initPlasmicLoader).toHaveBeenCalledExactlyOnceWith({ projects: [{ id: "project", version: "1.2.3", token: "fixture-token" }], preview: false, apiHost: "http://internal.example.test", cdnHost: "http://internal.example.test" });
});
it("preserves embedded data, prefetched queries and false/zero props without exposing the token", async () => {
  const props = { count: 0, disabled: false };
  const globalVariants = [{ name: "Theme", value: "dark", projectId: "project" }];
  const { html } = await genLoaderHtmlBundle({ projectId: "project", projectToken: "fixture-token", component: "PublishedPage", hydrate: true, embedHydrate: true, prepass: true, componentProps: props, globalVariants });
  expect(html).toContain('data-plasmic-project-token=""'); expect(html).not.toContain("fixture-token");
  expect(html).toContain('data-plasmic-component-data="{&quot;entryCompMetas&quot;:[],&quot;bundle&quot;:{}}"');
  expect(html).toContain('data-plasmic-prefetched-query-data="{&quot;empty&quot;:false}"');
  expect(renderToString).toHaveBeenCalledWith(expect.anything(), { name: "PublishedPage", projectId: "project" }, { prefetchedData: { entryCompMetas: [], bundle: {} }, componentProps: props, globalVariants, prefetchedQueryData: { empty: false } });
});
