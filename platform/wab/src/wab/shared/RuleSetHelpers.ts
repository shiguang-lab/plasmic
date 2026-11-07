import { isKnownTplTag, TplNode } from "@/wab/shared/model/classes";
// TODO clean up this require cycle
import { DeepReadonly } from "@/wab/commons/types";
import { assert } from "@/wab/shared/common";
import {
  CONTENT_LAYOUT_DEFAULTS,
  getAllDefinedStyles,
  typographyCssProps,
} from "@/wab/shared/core/style-props";
import * as css from "@/wab/shared/css";
import { Mixin, RuleSet, Theme, ThemeLayoutSettings } from "@/wab/shared/model/classes";
import {
  makeReadonlySizeAwareExpProxy,
  makeSizeAwareExpProxy,
} from "@/wab/shared/sizingutils";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import L, { memoize } from "lodash";
import { CSSProperties } from "react";

/** Helper for handling rulesets. */
export interface IRuleSetHelpers {
  has(prop: string): boolean;

  get(prop: string): string;

  set(prop: string, value: string): void;
}

export type ReadonlyIRuleSetHelpers = Pick<IRuleSetHelpers, "has" | "get">;

export interface IRuleSetHelpersX extends IRuleSetHelpers {
  getRaw(prop: string): string | undefined;

  merge(props: CSSProperties): void;

  clear(prop: string): void;

  clearAll(props: string[]): void;

  props(): string[];
}

export type ReadonlyIRuleSetHelpersX = Pick<
  IRuleSetHelpersX,
  "has" | "get" | "getRaw" | "props"
>;

/** Raw lookup shared by live helpers and finite installed model snapshots. */
export function getRuleSetRawValue(values: Readonly<RuleSet["values"]>, prop: string): string | undefined {
  return values[css.normProp(prop)];
}

/** The original truthy raw value or normalized CSS initial for a real tag. */
export function getRuleSetValueOrInitial(raw: string | undefined, prop: string, forTag: string): string {
  return raw || css.getCssInitial(css.normProp(prop), forTag);
}

export class RuleSetHelpers implements IRuleSetHelpersX {
  constructor(
    private readonly _rs: RuleSet,
    public readonly _forTag: string,
  ) {}

  rs = () => this._rs;

  has(prop: /*TWZ*/ string) {
    return css.normProp(prop) in this._rs.values;
  }

  getRaw(prop: /*TWZ*/ string): string | undefined {
    return getRuleSetRawValue(this._rs.values, prop);
  }

  get(prop: /*TWZ*/ string): string {
    return getRuleSetValueOrInitial(this.getRaw(prop), prop, this._forTag);
  }

  props() {
    return getAllDefinedStyles(this.rs());
  }

  clear(prop: string) {
    delete this._rs.values[css.normProp(prop)];
  }

  clearAll(props: string[]) {
    for (const prop of props) {
      this.clear(prop);
    }
  }

  merge(props: CSSProperties) {
    for (const prop in props) {
      this.set(prop, props[prop]);
    }
  }

  mergeRs(src: RuleSet) {
    for (const [p, v] of Object.entries(src.values)) {
      this.set(p, v);
    }
  }

  set(prop: /*TWZ*/ string, val: /*TWZ*/ string) {
    assert(val != null && val !== "", `val cannot be ${val}`);
    this._rs.values[css.normProp(prop)] =
      typeof val === "string" ? val : "" + val;
  }
}

export const getCssDefault = memoize(
  function (prop: string, tag: string | undefined) {
    return css.getCssInitial(css.normProp(prop), undefined);
  },
  (prop, tag) => prop + tag,
);

export function setDefaults(exp: IRuleSetHelpersX, defaults: CSSProperties) {
  exp.merge(L.pickBy(defaults, (val, prop) => !exp.has(prop)));
}

export function RSH(rs: RuleSet, tpl: TplNode) {
  const forTag = isKnownTplTag(tpl) ? tpl.tag : "div";
  return makeSizeAwareExpProxy(new RuleSetHelpers(rs, forTag), tpl);
}

export function readonlyRSH(
  rs: DeepReadonly<RuleSet>,
  tpl: TplNode,
): ReadonlyIRuleSetHelpersX {
  const forTag = isKnownTplTag(tpl) ? tpl.tag : "div";
  return makeReadonlySizeAwareExpProxy(
    new RuleSetHelpers(rs as RuleSet, forTag),
    tpl,
  );
}

export function hasTypography(rsh: ReadonlyIRuleSetHelpersX) {
  return typographyCssProps.some((p) => rsh.has(p));
}

export function extractStyles(
  styleProps: string[],
  fromExp: IRuleSetHelpersX,
  targetExp: IRuleSetHelpersX,
  keepProps?: string[],
) {
  for (const sn of styleProps) {
    if (fromExp.has(sn)) {
      targetExp.set(sn, fromExp.get(sn));
      if (!keepProps || !keepProps.includes(sn)) {
        fromExp.clear(sn);
      }
    }
  }
}

/** Existing document-layout defaults over its actual materialized ruleset. */
export class ThemeLayoutRuleSetHelpers extends RuleSetHelpers {
  constructor(private readonly layout: ThemeLayoutSettings, private readonly theme?: Theme | null) {
    super(layout.rs, "div");
  }
  set(prop: string, value: string) {
    if (this.theme && !this.theme.layout) { this.theme.layout = this.layout; }
    super.set(prop, value);
  }
  get(prop: string): string {
    return this.getRaw(prop) ?? CONTENT_LAYOUT_DEFAULTS[prop];
  }
}

export class VariantedRuleSetHelpers extends RuleSetHelpers {
  constructor(
    private readonly mixin: Mixin,
    _forTag: string,
    private readonly vsh: VariantedStylesHelper,
  ) {
    super(vsh.getActiveVariantedRuleSet(mixin), _forTag);
  }

  set(prop: string, val: string) {
    this.vsh.updateMixinRule(this.mixin, prop, val);
  }

  clear(prop: string) {
    this.vsh.updateMixinRule(this.mixin, prop, undefined);
  }
}
