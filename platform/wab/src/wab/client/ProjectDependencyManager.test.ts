import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { createSite } from "@/wab/shared/core/sites";
import { unbundleProjectDependency } from "@/wab/shared/core/tagged-unbundle";
import { ProjectDependency } from "@/wab/shared/model/classes";
import { autorun } from "mobx";

vi.mock("@/wab/shared/core/tagged-unbundle", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/wab/shared/core/tagged-unbundle")>()),
  unbundleProjectDependency: vi.fn(),
}));

test("loads Plume alongside version metadata, shares its in-flight request and updates observers", async () => {
  const site = createSite();
  const dependency = new ProjectDependency({ uuid: "dep", pkgId: "pkg", projectId: "project", version: "1.0.0", name: "Library", site: createSite() });
  site.projectDependencies.push(dependency);
  const { studioCtx, api } = fakeStudioCtx({ site });
  const manager = studioCtx.projectDependencyManager;
  const plume = createSite();
  vi.mocked(unbundleProjectDependency).mockReturnValue({ projectDependency: { site: plume } } as any);
  let resolvePlume!: (value: any) => void;
  api.getPlumePkg.mockReturnValue(new Promise((resolve) => { resolvePlume = resolve; }));
  let resolveMetadata!: (value: any) => void;
  api.getPkgVersionMeta.mockReturnValue(new Promise((resolve) => { resolveMetadata = resolve; }));
  const observed: unknown[] = [];
  const disposeObserver = autorun(() => { observed.push(manager.plumeSite); });
  try {
    const refresh = manager.refreshDeps();
    const requiredPlume = manager.ensurePlumeSite();
    expect(api.getPlumePkg).toHaveBeenCalledOnce();
    expect(api.getPkgVersionMeta).toHaveBeenCalledOnce();
    resolvePlume({ pkg: {}, depPkgs: [] });
    expect(await requiredPlume).toBe(plume);
    expect(observed).toEqual([undefined, plume]);
    // A consumer can use Plume while the independent latest-version request is pending.
    expect(await manager.ensurePlumeSite()).toBe(plume);
    expect(api.getPlumePkg).toHaveBeenCalledOnce();
    resolveMetadata({ pkg: { version: "2.0.0" } });
    await refresh;
  } finally {
    disposeObserver();
    studioCtx.dispose();
  }
});

test("a failed Plume fetch can be retried without retaining the failed promise", async () => {
  const { studioCtx, api } = fakeStudioCtx();
  const plume = createSite();
  vi.mocked(unbundleProjectDependency).mockReturnValue({ projectDependency: { site: plume } } as any);
  api.getPlumePkg.mockRejectedValueOnce(new Error("Unavailable"));
  api.getPlumePkg.mockResolvedValueOnce({ pkg: {}, depPkgs: [] } as any);
  try {
    await expect(studioCtx.getPlumeSite()).rejects.toThrow("Unavailable");
    expect(await studioCtx.getPlumeSite()).toBe(plume);
    expect(api.getPlumePkg).toHaveBeenCalledTimes(2);
  } finally {
    studioCtx.dispose();
  }
});
