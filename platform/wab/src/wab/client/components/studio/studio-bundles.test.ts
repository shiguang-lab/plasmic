import { runInNewContext } from "node:vm";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

vi.unmock("@/wab/client/components/studio/studio-bundles");

vi.mock("@/wab/client/env", () => ({ ENV: { COMMITHASH: "test" } }));
vi.mock("@/wab/shared/urls", () => ({
  getStaticBaseUrl: () => "http://localhost/static",
}));
vi.mock("@/wab/shared/core/hostless-components", () => ({
  fstPartyHostLessComponents: [],
}));
const flags = vi.hoisted(() => ({ hostLessComponents: [] as any[] }));
vi.mock("@/wab/shared/devflags", () => ({ DEVFLAGS: flags }));
vi.mock("@/wab/shared/core/project-deps", () => ({
  walkDependencyTree: (site: any) => site.projectDependencies,
}));

import { scriptExec } from "@/wab/client/script-exec";
import type * as StudioBundles from "@/wab/client/components/studio/studio-bundles";

vi.mock("@/wab/client/script-exec", () => ({ scriptExec: vi.fn() }));
const api = {
  getHostlessLibraryRelease: async (pkg: string) => (await fetch(`/api/v1/hostless-libraries/${pkg}/release`)).json(),
  getHostlessLibraryCanvas: async (pkg: string, release: {version:string;pkgId:string}) => {
    const response = await fetch(`/api/v1/hostless-libraries/${pkg}/canvas?${new URLSearchParams({version:release.version,pkgId:release.pkgId})}`);
    if (!response.ok) { throw new Error(`Component library: ${response.status}`); }
    return response.text();
  },
};
let bundles: typeof StudioBundles;
beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  bundles = await import("@/wab/client/components/studio/studio-bundles");
  vi.mocked(scriptExec).mockImplementation((win, source) => {
    runInNewContext(source, { window: win });
  });
});

function targetWindow() {
  return { document: {}, initializations: 0, registrations: [] } as unknown as Window & {
    initializations: number;
    registrations: object[];
    __CanvasPkgs?: { Antd6?: object };
  };
}

afterEach(() => { vi.unstubAllGlobals(); flags.hostLessComponents = []; });

test("concurrent bootstrap and library loads share the pending initialization, then omit runtime source", async () => {
  const pending = Promise.withResolvers<string>();
  const fetchMock = vi.fn(async (url: string) => ({
    ok: true,
    text: () => url.endsWith("client.test.js") ? pending.promise : Promise.resolve("registration"),
  }));
  vi.stubGlobal("fetch", fetchMock);
  const win = targetWindow();
  const first = bundles.ensureCanvasRuntime(win);
  expect(bundles.ensureCanvasRuntime(win)).toBe(first);
  const ready = vi.fn();
  const libraries = bundles.getSortedHostLessPkgs(win, api, ["antd6", "overseas"], "-v2").then((sources) => { ready(); return sources; });
  const single = bundles.getHostLessPkg(win, api, "react-ui", "-v2");
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
  expect(ready).not.toHaveBeenCalled();
  expect(scriptExec).not.toHaveBeenCalled();
  pending.resolve("window.initializations++; window.__CanvasPkgs = { Antd6: {} };");
  const [, sources, source] = await Promise.all([first, libraries, single]);
  expect(win.initializations).toBe(1);
  expect(scriptExec).toHaveBeenCalledOnce();
  expect([source, ...sources.map(([, code]) => code)].every((code) => !code.includes("window.initializations++"))).toBe(true);
  await bundles.ensureCanvasRuntime(win);
  await bundles.getSortedHostLessPkgs(win, api, ["antd6"], "-v2");
  expect(scriptExec).toHaveBeenCalledOnce();
  expect(fetchMock).toHaveBeenCalledTimes(4);
});

