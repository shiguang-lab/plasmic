import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ModelFieldStore, ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { subscribeStudioRenderPolicy } from "@/wab/client/studio-ctx/studio-render-policy";
import { toClassName, toJsIdentifier, toVarName } from "@/wab/shared/codegen/util";
import { assert, ensure } from "@/wab/shared/common";
import type { ArenaFrame, ObjInst, Site, Variant } from "@/wab/shared/model/classes";
import { getPublicUrl, getStaticBaseUrl } from "@/wab/shared/urls";

/** One iframe generation's committed URL. The initial URL and later writes use
 * the same declared-field algorithm; no React store or model tracking bridge. */
export class CanvasFrameHash {
  private readonly models: ModelSnapshots;
  private readonly site: Site;
  private readonly fields = new Map<ModelFieldStore<unknown>, () => void>();
  private readonly stopCommits: () => void;
  private readonly stopPolicy: () => void;
  private readonly onAbort = () => this.dispose();
  private current: string;
  private interactive = false;
  private dirty = true;
  private disposed = false;

  constructor(
    private readonly studio: StudioCtx,
    private readonly frame: ArenaFrame,
    private readonly lifetime: AbortSignal,
    private readonly write: (hash: string) => void,
  ) {
    assert(!lifetime.aborted && studio.arenaState.isCurrentLifetime(lifetime), "Cannot create a frame hash for an expired model owner");
    this.models = studio.modelSnapshots;
    this.site = studio.site;
    this.current = this.capture();
    this.stopCommits = studio.subscribeModelChanges((event) => {
      if (event.type === "site-replaced") { this.dispose(); }
      else { this.refresh(); }
    });
    this.stopPolicy = subscribeStudioRenderPolicy(studio, (policy) => policy.interactive, () => this.refresh());
    lifetime.addEventListener("abort", this.onAbort, { once: true });
  }

  getHash(): string {
    assert(this.isActive(), "Cannot read a disposed frame hash");
    return this.current;
  }

  private isActive() {
    return !this.disposed && !this.lifetime.aborted && this.studio.arenaState.isCurrentLifetime(this.lifetime) && this.studio.modelSnapshots === this.models;
  }

  private refresh() {
    if (!this.isActive()) { this.dispose(); return; }
    if (!this.dirty && this.interactive === this.studio.renderPolicy.store.getState().interactive) { return; }
    const next = this.capture();
    if (next !== this.current) {
      this.current = next;
      this.write(next);
    }
  }

  private capture(): string {
    const fields = new Set<ModelFieldStore<unknown>>();
    const read = <T extends ObjInst, Key extends Exclude<keyof T, "uid"> & string>(model: T, key: Key) => {
      const field = this.models.field(model, key); fields.add(field); return field.getState();
    };
    // siteToAllGlobalVariants includes local groups followed by DIRECT imported
    // groups, in roster order. Last identical UUID wins the original keyBy map.
    const sites = [this.site, ...read(this.site, "projectDependencies").map((ref) => this.models.resolve(read(this.models.resolve(ref), "site")))];
    const byUuid = new Map<string, Variant>();
    for (const site of sites) {
      for (const groupRef of read(site, "globalVariantGroups")) {
        const group = this.models.resolve(groupRef);
        for (const variantRef of read(group, "variants")) {
          const variant = this.models.resolve(variantRef);
          byUuid.set(read(variant, "uuid"), variant);
        }
      }
    }
    const active = new Set<Variant>();
    for (const [uuid, pinned] of Object.entries(read(this.frame, "pinnedGlobalVariants"))) {
      if (pinned) { active.add(ensure(byUuid.get(uuid), `Globat variant with uuid ${uuid} not found.`)); }
    }
    for (const ref of read(this.frame, "targetGlobalVariants")) { active.add(this.models.resolve(ref)); }
    const variants: [string, string][] = [];
    for (const variant of active) {
      const parent = read(variant, "parent");
      assert(parent, "Global variant should belong to a VariantGroup");
      const group = this.models.resolve(parent);
      const param = this.models.resolve(read(group, "param"));
      const variable = this.models.resolve(read(param, "variable"));
      variants.push([toJsIdentifier(read(variable, "name")), toVarName(read(variant, "name"))]);
    }
    const container = this.models.resolve(read(this.frame, "container"));
    const component = this.models.resolve(read(container, "component"));
    const interactive = this.studio.renderPolicy.store.getState().interactive;
    const hash = new URLSearchParams({
      canvas: "true", origin: getPublicUrl(), staticBaseUrl: getStaticBaseUrl(),
      componentName: toClassName(read(component, "name")),
      globalVariants: JSON.stringify(Object.fromEntries(variants)), interactive: `${interactive}`,
    }).toString();
    for (const [field, stop] of this.fields) { if (!fields.has(field)) { stop(); this.fields.delete(field); } }
    for (const field of fields) {
      if (!this.fields.has(field)) { this.fields.set(field, this.models.subscribePreparedField(field, () => { this.dirty = true; })); }
    }
    this.interactive = interactive;
    this.dirty = false;
    return hash;
  }

  dispose() {
    if (this.disposed) { return; }
    this.disposed = true;
    this.lifetime.removeEventListener("abort", this.onAbort);
    this.stopCommits(); this.stopPolicy();
    this.fields.forEach((stop) => stop()); this.fields.clear();
  }
}
