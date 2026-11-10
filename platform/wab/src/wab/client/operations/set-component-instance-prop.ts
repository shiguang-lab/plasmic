import { getComponentArgFromHtmlProp } from "@/wab/client/operations/html-to-tpl";
import { unwrap } from "@/wab/commons/neverthrow-utils";
import { formatWIError } from "@/wab/client/web-importer/errors";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensureVariantSetting } from "@/wab/shared/Variants";
import { elementSchemaToTpl } from "@/wab/shared/code-components/code-components";
import { assert, ensureInstance } from "@/wab/shared/common";
import { tryExtractJson } from "@/wab/shared/core/exprs";
import { tryGetTplOwnerComponent } from "@/wab/shared/core/tpls";
import { GenericError } from "@/wab/shared/error-handling";
import { CustomCode, ObjectPath, TemplatedString, ExprText, RawText, RenderExpr, TplComponent, VariantSetting, ensureKnownTplTag, isKnownRenderExpr } from "@/wab/shared/model/classes";
import type { RichSlotType } from "@plasmicapp/host/registerComponent";
import { Result } from "neverthrow";

export type SetComponentInstancePropResult = Result<
  void,
  GenericError & { recoverable?: boolean }
>;

/**
 * Set a single prop (or variant selection) on a component instance, under
 * the given variant setting of the containing component.
 */
export function setComponentInstanceProp(
  tpl: TplComponent,
  propName: string,
  value: unknown,
  opts: {
    vs: VariantSetting;
    tplMgr: TplMgr;
    registration?: unknown;
  },
): SetComponentInstancePropResult {
  const { vs, tplMgr } = opts;
  const component = tpl.component;

  return getComponentArgFromHtmlProp(
    tplMgr.site(),
    component,
    component.name,
    propName,
    value,
    undefined,
    opts.registration,
  )
    .map(([param, expr]) => {
      const slot = opts.registration as RichSlotType<unknown> | undefined;
      if (slot && typeof slot === "object" && slot.type === "slot" && slot.fixedRoot) {
        const existing = vs.args.find((arg) => arg.param === param)?.expr;
        let root = isKnownRenderExpr(existing) && existing.tpl.length === 1
          ? ensureKnownTplTag(existing.tpl[0]) : undefined;
        if (!root) {
          assert(slot.defaultValue && typeof slot.defaultValue === "object" &&
            !Array.isArray(slot.defaultValue) && slot.defaultValue.type === "text",
            "A fixed text slot needs a registered text root");
          root = ensureKnownTplTag(unwrap(elementSchemaToTpl(
            tplMgr.site(), tryGetTplOwnerComponent(tpl), slot.defaultValue,
            { codeComponentsOnly: true },
          )).tpl);
          root.parent = tpl;
        }
        const text = tryExtractJson(expr);
        ensureVariantSetting(root, vs.variants).text = typeof text === "string"
          ? new RawText({ text, markers: [] }) : new ExprText({ expr: ensureInstance(expr, CustomCode, ObjectPath, TemplatedString), html: false });
        expr = new RenderExpr({ tpl: [root] });
      }
      tplMgr.setArg(tpl, vs, param.variable, expr);
    })
    .mapErr((error) => ({
      message: formatWIError(error),
      ...(error.code === "invalid-component-prop" && error.recoverable
        ? { recoverable: true }
        : {}),
    }));
}
