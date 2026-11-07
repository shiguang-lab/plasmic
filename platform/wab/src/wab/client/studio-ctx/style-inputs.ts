/**
 * Native selected-style cells from explicit persisted model inputs.
 *
 * This projection never owns style data. It subscribes to declared model fields,
 * and during prepare it calls the existing effective-variant / VariantTplMgr /
 * RSH / VSH / defined-indicator algorithms. Cells contain only frozen scalars
 * and ModelRefs.
 */
import type {
  ModelFieldStore,
  ModelRef,
  ModelSnapshots,
} from "@/wab/client/studio-ctx/model-snapshots";
import { assert, ensure } from "@/wab/shared/common";
import * as css from "@/wab/shared/css";
import {
  computeDefinedIndicator,
  computeSingleRsDefinedIndicator,
  type DefinedIndicatorType,
  type VariantSettingSource,
} from "@/wab/shared/defined-indicator";
import type { EffectiveVariantSetting } from "@/wab/shared/effective-variant-setting";
import { RuleSetHelpers, ThemeLayoutRuleSetHelpers, VariantedRuleSetHelpers, type ReadonlyIRuleSetHelpersX } from "@/wab/shared/RuleSetHelpers";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { RuleSet as RuleSetModel, ThemeLayoutSettings as ThemeLayoutSettingsModel } from "@/wab/shared/model/classes";
import { instUtil } from "@/wab/shared/model/InstUtil";
import type {
  Animation,
  Component,
  Mixin,
  ObjInst,
  RuleSet,
  Site,
  Theme,
  TplComponent,
  TplNode,
  TplSlot,
  Param,
  ThemeLayoutSettings,
  Variant,
} from "@/wab/shared/model/classes";
import { tryGetVariantSetting, type VariantCombo } from "@/wab/shared/Variants";
import type { ThemableTag } from "@/wab/shared/html";
import { createStore, type StoreApi } from "zustand/vanilla";

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export type StyleKey = string;

/** A style-source stack entry with live models replaced by owner refs. */
export type StyleSourceSnapshot =
  | {
      readonly type: "theme";
      readonly theme: ModelRef<Theme>;
      readonly prop: string;
      readonly value: string;
    }
  | {
      readonly type: "themeTag";
      readonly theme: ModelRef<Theme>;
      readonly selector: string;
      readonly prop: string;
      readonly value: string;
    }
  | {
      readonly type: "mixin";
      readonly combo: readonly ModelRef<Variant>[];
      readonly mixin: ModelRef<Mixin>;
      readonly prop: string;
      readonly value: string;
    }
  | {
      readonly type: "style";
      readonly combo: readonly ModelRef<Variant>[];
      readonly prop: string;
      readonly value: string;
      readonly isDerived?: boolean;
      readonly animations?: readonly ModelRef<Animation>[];
    }
  | {
      readonly type: "slot";
      readonly parentTpl: ModelRef<TplSlot>;
      readonly param: ModelRef<Param>;
      readonly prop: string;
      readonly value: string;
      readonly activeVariants: readonly ModelRef<Variant>[];
      readonly tplComponent?: ModelRef<TplComponent>;
    }
  | {
      readonly type: "parentTplStyle";
      readonly parentTpl: ModelRef<TplNode>;
      readonly prop: string;
      readonly value: string;
      readonly activeVariants: readonly ModelRef<Variant>[];
      readonly tplComponent?: ModelRef<TplComponent>;
    };

/**
 * Mirrors the real DefinedIndicatorType shape, but only with scalars and refs.
 * No live Theme/Mixin/TplNode/Arg/Variant objects are retained.
 */
export interface StyleIndicatorSnapshot {
  readonly source: DefinedIndicatorType["source"];
  readonly prop?: string;
  readonly value?: string;
  readonly themeTag?: ThemableTag;
  readonly targetHasHighestPriority?: boolean;
  readonly stack: readonly StyleSourceSnapshot[];
  readonly targetSourceIndex?: number;
  readonly mixin?: ModelRef<Mixin>;
  readonly theme?: ModelRef<Theme>;
}

export interface StyleCell {
  readonly key: StyleKey;
  readonly value: string;
  readonly raw: string | undefined;
  readonly has: boolean;
  readonly targetHas: boolean;
  /**
   * Present only when the existing indicator algorithm and the supported
   * style-source capture both succeed. Consumers must not assume this is a
   * native indicator render projection (see indicatorUnsupported).
   */
  readonly indicator?: StyleIndicatorSnapshot;
  readonly indicatorUnsupported?: string;
}

export type StyleCellsSnapshot = readonly StyleCell[];

export type StyleCellsStore = ModelFieldStore<StyleCellsSnapshot>;

const EMPTY_STACK: readonly StyleSourceSnapshot[] = Object.freeze([]);
const NONE_INDICATOR: StyleIndicatorSnapshot = Object.freeze({
  source: "none",
  stack: EMPTY_STACK,
});
const INVARIANTABLE_INDICATOR: StyleIndicatorSnapshot = Object.freeze({
  source: "invariantable",
  stack: EMPTY_STACK,
});

function freeze<T extends object>(value: T): T {
  return Object.freeze(value);
}

function freezeArray<T>(value: readonly T[]): readonly T[] {
  return Object.freeze(value.slice());
}

function variantRefs(
  models: ModelSnapshots,
  variants: readonly Variant[],
): readonly ModelRef<Variant>[] {
  return freezeArray(variants.map((variant) => models.ref(variant)));
}

// ---------------------------------------------------------------------------
// Indicator capture / resolution
// ---------------------------------------------------------------------------

