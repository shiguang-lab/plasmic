import { PlasmicHtmlHydrater } from "../../../../../loader-html-hydrate/src/hydrater";
import { initPlasmicLoader, hydrateFromElement } from "@plasmicapp/loader-react";

vi.mock("@plasmicapp/loader-react", () => ({ initPlasmicLoader: vi.fn(), hydrateFromElement: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

function element(extra: Record<string, string> = {}) {
  const attributes: Record<string, string> = {
    "data-plasmic-project-id": "project", "data-plasmic-project-version": "1.2.3",
    "data-plasmic-component": "PublishedPage", "data-plasmic-project-token": "fixture-token",
    "data-plasmic-component-props": '{"initialCount":0,"disabled":false}',
    "data-plasmic-global-variants": '[{"name":"Theme","value":"dark"}]',
    "data-plasmic-prefetched-query-data": '{"query":false}', ...extra,
  };
  return { getAttribute: (name: string) => attributes[name] ?? null, setAttribute: (name: string, value: string) => { attributes[name] = value; } } as unknown as HTMLElement;
}

it.each([
  { host: "https://codegen.example.test/published", scriptHost: "https://assets.example.test", expected: "https://codegen.example.test/published" },
  { host: "", scriptHost: "https://codegen.example.test", expected: "https://codegen.example.test" },
  { host: "", scriptHost: undefined, expected: undefined },
])("hydrates published data from its configured API host: $expected", async ({ host, scriptHost, expected }) => {
  const data = { entryCompMetas: [] };
  const fetchComponentData = vi.fn().mockResolvedValue(data);
  const loader = { fetchComponentData };
  vi.mocked(initPlasmicLoader).mockReturnValue(loader as any);
  const target = element({ "data-plasmic-host": host });
  await new PlasmicHtmlHydrater(scriptHost).hydrateElement(target);
  expect(initPlasmicLoader).toHaveBeenCalledExactlyOnceWith({ projects: [{ id: "project", version: "1.2.3", token: "fixture-token" }], apiHost: expected, cdnHost: expected });
  expect(fetchComponentData).toHaveBeenCalledExactlyOnceWith({ name: "PublishedPage", projectId: "project" });
  expect(hydrateFromElement).toHaveBeenCalledExactlyOnceWith(loader, target, { name: "PublishedPage", projectId: "project" }, { prefetchedData: data, globalVariants: [{ name: "Theme", value: "dark" }], componentProps: { initialCount: 0, disabled: false }, prefetchedQueryData: { query: false } });
  expect(target.getAttribute("data-plasmic-hydrated")).toBe("true");
});

it("uses embedded data without a network fetch and preserves empty/false props", async () => {
  const fetchComponentData = vi.fn();
  const loader = { fetchComponentData };
  vi.mocked(initPlasmicLoader).mockReturnValue(loader as any);
  const target = element({ "data-plasmic-component-data": '{"entryCompMetas":[]}', "data-plasmic-project-token": "" });
  await new PlasmicHtmlHydrater().hydrateElement(target);
  expect(fetchComponentData).not.toHaveBeenCalled();
  expect(hydrateFromElement).toHaveBeenCalledOnce();
  expect(vi.mocked(hydrateFromElement).mock.calls[0][3]?.componentProps).toEqual({ initialCount: 0, disabled: false });
});

it("does not claim hydration succeeded when fetching the published data fails", async () => {
  vi.mocked(initPlasmicLoader).mockReturnValue({ fetchComponentData: vi.fn().mockRejectedValue(new Error("Pinned version unavailable")) } as any);
  const target = element();
  await expect(new PlasmicHtmlHydrater().hydrateElement(target)).rejects.toThrow("Pinned version unavailable");
  expect(hydrateFromElement).not.toHaveBeenCalled();
  expect(target.getAttribute("data-plasmic-hydrated")).toBeNull();
});
