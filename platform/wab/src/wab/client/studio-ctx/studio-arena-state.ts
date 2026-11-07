import { StudioViewRegistry } from "@/wab/client/studio-ctx/studio-view-registry";
import type { ModelChange } from "@/wab/shared/core/observable-model";
import type { ModelFieldStore, ModelRef, ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { AnyArena, getArenaFrames, getArenaName, isDedicatedArena, isMixedArena } from "@/wab/shared/Arenas";
import { arrayEq, assert, switchType } from "@/wab/shared/common";
import { getSiteArenas, isValidArena } from "@/wab/shared/core/sites";
import { Pt } from "@/wab/shared/geom";
import { Arena, ArenaFrame, Component, ComponentArena, ObjInst, PageArena, Site } from "@/wab/shared/model/classes";
import { orderBy } from "lodash";
import { shallow } from "zustand/shallow";
import { createStore } from "zustand/vanilla";

export type ArenaStatus = "visible" | "background" | "cached" | "dead";
export interface StudioViewportSnapshot {
  readonly focusedArenaFrame?: ArenaFrame;
  readonly scroll: Pt;
  readonly canvasPadding: Pt;
  readonly scale: number;
}
interface ArenaViewInfo {
  readonly lastAccess: number;
  readonly isAlive: boolean;
  readonly lastViewSnapshot: StudioViewportSnapshot | undefined;
  readonly isBackground?: boolean;
}
export interface StudioArenaSnapshot {
  readonly current: ModelRef<AnyArena> | null;
  readonly kind: "mixed" | "component" | "page" | null;
  readonly name: string;
  readonly focusedMode: boolean;
  readonly frames: readonly ModelRef<ArenaFrame>[];
  readonly recent: readonly ModelRef<AnyArena>[];
}

/** Installation is separate from notification so other native owners can prepare
 * their inputs before any subscriber observes a completed arena command. */
class ArenaOutput<T> {
  private readonly notifications;
  private readonly subscriptions = new Set<() => void>();
  private sealed = false;
  constructor(private value: T) { this.notifications = createStore<T>(() => value); }
  readonly store: ModelFieldStore<T> = {
    getState: () => this.value,
    getInitialState: () => this.notifications.getInitialState(),
    subscribe: (listener) => {
      if (this.sealed) { return () => undefined; }
      const unsubscribe = this.notifications.subscribe(listener);
      const stop = () => { unsubscribe(); this.subscriptions.delete(stop); };
      this.subscriptions.add(stop);
      return stop;
    },
  };
  install(value: T) { this.value = value; }
  publish() {
    if (!Object.is(this.value, this.notifications.getState())) { this.notifications.setState(() => this.value, true); }
    if (this.sealed) { for (const stop of this.subscriptions) { stop(); } }
  }
  seal(value: T) { this.value = value; this.sealed = true; }
}

interface Savepoint {
  readonly current: AnyArena | null;
  readonly recent: readonly AnyArena[];
  readonly pin: { readonly arena: AnyArena; readonly token: object } | undefined;
  readonly views: Map<AnyArena, ArenaViewInfo | undefined>;
  readonly snapshot: StudioArenaSnapshot;
  readonly frameSnapshot: readonly ModelRef<ArenaFrame>[];
  readonly componentSnapshot: readonly ModelRef<Component>[];
  readonly lifetime: object;
  readonly ready: boolean;
}
const noFrames: readonly ModelRef<ArenaFrame>[] = Object.freeze([]);
const noArenas: readonly ModelRef<AnyArena>[] = Object.freeze([]);
const noComponents: readonly ModelRef<Component>[] = Object.freeze([]);
const emptyArena: StudioArenaSnapshot = Object.freeze({ current: null, kind: null, name: "", focusedMode: false, frames: noFrames, recent: noArenas });
const deadOutput = new ArenaOutput<ArenaStatus>("dead");
deadOutput.seal("dead");

/** Canonical arena commands and their demanded immutable UI outputs. Runtime
 * viewport records stay private; changing one arena never clones the registry. */
export class StudioArenaState {
  private current: AnyArena | null = null;
  private recent: readonly AnyArena[] = Object.freeze([]);
  private readonly views = new Map<AnyArena, ArenaViewInfo>();
  private pin: { readonly arena: AnyArena; readonly token: object } | undefined;
  private readonly output = new ArenaOutput(emptyArena);
  readonly store = this.output.store;
  private readonly frameOutput = new ArenaOutput(noFrames);
  /** Includes dedicated grids hidden by focused mode, for framesChanged. */
  readonly frameMembershipStore = this.frameOutput.store;
  private readonly readyOutput = new ArenaOutput<boolean>(true);
  /** A replaced Site is not ready for canvas work until its route has resolved. */
  readonly readinessStore = this.readyOutput.store;
  private ready = true;
  private readonly componentOutput = new ArenaOutput(noComponents);
  /** Component observation is a command effect, separate from frame geometry. */
  readonly observedComponentsStore = this.componentOutput.store;
  private readonly statuses = new Map<AnyArena, ArenaOutput<ArenaStatus>>();
  private readonly retiredStatuses = new WeakMap<AnyArena, ArenaOutput<ArenaStatus>>();
  private readonly terminalPublications = new Set<ArenaOutput<ArenaStatus>>();
  private readonly changedStatuses = new Set<AnyArena>();
  private readonly retired = new WeakSet<AnyArena>();
  private fields = new Map<ObjInst, Set<string>>();
  private readonly savepoints: Savepoint[] = [];
  private publicationDepth = 0;
  private resourceDisposalDepth = 0;
  private readonly departedLifetimes: AbortController[] = [];
  private dirty = true;
  private disposed = false;
  private waitingForSite = false;
  private ownerToken = new AbortController();

  readonly viewRegistry: StudioViewRegistry;

  constructor(private readonly context: { readonly site: Site; readonly modelSnapshots: ModelSnapshots }) {
    this.viewRegistry = new StudioViewRegistry({
      get modelSnapshots() { return context.modelSnapshots; },
      lifetime: () => this.lifetime(),
      ownsView: (view) => view.studioCtx.arenaState === this,
    });
    this.prepareCommit();
    this.publishCommit();
  }
  currentArena() { return this.current; }
  recentArenas() { return this.recent; }
  lifetime() { return this.ownerToken.signal; }
  isArenaResolved() { return this.readyOutput.store.getState(); }
  isCurrentLifetime(token: object) { return !this.disposed && token === this.ownerToken.signal; }

  deferPublication<Result>(command: () => Result): Result {
    this.publicationDepth++;
    try { return this.viewRegistry.deferPublication(command); }
    finally { this.publicationDepth--; this.publishCommit(); }
  }
  /** Parent UI/session resets publish before old iframe resources are destroyed. */
  deferResourceDisposal<Result>(command: () => Result): Result {
    this.resourceDisposalDepth++;
    try { return command(); }
    finally { this.resourceDisposalDepth--; if (!this.resourceDisposalDepth) { this.releaseLifetimes(); } }
  }
  private releaseLifetimes() {
    for (const lifetime of this.departedLifetimes.splice(0)) { lifetime.abort(); }
  }

  transaction<Result>(command: () => Result): Result {
    return this.viewRegistry.deferPublication(() => {
    assert(!this.disposed, "Cannot change a disposed arena owner");
    const checkpoint: Savepoint = { current: this.current, recent: this.recent, pin: this.pin, views: new Map(), snapshot: this.output.store.getState(), frameSnapshot: this.frameOutput.store.getState(), componentSnapshot: this.componentOutput.store.getState(), lifetime: this.ownerToken, ready: this.ready };
    this.savepoints.push(checkpoint);
    try { return this.viewRegistry.transaction(command); }
    catch (error) {
      if (!this.disposed && checkpoint.lifetime === this.ownerToken) {
        this.output.install(checkpoint.snapshot); this.frameOutput.install(checkpoint.frameSnapshot); this.componentOutput.install(checkpoint.componentSnapshot);
        this.markStatus(this.current); this.markStatus(checkpoint.current);
        this.markStatus(this.pin?.arena); this.markStatus(checkpoint.pin?.arena);
        this.current = checkpoint.current; this.recent = checkpoint.recent; this.pin = checkpoint.pin; this.ready = checkpoint.ready;
        for (const [arena, info] of checkpoint.views) {
          if (info) { this.views.set(arena, info); } else { this.views.delete(arena); }
          this.markStatus(arena);
        }
        this.dirty = true;
      }
      throw error;
    } finally {
      this.savepoints.pop();
      if (!this.savepoints.length && !this.disposed) { this.prepareCommit(); this.publishCommit(); }
    }
    });
  }
  private markStatus(arena: AnyArena | null | undefined) { if (arena) { this.changedStatuses.add(arena); } }
  private changeView(arena: AnyArena, info: ArenaViewInfo | undefined) {
    const previous = this.views.get(arena);
    if (previous === info || previous && info && shallow(previous, info)) { return; }
    for (const checkpoint of this.savepoints) {
      if (!checkpoint.views.has(arena)) { checkpoint.views.set(arena, previous); }
    }
    if (info) { this.views.set(arena, Object.freeze(info)); } else { this.views.delete(arena); }
    this.markStatus(arena);
  }
  private changed() {
    this.dirty = true;
    if (!this.savepoints.length) { this.prepareCommit(); this.publishCommit(); }
  }
  setCurrent(arena: AnyArena | null) {
    assert(!this.disposed && !this.waitingForSite, "Cannot change an inactive arena owner");
    assert(!arena || !this.retired.has(arena) && isValidArena(this.context.site, arena), "Cannot activate an arena from another model owner");
    if (arena) {
      const recent = this.recent.filter((candidate) => candidate !== arena && isValidArena(this.context.site, candidate));
      recent.push(arena);
      if (recent.length > 5) { recent.shift(); }
      if (!arrayEq(this.recent, recent)) { this.recent = Object.freeze(recent); }
    }
    this.markStatus(this.current); this.markStatus(arena);
    this.current = arena; this.ready = true;
    this.changed();
  }
  setRecent(arenas: readonly AnyArena[]) {
    assert(!this.disposed, "Cannot change a disposed arena owner");
    if (!arrayEq(this.recent, arenas)) { this.recent = Object.freeze(arenas.slice()); this.changed(); }
  }
  rememberViewport(arena: AnyArena, snapshot: StudioViewportSnapshot, now: number) {
    this.changeView(arena, { isAlive: true, lastAccess: now, lastViewSnapshot: snapshot });
    this.changed();
  }
  activate(arena: AnyArena, now: number) {
    const previous = this.views.get(arena) ?? { isAlive: true, lastAccess: now, lastViewSnapshot: undefined };
    this.changeView(arena, { ...previous, isAlive: true, isBackground: false });
    this.changed();
    return previous;
  }
  ensureBackground(arena: AnyArena, now: number) {
    assert(!this.disposed && !this.retired.has(arena) && isValidArena(this.context.site, arena), "Cannot retain an arena from another model owner");
    if (arena === this.current) { return; }
    const previous = this.views.get(arena);
    this.changeView(arena, { lastViewSnapshot: previous?.lastViewSnapshot, lastAccess: now, isAlive: true, isBackground: previous?.isAlive ? previous.isBackground : true });
    this.changed();
  }
  pinBackground(arena: AnyArena): () => void {
    assert(!this.disposed && !this.retired.has(arena) && isValidArena(this.context.site, arena), "Cannot pin an arena from another model owner");
    const token = {};
    this.markStatus(this.pin?.arena); this.markStatus(arena);
    this.pin = { arena, token };
    this.changed();
    return () => {
      if (this.pin?.token !== token || this.disposed) { return; }
      this.markStatus(arena); this.pin = undefined; this.changed();
    };
  }
  /** Preserve the existing background-first LRU and pin-after-slice semantics. */
  collect(limit: number): boolean {
    const valid = new Set(getSiteArenas(this.context.site, { noSorting: true }));
    for (const arena of this.views.keys()) { if (!valid.has(arena)) { this.changeView(arena, undefined); } }
    const pruneViews = this.views.size > limit;
    if (pruneViews) {
      const victims = orderBy([...this.views.entries()].filter(([arena]) => arena !== this.current), [([_arena, info]) => info.isBackground ? 0 : 1, ([_arena, info]) => info.lastAccess], ["asc", "asc"])
        .slice(0, this.views.size - limit).filter(([arena]) => arena !== this.pin?.arena);
      for (const [arena, info] of victims) { this.changeView(arena, { ...info, isAlive: false }); }
    }
    this.changed();
    return pruneViews;
  }
  getStatus(arena: AnyArena): ArenaStatus {
    if (this.disposed || this.retired.has(arena)) { return "dead"; }
    if (arena === this.current) { return "visible"; }
    const info = this.views.get(arena);
    return !info?.isAlive ? "dead" : info.isBackground || this.pin?.arena === arena ? "background" : "cached";
  }
  statusStore(arena: AnyArena): ModelFieldStore<ArenaStatus> {
    const terminal = this.retiredStatuses.get(arena);
    if (terminal) { return terminal.store; }
    if (this.disposed || this.retired.has(arena) || !isValidArena(this.context.site, arena)) { return deadOutput.store; }
    let output = this.statuses.get(arena);
    if (!output) { output = new ArenaOutput(this.getStatus(arena)); this.statuses.set(arena, output); }
    return output.store;
  }

  prepareModelCommit(changes: readonly ModelChange[]) {
    if (changes.some(({ changeNode }) => this.fields.get(changeNode.inst)?.has(changeNode.field))) { this.dirty = true; }
    this.prepareCommit();
  }
  private declare(model: ObjInst, ...keys: string[]) {
    let fields = this.fields.get(model);
    if (!fields) { fields = new Set(); this.fields.set(model, fields); }
    keys.forEach((key) => fields.add(key));
  }
  private declareFrames(arena: AnyArena) {
    switchType(arena).when(Arena, (mixed) => this.declare(mixed, "children")).when([ComponentArena, PageArena], (dedicated) => {
      this.declare(dedicated, "_focusedFrame", "matrix", "customMatrix");
      for (const grid of [dedicated.matrix, dedicated.customMatrix]) {
        this.declare(grid, "rows");
        for (const row of grid.rows) {
          this.declare(row, "cols");
          for (const cell of row.cols) { this.declare(cell, "frame"); }
        }
      }
    }).result();
  }
  prepareCommit() {
    this.viewRegistry.prepareCommit();
    if (this.disposed || this.waitingForSite) { return; }
    if (this.dirty) {
      this.dirty = false;
      const { site, modelSnapshots: models } = this.context;
      const arenas = getSiteArenas(site, { noSorting: true });
      if (this.current && !arenas.includes(this.current)) { this.markStatus(this.current); this.current = null; }
      if (this.pin && !arenas.includes(this.pin.arena)) { this.markStatus(this.pin.arena); this.pin = undefined; }
      for (const arena of this.views.keys()) { if (!arenas.includes(arena)) { this.changeView(arena, undefined); } }
      const recent = this.recent.filter((arena) => arenas.includes(arena));
      if (!arrayEq(recent, this.recent)) { this.recent = Object.freeze(recent); }
      this.fields = new Map();
      this.declare(site, "arenas", "componentArenas", "pageArenas");
      arenas.forEach((arena) => this.declareFrames(arena));
      const previous = this.output.store.getState();
      const arena = this.current;
      const frames = arena ? getArenaFrames(arena).map((frame) => models.ref(frame)) : noFrames;
      const recentRefs = this.recent.map((item) => models.ref(item));
      if (arena) {
        if (isMixedArena(arena)) { this.declare(arena, "name"); }
        else { this.declare(arena, "component"); this.declare(arena.component, "name"); }
      }
      const next = Object.freeze({ current: arena ? models.ref(arena) : null,
        kind: arena ? switchType(arena).when(Arena, () => "mixed" as const).when(ComponentArena, () => "component" as const).when(PageArena, () => "page" as const).result() : null,
        name: arena ? getArenaName(arena) : "", focusedMode: isDedicatedArena(arena) && !!arena._focusedFrame,
        frames: arrayEq(previous.frames, frames) ? previous.frames : Object.freeze(frames),
        recent: arrayEq(previous.recent, recentRefs) ? previous.recent : Object.freeze(recentRefs) });
      this.output.install(shallow(previous, next) ? previous : next);
      const allFrames = arenas.flatMap((item) => getArenaFrames(item, true)).map((frame) => models.ref(frame));
      const beforeFrames = this.frameOutput.store.getState();
      this.frameOutput.install(arrayEq(beforeFrames, allFrames) ? beforeFrames : Object.freeze(allFrames));
      const components = !arena ? [] : isDedicatedArena(arena) ? [arena.component] : arena.children.map((frame) => {
        this.declare(frame, "container"); this.declare(frame.container, "component"); return frame.container.component;
      });
      const componentRefs = components.map((component) => models.ref(component));
      const beforeComponents = this.componentOutput.store.getState();
      this.componentOutput.install(arrayEq(beforeComponents, componentRefs) ? beforeComponents : Object.freeze(componentRefs));
    }
    this.readyOutput.install(this.ready && !this.waitingForSite);
    for (const arena of this.changedStatuses) { this.statuses.get(arena)?.install(this.getStatus(arena)); }
    this.changedStatuses.clear();
  }
  publishCommit() {
    if (this.publicationDepth || this.savepoints.length) { return; }
    this.viewRegistry.publishCommit();
    this.output.publish(); this.readyOutput.publish(); this.frameOutput.publish(); this.componentOutput.publish();
    for (const output of this.statuses.values()) { output.publish(); }
    for (const output of this.terminalPublications) { output.publish(); }
    this.terminalPublications.clear();
    if (!this.resourceDisposalDepth) { this.releaseLifetimes(); }
  }
  /** Called while the old Site/models are still readable. Old cached shells keep
   * terminal status resources, without resolving refs against the new models. */
  reset() {
    this.deferResourceDisposal(() => this.viewRegistry.deferPublication(() => {
    this.viewRegistry.reset();
    for (const arena of getSiteArenas(this.context.site, { noSorting: true })) { this.retired.add(arena); }
    for (const [arena, output] of this.statuses) {
      this.retired.add(arena); output.seal("dead"); this.retiredStatuses.set(arena, output); this.terminalPublications.add(output);
    }
    this.statuses.clear(); this.changedStatuses.clear(); this.views.clear(); this.fields.clear();
    const departed = this.ownerToken;
    this.current = null; this.recent = Object.freeze([]); this.pin = undefined; this.ownerToken = new AbortController(); this.ready = false;
    this.output.install(emptyArena); this.readyOutput.install(false); this.frameOutput.install(noFrames); this.componentOutput.install(noComponents);
    this.dirty = false; this.waitingForSite = true;
    this.departedLifetimes.push(departed);
    this.publishCommit();
    }));
  }
  attachSite() {
    assert(!this.disposed, "Cannot install a Site on a disposed arena owner");
    this.viewRegistry.attachSite();
    this.waitingForSite = false; this.ready = getSiteArenas(this.context.site, { noSorting: true }).length === 0; this.dirty = true; this.prepareCommit(); this.publishCommit();
  }
  dispose() {
    if (this.disposed) { return; }
    this.reset(); this.viewRegistry.dispose(); this.disposed = true; this.departedLifetimes.push(this.ownerToken);
    this.output.seal(emptyArena); this.readyOutput.seal(false); this.frameOutput.seal(noFrames); this.componentOutput.seal(noComponents);
    // Closing supersedes transaction/publication deferral, as for selection.
    this.viewRegistry.publishCommit();
    this.output.publish(); this.readyOutput.publish(); this.frameOutput.publish(); this.componentOutput.publish();
    for (const output of this.terminalPublications) { output.publish(); }
    this.terminalPublications.clear();
    this.releaseLifetimes();
  }
}
