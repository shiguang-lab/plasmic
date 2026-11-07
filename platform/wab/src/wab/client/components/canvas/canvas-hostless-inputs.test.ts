import { CanvasHostlessInputs } from "@/wab/client/components/canvas/canvas-hostless-inputs";
import type { HostLessPackageRequest } from "@/wab/client/components/studio/studio-bundles";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { ModelCommit, StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ensure } from "@/wab/shared/common";
import type { ModelChange } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { HostLessPackageInfo, ObjInst, ProjectDependency } from "@/wab/shared/model/classes";
import type { ChangeSummary } from "@/wab/shared/model/model-change-util";
import { mock } from "vitest-mock-extended";

const originalPackages = DEVFLAGS.hostLessComponents;
beforeEach(() => {
  const base = ensure(originalPackages?.[0], "Test requires a hostless package declaration");
  DEVFLAGS.hostLessComponents = [{ ...base, codeName: "managed", hasCodeArtifacts: true }];
});
afterEach(() => { DEVFLAGS.hostLessComponents = originalPackages; });

function fixture(authoring = false) {
  const info = new HostLessPackageInfo({ name: "managed", npmPkg: [], cssImport: [], deps: [], registerCalls: [], minimumReactVersion: null });
  const site = createSite({ hostLessPackageInfo: authoring ? info : null });
  const library = createSite({ hostLessPackageInfo: info });
  const dep = new ProjectDependency({ uuid: "dependency", projectId: "project", pkgId: "package", version: "1", name: "Library", site: library });
  site.projectDependencies.push(dep);
  const models = new ModelSnapshots(), listeners = new Set<(event: ModelCommit) => void>();
  const studio = Object.assign(mock<StudioCtx>(), { site, modelSnapshots: models, subscribeModelChanges: (listener: (event: ModelCommit) => void) => {
    listeners.add(listener); return () => { listeners.delete(listener); };
  } });
  const changed = vi.fn<(requests: readonly HostLessPackageRequest[]) => void>();
  const owner = new CanvasHostlessInputs(studio, changed);
  const commit = (inst: ObjInst, field: string) => {
    const changes: ModelChange[] = [{ type: "update", oldValue: undefined, newValue: Reflect.get(inst, field), changeNode: { inst, field } }];
    models.sync(changes); listeners.forEach((listener) => listener({ type: "commit", summary: mock<ChangeSummary>({ changes }) }));
  };
  return { site, library, dep, models, listeners, owner, changed, commit,
    dispose: () => { owner.dispose(); models.dispose(); } };
}

it("captures exact committed releases and preserves earlier requests through upgrades and undo", () => {
  const f = fixture();
  const initial = f.changed.mock.calls[0][0];
  expect(initial).toEqual([{ name: "managed", identity: "managed@package:1", release: { pkgId: "package", version: "1" } }]);
  f.dep.version = "2";
  expect(initial[0].release?.version).toBe("1");
  f.commit(f.dep, "version");
  expect(f.changed.mock.lastCall?.[0][0].identity).toBe("managed@package:2");
  f.commit(f.dep, "name"); f.commit(f.dep, "version");
  expect(f.changed).toHaveBeenCalledTimes(2);
  f.dep.version = "1"; f.commit(f.dep, "version");
  expect(f.changed.mock.lastCall?.[0]).toEqual(initial);
  f.dispose();
});

it("removes old dependency subscriptions and disposes", () => {
  const f = fixture();
  f.site.projectDependencies = []; f.commit(f.site, "projectDependencies");
  expect(f.changed.mock.lastCall?.[0]).toEqual([]);
  f.dep.version = "2"; f.commit(f.dep, "version");
  expect(f.changed).toHaveBeenCalledTimes(2);
  f.owner.dispose(); f.owner.dispose();
  expect(f.listeners.size).toBe(0);
  f.site.projectDependencies = [f.dep]; f.commit(f.site, "projectDependencies");
  expect(f.changed).toHaveBeenCalledTimes(2);
  f.dispose();
});

it("captures the constructor's authoring contract and stops on site replacement", () => {
  const f = fixture(true);
  expect(f.changed.mock.lastCall?.[0]).toEqual([{ name: "managed", identity: "managed", authoring: true }]);
  f.listeners.forEach((listener) => listener({ type: "site-replaced", site: createSite() }));
  expect(f.listeners.size).toBe(0);
  const info = ensure(f.library.hostLessPackageInfo, "The library must have package metadata");
  info.name = "renamed"; f.commit(info, "name");
  expect(f.changed).toHaveBeenCalledTimes(1);
  f.dispose();
});


it("accepts exact releases before deferred field UI publication", () => {
  const f = fixture();
  const version = f.models.field(f.dep, "version");
  const fieldPublished = vi.fn();
  const stop = version.subscribe(fieldPublished);
  try {
    f.changed.mockClear();
    f.models.deferPublication(() => {
      f.dep.version = "2";
      f.commit(f.dep, "version");
      expect(version.getState()).toBe("2");
      expect(fieldPublished).not.toHaveBeenCalled();
      expect(f.changed).toHaveBeenCalledExactlyOnceWith([
        { name: "managed", identity: "managed@package:2", release: { pkgId: "package", version: "2" } },
      ]);
      f.commit(f.dep, "version");
      expect(f.changed).toHaveBeenCalledOnce();
    });
    expect(fieldPublished).toHaveBeenCalledOnce();
    expect(f.changed).toHaveBeenCalledOnce();
  } finally { stop(); f.dispose(); }
});