function captureSource(
  models: ModelSnapshots,
  source: VariantSettingSource,
): StyleSourceSnapshot {
  switch (source.type) {
    case "theme":
      return freeze({
        type: "theme",
        theme: models.ref(source.theme),
        prop: source.prop,
        value: source.value,
      });
    case "themeTag":
      return freeze({
        type: "themeTag",
        theme: models.ref(source.theme),
        selector: source.selector,
        prop: source.prop,
        value: source.value,
      });
    case "mixin":
      return freeze({
        type: "mixin",
        combo: variantRefs(models, source.combo),
        mixin: models.ref(source.mixin),
        prop: source.prop,
        value: source.value,
      });
    case "style":
      return freeze({
        type: "style",
        combo: variantRefs(models, source.combo),
        prop: source.prop,
        value: source.value,
        isDerived: source.isDerived,
        animations: source.animations
          ? freezeArray(
              source.animations.map((animation) =>
                models.ref(animation),
              ),
            )
          : undefined,
      });
    case "parentTplStyle":
      return freeze({
        type: "parentTplStyle",
        parentTpl: models.ref(source.parentTpl),
        prop: source.prop,
        value: source.value,
        activeVariants: variantRefs(models, source.activeVariants),
        tplComponent: source.tplComponent
          ? models.ref(source.tplComponent)
          : undefined,
      });
    case "slot":
      return freeze({ type: "slot", parentTpl: models.ref(source.parentTpl), param: models.ref(source.param),
        prop: source.prop, value: source.value, activeVariants: variantRefs(models, source.activeVariants),
        tplComponent: source.tplComponent ? models.ref(source.tplComponent) : undefined });
    case "arg":
    case "attr":
    case "visibility":
    case "text":
    case "columnsConfig":
      throw new Error(
        `Native style projection does not support ${source.type} indicator sources`,
      );
    default:
      throw new Error(
        `Unsupported style indicator source: ${(source as { type: string }).type}`,
      );
  }
}

export function captureDefinedIndicator(
  models: ModelSnapshots,
  indicator: DefinedIndicatorType,
): StyleIndicatorSnapshot {
  switch (indicator.source) {
    case "none":
      return NONE_INDICATOR;
    case "invariantable":
      return INVARIANTABLE_INDICATOR;
    case "setNonVariable":
      return freeze({
        source: "setNonVariable",
        prop: indicator.prop,
        value: indicator.value,
        themeTag: indicator.themeTag,
        stack: EMPTY_STACK,
      });
    case "theme": {
      const stack = freezeArray(
        indicator.stack.map((source) => captureSource(models, source)),
      );
      return freeze({
        source: "theme",
        theme: models.ref(indicator.theme),
        stack,
      });
    }
    case "parentTplStyle": {
      const stack = freezeArray(
        indicator.stack.map((source) => captureSource(models, source)),
      );
      return freeze({ source: "parentTplStyle", stack });
    }
    case "set":
    case "derived":
    case "mixin":
    case "otherVariants": {
      const stack = freezeArray(
        indicator.stack.map((source) => captureSource(models, source)),
      );
      const targetSource = indicator.targetSource;
      const targetSourceIndex = targetSource
        ? indicator.stack.indexOf(targetSource)
        : undefined;
      if (targetSourceIndex !== undefined && targetSourceIndex < 0) {
        throw new Error("Indicator target source is not in its own stack");
      }
      const captured: StyleIndicatorSnapshot = {
        source: indicator.source,
        stack,
        targetSourceIndex,
        targetHasHighestPriority:
          indicator.source === "otherVariants"
            ? indicator.targetHasHighestPriority
            : undefined,
        mixin:
          indicator.source === "mixin"
            ? models.ref(indicator.mixin)
            : undefined,
      };
      return freeze(captured);
    }
    default:
      throw new Error(
        `Unsupported style indicator: ${(indicator as { source: string }).source}`,
      );
  }
}

function resolveSource(
  models: ModelSnapshots,
  source: StyleSourceSnapshot,
): VariantSettingSource {
  switch (source.type) {
    case "theme":
      return {
        type: "theme",
        theme: models.resolve(source.theme),
        prop: source.prop,
        value: source.value,
      };
    case "themeTag":
      return {
        type: "themeTag",
        theme: models.resolve(source.theme),
        selector: source.selector,
        prop: source.prop,
        value: source.value,
      };
    case "mixin":
      return {
        type: "mixin",
        combo: source.combo.map((variant) => models.resolve(variant)),
        mixin: models.resolve(source.mixin),
        prop: source.prop,
        value: source.value,
      };
    case "style":
      return {
        type: "style",
        combo: source.combo.map((variant) => models.resolve(variant)),
        prop: source.prop,
        value: source.value,
        isDerived: source.isDerived,
        animations: source.animations
          ? source.animations.map((animation) => models.resolve(animation))
          : undefined,
      };
    case "slot":
      return { type: "slot", parentTpl: models.resolve(source.parentTpl), param: models.resolve(source.param),
        prop: source.prop, value: source.value,
        activeVariants: source.activeVariants.map((variant) => models.resolve(variant)),
        tplComponent: source.tplComponent ? models.resolve(source.tplComponent) : undefined };
    case "parentTplStyle":
      return {
        type: "parentTplStyle",
        parentTpl: models.resolve(source.parentTpl),
        prop: source.prop,
        value: source.value,
        activeVariants: source.activeVariants.map((variant) =>
          models.resolve(variant),
        ),
        tplComponent: source.tplComponent
          ? models.resolve(source.tplComponent)
          : undefined,
      };
  }
}

/**
 * Reconstruct the existing consumer contract only when a consumer/popover
 * actually needs live models. The projection snapshot itself never does this.
 */