test("ready frames do not fetch or execute the runtime, and ordinary libraries do not initialize it", async () => {
  const fetchMock = vi.fn(async () => ({ ok: true, text: async () => "registration" }));
  vi.stubGlobal("fetch", fetchMock);
  const ready = targetWindow();
  ready.__CanvasPkgs = {};
  await bundles.getSortedHostLessPkgs(ready, api, ["antd6"], "-v2");
  const ordinary = targetWindow();
  await bundles.getHostLessPkg(ordinary, api, "ordinary", "-v2");
  await bundles.getSortedHostLessPkgs(ordinary, api, [], "-v2");
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(scriptExec).not.toHaveBeenCalled();
  expect(ordinary.__CanvasPkgs).toBeUndefined();
});

test("concurrent callers share a failed download and a single retry", async () => {
  const failed = Promise.withResolvers<{ ok: boolean; status: number; text: () => Promise<string> }>();
  const fetchMock = vi.fn().mockReturnValueOnce(failed.promise).mockResolvedValue({ ok: true, text: async () => "window.initializations++; window.__CanvasPkgs = {};" });
  vi.stubGlobal("fetch", fetchMock);
  const win = targetWindow();
  const first = bundles.ensureCanvasRuntime(win);
  expect(bundles.ensureCanvasRuntime(win)).toBe(first);
  const rejected = expect(first).rejects.toThrow("503");
  failed.resolve({ ok: false, status: 503, text: async () => "unavailable" });
  await rejected;
  const retry = bundles.ensureCanvasRuntime(win);
  expect(bundles.ensureCanvasRuntime(win)).toBe(retry);
  await retry;
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(win.initializations).toBe(1);
});

test.each(["headers", "body"])("a stalled runtime %s times out and permits one shared retry", async (stage) => {
  vi.useFakeTimers();
  const source = "window.initializations++; window.__CanvasPkgs = {};";
  const response = { ok: true, status: 200, text: async () => source };
  const headers = Promise.withResolvers<typeof response>();
  const body = Promise.withResolvers<string>();
  const fetchMock = vi.fn(async (_url: string, _options?: RequestInit) => response);
  fetchMock.mockImplementationOnce(() => stage === "headers"
    ? headers.promise
    : Promise.resolve({ ...response, text: () => body.promise }));
  vi.stubGlobal("fetch", fetchMock);
  const win = targetWindow();
  const failed = vi.fn();
  const first = bundles.ensureCanvasRuntime(win);
  expect(bundles.ensureCanvasRuntime(win)).toBe(first);
  const settled = first.catch(failed);
  try {
    await vi.advanceTimersByTimeAsync(3 * 60 * 1000 + 1);
    expect(failed).toHaveBeenCalledOnce();
    expect(failed.mock.calls[0][0].message).toContain("Couldn't get canvasPkgs");
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
    await settled;
    const retry = bundles.ensureCanvasRuntime(win);
    expect(bundles.ensureCanvasRuntime(win)).toBe(retry);
    await retry;
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(win.initializations).toBe(1);
  } finally {
    headers.resolve(response);
    body.resolve(source);
    await settled;
    vi.useRealTimers();
  }
});

test.each(["throw", "missing runtime"])("retries an initialization failure (%s) using the cached source", async (failure) => {
  const fetchMock = vi.fn(async () => ({ ok: true, text: async () => "window.initializations++; window.__CanvasPkgs = {};" }));
  vi.stubGlobal("fetch", fetchMock);
  const win = targetWindow();
  vi.mocked(scriptExec).mockImplementationOnce(() => {
    if (failure === "throw") {
      win.__CanvasPkgs = {};
      throw new Error("Runtime execution failed");
    }
  });
  await expect(bundles.ensureCanvasRuntime(win)).rejects.toThrow(failure === "throw" ? "Runtime execution failed" : "Canvas runtime did not initialize");
  expect(win.__CanvasPkgs).toBeUndefined();
  await bundles.ensureCanvasRuntime(win);
  expect(win.initializations).toBe(1);
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(scriptExec).toHaveBeenCalledTimes(2);
});

