import { getComponentArgFromHtmlProp } from "@/wab/client/operations/html-to-tpl";
import { formatWIError } from "@/wab/client/web-importer/errors";
import { TplMgr } from "@/wab/shared/TplMgr";
import { GenericError } from "@/wab/shared/error-handling";
import { TplComponent, VariantSetting } from "@/wab/shared/model/classes";
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
      tplMgr.setArg(tpl, vs, param.variable, expr);
    })
    .mapErr((error) => ({
      message: formatWIError(error),
      ...(error.code === "invalid-component-prop" && error.recoverable
        ? { recoverable: true }
        : {}),
    }));
}
