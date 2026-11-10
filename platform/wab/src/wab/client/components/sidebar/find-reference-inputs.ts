import type { UsageSummary } from "@/wab/client/components/sidebar/FindReferencesModal";
import type { captureVariantModelWorld } from "@/wab/client/components/variants/variant-model-world";
import { ModelFieldInputs } from "@/wab/client/stores/model-field-inputs";
import { FRAME_LOWER } from "@/wab/shared/Labels";
import { ComponentType } from "@/wab/shared/core/components";
import type { DefaultStyle } from "@/wab/shared/core/styles";
import { ArenaFrame, Component, Mixin, StyleToken, StyleTokenOverride, isKnownStyleToken } from "@/wab/shared/model/classes";

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
  private readonly inputs: ModelFieldInputs;
  constructor(private readonly world: Pick<ReturnType<typeof captureVariantModelWorld>, "models" | "site" | "lifetime" | "isCurrent">, private readonly summary: UsageSummary, private readonly contentEditorMode: boolean) {
    this.inputs = new ModelFieldInputs(world, (_field, _watch, read) => {
    const { models, site } = this.world;
    const dedicated = this.summary.components.length ? [...read(site, "pageArenas"), ...read(site, "componentArenas")].map((ref) => {
      const arena = models.resolve(ref);
      return { uid: ref.uid, componentUid: read(arena, "component").uid };
    }) : [];
    const arenaByComponent = new Map<number, number>();
    dedicated.forEach((arena) => { if (!arenaByComponent.has(arena.componentUid)) { arenaByComponent.set(arena.componentUid, arena.uid); } });
    const custom = this.summary.frames.length ? read(site, "arenas").map((ref) => {
      const arena = models.resolve(ref);
      return { uid: ref.uid, frames: read(arena, "children") };
    }) : [];
    const arenaByFrame = new Map<number, number>();
    custom.forEach((arena) => arena.frames.forEach((frame) => { if (!arenaByFrame.has(frame.uid)) { arenaByFrame.set(frame.uid, arena.uid); } }));
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
        arenaUid: !this.contentEditorMode || editable ? arenaByComponent.get(component.uid) : undefined,
      };
    });
    const token = (target: StyleToken | StyleTokenOverride): ReferenceInput => {
      const base = isKnownStyleToken(target) ? target : models.resolve(read(target, "token"));
      return { target, type: "token", displayName: read(base, "name") };
    };
    const next: ReferenceInput[] = [
      ...components.filter((input) => input.type === "page"),
      ...components.filter((input) => input.type === "component"),
      ...this.summary.frames.map((target): ReferenceInput => ({ target, type: "frame", displayName: read(target, "name") || `unnamed ${FRAME_LOWER}`, arenaUid: arenaByFrame.get(target.uid) })),
      ...(this.summary.styleTokens ?? []).map(token),
      ...(this.summary.styleTokenOverrides ?? []).map(token),
      ...(this.summary.mixins ?? []).map((target): ReferenceInput => ({ target, type: "mixin", displayName: read(target, "name") })),
      ...(this.summary.themes ?? []).map((target): ReferenceInput => ({ target, type: "theme", displayName: target.selector ? `Default "${target.selector}"` : "Default Typography" })),
    ];
    if (next.length !== this.current.length || next.some((input, index) => {
      const previous = this.current[index];
      return input.target !== previous.target || input.type !== previous.type || input.displayName !== previous.displayName || input.arenaUid !== previous.arenaUid;
    })) { this.current = Object.freeze(next.map((input) => Object.freeze(input))); }
    return [this.current];
    });
  }
  getSnapshot = (): readonly ReferenceInput[] => {
    if (!this.world.isCurrent()) { return empty; }
    this.inputs.read();
    return this.current;
  };
  subscribe = (listener: () => void) => {
    let previous = this.getSnapshot();
    return this.inputs.subscribe(() => {
      const next = this.getSnapshot();
      if (next !== previous) { previous = next; listener(); }
    });
  };
}