export function resolveDefinedIndicator(
  models: ModelSnapshots,
  indicator: StyleIndicatorSnapshot,
): DefinedIndicatorType {
  switch (indicator.source) {
    case "none":
      return { source: "none" };
    case "invariantable":
      return { source: "invariantable" };
    case "setNonVariable":
      return {
        source: "setNonVariable",
        prop: ensure(indicator.prop, "setNonVariable indicator must have prop"),
        value: ensure(
          indicator.value,
          "setNonVariable indicator must have value",
        ),
        themeTag: indicator.themeTag,
      };
    case "theme":
      return {
        source: "theme",
        theme: models.resolve(
          ensure(indicator.theme, "theme indicator must have a theme ref"),
        ),
        stack: indicator.stack.map((source) => resolveSource(models, source)),
      };
    case "parentTplStyle":
      return {
        source: "parentTplStyle",
        stack: indicator.stack.map((source) => resolveSource(models, source)),
      };
    case "set":
    case "derived":
    case "mixin":
    case "otherVariants": {
      const stack = indicator.stack.map((source) =>
        resolveSource(models, source),
      );
      const targetSource =
        indicator.targetSourceIndex === undefined
          ? undefined
          : ensure(
              stack[indicator.targetSourceIndex],
              "indicator target source index is out of range",
            );
      if (indicator.source === "mixin") {
        return {
          source: "mixin",
          mixin: models.resolve(
            ensure(indicator.mixin, "mixin indicator must have a mixin ref"),
          ),
          stack,
          targetSource,
        };
      }
      if (indicator.source === "set") {
        return {
          source: "set",
          stack,
          targetSource: ensure(
            targetSource,
            "set indicator must have a target source",
          ),
        };
      }
      if (indicator.source === "derived") {
        return {
          source: "derived",
          stack,
          targetSource: ensure(
            targetSource,
            "derived indicator must have a target source",
          ),
        };
      }
      return {
        source: "otherVariants",
        stack,
        targetSource,
        targetHasHighestPriority:
          indicator.targetHasHighestPriority ?? false,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Comparison helpers (stable snapshots without serializing the world)
// ---------------------------------------------------------------------------

function refsEqual<T extends ObjInst>(
  a: readonly ModelRef<T>[] | undefined,
  b: readonly ModelRef<T>[] | undefined,
) {
  if (a === b) {
    return true;
  }
  if (!a || !b || a.length !== b.length) {
    return false;
  }
  return a.every((item, index) => item === b[index]);
}

function sourceEquals(a: StyleSourceSnapshot, b: StyleSourceSnapshot) {
  if (a.type !== b.type) {
    return false;
  }
  switch (a.type) {
    case "theme":
      return (
        b.type === "theme" &&
        a.theme === b.theme &&
        a.prop === b.prop &&
        a.value === b.value
      );
    case "themeTag":
      return (
        b.type === "themeTag" &&
        a.theme === b.theme &&
        a.selector === b.selector &&
        a.prop === b.prop &&
        a.value === b.value
      );
    case "mixin":
      return (
        b.type === "mixin" &&
        refsEqual(a.combo, b.combo) &&
        a.mixin === b.mixin &&
        a.prop === b.prop &&
        a.value === b.value
      );
    case "style":
      return (
        b.type === "style" &&
        refsEqual(a.combo, b.combo) &&
        a.prop === b.prop &&
        a.value === b.value &&
        a.isDerived === b.isDerived &&
        refsEqual(a.animations, b.animations)
      );
    case "slot":
      return b.type === "slot" && a.parentTpl === b.parentTpl && a.param === b.param && a.prop === b.prop &&
        a.value === b.value && refsEqual(a.activeVariants, b.activeVariants) && a.tplComponent === b.tplComponent;
    case "parentTplStyle":
      return (
        b.type === "parentTplStyle" &&
        a.parentTpl === b.parentTpl &&
        a.prop === b.prop &&
        a.value === b.value &&
        refsEqual(a.activeVariants, b.activeVariants) &&
        a.tplComponent === b.tplComponent
      );
  }
}

function indicatorEquals(
  a: StyleIndicatorSnapshot,
  b: StyleIndicatorSnapshot,
) {
  if (a === b) {
    return true;
  }
  if (
    a.source !== b.source ||
    a.prop !== b.prop ||
    a.value !== b.value ||
    a.themeTag !== b.themeTag ||
    a.targetHasHighestPriority !== b.targetHasHighestPriority ||
    a.targetSourceIndex !== b.targetSourceIndex ||
    a.mixin !== b.mixin ||
    a.theme !== b.theme ||
    a.stack.length !== b.stack.length
  ) {
    return false;
  }
  return a.stack.every((source, index) =>
    sourceEquals(source, b.stack[index]),
  );
}

function cellEquals(a: StyleCell, b: StyleCell) {
  const indicatorsEqual =
    a.indicator && b.indicator
      ? indicatorEquals(a.indicator, b.indicator)
      : a.indicator === b.indicator;
  return (
    a.key === b.key &&
    a.value === b.value &&
    a.raw === b.raw &&
    a.has === b.has &&
    a.targetHas === b.targetHas &&
    indicatorsEqual &&
    a.indicatorUnsupported === b.indicatorUnsupported
  );
}

function cellsEqual(a: StyleCellsSnapshot, b: StyleCellsSnapshot) {
  return a.length === b.length && a.every((cell, index) => cellEquals(cell, b[index]));
}

// ---------------------------------------------------------------------------
// Explicit persisted-field declarations
// ---------------------------------------------------------------------------

interface FieldDeclaration {
  readonly fields: readonly string[];
  readonly follow: readonly string[];
}

/**
 * Only fields on the effective-style path. Tpl parent is walked explicitly so
 * a TplComponent boundary is not crossed, and Component.tplTree is never
 * traversed.
 */
const STYLE_FIELD_DECLARATIONS: Record<string, FieldDeclaration> = {
  Site: {
    fields: [
      "activeTheme",
      "globalVariantGroups",
      "activeScreenVariantGroup",
      "projectDependencies",
    ],
    follow: ["activeTheme", "globalVariantGroups", "projectDependencies"],
  },
  ProjectDependency: { fields: ["site"], follow: ["site"] },
  Theme: { fields: ["defaultStyle", "styles"], follow: ["defaultStyle", "styles"] },
  // Selector is immutable; a legal selector replacement arrives through Theme.styles.
  ThemeStyle: {
    fields: ["selector", "style"],
    follow: ["style"],
  },
  Mixin: { fields: ["rs", "variantedRs"], follow: ["rs", "variantedRs"] },
  RuleSet: {
    fields: ["values", "mixins", "animations"],
    follow: ["mixins", "animations"],
  },
  VariantedRuleSet: { fields: ["variants", "rs"], follow: ["variants", "rs"] },
  VariantSetting: { fields: ["variants", "rs", "args", "attrs", "text", "dataCond"], follow: ["variants", "rs", "args"] },
  Variant: {
    fields: ["name", "parent", "selectors", "forTpl", "mediaQuery"],
    follow: ["parent", "forTpl"],
  },
  VariantGroup: { fields: ["variants", "multi"], follow: ["variants"] },
  ComponentVariantGroup: {
    fields: ["variants", "multi", "type"],
    follow: ["variants"],
  },
  GlobalVariantGroup: {
    fields: ["variants", "multi", "type"],
    follow: ["variants"],
  },
  Component: {
    fields: ["variants", "variantGroups", "superComp", "params", "type"],
    follow: ["variants", "variantGroups", "superComp", "params"],
  },
  TplTag: {
    fields: ["vsettings", "parent", "tag", "type"],
    follow: ["vsettings"],
  },
  TplComponent: {
    fields: ["vsettings", "parent", "component"],
    follow: ["vsettings", "component"],
  },
  TplSlot: {
    fields: ["vsettings", "parent", "param"],
    follow: ["vsettings"],
  },
  Arg: { fields: ["param", "expr"], follow: ["param", "expr"] },
  RenderExpr: { fields: ["tpl"], follow: [] },
  VirtualRenderExpr: { fields: ["tpl"], follow: [] },
  VariantsRef: { fields: ["variants"], follow: ["variants"] },
  SlotParam: { fields: ["type", "tplSlot"], follow: [] },
  PropParam: { fields: ["type"], follow: [] },
  StateParam: { fields: ["type"], follow: [] },
  StateChangeHandlerParam: { fields: ["type"], follow: [] },
  GlobalVariantGroupParam: { fields: ["type"], follow: [] },
  ThemeLayoutSettings: { fields: ["rs"], follow: ["rs"] },
  Animation: { fields: ["sequence"], follow: ["sequence"] },
  AnimationSequence: { fields: ["name"], follow: [] },
};

class StyleFieldCollector {
  private readonly used = new Set<ModelFieldStore<unknown>>();
  readonly skipped = new Set<string>();

  constructor(
    private readonly models: ModelSnapshots,
    private readonly stops: Map<ModelFieldStore<unknown>, () => void>,
    private readonly invalidate: () => void,
    private readonly subscribe: boolean,
  ) {}

  field(model: ObjInst, key: string) {
    const store = this.models.declaredField(model, key);
    this.used.add(store);
    if (!this.subscribe) {
      return;
    }
    if (!this.stops.has(store)) {
      this.stops.set(store, this.models.subscribePreparedField(store, this.invalidate));
    }
  }

  finish() {
    if (!this.subscribe) {
      return;
    }
    for (const [store, stop] of this.stops) {
      if (!this.used.has(store)) {
        stop();
        this.stops.delete(store);
      }
    }
  }
}

function declareModel(
  collector: StyleFieldCollector,
  model: ObjInst,
  visited: Set<ObjInst>,
  follow = true,
) {
  if (visited.has(model)) {
    return;
  }
  visited.add(model);
  const type = instUtil.getInstClassName(model);
  const declaration = STYLE_FIELD_DECLARATIONS[type];
  if (!declaration) {
    // Expression types outside the CSS field schema do not contribute style
    // values. Report their identities for field-coverage inspection.
    collector.skipped.add(type);
    return;
  }
  for (const key of declaration.fields) {
    collector.field(model, key);
  }
  if (!follow) {
    return;
  }
  for (const key of declaration.follow) {
    followValue(collector, Reflect.get(model, key), visited);
  }
}

function followValue(
  collector: StyleFieldCollector,
  value: unknown,
  visited: Set<ObjInst>,
) {
  if (Array.isArray(value)) {
    value.forEach((item) => followValue(collector, item, visited));
  } else if (value && instUtil.isObjInst(value)) {
    declareModel(collector, value, visited);
  }
}

function declareTplStyleFields(
  collector: StyleFieldCollector,
  source: TplStyleSource,
) {
  const visited = new Set<ObjInst>();
  declareModel(collector, source.site, visited);
  declareModel(collector, source.component, visited);
  const context = source.readContext();
  const roots = [source.tpl, ...context.effectiveVariantSetting.parentStyleContexts.map((parent) => parent.parentTpl)];
  for (const root of roots) {
    for (let tpl: TplNode | null | undefined = root; tpl; tpl = tpl.parent) {
      declareModel(collector, tpl, visited);
      if (instUtil.getInstClassName(tpl) === "TplComponent") { break; }
    }
  }

  const targetVs = tryGetVariantSetting(source.tpl, context.targetVariantCombo);
  if (targetVs) {
    declareModel(collector, targetVs, visited);
  }
}

function declareSingleRsStyleFields(collector: StyleFieldCollector, source: SingleRsStyleSource) {
  const visited = new Set<ObjInst>();
  const read = source.read;
  if (read.kind === "ruleSet") { declareModel(collector, read.rs, visited); }
  else if (read.kind === "mixin") {
    declareModel(collector, read.site, visited); declareModel(collector, read.mixin, visited);
    read.activeGlobalVariants.forEach((variant) => declareModel(collector, variant, visited));
  } else if (read.theme) {
    collector.field(read.theme, "layout");
    if (read.theme.layout) { declareModel(collector, read.theme.layout, visited); }
  } else { declareModel(collector, read.layout, visited); }
}

// ---------------------------------------------------------------------------
// Projection sources (discriminated, not a one-size owner)
// ---------------------------------------------------------------------------

export interface TplStyleContext {
  readonly activeVariantCombo: VariantCombo;
  readonly targetVariantCombo: VariantCombo;
  readonly targetIndicatorCombo: VariantCombo;
  readonly effectiveVariantSetting: EffectiveVariantSetting;
}
export interface TplStyleSource {
  readonly kind: "tpl";
  readonly tpl: TplNode;
  readonly site: Site;
  readonly component: Component;
  /** Fixed component-stack identity, not a mutable model revision. */
  readonly contextKey: string;
  /** Reuses the provider's fixed-frame VariantTplMgr and its current native pins. */
  readonly readContext: () => TplStyleContext;
}
export type SingleRsReadRecipe =
  | { readonly kind: "ruleSet"; readonly rs: RuleSet; readonly forTag: string }
  | { readonly kind: "mixin"; readonly site: Site; readonly mixin: Mixin;
      readonly activeGlobalVariants: readonly Variant[]; readonly forTag: string }
  | { readonly kind: "themeLayout"; readonly theme: Theme | undefined | null; readonly layout: ThemeLayoutSettings };
export interface SingleRsStyleSource {
  readonly kind: "singleRs";
  readonly read: SingleRsReadRecipe;
  readonly themeTag?: ThemableTag;
}
function materializeSingleRsRead(source: SingleRsStyleSource): ReadonlyIRuleSetHelpersX {
  const read = source.read;
  if (read.kind === "ruleSet") { return new RuleSetHelpers(read.rs, read.forTag); }
  if (read.kind === "mixin") {
    return new VariantedRuleSetHelpers(read.mixin, read.forTag,
      new VariantedStylesHelper(read.site, [...read.activeGlobalVariants], [...read.activeGlobalVariants]));
  }
  const layout = read.theme ? read.theme.layout ?? new ThemeLayoutSettingsModel({ rs: new RuleSetModel({ values: {}, mixins: [], animations: null }) }) : read.layout;
  return new ThemeLayoutRuleSetHelpers(layout, read.theme);
}

// ---------------------------------------------------------------------------
// Store helper (storage only, no style algorithm)
// ---------------------------------------------------------------------------

/**
 * Zustand is the notification primitive; the native owner still installs
 * `current` directly in the ModelSnapshots.beforePublish fence. That keeps
 * getState correct before any field/native subscriber runs, while publish only
 * delivers one notification when the installed snapshot identity changed.
 */
class ProjectionStore<T> {
  private current: T;
  private dirty = false;
  private disposed = false;
  private readonly state: StoreApi<T>;
  private readonly subscriptions = new Set<() => void>();
  readonly store: ModelFieldStore<T>;

  constructor(
    private readonly compute: () => T,
    private readonly equals: (a: T, b: T) => boolean,
    private readonly onSubscriberChange?: (count: number) => void,
    private readonly ownerDisposed?: () => boolean,
  ) {
    this.current = compute();
    this.state = createStore<T>(() => this.current);
    this.store = {
      getState: () => this.current,
      getInitialState: this.state.getInitialState,
      subscribe: (listener) => {
        if (this.isDisposed) {
          return () => undefined;
        }
        const unsubscribe = this.state.subscribe(listener);
        const stop = () => {
          unsubscribe();
          this.subscriptions.delete(stop);
          this.onSubscriberChange?.(this.subscriptions.size);
        };
        this.subscriptions.add(stop);
        this.onSubscriberChange?.(this.subscriptions.size);
        return stop;
      },
    };
  }

  getSnapshot = () => this.current;

  get subscriberCount() {
    return this.subscriptions.size;
  }

  markDirty = () => {
    if (!this.isDisposed) {
      this.dirty = true;
    }
  };

  /**
   * Re-read the committed input. This is used when a projection is connected
   * after render, so a model edit that happened between render and commit is
   * not displayed from the render-time snapshot.
   */
  refresh() {
    if (this.isDisposed) {
      return false;
    }
    const next = this.compute();
    this.dirty = false;
    if (this.equals(next, this.current)) {
      return false;
    }
    this.current = next;
    return true;
  }

  /** Install the final cell snapshot before prepared field publication. */
  prepare() {
    if (this.isDisposed || !this.dirty) {
      return;
    }
    this.refresh();
  }

  /** Notify only after every owner has installed its final inputs. */
  publish() {
    if (this.isDisposed || this.state.getState() === this.current) {
      return;
    }
    this.state.setState(this.current, true);
  }

  get isDisposed() {
    return this.disposed || !!this.ownerDisposed?.();
  }

  dispose() {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    for (const stop of this.subscriptions) {
      stop();
    }
    this.subscriptions.clear();
  }
}

// ---------------------------------------------------------------------------
// Concrete owners
// ---------------------------------------------------------------------------

export interface StyleProjectionOptions {
  /**
   * Registry-created projections are not demanded until a committed consumer
   * subscribes or retains. Direct projection construction stays eager.
   */
  readonly deferFieldSubscriptions?: boolean;
  /** Closed render candidates remain terminal without a strong owner registration. */
  readonly ownerDisposed?: () => boolean;
}

export class TplStyleProjection {
  readonly store: StyleCellsStore;
  private readonly storage: ProjectionStore<StyleCellsSnapshot>;
  private readonly fieldStops = new Map<ModelFieldStore<unknown>, () => void>();
  private readonly skippedFieldTypes = new Set<string>();
  private readonly invalidate = () => {
    this.storage?.markDirty();
  };
  private source: TplStyleSource;
  private keys: readonly StyleKey[];
  private readonly managed: boolean;
  private connected: boolean;
  private leases = 0;
  private demand: (() => boolean) | undefined;
  private idle: (() => void) | undefined;
  private capturedContext: TplStyleContext | undefined;

  constructor(
    private readonly models: ModelSnapshots,
    source: TplStyleSource,
    keys: readonly StyleKey[],
    options?: StyleProjectionOptions,
  ) {
    this.source = source;
    this.keys = normalizeStyleKeys(keys);
    this.managed = !!options?.deferFieldSubscriptions;
    this.connected = !this.managed;
    this.storage = new ProjectionStore(
      () => this.computeCells(),
      cellsEqual,
      () => this.handleSubscriberChange(),
      options?.ownerDisposed,
    );
    this.store = this.storage.store;
  }

  update(source: TplStyleSource, keys: readonly StyleKey[]) {
    const nextKeys = normalizeStyleKeys(keys);
    let changed = false;
    if (
      nextKeys.length !== this.keys.length ||
      nextKeys.some((key, index) => key !== this.keys[index])
    ) {
      this.keys = nextKeys;
      changed = true;
    }
    this.source = source;
    if (changed) {
      this.storage.markDirty();
    }
  }

  prepare() {
    if (this.managed && !this.connected) { return; }
    const next = this.source.readContext(), previous = this.capturedContext;
    const same = (left: readonly Variant[], right: readonly Variant[]) => left.length === right.length && left.every((variant, index) => variant === right[index]);
    if (!previous || !same(previous.activeVariantCombo, next.activeVariantCombo) ||
      !same(previous.targetVariantCombo, next.targetVariantCombo) || !same(previous.targetIndicatorCombo, next.targetIndicatorCombo)) { this.storage.markDirty(); }
    this.storage.prepare();
  }

  publish() {
    this.storage.publish();
  }

  bindDemand(demand: () => boolean, idle: () => void) {
    this.demand = demand;
    this.idle = idle;
  }

  /**
   * Attach field subscriptions and recheck the committed model. Called only
   * after a consumer has committed (store subscription or retain effect).
   */
  connect() {
    if (this.storage.isDisposed || this.connected) {
      return;
    }
    if (this.demand && !this.demand()) { this.dispose(); return; }
    this.connected = true;
    try {
      if (this.storage.refresh()) {
        this.storage.publish();
      }
    } catch (error) {
      // Do not leave a half-connected projection that silently stops
      // retrying. The genuine active-provider error still surfaces.
      this.connected = false;
      this.stopFields();
      this.idle?.();
      throw error;
    }
  }

  /**
   * Stop declared-field subscriptions for an idle projection. The cached
   * snapshot stays stable, and a later committed render reconnects it.
   */
  disconnect() {
    if (this.storage.isDisposed) {
      return;
    }
    this.stopFields();
    this.connected = false;
    this.idle?.();
  }

  /** A committed consumer lease; keeps the projection connected. */
  retain(): () => void {
    if (this.storage.isDisposed) {
      return () => undefined;
    }
    this.leases++;
    this.connect();
    let stopped = false;
    return () => {
      if (stopped) {
        return;
      }
      stopped = true;
      this.leases = Math.max(0, this.leases - 1);
      this.releaseIfIdle();
    };
  }

  resolveIndicator(indicator: StyleIndicatorSnapshot): DefinedIndicatorType {
    assert(
      !this.storage.isDisposed,
      "Cannot resolve a style indicator from a disposed projection",
    );
    return resolveDefinedIndicator(this.models, indicator);
  }

  get isDisposed() {
    return this.storage.isDisposed;
  }

  get isConnected() {
    return this.connected;
  }

  /** Model types encountered outside the CSS field schema. */
  get unsupportedFieldTypes(): readonly string[] {
    return [...this.skippedFieldTypes].sort();
  }

  dispose() {
    this.leases = 0;
    this.stopFields();
    this.connected = false;
    this.storage.dispose();
    this.idle?.();
  }

  private handleSubscriberChange() {
    if (this.storage?.subscriberCount) {
      this.connect();
    } else if (this.managed) {
      this.releaseIfIdle();
    }
  }

  private releaseIfIdle() {
    if (
      this.managed &&
      this.leases <= 0 &&
      !!this.storage &&
      !this.storage.subscriberCount
    ) {
      this.disconnect();
    }
  }

  private stopFields() {
    for (const stop of this.fieldStops.values()) {
      stop();
    }
    this.fieldStops.clear();
  }

  private computeCells(): StyleCellsSnapshot {
    this.declareFields(this.connected);
    const context = this.source.readContext();
    this.capturedContext = context;
    const effectiveVs = context.effectiveVariantSetting;
    const rsh = effectiveVs.rshWithThemeAndParentStyle();
    const targetVs = tryGetVariantSetting(
      this.source.tpl,
      context.targetVariantCombo,
    );
    const cells = this.keys.map((key) => {
      let indicator: StyleIndicatorSnapshot | undefined;
      let indicatorUnsupported: string | undefined;
      try {
        indicator = captureDefinedIndicator(
          this.models,
          computeDefinedIndicator(
            this.source.site,
            this.source.component,
            effectiveVs.getPropSource(key),
            context.targetIndicatorCombo,
          ),
        );
      } catch (error) {
        // A value-only cell must remain usable even when the indicator read
        // projection does not yet support this source stack.
        indicatorUnsupported =
          error instanceof Error ? error.message : String(error);
      }
      return freeze({
        key,
        value: rsh.get(key),
        raw: rsh.getRaw(key),
        has: rsh.has(key),
        targetHas: !!targetVs && Object.hasOwn(targetVs.rs.values, key),
        indicator,
        indicatorUnsupported,
      });
    });
    return freezeArray(cells);
  }

  private declareFields(subscribe: boolean) {
    const collector = new StyleFieldCollector(
      this.models,
      this.fieldStops,
      this.invalidate,
      subscribe,
    );
    declareTplStyleFields(collector, this.source);
    collector.finish();
    this.skippedFieldTypes.clear();
    collector.skipped.forEach((type) => this.skippedFieldTypes.add(type));
  }
}

export class SingleRsStyleProjection {
  readonly store: StyleCellsStore;
  private readonly storage: ProjectionStore<StyleCellsSnapshot>;
  private readonly fieldStops = new Map<ModelFieldStore<unknown>, () => void>();
  private readonly skippedFieldTypes = new Set<string>();
  private readonly invalidate = () => {
    this.storage?.markDirty();
  };
  private source: SingleRsStyleSource;
  private keys: readonly StyleKey[];
  private readonly managed: boolean;
  private connected: boolean;
  private leases = 0;
  private demand: (() => boolean) | undefined;
  private idle: (() => void) | undefined;

  constructor(
    private readonly models: ModelSnapshots,
    source: SingleRsStyleSource,
    keys: readonly StyleKey[],
    options?: StyleProjectionOptions,
  ) {
    this.source = source;
    this.keys = normalizeStyleKeys(keys);
    this.managed = !!options?.deferFieldSubscriptions;
    this.connected = !this.managed;
    this.storage = new ProjectionStore(
      () => this.computeCells(),
      cellsEqual,
      () => this.handleSubscriberChange(),
      options?.ownerDisposed,
    );
    this.store = this.storage.store;
  }

  update(source: SingleRsStyleSource, keys: readonly StyleKey[]) {
    const nextKeys = normalizeStyleKeys(keys);
    let changed = singleRsStyleProjectionKey(this.source, this.keys) !== singleRsStyleProjectionKey(source, nextKeys);
    if (
      nextKeys.length !== this.keys.length ||
      nextKeys.some((key, index) => key !== this.keys[index])
    ) {
      this.keys = nextKeys;
      changed = true;
    }
    this.source = source;
    if (changed) {
      this.storage.markDirty();
    }
  }

  prepare() {
    this.storage.prepare();
  }

  publish() {
    this.storage.publish();
  }

  bindDemand(demand: () => boolean, idle: () => void) {
    this.demand = demand;
    this.idle = idle;
  }

  /**
   * Attach field subscriptions and recheck the committed model. Called only
   * after a consumer has committed (store subscription or retain effect).
   */
  connect() {
    if (this.storage.isDisposed || this.connected) {
      return;
    }
    if (this.demand && !this.demand()) { this.dispose(); return; }
    this.connected = true;
    try {
      if (this.storage.refresh()) {
        this.storage.publish();
      }
    } catch (error) {
      // Do not leave a half-connected projection that silently stops
      // retrying. The genuine active-provider error still surfaces.
      this.connected = false;
      this.stopFields();
      this.idle?.();
      throw error;
    }
  }

  /**
   * Stop declared-field subscriptions for an idle projection. The cached
   * snapshot stays stable, and a later committed render reconnects it.
   */
  disconnect() {
    if (this.storage.isDisposed) {
      return;
    }
    this.stopFields();
    this.connected = false;
    this.idle?.();
  }

  /** A committed consumer lease; keeps the projection connected. */
  retain(): () => void {
    if (this.storage.isDisposed) {
      return () => undefined;
    }
    this.leases++;
    this.connect();
    let stopped = false;
    return () => {
      if (stopped) {
        return;
      }
      stopped = true;
      this.leases = Math.max(0, this.leases - 1);
      this.releaseIfIdle();
    };
  }

  resolveIndicator(indicator: StyleIndicatorSnapshot): DefinedIndicatorType {
    assert(
      !this.storage.isDisposed,
      "Cannot resolve a style indicator from a disposed projection",
    );
    return resolveDefinedIndicator(this.models, indicator);
  }

  get isDisposed() {
    return this.storage.isDisposed;
  }

  get isConnected() {
    return this.connected;
  }

  /** Model types encountered outside the CSS field schema. */
  get unsupportedFieldTypes(): readonly string[] {
    return [...this.skippedFieldTypes].sort();
  }

  dispose() {
    this.leases = 0;
    this.stopFields();
    this.connected = false;
    this.storage.dispose();
    this.idle?.();
  }

  private handleSubscriberChange() {
    if (this.storage?.subscriberCount) {
      this.connect();
    } else if (this.managed) {
      this.releaseIfIdle();
    }
  }

  private releaseIfIdle() {
    if (
      this.managed &&
      this.leases <= 0 &&
      !!this.storage &&
      !this.storage.subscriberCount
    ) {
      this.disconnect();
    }
  }

  private stopFields() {
    for (const stop of this.fieldStops.values()) {
      stop();
    }
    this.fieldStops.clear();
  }

  private computeCells(): StyleCellsSnapshot {
    this.declareFields(this.connected);
    const rsh = materializeSingleRsRead(this.source);
    const cells = this.keys.map((key) => {
      const has = rsh.has(key);
      let indicator: StyleIndicatorSnapshot | undefined;
      let indicatorUnsupported: string | undefined;
      try {
        indicator = captureDefinedIndicator(
          this.models,
          computeSingleRsDefinedIndicator(rsh, key, this.source.themeTag),
        );
      } catch (error) {
        indicatorUnsupported =
          error instanceof Error ? error.message : String(error);
      }
      return freeze({
        key,
        value: rsh.get(key),
        raw: rsh.getRaw(key),
        has,
        targetHas: has,
        indicator,
        indicatorUnsupported,
      });
    });
    return freezeArray(cells);
  }

  private declareFields(subscribe: boolean) {
    const collector = new StyleFieldCollector(
      this.models,
      this.fieldStops,
      this.invalidate,
      subscribe,
    );
    declareSingleRsStyleFields(collector, this.source);
    collector.finish();
    this.skippedFieldTypes.clear();
    collector.skipped.forEach((type) => this.skippedFieldTypes.add(type));
  }
}

// ---------------------------------------------------------------------------
// Keys and registries
// ---------------------------------------------------------------------------

export function normalizeStyleKeys(keys: readonly string[]): readonly StyleKey[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const key of keys) {
    assert(!!key, "Style key must be non-empty");
    const prop = css.normProp(key);
    if (!seen.has(prop)) {
      seen.add(prop);
      normalized.push(prop);
    }
  }
  return freezeArray(normalized);
}

function comboKey(combo: readonly Variant[]) {
  return combo.map((variant) => variant.uuid).sort().join(",");
}

export function tplStyleProjectionKey(source: TplStyleSource, keys: readonly StyleKey[]) {
  const context = source.readContext();
  return [source.tpl.uid, source.site.uid, source.component.uid, source.contextKey,
    comboKey(context.activeVariantCombo), comboKey(context.targetVariantCombo), comboKey(context.targetIndicatorCombo), keys.join("\u0000")].join("|");
}
export function singleRsStyleProjectionKey(source: SingleRsStyleSource, keys: readonly StyleKey[]) {
  const read = source.read;
  const identity = read.kind === "ruleSet" ? [read.kind, read.rs.uid, read.forTag]
    : read.kind === "mixin" ? [read.kind, read.site.uid, read.mixin.uid, read.forTag, comboKey(read.activeGlobalVariants)]
    : [read.kind, read.theme?.uid, read.layout.uid];
  return [...identity, source.themeTag ?? "", keys.join("\u0000")].join("|");
}

export interface TplProjectionHandle {
  readonly key: string;
  readonly projection: TplStyleProjection;
  retain(): () => void;
}

export interface SingleRsProjectionHandle {
  readonly key: string;
  readonly projection: SingleRsStyleProjection;
  retain(): () => void;
}

export class ViewStyleInputs {
  private readonly entries = new Map<string, Set<TplStyleProjection>>();
  private readonly stopLifetime: (() => void) | undefined;
  private disposed = false;
  private publicationDepth = 0;

  constructor(
    private readonly models: () => ModelSnapshots,
    lifetime?: AbortSignal,
  ) {
    if (lifetime) {
      if (lifetime.aborted) {
        this.disposed = true;
      } else {
        const onAbort = () => this.dispose();
        lifetime.addEventListener("abort", onAbort, { once: true });
        this.stopLifetime = () =>
          lifetime.removeEventListener("abort", onAbort);
      }
    }
  }

  get(
    source: TplStyleSource,
    keys: readonly StyleKey[],
  ): TplProjectionHandle {
    assert(!this.disposed, "Cannot read style inputs from a disposed view");
    const normalized = normalizeStyleKeys(keys);
    const key = tplStyleProjectionKey(source, normalized);
    let projection = this.entries.get(key)?.values().next().value;
    if (!projection || projection.isDisposed) {
      // Render-time construction computes the initial cells but does not
      // attach declared-field subscriptions. Those are connected by the first
      // committed store subscriber or retain cleanup lease.
      projection = new TplStyleProjection(
        this.models(),
        source,
        normalized,
        { deferFieldSubscriptions: true, ownerDisposed: () => this.disposed },
      );
      const candidate = projection;
      candidate.bindDemand(() => {
        if (this.disposed) { return false; }
        let group = this.entries.get(key);
        if (!group) { group = new Set(); this.entries.set(key, group); }
        group.add(candidate);
        return true;
      }, () => {
        const group = this.entries.get(key);
        group?.delete(candidate);
        if (group?.size === 0) { this.entries.delete(key); }
      });
    } else {
      projection.update(source, normalized);
    }
    return {
      key,
      projection,
      retain: () => projection.retain(),
    };
  }

  get isDisposed() {
    return this.disposed;
  }

  prepareCommit() {
    if (this.disposed) {
      return;
    }
    for (const group of this.entries.values()) { group.forEach((projection) => projection.prepare()); }
  }

  deferPublication<Result>(command: () => Result): Result {
    this.publicationDepth++;
    try { return command(); }
    finally { this.publicationDepth--; this.publishCommit(); }
  }

  publishCommit() {
    if (this.disposed || this.publicationDepth) {
      return;
    }
    for (const group of this.entries.values()) { group.forEach((projection) => projection.publish()); }
  }

  dispose() {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.stopLifetime?.();
    for (const group of this.entries.values()) { [...group].forEach((projection) => projection.dispose()); }
    this.entries.clear();
  }
}

export class SingleRsStyleInputs {
  private readonly entries = new Map<string, Set<SingleRsStyleProjection>>();
  private readonly stopLifetime: (() => void) | undefined;
  private disposed = false;
  private publicationDepth = 0;

  constructor(
    private readonly models: () => ModelSnapshots,
    lifetime?: AbortSignal,
  ) {
    if (lifetime) {
      if (lifetime.aborted) {
        this.disposed = true;
      } else {
        const onAbort = () => this.dispose();
        lifetime.addEventListener("abort", onAbort, { once: true });
        this.stopLifetime = () =>
          lifetime.removeEventListener("abort", onAbort);
      }
    }
  }

  get(
    source: SingleRsStyleSource,
    keys: readonly StyleKey[],
  ): SingleRsProjectionHandle {
    assert(
      !this.disposed,
      "Cannot read single-ruleset style inputs from a disposed owner",
    );
    const normalized = normalizeStyleKeys(keys);
    const key = singleRsStyleProjectionKey(source, normalized);
    let projection = this.entries.get(key)?.values().next().value;
    if (!projection || projection.isDisposed) {
      // See ViewStyleInputs.get: subscriptions start only after commit.
      projection = new SingleRsStyleProjection(
        this.models(),
        source,
        normalized,
        { deferFieldSubscriptions: true, ownerDisposed: () => this.disposed },
      );
      const candidate = projection;
      candidate.bindDemand(() => {
        if (this.disposed) { return false; }
        let group = this.entries.get(key);
        if (!group) { group = new Set(); this.entries.set(key, group); }
        group.add(candidate);
        return true;
      }, () => {
        const group = this.entries.get(key);
        group?.delete(candidate);
        if (group?.size === 0) { this.entries.delete(key); }
      });
    } else {
      projection.update(source, normalized);
    }
    return {
      key,
      projection,
      retain: () => projection.retain(),
    };
  }

  get isDisposed() {
    return this.disposed;
  }

  prepareCommit() {
    if (this.disposed) {
      return;
    }
    for (const group of this.entries.values()) { group.forEach((projection) => projection.prepare()); }
  }

  deferPublication<Result>(command: () => Result): Result {
    this.publicationDepth++;
    try { return command(); }
    finally { this.publicationDepth--; this.publishCommit(); }
  }

  publishCommit() {
    if (this.disposed || this.publicationDepth) {
      return;
    }
    for (const group of this.entries.values()) { group.forEach((projection) => projection.publish()); }
  }

  dispose() {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.stopLifetime?.();
    for (const group of this.entries.values()) { [...group].forEach((projection) => projection.dispose()); }
    this.entries.clear();
  }
}

// ---------------------------------------------------------------------------
// Explicit native provider contract
// ---------------------------------------------------------------------------

/**
 * The two real provider modes expose their owner and source explicitly. Hooks
 * consume this contract structurally, so they do not import StyleComponent and
 * cannot create a second registry during render. The owner (ViewCtx or
 * StudioCtx) owns the registry and its disposal.
 */
export interface NativeTplStyleSource {
  readonly kind: "tpl";
  readonly inputs: ViewStyleInputs;
  readonly source: TplStyleSource;
}

export interface NativeSingleRsStyleSource {
  readonly kind: "singleRs";
  readonly inputs: SingleRsStyleInputs;
  readonly source: SingleRsStyleSource;
}

export type NativeStyleSource =
  | NativeTplStyleSource
  | NativeSingleRsStyleSource;

export interface NativeStyleProvider {
  getNativeStyleSource(): NativeStyleSource;
}