test("a navigated frame has its own initialization and does not receive the old pending injection", async () => {
  const pending = Promise.withResolvers<string>();
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, text: () => pending.promise })));
  const win = targetWindow();
  const old = expect(bundles.ensureCanvasRuntime(win)).rejects.toThrow("target navigated");
  Object.defineProperty(win, "document", { value: {}, configurable: true });
  const current = bundles.ensureCanvasRuntime(win);
  pending.resolve("window.initializations++; window.__CanvasPkgs = {};");
  await Promise.all([old, current]);
  expect(win.initializations).toBe(1);
  expect(scriptExec).toHaveBeenCalledOnce();
  await bundles.ensureCanvasRuntime(win);
  expect(scriptExec).toHaveBeenCalledOnce();
});

test("does not return registrations for a document replaced while its library was loading", async () => {
  const pending = Promise.withResolvers<string>();
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, text: () => pending.promise })));
  const win = targetWindow();
  win.__CanvasPkgs = {};
  const old = expect(bundles.getSortedHostLessPkgs(win, api, ["antd6"], "-v2")).rejects.toThrow("target navigated");
  Object.defineProperty(win, "document", { value: {}, configurable: true });
  delete win.__CanvasPkgs;
  pending.resolve("registration");
  await old;
  expect(scriptExec).not.toHaveBeenCalled();
});

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
    for (let frame = 0; frame < 2; frame++) {
      const win = targetWindow();
      for (let visit = 0; visit < 2; visit++) {
        const modules = await bundles.getSortedHostLessPkgs(win, api, packages, "-v2");
        expect(modules.every(([, source]) => !source.includes("window.initializations++"))).toBe(true);
        for (const [, source] of modules) {
          runInNewContext(source, { window: win });
        }
        expect(win.initializations).toBe(1);
        expect(win.registrations).toHaveLength(packages.length * (visit + 1));
        expect(win.registrations.every((runtime) => runtime === win.__CanvasPkgs?.Antd6)).toBe(true);
      }
    }
  },
);

test("loads a new library registration at the Project dependency version", async () => {
  flags.hostLessComponents = [{ codeName: "new-library", hasCodeArtifacts: true }];
  const fetchMock = vi.fn(async (url: string) => ({ ok: true, text: async () => url.endsWith("client.test.js") ? "window.__CanvasPkgs = {};" : "registration" }));
  vi.stubGlobal("fetch", fetchMock);
  const site = { projectDependencies: [{ pkgId: "library-package", version: "2.3.4", site: { hostLessPackageInfo: { name: "new-library" } } }] } as any;
  const loaded = await bundles.getSortedHostLessPkgs(targetWindow(), api, ["new-library"], "-v2", site);
  expect(loaded[0][0]).toBe("new-library@library-package:2.3.4");
  expect(loaded[0][1]).toContain("registration");
  expect(fetchMock).toHaveBeenCalledWith("/api/v1/hostless-libraries/new-library/canvas?version=2.3.4&pkgId=library-package");
});

test("missing consumer releases fail instead of silently loading latest", async () => {
  flags.hostLessComponents = [{ codeName: "managed", hasCodeArtifacts: true }];
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const win = targetWindow(); win.__CanvasPkgs = {};
  await expect(bundles.getSortedHostLessPkgs(win, api, ["managed"], "-v2", { projectDependencies: [] } as any)).rejects.toThrow("Missing exact component library dependency");
  expect(fetchMock).not.toHaveBeenCalled();
});

test("library authoring resolves latest again and then fetches each exact release", async () => {
  flags.hostLessComponents = [{ codeName: "managed", hasCodeArtifacts: true }];
  let latest = "1.0.0";
  const fetchMock = vi.fn(async (url: string) => ({ ok: true, json: async () => ({ pkgId: "library-package", version: latest }), text: async () => url }));
  vi.stubGlobal("fetch", fetchMock);
  const win = targetWindow(); win.__CanvasPkgs = {};
  expect(await bundles.getHostLessPkg(win, api, "managed", "-v2")).toContain("version=1.0.0&pkgId=library-package");
  latest = "2.0.0";
  expect(await bundles.getHostLessPkg(win, api, "managed", "-v2")).toContain("version=2.0.0&pkgId=library-package");
  expect(fetchMock.mock.calls.filter(([url]) => url.endsWith("/release"))).toHaveLength(2);
  const site = { hostLessPackageInfo: { name: "managed" }, projectDependencies: [] } as any;
  const modules = await bundles.getSortedHostLessPkgs(win, api, ["managed"], "-v2", site);
  expect(modules[0][0]).toBe(bundles.getHostLessPkgIdentity("managed", site));
  expect(modules[0][1]).toContain("version=2.0.0&pkgId=library-package");
});

