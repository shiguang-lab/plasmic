import { ModelRevisions } from "@/wab/shared/model-revisions";
import { CanvasRegistrations } from "@/wab/client/components/canvas/canvas-registrations";
import { CanvasCtx } from "@/wab/client/components/canvas/canvas-ctx";
import { createHostlessPkgsStore } from "@/wab/client/studio-ctx/hostless-pkgs-state";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { scriptExec } from "@/wab/client/script-exec";
import $ from "jquery";
const libs = vi.hoisted(() => ({
  load: vi.fn(),
  loadNative: vi.fn(),
  identity: (name: string, site: any) =>
    site.hostLessPackageInfo?.name === name
      ? name
      : name + "@library:" + site.version,
}));
vi.mock("@/wab/client/components/studio/studio-bundles", () => ({
  getSortedHostLessPkgs: libs.load,
  loadHostLessPackages: libs.loadNative,
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
  libs.loadNative.mockReset();
  libs.loadNative.mockImplementation(async (_w, _a, requests) => requests.map((request) => [request.identity, request.name + " source"]));
  libs.load.mockImplementation(async (_w, _a, names, _v, site) =>
    names.map((n: string) => [libs.identity(n, site), n + " source"]),
  );
});
function fixture(kind: "studio" | "canvas", site: any) {
  // Studio keeps installed hostless packages in a store now; expose a small
  // set-like façade so the assertions below keep reading the same way.
  const hostlessPkgsStore = createHostlessPkgsStore();
  const installed =
    kind === "studio"
      ? {
          get size() {
            return hostlessPkgsStore.getState().installed.size;
          },
          has: (pkg: string) => hostlessPkgsStore.getState().installed.has(pkg),
          add: (pkg: string) => {
            const next = new Set(hostlessPkgsStore.getState().installed);
            next.add(pkg);
            hostlessPkgsStore.setState({ installed: next });
          },
          [Symbol.iterator]: () =>
            hostlessPkgsStore.getState().installed[Symbol.iterator](),
        }
      : new Set<string>(),
    clear = vi.fn();
  const ctx = Object.create(
    kind === "studio" ? StudioCtx.prototype : CanvasCtx.prototype,
  );
  Object.defineProperties(ctx, {
    site: { value: site },
    appCtx: { value: { api: {} } },
  });
  Object.assign(ctx, {
    hostlessPkgsStore,
    installedHostLessPkgs: installed,
    _hostLessPkgsLock: Promise.resolve(),
    hostLessPkgsFrame: { contentWindow: {} },
    _win: {},
    hostLessRegistry: { clear },
    ccRegistry: { clear },
    registrations: new CanvasRegistrations(),
  });
  if (kind === "studio") { ctx.hostLessPkgsLock = Promise.resolve(); ctx.modelRevisions = new ModelRevisions(); }
  const update = (pkgs: string[]) =>
    kind === "studio"
      ? ctx.updateCcRegistry(pkgs)
      : ctx.updateCcRegistry(pkgs.map((name) => ({ name, identity: libs.identity(name, site), authoring: site.hostLessPackageInfo?.name === name })), { appCtx: { api: {} } });
  const load = kind === "studio" ? libs.load : libs.loadNative;
  const requested = () => load.mock.calls.map((call) => kind === "studio" ? call[2] : call[2].map((request) => request.name));
  return { installed, clear, update, load, requested };
}
it.each(["studio", "canvas"] as const)(
  "%s preserves installed consumers, installs changed versions, and clears obsolete bookkeeping",
  async (kind) => {
    const site = { version: "1.0.0", hostLessPackageInfo: null },
      f = fixture(kind, site);
    await f.update(["managed"]);
    await f.update(["managed"]);
    expect(f.requested()).toEqual([["managed"], []]);
    expect([...f.installed]).toEqual(["managed@library:1.0.0"]);
    expect(f.clear).toHaveBeenCalledTimes(2);
    site.version = "2.0.0";
    await f.update(["managed"]);
    expect(f.requested().at(-1)).toEqual(["managed"]);
    expect([...f.installed]).toEqual(["managed@library:2.0.0"]);
    await f.update([]);
    expect(f.installed.size).toBe(0);
  },
);

it("does not execute downloaded registrations or start queued downloads after frame disposal", async () => {
  const canvas = new CanvasCtx({ $viewport: $(document.createElement("iframe")), name: "Pending" });
  canvas._win = window;
  const studio = { appCtx: { api: {} } } as unknown as StudioCtx;
  const pending = Promise.withResolvers<[string, string][]>();
  libs.loadNative.mockReturnValueOnce(pending.promise);
  vi.mocked(scriptExec).mockClear();
  const loading = vi.fn(); canvas.registrations.loadingStore.subscribe(loading);
  const first = canvas["updateCcRegistry"]([{ name: "managed", identity: "managed@package:1" }], studio);
  const second = canvas["updateCcRegistry"]([{ name: "managed", identity: "managed@package:2" }], studio);
  await vi.waitFor(() => expect(libs.loadNative).toHaveBeenCalledOnce());
  canvas.dispose();
  pending.resolve([["managed@package:1", "registration"]]);
  await Promise.all([first, second]);
  expect(scriptExec).not.toHaveBeenCalled();
  expect(libs.loadNative).toHaveBeenCalledOnce();
  expect(canvas.installedHostLessPkgs.size).toBe(0);
  expect(canvas.registrations.pendingCount).toBe(0);
  expect(canvas.registrations.loadingStore.getState()).toBe(false);
  expect(loading).toHaveBeenCalledTimes(1);
});
it.each(["studio", "canvas"] as const)(
  "%s keeps authoring release refreshes even when registrations are already installed",
  async (kind) => {
    const f = fixture(kind, {
      version: "1.0.0",
      hostLessPackageInfo: { name: "managed" },
    });
    f.installed.add("managed");
    await f.update(["managed"]);
    expect(f.requested().at(-1)).toEqual(["managed"]);
  },
);
it.each(["studio", "canvas"] as const)(
  "%s permits retry after a failed download",
  async (kind) => {
    const f = fixture(kind, { version: "1.0.0", hostLessPackageInfo: null });
    f.load.mockRejectedValueOnce(new Error("503"));
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
    f.load.mockReturnValueOnce(pending.promise);
    const first = f.update(["managed"]);
    await vi.waitFor(() => expect(f.load).toHaveBeenCalledOnce());
    site.version = "2.0.0";
    pending.resolve([]);
    await first;
    expect([...f.installed]).toEqual(["managed@library:1.0.0"]);
    await f.update(["managed"]);
    expect([...f.installed]).toEqual(["managed@library:2.0.0"]);
  },
);
