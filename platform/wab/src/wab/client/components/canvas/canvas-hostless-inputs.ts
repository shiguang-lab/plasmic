import { isManagedLibrary, type HostLessPackageRequest } from "@/wab/client/components/studio/studio-bundles";
import type { ModelFieldStore } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { assert } from "@/wab/shared/common";
import { codeUsesGlobalObjects } from "@/wab/shared/eval/expression-parser";
import { memoizeModelQuery } from "@/wab/shared/model-query";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { isKnownCodeComponentMeta, isKnownComponent, isKnownCustomCode, isKnownNodeMarker, isKnownTplRef, type ArenaFrame, type Component, type ObjInst, type ProjectDependency, type TplNode } from "@/wab/shared/model/classes";
import { isStrongRefField } from "@/wab/shared/model/model-meta";
import { isEqual } from "lodash";

// Walk the model's owned values, including defaults, fallback expressions,
// render props, inactive variants and rich text. Parent/back references must not
// pull unrelated sibling trees into an artboard's dependency closure.
const canvasReferences = memoizeModelQuery((root: TplNode) => {
  const components = new Set<Component>(), visited = new Set<ObjInst>();
  let opaque = false;
  const visit = (value: unknown) => {
    if (instUtil.isObjInst(value)) {
      if (visited.has(value)) { return; }
      visited.add(value);
      if (isKnownComponent(value)) { components.add(value); }
      if (isKnownCodeComponentMeta(value) && !value.isHostLess) { opaque = true; }
      if (!opaque && isKnownCustomCode(value) && codeUsesGlobalObjects(value.code)) { opaque = true; }
      for (const field of instUtil.allInstFields(value)) {
        const target = Reflect.get(value, field.name);
        if (isStrongRefField(field) ||
          // Component contracts (including sub/super components and allowed
          // render-prop types) and explicit node references are weak model refs.
          (field.name !== "page" && (isKnownComponent(target) ||
            (Array.isArray(target) && target.some(isKnownComponent)))) ||
          ((isKnownTplRef(value) || isKnownNodeMarker(value)) && field.name === "tpl")) {
          visit(target);
        }
      }
    } else if (Array.isArray(value)) { value.forEach(visit); }
    else if (value && typeof value === "object") { Object.values(value).forEach(visit); }
  };
  visit(root);
  return { components, opaque };
});

/** Captures the exact used package releases at the completed model transaction. */
export class CanvasHostlessInputs {
  private readonly fields = new Map<ModelFieldStore<unknown>, () => void>();
  private requests: readonly HostLessPackageRequest[] = Object.freeze([]);
  private dirty = true;
  private disposed = false;
  private readonly stopCommits: () => void;

  constructor(private readonly studio: StudioCtx, private readonly changed: (requests: readonly HostLessPackageRequest[]) => void, private readonly frame?: ArenaFrame) {
    this.stopCommits = studio.subscribeModelChanges((event) => {
      if (event.type === "site-replaced") { this.dispose(); }
      else if (this.dirty || this.frame) { this.capture(); }
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
    const used = new Set<Component>();
    let loadAll = !this.frame;
    if (this.frame) {
      for (const tpl of [this.frame.container, ...root.globalContexts]) {
        const refs = canvasReferences(tpl);
        refs.components.forEach((component) => used.add(component));
        loadAll ||= refs.opaque;
      }
    }
    const requiredNames = new Set<string>();
    const packageDeps = new Map<string, readonly string[]>();
    // Registered functions and JS libraries can return components without a
    // model reference. Keep the complete registry whenever such code is present.
    loadAll ||= !!read(root, "customFunctions").length || !!read(root, "codeLibraries").length;
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
      if (name && info) {
        packageDeps.set(name, read(models.resolve(info), "deps"));
        if (read(site, "components").some((ref) => used.has(models.resolve(ref)))) { requiredNames.add(name); }
      }
      loadAll ||= !!read(site, "customFunctions").length || !!read(site, "codeLibraries").length;
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
    for (const name of requiredNames) {
      for (const dependency of packageDeps.get(name) ?? []) { requiredNames.add(dependency); }
    }
    const selected = loadAll || author ? next : next.filter((request) => requiredNames.has(request.name));
    if (!isEqual(selected, this.requests)) {
      this.requests = Object.freeze(selected);
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
