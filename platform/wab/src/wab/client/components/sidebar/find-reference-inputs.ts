import type { UsageSummary } from "@/wab/client/components/sidebar/FindReferencesModal";
import type { captureVariantModelWorld } from "@/wab/client/components/variants/variant-model-world";
import type { ModelFieldStore } from "@/wab/client/studio-ctx/model-snapshots";
import { FRAME_LOWER } from "@/wab/shared/Labels";
import { ComponentType } from "@/wab/shared/core/components";
import type { DefaultStyle } from "@/wab/shared/core/styles";
import { ArenaFrame, Component, Mixin, ObjInst, StyleToken, StyleTokenOverride, isKnownStyleToken } from "@/wab/shared/model/classes";

type ReferenceTarget = Component | ArenaFrame | StyleToken | StyleTokenOverride | Mixin | DefaultStyle;
export interface ReferenceInput {
  readonly type: "page" | "component" | "frame" | "token" | "mixin" | "theme";
  readonly displayName: string;
  /** Models are opaque command targets; render uses the projected fields. */
  readonly target: ReferenceTarget;
  readonly arenaUid?: number;
}
const empty: readonly ReferenceInput[] = Object.freeze([]);

/** The references panel demands names and arena membership, rather than a
 * whole-document revision whose result rendering could cache independently. */
export class ReferenceInputs {
  private current = empty;
  private readonly fields = new Map<ModelFieldStore<unknown>, () => void>();
  private readonly listeners = new Set<() => void>();
  constructor(private readonly world: Pick<ReturnType<typeof captureVariantModelWorld>, "models" | "site" | "lifetime" | "isCurrent">, private readonly summary: UsageSummary, private readonly contentEditorMode: boolean) {}

  getSnapshot = (): readonly ReferenceInput[] => {
    if (!this.world.isCurrent()) { return empty; }
    const { models, site } = this.world;
    const used = new Set<ModelFieldStore<unknown>>();
    const read = <T extends ObjInst, Key extends Exclude<keyof T, "uid"> & string>(model: T, key: Key) => {
      const field = models.field(model, key); used.add(field); return field.getState();
    };
    const dedicated = this.summary.components.length ? [...read(site, "pageArenas"), ...read(site, "componentArenas")].map((ref) => {
      const arena = models.resolve(ref);
      return { uid: ref.uid, componentUid: read(arena, "component").uid };
    }) : [];
    const custom = this.summary.frames.length ? read(site, "arenas").map((ref) => {
      const arena = models.resolve(ref);
      return { uid: ref.uid, frames: read(arena, "children") };
    }) : [];
    const components: ReferenceInput[] = this.summary.components.map((component) => {
      const type = read(component, "type");
      const name = read(component, "name");
      const meta = read(component, "codeComponentMeta");
      const registeredName = type === ComponentType.Code && meta ? read(models.resolve(meta), "displayName") : undefined;
      const editable = read(component, "editableByContentEditor");
      return {
        target: component,
        type: type === ComponentType.Page ? "page" : "component",
        displayName: registeredName || name || "unnamed artboard",
        arenaUid: !this.contentEditorMode || editable ? dedicated.find((arena) => arena.componentUid === component.uid)?.uid : undefined,
      };
    });
    const token = (target: StyleToken | StyleTokenOverride): ReferenceInput => {
      const base = isKnownStyleToken(target) ? target : models.resolve(read(target, "token"));
      return { target, type: "token", displayName: read(base, "name") };
    };
    const next: ReferenceInput[] = [
      ...components.filter((input) => input.type === "page"),
      ...components.filter((input) => input.type === "component"),
      ...this.summary.frames.map((target): ReferenceInput => ({ target, type: "frame", displayName: read(target, "name") || `unnamed ${FRAME_LOWER}`, arenaUid: custom.find((arena) => arena.frames.some((ref) => ref.uid === target.uid))?.uid })),
      ...(this.summary.styleTokens ?? []).map(token),
      ...(this.summary.styleTokenOverrides ?? []).map(token),
      ...(this.summary.mixins ?? []).map((target): ReferenceInput => ({ target, type: "mixin", displayName: read(target, "name") })),
      ...(this.summary.themes ?? []).map((target): ReferenceInput => ({ target, type: "theme", displayName: target.selector ? `Default "${target.selector}"` : "Default Typography" })),
    ];
    if (next.length !== this.current.length || next.some((input, index) => {
      const previous = this.current[index];
      return input.target !== previous.target || input.type !== previous.type || input.displayName !== previous.displayName || input.arenaUid !== previous.arenaUid;
    })) { this.current = Object.freeze(next.map((input) => Object.freeze(input))); }
    if (this.listeners.size) {
      used.forEach((field) => { if (!this.fields.has(field)) { this.fields.set(field, field.subscribe(this.sync)); } });
      for (const [field, stop] of this.fields) { if (!used.has(field)) { stop(); this.fields.delete(field); } }
    }
    return this.current;
  };
  private sync = () => {
    const before = this.current;
    const after = this.getSnapshot();
    if (after !== before) { this.listeners.forEach((listener) => listener()); }
  };
  private disconnect = () => { this.fields.forEach((stop) => stop()); this.fields.clear(); this.world.lifetime.removeEventListener("abort", this.close); };
  private close = () => { this.disconnect(); this.current = empty; this.listeners.forEach((listener) => listener()); };
  subscribe = (listener: () => void) => {
    if (!this.world.isCurrent()) { return () => undefined; }
    this.listeners.add(listener); this.world.lifetime.addEventListener("abort", this.close, { once: true }); this.getSnapshot();
    return () => { this.listeners.delete(listener); if (!this.listeners.size) { this.disconnect(); } };
  };
}
