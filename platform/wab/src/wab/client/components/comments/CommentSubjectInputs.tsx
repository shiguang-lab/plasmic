import { getRuleSetValueOrInitial } from "@/wab/shared/RuleSetHelpers";
import { TplExpsProvider } from "@/wab/client/components/style-controls/StyleComponent";
import { useVariantModelWorld } from "@/wab/client/components/variants/variant-model-world";
import type { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { ModelFieldStore } from "@/wab/client/studio-ctx/model-snapshots";
import { useStyleCells } from "@/wab/client/studio-ctx/style-inputs-react";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { isTplTag, summarizeTpl, type TplNamable } from "@/wab/shared/core/tpls";
import { isKnownCompositeExpr, isKnownCustomCode, isKnownTemplatedString, isKnownTplComponent, isKnownTplSlot, type Expr, type ObjInst, type TplNode } from "@/wab/shared/model/classes";
import * as React from "react";

/** The comment heading owns finite model fields, not a project-wide revision. */
export function CommentSubjectName({ studio, subject, fallback }: {
  studio: StudioCtx;
  subject: TplNamable;
  fallback: string;
}) {
  const world = useVariantModelWorld(studio, subject);
  const source = React.useMemo(() => new CommentNameInputs(subject, world.models, world.lifetime, world.isCurrent), [subject, world.models, world.lifetime, world.isCurrent]);
  const name = React.useSyncExternalStore(source.subscribe, source.read, source.read);
  return <>{name || fallback}</>;
}
class CommentNameInputs {
  private value: string | null | undefined;
  private readonly field: ModelFieldStore<string | null | undefined> | undefined;
  constructor(subject: TplNamable, models: ModelSnapshots, private readonly lifetime: AbortSignal, private readonly isCurrent: () => boolean) {
    if (isCurrent()) { const field = models.field(subject, "name"); this.field = field; this.value = field.getState(); }
  }
  read = () => { if (this.isCurrent() && this.field) { this.value = this.field.getState(); } return this.value; };
  subscribe = (listener: () => void) => {
    if (!this.isCurrent() || !this.field) { return () => undefined; }
    const stopField = this.field.subscribe(listener);
    const stop = () => { stopField(); this.lifetime.removeEventListener("abort", stop); };
    this.lifetime.addEventListener("abort", stop, { once: true });
    return stop;
  };
}

/** Keeps summarizeTpl's actual contract while subscribing only to its metadata. */
class CommentSubjectInputs {
  private fields = new Set<ModelFieldStore<unknown>>();
  private stops = new Map<ModelFieldStore<unknown>, () => void>();
  private listener: (() => void) | undefined;
  private value: string;

  constructor(private readonly view: ViewCtx, private readonly subject: TplNode, private readonly models: ModelSnapshots, private readonly lifetime: AbortSignal, private readonly isCurrent: () => boolean, private readonly layout: {display: string | undefined; direction: string | undefined}) {
    this.value = isCurrent() ? this.capture() : "";
  }

  private demand(model: ObjInst, ...keys: string[]) {
    for (const key of keys) {
      this.fields.add(this.models.declaredField(model, key));
    }
  }

  private expression(expr: Expr) {
    if (isKnownCustomCode(expr)) {
      this.demand(expr, "code");
    } else if (isKnownTemplatedString(expr)) {
      this.demand(expr, "text");
    } else if (isKnownCompositeExpr(expr)) {
      this.demand(expr, "hostLiteral", "substitutions");
      Object.values(expr.substitutions).forEach((part) => this.expression(part));
    }
  }

  private capture() {
    this.fields = new Set();
    const tpl = this.subject;
    if (isKnownTplComponent(tpl)) {
      this.demand(tpl, "component");
      this.demand(tpl.component, "name", "type", "codeComponentMeta");
      if (tpl.component.codeComponentMeta) {
        this.demand(tpl.component.codeComponentMeta, "displayName");
      }
    } else if (isKnownTplSlot(tpl)) {
      this.demand(tpl, "param");
      this.demand(tpl.param, "variable");
      this.demand(tpl.param.variable, "name");
    } else if (isTplTag(tpl)) {
      this.demand(tpl, "tag", "type", "parent");
      if (tpl.tag === "input") {
        this.demand(tpl, "vsettings");
        for (const setting of tpl.vsettings) {
          this.demand(setting, "variants", "attrs");
          for (const variant of setting.variants) {
            this.demand(variant, "name");
          }
          if (setting.attrs.type) { this.expression(setting.attrs.type); }
        }
      }
    }
    return summarizeTpl(tpl, {get: (prop) => getRuleSetValueOrInitial(
      prop === "display" ? this.layout.display : prop === "flex-direction" ? this.layout.direction : undefined,
      prop, isTplTag(tpl) ? tpl.tag : "div",
    )});
  }

  private refresh = () => {
    if (!this.isCurrent()) { this.close(); return; }
    const previous = this.value;
    this.value = this.capture();
    this.connect();
    if (previous !== this.value) { this.listener?.(); }
  };

  private connect() {
    for (const [field, stop] of this.stops) {
      if (!this.listener || !this.fields.has(field)) { stop(); this.stops.delete(field); }
    }
    if (this.listener) {
      for (const field of this.fields) {
        if (!this.stops.has(field)) { this.stops.set(field, field.subscribe(this.refresh)); }
      }
    }
  }

  private close = () => {
    this.listener = undefined; this.connect();
    this.lifetime.removeEventListener("abort", this.close);
    this.view.disposeSignal.removeEventListener("abort", this.close);
  };
  getSnapshot = () => this.value;
  subscribe = (listener: () => void) => {
    if (!this.isCurrent()) { return () => undefined; }
    this.listener = listener;
    this.lifetime.addEventListener("abort", this.close, { once: true });
    this.view.disposeSignal.addEventListener("abort", this.close, { once: true });
    this.refresh();
    return this.close;
  };
}

export function CommentSubjectType({ view, subject }: { view: ViewCtx; subject: TplNode }) {
  const world = useVariantModelWorld(view.studioCtx, subject, view);
  const provider = React.useMemo(() => new TplExpsProvider(view, subject), [view, subject]);
  const cells = useStyleCells(provider, isTplTag(subject) ? ["display", "flex-direction"] : []);
  const display = cells.find((cell) => cell.key === "display")?.value;
  const direction = cells.find((cell) => cell.key === "flex-direction")?.value;
  const source = React.useMemo(() => new CommentSubjectInputs(view, subject, world.models, world.lifetime, world.isCurrent, {display, direction}), [view, subject, world.models, world.lifetime, world.isCurrent, display, direction]);
  const type = React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
  return <>{type}</>;
}
