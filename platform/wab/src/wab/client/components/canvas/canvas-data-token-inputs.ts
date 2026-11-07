import { captureDataTokenDefinitions, type DataTokenDefinitions, type DataTokenProjectDefinition } from "@/wab/commons/DataToken";
import type { ProjectId } from "@/wab/shared/ApiSchema";
import type { ObjInst, Site } from "@/wab/shared/model/classes";
import type { ModelFieldStore, ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { createStore } from "zustand/vanilla";

const emptyDefinitions: DataTokenDefinitions = Object.freeze([]);
type PrepareListener = () => (() => void);

function shareProject(previous: DataTokenProjectDefinition | undefined, next: DataTokenProjectDefinition): DataTokenProjectDefinition {
  if (!previous || previous.projectId !== next.projectId || previous.pickerName !== next.pickerName) { return next; }
  const tokens = next.tokens.map((token) => previous.tokens.find((before) =>
    before.uuid === token.uuid && before.name === token.name && before.value === token.value) ?? token);
  if (tokens.length === previous.tokens.length && tokens.every((token, index) => token === previous.tokens[index])) { return previous; }
  return Object.freeze({ ...next, tokens: Object.freeze(tokens) });
}

/** One artboard's immutable token source definitions. No evaluated runtime value
 * is retained here: each mounted CanvasComponent owns its own value graph. */
export class CanvasDataTokenInputs {
  private readonly state = createStore<DataTokenDefinitions>(() => emptyDefinitions);
  private current = emptyDefinitions;
  private readonly initial: DataTokenDefinitions;
  private readonly fields = new Map<ModelFieldStore<unknown>, () => void>();
  private readonly subscriptions = new Set<() => void>();
  private readonly beforePublish = new Set<PrepareListener>();
  private readonly notifications = new Set<() => void>();
  private dirty = true;
  private disposed = false;
  readonly store: ModelFieldStore<DataTokenDefinitions> = {
    getState: () => this.current,
    getInitialState: () => this.initial,
    subscribe: (listener) => {
      if (this.disposed) { return () => undefined; }
      const unsubscribe = this.state.subscribe(listener);
      const stop = () => { unsubscribe(); this.subscriptions.delete(stop); };
      this.subscriptions.add(stop); return stop;
    },
  };

  constructor(private readonly context: { readonly site: Site; readonly modelSnapshots: ModelSnapshots; readonly projectId: ProjectId }) {
    this.prepareCommit();
    this.initial = this.current;
    this.state.setState(this.current, true);
  }

  subscribeBeforePublish(listener: PrepareListener): () => void {
    if (this.disposed) { return () => undefined; }
    this.beforePublish.add(listener);
    return () => this.beforePublish.delete(listener);
  }

  prepareCommit() {
    if (this.disposed || !this.dirty) { return; }
    this.dirty = false;
    const { site, modelSnapshots: models } = this.context;
    const fields = new Set<ModelFieldStore<unknown>>();
    const read = <T extends ObjInst, Key extends Exclude<keyof T, "uid"> & string>(model: T, key: Key) => {
      const store = models.field(model, key); fields.add(store); return store.getState();
    };
    // Preserve walkDependencyTree's order, duplicate direct entries, and cycle
    // policy. Only project-id-deduplicated transitive additions enter the queue.
    const direct = read(site, "projectDependencies").map((ref) => models.resolve(ref));
    const queue = [...direct];
    const directIds = new Set(queue.map((dep) => read(dep, "projectId")));
    const seen = new Set(directIds);
    const sites: Site[] = [site];
    for (let index = 0; index < queue.length; index++) {
      const dep = queue[index];
      const id = read(dep, "projectId");
      const dependencySite = models.resolve(read(dep, "site")); sites.push(dependencySite);
      if (directIds.has(id) && read(dependencySite, "dataTokens").length) { read(dep, "name"); }
      for (const ref of read(dependencySite, "projectDependencies")) {
        const child = models.resolve(ref), childId = read(child, "projectId");
        if (!seen.has(childId)) { seen.add(childId); queue.push(child); }
      }
    }
    const tokenIds = new Set<string>();
    for (const owner of sites) {
      for (const ref of read(owner, "dataTokens")) {
        const token = models.resolve(ref);
        tokenIds.add(read(token, "uuid"));
        read(token, "name"); read(token, "value"); read(token, "isRegistered");
      }
    }
    // toFinalToken uses this shared override channel for registered local and
    // direct-dependency DataTokens as well as style tokens. Unrelated values
    // are not dependencies of the data environment.
    for (const ref of read(site, "styleTokenOverrides")) {
      const override = models.resolve(ref), token = models.resolve(read(override, "token"));
      if (tokenIds.has(read(token, "uuid"))) { read(override, "value"); }
    }
    const captured = captureDataTokenDefinitions(site, this.context.projectId);
    const projects = captured.map((project, index) => shareProject(this.current[index], project));
    const next = projects.length === this.current.length && projects.every((project, index) => project === this.current[index])
      ? this.current : Object.freeze(projects);
    for (const [field, stop] of this.fields) {
      if (!fields.has(field)) { stop(); this.fields.delete(field); }
    }
    for (const field of fields) {
      if (!this.fields.has(field)) { this.fields.set(field, models.subscribePreparedField(field, () => { this.dirty = true; })); }
    }
    if (next !== this.current) {
      this.current = next;
      this.beforePublish.forEach((prepare) => this.notifications.add(prepare()));
    }
  }

  publishCommit() {
    if (this.disposed) { return; }
    if (this.state.getState() !== this.current) { this.state.setState(this.current, true); }
    const notifications = [...this.notifications]; this.notifications.clear();
    notifications.forEach((publish) => publish());
  }

  dispose() {
    if (this.disposed) { return; }
    this.disposed = true;
    this.fields.forEach((stop) => stop()); this.fields.clear();
    this.subscriptions.forEach((stop) => stop()); this.subscriptions.clear();
    this.beforePublish.clear(); this.notifications.clear();
    this.current = emptyDefinitions;
  }
}
