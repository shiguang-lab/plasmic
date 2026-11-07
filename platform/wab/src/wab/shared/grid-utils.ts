import GridStyleParser from "@/wab/gen/GridStyleParser";
import {
  ReadonlyIRuleSetHelpers,
  readonlyRSH,
} from "@/wab/shared/RuleSetHelpers";
import { ensure } from "@/wab/shared/common";
import { CssVarResolver, expandRuleSets } from "@/wab/shared/core/styles";
import { isTplTag } from "@/wab/shared/core/tpls";
import { NumericSize, Size } from "@/wab/shared/css-size";
import { TplNode } from "@/wab/shared/model/classes";
import { isArray, last } from "lodash";

export interface FlexibleSize {
  readonly type: "FlexibleSize";
  readonly size: NumericSize;
}

export interface FixedSize {
  readonly type: "FixedSize";
  readonly num: number;
}

export interface Track {
  readonly size: Size;
}

export interface GridSpec {
  readonly gridTemplateColumns?:
    | ReadonlyArray<Track>
    | FlexibleSize
    | FixedSize;
}

export const GRID_DEFAULT_TEMPLATE: FixedSize = {
  type: "FixedSize",
  num: 2,
};

export function parseGridCssPropsToSpec(
  rsh: ReadonlyIRuleSetHelpers,
  resolver: CssVarResolver,
): GridSpec {
  ensure(
    rsh.get("display") === "grid",
    "Grid element is expected to have display:grid",
  );
  return parseGridTemplateCss(rsh.has("grid-template-columns")
    ? resolver.tryResolveTokenOrMixinRef(rsh.get("grid-template-columns")) : undefined);
}

/** Parse the original optional, already-resolved grid template string. */
export function parseGridTemplateCss(value: string | undefined): GridSpec {
  return { gridTemplateColumns: value === undefined ? undefined : GridStyleParser.parse(value, { startRule: "axisTemplate" }) };
}

export function parseGridChildCssProps(values: {
  readonly rowStart?: string;
  readonly rowEnd?: string;
  readonly columnStart?: string;
  readonly columnEnd?: string;
}) {
  // start: X
  // end: span Y
  return {
    row: {
      start: values.rowStart,
      span: values.rowEnd !== undefined
        ? last(values.rowEnd.split(" "))
        : undefined,
    },
    column: {
      start: values.columnStart,
      span: values.columnEnd !== undefined
        ? last(values.columnEnd.split(" "))
        : undefined,
    },
  };
}

export function isTrackTemplate(
  template: ReadonlyArray<Track> | FlexibleSize | FixedSize,
): template is ReadonlyArray<Track> {
  return isArray(template);
}

export function isFlexibleSize(
  template: ReadonlyArray<Track> | FlexibleSize | FixedSize,
): template is FlexibleSize {
  return !isTrackTemplate(template) && template.type === "FlexibleSize";
}

export function isGridTag(tpl: TplNode) {
  if (!isTplTag(tpl)) {
    return false;
  }
  return tpl.vsettings
    .flatMap((vs) => expandRuleSets([vs.rs]))
    .some((rs) => {
      const rsh = readonlyRSH(rs, tpl);
      return rsh.get("display") === "grid";
    });
}