test.each([false, true])("retries a failed library download (managed: %s) without reusing its rejected cache entry", async (managed) => {
  vi.resetModules();
  const { getHostLessPkg } = await import("@/wab/client/components/studio/studio-bundles");
  flags.hostLessComponents = managed ? [{ codeName: "retry-library", hasCodeArtifacts: true }] : [];
  const fetchMock = vi.fn(async (url: string) => ({ ok: true, status: 200, text: async (): Promise<string> => url.endsWith("client.test.js") ? "window.__CanvasPkgs = {};" : "registration" }));
  fetchMock.mockResolvedValueOnce({ ok: false, status: 503, text: async () => "unavailable" });
  vi.stubGlobal("fetch", fetchMock);
  const win = targetWindow();
  await expect(getHostLessPkg(win, api, "retry-library", "-v2", { pkgId: "library-package", version: "1.0.0" })).rejects.toThrow("503");
  await expect(getHostLessPkg(win, api, "retry-library", "-v2", { pkgId: "library-package", version: "1.0.0" })).resolves.toContain("registration");
  expect(fetchMock.mock.calls.filter(([url]) => !url.endsWith("client.test.js"))).toHaveLength(2);
});

test("retries a failed shared runtime download through the Studio cache", async () => {
  vi.resetModules();
  const { getHostLessPkg } = await import("@/wab/client/components/studio/studio-bundles");
  flags.hostLessComponents = [{ codeName: "runtime-retry", hasCodeArtifacts: true }];
  let runtimeCalls = 0;
  const fetchMock = vi.fn(async (url: string) => ({
    ok: !url.endsWith("client.test.js") || ++runtimeCalls > 1,
    status: 503,
    text: async () => url.endsWith("client.test.js") ? "window.__CanvasPkgs = {};" : "registration",
  }));
  vi.stubGlobal("fetch", fetchMock);
  const win = targetWindow();
  await expect(getHostLessPkg(win, api, "runtime-retry", "-v2", { pkgId: "library-package", version: "1.0.0" })).rejects.toThrow("runtime: 503");
  await expect(getHostLessPkg(win, api, "runtime-retry", "-v2", { pkgId: "library-package", version: "1.0.0" })).resolves.toContain("registration");
  expect(runtimeCalls).toBe(2);
  expect(fetchMock.mock.calls.filter(([url]) => url.includes("runtime-retry/canvas"))).toHaveLength(2);
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
  const win = { document: {} } as unknown as Record<string, { name: string; version?: string }[]>;
  const execute = async (pkg: string, version: string) => runInNewContext(await getHostLessPkg(win as unknown as Window, api, pkg, "-v2", { pkgId: "library-package", version }), { window: win });
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

test("a canvas host delegates managed releases to Studio and does not retain another account's source", async () => {
  flags.hostLessComponents = [{ codeName: "managed", hasCodeArtifacts: true }];
  const frameFetch = vi.fn(() => { throw new Error("Canvas origin has no API"); });
  vi.stubGlobal("fetch", frameFetch);
  const studio = {
    getHostlessLibraryRelease: vi.fn(async () => ({pkgId:"library",version:"1.0.0"})),
    getHostlessLibraryCanvas: vi.fn().mockResolvedValueOnce("firstAccount").mockResolvedValueOnce("secondAccount"),
  };
  const win = targetWindow(); win.__CanvasPkgs = {};
  expect(await bundles.getHostLessPkg(win, studio, "managed", "-v2")).toContain("firstAccount");
  expect(await bundles.getHostLessPkg(win, studio, "managed", "-v2")).toContain("secondAccount");
  expect(studio.getHostlessLibraryCanvas).toHaveBeenCalledWith("managed", {pkgId:"library",version:"1.0.0"});
  expect(frameFetch).not.toHaveBeenCalled();
});
