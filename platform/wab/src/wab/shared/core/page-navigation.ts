import { codeLit, InteractionConditionalMode, isCodeLitVal, tryExtractString } from "@/wab/shared/core/exprs";
import { flattenExprs, flattenTpls, isTplVariantable } from "@/wab/shared/core/tpls";
import {
  Component, Expr, ObjInst, TplNode, VariantSetting,
  isKnownCollectionExpr, isKnownCompositeExpr, isKnownCustomCode,
  isKnownEventHandler, isKnownFunctionExpr, isKnownMapExpr, isKnownObjectPath,
  isKnownPageHref, isKnownTemplatedString, isKnownTplComponent, isKnownTplSlot,
  isKnownTplTag, isKnownRenderExpr,
} from "@/wab/shared/model/classes";
import { getMatchingPagePathParams } from "@/wab/shared/utils/url-utils";

export interface PageNavigation {
  id: string;
  tpl: TplNode;
  prop: string;
  event: string;
  destination: Expr;
  target?: Component;
  kind: "page" | "external" | "dynamic" | "anchor";
  conditional: boolean;
  /** Mutates only this navigation, inside the caller's normal Studio transaction. */
  remove: () => void;
}

type Declare = (model: ObjInst, ...fields: string[]) => void;

/** Never evaluate user code to guess a navigation destination. */
export function resolveNavigationTarget(expr: Expr, pages: Component[]): Pick<PageNavigation, "kind" | "target"> {
  if (isKnownPageHref(expr)) {
    return pages.includes(expr.page) ? { kind: "page", target: expr.page } : { kind: "dynamic" };
  }
  let href = tryExtractString(expr)?.trim();
  if (!href && isKnownTemplatedString(expr)) {
    let prefix = "";
    for (const part of expr.text) { if (typeof part !== "string") { break; } prefix += part; }
    // Dynamic query values do not make a fixed page path dynamic.
    if (/[?#]/.test(prefix)) { href = prefix.split(/[?#]/)[0]; }
  }
  if (!href) { return { kind: "dynamic" }; }
  if (href.startsWith("#")) { return { kind: "anchor" }; }
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href)) { return { kind: "external" }; }
  const path = href.split(/[?#]/)[0].replace(/\/$/, "") || "/";
  const exact = pages.find((page) => (page.pageMeta?.path.replace(/\/$/, "") || "/") === path);
  if (exact) { return { kind: "page", target: exact }; }
  // A concrete path can identify a parameterized page. Ambiguous matches stay unresolved.
  const matches = pages.filter((page) => page.pageMeta && getMatchingPagePathParams(page.pageMeta.path, path) !== false);
  return matches.length === 1 ? { kind: "page", target: matches[0] } : { kind: "dynamic" };
}

/** Both the model subscription and the derived links walk the same active props. */
export function collectPageNavigations(
  component: Component,
  pages: Component[],
  settings: (tpl: TplNode) => VariantSetting[],
  field: Declare = () => undefined,
): PageNavigation[] {
  const links: PageNavigation[] = [];
  field(component, "tplTree", "name");
  for (const tpl of flattenTpls(component.tplTree)) {
    field(tpl, "parent");
    if (isKnownTplTag(tpl)) { field(tpl, "children", "name"); }
    if (isKnownTplSlot(tpl)) { field(tpl, "defaultContents"); }
    if (!isTplVariantable(tpl)) { continue; }
    field(tpl, "vsettings");
    const props = new Map<string, { expr: Expr; set: (expr: Expr) => void; clear: () => void }>();
    // Subscribe to inactive settings too, so editing a variant's membership is observed.
    for (const vs of tpl.vsettings) { field(vs, "attrs", "args", "variants"); }
    for (const vs of settings(tpl)) {
      for (const [name, expr] of Object.entries(vs.attrs)) {
        const inherited = props.has(name);
        props.set(name, { expr, set: (next) => { vs.attrs[name] = next; }, clear: () => {
          if (inherited) { vs.attrs[name] = codeLit(undefined); } else { delete vs.attrs[name]; }
        } });
      }
      for (const arg of vs.args) {
        field(arg, "param", "expr"); field(arg.param, "variable", "type"); field(arg.param.variable, "name");
        const inherited = props.has(arg.param.variable.name);
        props.set(arg.param.variable.name, { expr: arg.expr, set: (next) => { arg.expr = next; }, clear: () => {
          if (inherited) { arg.expr = codeLit(undefined); }
          else { const index = vs.args.indexOf(arg); if (index >= 0) { vs.args.splice(index, 1); } }
        } });
      }
    }
    if (isKnownTplComponent(tpl)) { field(tpl, "component", "name"); }
    for (const [prop, binding] of props) {
      for (const expr of flattenExprs(binding.expr)) {
        if (isKnownEventHandler(expr)) {
          field(expr, "interactions");
          for (const action of expr.interactions) {
            field(action, "actionName", "args", "conditionalMode", "condExpr");
            action.args.forEach((arg) => field(arg, "name", "expr"));
          }
        }
        if (isKnownCustomCode(expr)) { field(expr, "code", "fallback"); }
        if (isKnownObjectPath(expr)) { field(expr, "path", "fallback"); }
        if (isKnownPageHref(expr)) { field(expr, "page", "params", "query", "fragment"); }
        if (isKnownTemplatedString(expr)) { field(expr, "text"); }
        if (isKnownCollectionExpr(expr)) { field(expr, "exprs"); }
        if (isKnownMapExpr(expr)) { field(expr, "mapExpr"); }
        if (isKnownCompositeExpr(expr)) { field(expr, "hostLiteral", "substitutions"); }
        if (isKnownFunctionExpr(expr)) { field(expr, "bodyExpr"); }
        if (isKnownRenderExpr(expr)) { field(expr, "tpl"); }
      }
      const visit = (expr: Expr, path: string, set: (expr: Expr) => void, href: boolean, clear: () => void = () => set(codeLit(undefined))) => {
        if (isKnownEventHandler(expr)) {
          for (const interaction of expr.interactions) {
            if (interaction.actionName !== "navigation" || interaction.conditionalMode === InteractionConditionalMode.Never) { continue; }
            const destination = interaction.args.find((arg) => arg.name === "destination")?.expr;
            if (!destination) { continue; }
            links.push({
              id: `${tpl.uuid}:${path}:${interaction.uuid}`, tpl, prop, event: path,
              destination, ...resolveNavigationTarget(destination, pages),
              conditional: interaction.conditionalMode === InteractionConditionalMode.Expression,
              remove: () => {
                const index = expr.interactions.indexOf(interaction);
                if (index < 0) { return; }
                expr.interactions.splice(index, 1);
                if (!expr.interactions.length) { clear(); }
              },
            });
          }
        } else if (href || isKnownPageHref(expr)) {
          if (tryExtractString(expr)?.trim() === "" || isCodeLitVal(expr, undefined) || isCodeLitVal(expr, null)) { return; }
          links.push({ id: `${tpl.uuid}:${path}`, tpl, prop, event: "href", destination: expr,
            ...resolveNavigationTarget(expr, pages), conditional: false, remove: clear });
        } else if (isKnownCollectionExpr(expr)) {
          expr.exprs.forEach((child, index) => child && visit(child, `${path}.${index}`, (next) => { expr.exprs[index] = next; }, false));
        } else if (isKnownMapExpr(expr)) {
          Object.entries(expr.mapExpr).forEach(([key, child]) => visit(child, `${path}.${key}`, (next) => { expr.mapExpr[key] = next; }, key === "href", () => { delete expr.mapExpr[key]; }));
        } else if (isKnownCompositeExpr(expr)) {
          Object.entries(expr.substitutions).forEach(([key, child]) => visit(child, `${path}.${key}`, (next) => { expr.substitutions[key] = next; }, key.split(".").at(-1) === "href"));
        } else if (isKnownFunctionExpr(expr)) {
          visit(expr.bodyExpr, path, (next) => { expr.bodyExpr = next; }, false);
        }
      };
      visit(binding.expr, prop, binding.set, prop === "href", binding.clear);
    }
  }
  return links;
}
