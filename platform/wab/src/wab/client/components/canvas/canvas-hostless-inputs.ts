import { isManagedLibrary, type HostLessPackageRequest } from "@/wab/client/components/studio/studio-bundles";
import type { ModelFieldStore } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { assert } from "@/wab/shared/common";
import type { ObjInst, ProjectDependency } from "@/wab/shared/model/classes";
import { isEqual } from "lodash";

/** Captures the exact used package releases at the completed model transaction. */
export class CanvasHostlessInputs {
  private readonly fields = new Map<ModelFieldStore<unknown>, () => void>();
  private requests: readonly HostLessPackageRequest[] = Object.freeze([]);
  private dirty = true;
  private disposed = false;
  private readonly stopCommits: () => void;

  constructor(private readonly studio: StudioCtx, private readonly changed: (requests: readonly HostLessPackageRequest[]) => void) {
    this.stopCommits = studio.subscribeModelChanges((event) => {
      if (event.type === "site-replaced") { this.dispose(); }
      else if (this.dirty) { this.capture(); }
    });
    this.capture();
  }

  private capture() {
    if (this.disposed) { return; }
    this.dirty = false;
    const models = this.studio.modelSnapshots;
    const fields = new Set<ModelFieldStore<unknown>>();
    const read = <T extends ObjInst, Key extends Exclude<keyof T, "uid"> & string>(model: T, key: Key) => {
      const field = models.field(model, key); fields.add(field); return field.getState();
    };
    const root = this.studio.site;
    const rootInfo = read(root, "hostLessPackageInfo");
    const author = rootInfo ? read(models.resolve(rootInfo), "name") : undefined;
    const next: HostLessPackageRequest[] = author ? [Object.freeze({ name: author, identity: author, authoring: true })] : [];
    const names = new Set(author ? [author] : []);
    const queue: ProjectDependency[] = read(root, "projectDependencies").map((ref) => models.resolve(ref));
    const queued = new Set(queue.map((dependency) => read(dependency, "projectId")));
    for (let index = 0; index < queue.length; index++) {
      const dependency = queue[index];
      const site = models.resolve(read(dependency, "site"));
      const info = read(site, "hostLessPackageInfo");
      const name = info ? read(models.resolve(info), "name") : undefined;
      if (name && !names.has(name)) {
        names.add(name);
        if (isManagedLibrary(name)) {
          const pkgId = read(dependency, "pkgId"), version = read(dependency, "version");
          assert(pkgId && version, `Missing exact component library dependency for ${name}`);
          next.push(Object.freeze({ name, identity: `${name}@${pkgId}:${version}`, release: Object.freeze({ pkgId, version }) }));
        } else { next.push(Object.freeze({ name, identity: name })); }
      }
      for (const ref of read(site, "projectDependencies")) {
        const child = models.resolve(ref), id = read(child, "projectId");
        if (!queued.has(id)) { queued.add(id); queue.push(child); }
      }
    }
    for (const [field, stop] of this.fields) {
      if (!fields.has(field)) { stop(); this.fields.delete(field); }
    }
    for (const field of fields) {
      if (!this.fields.has(field)) { this.fields.set(field, models.subscribePreparedField(field, () => { this.dirty = true; })); }
    }
    if (!isEqual(next, this.requests)) {
      this.requests = Object.freeze(next);
      this.changed(this.requests);
    }
  }

  dispose() {
    if (this.disposed) { return; }
    this.disposed = true;
    this.stopCommits();
    this.fields.forEach((stop) => stop()); this.fields.clear();
    this.requests = Object.freeze([]);
  }
}
