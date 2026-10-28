import { runInNewContext } from "node:vm";
import { afterEach, expect, test, vi } from "vitest";

vi.unmock("@/wab/client/components/studio/studio-bundles");

vi.mock("@/wab/client/env", () => ({ ENV: { COMMITHASH: "test" } }));
vi.mock("@/wab/shared/urls", () => ({
  getStaticBaseUrl: () => "http://localhost/static",
}));
vi.mock("@/wab/shared/common", () => ({
  sortAs: (values: string[]) => values,
}));
vi.mock("@/wab/shared/core/hostless-components", () => ({
  fstPartyHostLessComponents: [],
}));
const flags = vi.hoisted(() => ({ hostLessComponents: [] as any[] }));
vi.mock("@/wab/shared/devflags", () => ({ DEVFLAGS: flags }));
vi.mock("@/wab/shared/core/project-deps", () => ({
  walkDependencyTree: (site: any) => site.projectDependencies,
}));

import { getSortedHostLessPkgs } from "@/wab/client/components/studio/studio-bundles";

afterEach(() => { vi.unstubAllGlobals(); flags.hostLessComponents = []; });

test.each([["antd6", "overseas", "react-ui"], ["react-ui"]])(
  "metadata and preview windows initialize the runtime before %j, once per window",
  async (...packages: string[]) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        text: async () =>
          url.endsWith("/client.test.js")
            ? "window.initializations++; window.__CanvasPkgs = { Antd6: {} };"
            : "window.registrations.push(window.__CanvasPkgs.Antd6);",
      })),
    );
    const modules = await getSortedHostLessPkgs(packages, "-v2");
    expect(modules.filter(([, source]) => source.includes("window.initializations++"))).toHaveLength(1);
    for (let frame = 0; frame < 2; frame++) {
      const window = {
        initializations: 0,
        registrations: [] as object[],
        __CanvasPkgs: undefined as any,
      };
      for (const [, source] of modules) {
        runInNewContext(source, { window });
      }
      expect(window.initializations).toBe(1);
      expect(window.registrations).toHaveLength(packages.length);
      expect(
        window.registrations.every(
          (runtime) => runtime === window.__CanvasPkgs.Antd6,
        ),
      ).toBe(true);
      for (const [, source] of modules) {
        runInNewContext(source, { window });
      }
      expect(window.initializations).toBe(1);
    }
  },
);

test("loads a new library registration at the Project dependency version", async () => {
  flags.hostLessComponents = [{ codeName: "new-library", hasCodeArtifacts: true }];
  const fetchMock = vi.fn(async () => ({ ok: true, text: async () => "registration" }));
  vi.stubGlobal("fetch", fetchMock);
  const site = { projectDependencies: [{ version: "2.3.4", site: { hostLessPackageInfo: { name: "new-library" } } }] } as any;
  const loaded = await getSortedHostLessPkgs(["new-library"], "-v2", site);
  expect(loaded[0][0]).toBe("new-library@2.3.4");
  expect(loaded[0][1]).toContain("registration");
  expect(fetchMock).toHaveBeenCalledWith("/api/v1/hostless-libraries/new-library/canvas?version=2.3.4");
});

test.each([false, true])("retries a failed library download (managed: %s) without reusing its rejected cache entry", async (managed) => {
  vi.resetModules();
  const { getHostLessPkg } = await import("@/wab/client/components/studio/studio-bundles");
  flags.hostLessComponents = managed ? [{ codeName: "retry-library", hasCodeArtifacts: true }] : [];
  const fetchMock = vi.fn(async (url: string) => ({ ok: true, status: 200, text: async (): Promise<string> => url.endsWith("client.test.js") ? "runtime" : "registration" }));
  fetchMock.mockResolvedValueOnce({ ok: false, status: 503, text: async () => "unavailable" });
  vi.stubGlobal("fetch", fetchMock);
  await expect(getHostLessPkg("retry-library", "-v2", "1.0.0")).rejects.toThrow("503");
  await expect(getHostLessPkg("retry-library", "-v2", "1.0.0")).resolves.toContain("registration");
  expect(fetchMock.mock.calls.filter(([url]) => !url.endsWith("client.test.js"))).toHaveLength(2);
});

test("retries a failed shared runtime download and preserves successfully fetched library code", async () => {
  vi.resetModules();
  const { getHostLessPkg } = await import("@/wab/client/components/studio/studio-bundles");
  flags.hostLessComponents = [{ codeName: "runtime-retry", hasCodeArtifacts: true }];
  let runtimeCalls = 0;
  const fetchMock = vi.fn(async (url: string) => ({
    ok: !url.endsWith("client.test.js") || ++runtimeCalls > 1,
    status: 503,
    text: async () => url.endsWith("client.test.js") ? "runtime" : "registration",
  }));
  vi.stubGlobal("fetch", fetchMock);
  await expect(getHostLessPkg("runtime-retry", "-v2", "1.0.0")).rejects.toThrow("runtime: 503");
  await expect(getHostLessPkg("runtime-retry", "-v2", "1.0.0")).resolves.toContain("runtime");
  expect(runtimeCalls).toBe(2);
  expect(fetchMock.mock.calls.filter(([url]) => url.includes("runtime-retry/canvas"))).toHaveLength(1);
});

test("replaces every registry owned by an updated library, preserves other libraries, and rolls back a failed registration", async () => {
  vi.resetModules();
  const { getHostLessPkg } = await import("@/wab/client/components/studio/studio-bundles");
  const keys = ["__PlasmicComponentRegistry", "__PlasmicContextRegistry", "__PlasmicFunctionsRegistry", "__PlasmicTokenRegistry", "__PlasmicTraitRegistry", "__PlasmicLibraryRegistry"];
  flags.hostLessComponents = ["versioned-library", "unrelated-library"].map((codeName) => ({ codeName, hasCodeArtifacts: true }));
  vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, text: async () => {
    if (url.endsWith("client.test.js")) {
      return "window.__CanvasPkgs = {};";
    }
    const name = url.includes("unrelated-library") ? "Other" : "Versioned";
    const version = new URL(url, "http://localhost").searchParams.get("version");
    return keys.map((key) => `window.${key}.push({name:${JSON.stringify(name)},version:${JSON.stringify(version)}});`)
      .join("\n") + (name === "Versioned" && version === "1.0.0" ? '\nwindow.__PlasmicComponentRegistry.push({name:"RemovedComponent"});' : "")
      + (version === "broken" ? '\nthrow new Error("Registration failed");' : "");
  } })));
  const win: Record<string, { name: string; version?: string }[]> = {};
  const execute = async (pkg: string, version: string) => runInNewContext(await getHostLessPkg(pkg, "-v2", version), { window: win });
  await execute("versioned-library", "1.0.0");
  await execute("unrelated-library", "1.0.0");
  await execute("versioned-library", "2.0.0");
  for (const key of keys) {
    expect(win[key].map(({ name, version }) => [name, version])).toEqual([["Other", "1.0.0"], ["Versioned", "2.0.0"]]);
  }
  await expect(execute("versioned-library", "broken")).rejects.toThrow("Registration failed");
  for (const key of keys) {
    expect(win[key].map(({ name, version }) => [name, version])).toEqual([["Other", "1.0.0"], ["Versioned", "2.0.0"]]);
  }
  await execute("versioned-library", "3.0.0");
  expect(win.__PlasmicComponentRegistry.map(({ name, version }) => [name, version])).toEqual([["Other", "1.0.0"], ["Versioned", "3.0.0"]]);
});
