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

test("ensureCanUpgradeDeps allows upgrading a hostless dependency even when another imported project transitively references its older version", () => {
  const antdOldSite = createSite();
  (antdOldSite as any).hostLessPackageInfo = {
    id: "antd6",
    name: "antd6",
    version: "1.12.0",
    package: "@plasmicpkgs/antd5",
  };
  const antdOld = new ProjectDependency({
    uuid: "dep-antd-old",
    pkgId: "antd6-pkg",
    projectId: "antd6-proj",
    version: "1.12.0",
    name: "antd6",
    site: antdOldSite,
  });

  const antdNewSite = createSite();
  (antdNewSite as any).hostLessPackageInfo = {
    id: "antd6",
    name: "antd6",
    version: "1.22.0",
    package: "@plasmicpkgs/antd5",
  };
  const antdNew = new ProjectDependency({
    uuid: "dep-antd-new",
    pkgId: "antd6-pkg",
    projectId: "antd6-proj",
    version: "1.22.0",
    name: "antd6",
    site: antdNewSite,
  });

  const templateDep = new ProjectDependency({
    uuid: "dep-template",
    pkgId: "template-pkg",
    projectId: "template-proj",
    version: "1.0.0",
    name: "Admin Templates",
    site: createSite({
      projectDependencies: [antdOld],
    }),
  });

  const site = createSite({
    projectDependencies: [antdOld, templateDep],
  });

  const { studioCtx } = fakeStudioCtx({ site });
  try {
    const manager = studioCtx.projectDependencyManager;
    expect(() => manager.ensureCanUpgradeDeps([antdNew])).not.toThrow();
  } finally {
    studioCtx.dispose();
  }
});

test("upgradeProjectDeps updates direct dependency map and synchronizes transitive dependency references", async () => {
  const antdOldSite = createSite();
  (antdOldSite as any).hostLessPackageInfo = {
    id: "antd6",
    name: "antd6",
    version: "1.12.0",
    package: "@plasmicpkgs/antd5",
  };
  const antdOld = new ProjectDependency({
    uuid: "dep-antd-old",
    pkgId: "antd6-pkg",
    projectId: "antd6-proj",
    version: "1.12.0",
    name: "antd6",
    site: antdOldSite,
  });

  const antdNewSite = createSite();
  (antdNewSite as any).hostLessPackageInfo = {
    id: "antd6",
    name: "antd6",
    version: "1.22.0",
    package: "@plasmicpkgs/antd5",
  };
  const antdNew = new ProjectDependency({
    uuid: "dep-antd-new",
    pkgId: "antd6-pkg",
    projectId: "antd6-proj",
    version: "1.22.0",
    name: "antd6",
    site: antdNewSite,
  });

  const transitiveAntdOld = new ProjectDependency({
    uuid: "dep-antd-transitive",
    pkgId: "antd6-pkg",
    projectId: "antd6-proj",
    version: "1.12.0",
    name: "antd6",
    site: antdOldSite,
  });

  const templateDep = new ProjectDependency({
    uuid: "dep-template",
    pkgId: "template-pkg",
    projectId: "template-proj",
    version: "1.0.0",
    name: "Admin Templates",
    site: createSite({
      projectDependencies: [transitiveAntdOld],
    }),
  });

  const site = createSite({
    projectDependencies: [antdOld, templateDep],
  });

  const { studioCtx, api } = fakeStudioCtx({ site });
  studioCtx.bundler()._uid2addr.set(antdOld.uid, { uuid: antdOld.projectId, iid: antdOld.uuid });
  studioCtx.bundler()._uid2addr.set(transitiveAntdOld.uid, { uuid: transitiveAntdOld.projectId, iid: transitiveAntdOld.uuid });
  studioCtx.bundler()._uid2addr.set(templateDep.uid, { uuid: templateDep.projectId, iid: templateDep.uuid });
  studioCtx.bundler()._uid2addr.set(antdNew.uid, { uuid: antdNew.projectId, iid: antdNew.uuid });
  api.getPkgVersionMeta.mockResolvedValue({ pkg: { version: "1.22.0" } } as any);
  api.getPlumePkg.mockResolvedValue({ pkg: {}, depPkgs: [] } as any);
  const plume = createSite();
  vi.mocked(unbundleProjectDependency).mockReturnValue({ projectDependency: { site: plume } } as any);

  try {
    const manager = studioCtx.projectDependencyManager;
    await manager.upgradeProjectDeps([antdNew]);

    // Check direct dependencies in manager
    const depData = manager.getDependencyData("antd6-pkg");
    expect(depData?.model.version).toBe("1.22.0");
    expect(site.projectDependencies.find((d) => d.pkgId === "antd6-pkg")?.version).toBe("1.22.0");
  } finally {
    studioCtx.dispose();
  }
});

test("ensureCanUpgradeDeps still detects genuine version conflicts between unaligned non-target dependencies", () => {
  const libV1 = new ProjectDependency({
    uuid: "dep-lib-1",
    pkgId: "lib-pkg",
    projectId: "lib-proj-1",
    version: "1.0.0",
    name: "CommonLib",
    site: createSite(),
  });
  const libV2 = new ProjectDependency({
    uuid: "dep-lib-2",
    pkgId: "lib-pkg",
    projectId: "lib-proj-2",
    version: "2.0.0",
    name: "CommonLib",
    site: createSite(),
  });

  const pkgA = new ProjectDependency({
    uuid: "dep-a",
    pkgId: "a-pkg",
    projectId: "a-proj",
    version: "1.0.0",
    name: "PackageA",
    site: createSite({ projectDependencies: [libV1] }),
  });
  const pkgB = new ProjectDependency({
    uuid: "dep-b",
    pkgId: "b-pkg",
    projectId: "b-proj",
    version: "1.0.0",
    name: "PackageB",
    site: createSite({ projectDependencies: [libV2] }),
  });

  const site = createSite({
    projectDependencies: [pkgA, pkgB],
  });

  const { studioCtx } = fakeStudioCtx({ site });
  try {
    const manager = studioCtx.projectDependencyManager;
    expect(() => manager.ensureCanUpgradeDeps([])).toThrow(/conflicting dependencies/);
  } finally {
    studioCtx.dispose();
  }
});

