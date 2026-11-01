import { CanvasCtx } from "@/wab/client/components/canvas/canvas-ctx";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { observable } from "mobx";
const libs = vi.hoisted(() => ({
  load: vi.fn(),
  identity: (name: string, site: any) =>
    site.hostLessPackageInfo?.name === name
      ? name
      : name + "@library:" + site.version,
}));
vi.mock("@/wab/client/components/studio/studio-bundles", () => ({
  getSortedHostLessPkgs: libs.load,
  getHostLessPkgIdentity: libs.identity,
  getVersionForCanvasPackages: () => "-v2",
  ensureCanvasRuntime: vi.fn(),
  getReactWebBundle: vi.fn(),
  getCanvasPkgs: vi.fn(),
  getLiveFrameClientJs: vi.fn(),
}));
vi.mock("@/wab/client/script-exec", () => ({ scriptExec: vi.fn() }));

beforeEach(() => {
  libs.load.mockReset();
  libs.load.mockImplementation(async (_w, _a, names, _v, site) =>
    names.map((n: string) => [libs.identity(n, site), n + " source"]),
  );
});
function fixture(kind: "studio" | "canvas", site: any) {
  const installed = observable.set<string>(),
    clear = vi.fn();
  const ctx = Object.create(
    kind === "studio" ? StudioCtx.prototype : CanvasCtx.prototype,
  );
  Object.defineProperties(ctx, {
    site: { value: site },
    appCtx: { value: { api: {} } },
  });
  Object.assign(ctx, {
    installedHostLessPkgs: installed,
    _hostLessPkgsLock: Promise.resolve(),
    hostLessPkgsFrame: { contentWindow: {} },
    _win: {},
    hostLessRegistry: { clear },
    ccRegistry: { clear },
    _updatingCcRegistryCount: observable.box(0),
  });
  if (kind === "studio") ctx.hostLessPkgsLock = Promise.resolve();
  const update = (pkgs: string[]) =>
    kind === "studio"
      ? ctx.updateCcRegistry(pkgs)
      : ctx.updateCcRegistry(pkgs, site, { appCtx: { api: {} } });
  return { installed, clear, update };
}
it.each(["studio", "canvas"] as const)(
  "%s preserves installed consumers, installs changed versions, and clears obsolete bookkeeping",
  async (kind) => {
    const site = { version: "1.0.0", hostLessPackageInfo: null },
      f = fixture(kind, site);
    await f.update(["managed"]);
    await f.update(["managed"]);
    expect(libs.load.mock.calls.map((c) => c[2])).toEqual([["managed"], []]);
    expect([...f.installed]).toEqual(["managed@library:1.0.0"]);
    expect(f.clear).toHaveBeenCalledTimes(2);
    site.version = "2.0.0";
    await f.update(["managed"]);
    expect(libs.load.mock.calls.at(-1)?.[2]).toEqual(["managed"]);
    expect([...f.installed]).toEqual(["managed@library:2.0.0"]);
    await f.update([]);
    expect(f.installed.size).toBe(0);
  },
);
it.each(["studio", "canvas"] as const)(
  "%s keeps authoring release refreshes even when registrations are already installed",
  async (kind) => {
    const f = fixture(kind, {
      version: "1.0.0",
      hostLessPackageInfo: { name: "managed" },
    });
    f.installed.add("managed");
    await f.update(["managed"]);
    expect(libs.load.mock.calls.at(-1)?.[2]).toEqual(["managed"]);
  },
);
it.each(["studio", "canvas"] as const)(
  "%s permits retry after a failed download",
  async (kind) => {
    const f = fixture(kind, { version: "1.0.0", hostLessPackageInfo: null });
    libs.load.mockRejectedValueOnce(new Error("503"));
    await expect(f.update(["managed"])).rejects.toThrow("503");
    expect(f.installed.size).toBe(0);
    await f.update(["managed"]);
    expect([...f.installed]).toEqual(["managed@library:1.0.0"]);
  },
);

it.each(["studio", "canvas"] as const)(
  "%s preserves the version snapshot when the model changes during a queued refresh",
  async (kind) => {
    const site = { version: "1.0.0", hostLessPackageInfo: null },
      f = fixture(kind, site);
    f.installed.add("managed@library:1.0.0");
    const pending = Promise.withResolvers<unknown[]>();
    libs.load.mockReturnValueOnce(pending.promise);
    const first = f.update(["managed"]);
    await vi.waitFor(() => expect(libs.load).toHaveBeenCalledOnce());
    site.version = "2.0.0";
    pending.resolve([]);
    await first;
    expect([...f.installed]).toEqual(["managed@library:1.0.0"]);
    await f.update(["managed"]);
    expect([...f.installed]).toEqual(["managed@library:2.0.0"]);
  },
);
