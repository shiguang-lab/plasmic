import { codeLit, InteractionConditionalMode, isCodeLitVal, tryExtractString } from "@/wab/shared/core/exprs";
import { flattenExprs, flattenTpls, isTplVariantable } from "@/wab/shared/core/tpls";
import {
  Component, Expr, ObjInst, TplNode, VariantSetting,
  isKnownCollectionExpr, isKnownCompositeExpr, isKnownCustomCode,
  isKnownEventHandler, isKnownFunctionExpr, isKnownMapExpr, isKnownObjectPath,
  isKnownPageHref, isKnownTemplatedString, isKnownTplComponent, isKnownTplSlot,
  isKnownTplTag, isKnownRenderExpr,
} from "@/wab/shared/model/classes";
import { parseJsCode } from "@/wab/shared/parser-utils";
import { getMatchingPagePathParams } from "@/wab/shared/utils/url-utils";
import type * as ast from "estree";

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

type RoutePart = string | { dynamic: true };

function flattenCodeUrlParts(
  node: ast.Expression | ast.PrivateIdentifier | ast.SpreadElement | null | undefined,
): RoutePart[] {
  if (!node) {
    return [{ dynamic: true }];
  }
  switch (node.type) {
    case "Literal":
      return typeof node.value === "string" ? [node.value] : [{ dynamic: true }];
    case "BinaryExpression":
      return node.operator === "+"
        ? [...flattenCodeUrlParts(node.left), ...flattenCodeUrlParts(node.right)]
        : [{ dynamic: true }];
    case "TemplateLiteral": {
      const parts: RoutePart[] = [];
      node.quasis.forEach((quasi, i) => {
        const text = quasi.value.cooked ?? quasi.value.raw;
        if (text) {
          parts.push(text);
        }
        if (i < node.expressions.length) {
          parts.push({ dynamic: true });
        }
      });
      return parts;
    }
    default:
      return [{ dynamic: true }];
  }
}

function extractRouteParts(expr: Expr): RoutePart[] | undefined {
  if (isKnownTemplatedString(expr)) {
    return expr.text.map((part) => (typeof part === "string" ? part : { dynamic: true }));
  }
  if (isKnownCustomCode(expr)) {
    try {
      const parsed = parseJsCode(`(${expr.code})`);
      if (parsed.body.length === 1 && parsed.body[0].type === "ExpressionStatement") {
        return flattenCodeUrlParts(parsed.body[0].expression);
      }
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function matchPathPattern(path: string, pages: Component[]): Component | undefined {
  const normalized = path.replace(/\/$/, "") || "/";
  const exact = pages.find((page) => (page.pageMeta?.path.replace(/\/$/, "") || "/") === normalized);
  if (exact) {
    return exact;
  }
  // A concrete path can identify a parameterized page. Ambiguous matches stay unresolved.
  const matches = pages.filter((page) => page.pageMeta && getMatchingPagePathParams(page.pageMeta.path, normalized) !== false);
  return matches.length === 1 ? matches[0] : undefined;
}

function extractStaticPrefix(parts: RoutePart[]): string {
  let prefix = "";
  for (const part of parts) {
    if (typeof part !== "string") {
      break;
    }
    prefix += part;
  }
  return prefix.trimStart();
}

function collectPathnameParts(parts: RoutePart[]): RoutePart[] {
  const pathParts: RoutePart[] = [];
  for (const part of parts) {
    if (typeof part !== "string") {
      if (typeof pathParts.at(-1) === "string") {
        pathParts.push(part);
      }
      continue;
    }
    const text = pathParts.length === 0 ? part.trimStart() : part;
    const stop = text.search(/[?#]/);
    if (stop >= 0) {
      if (stop > 0) {
        pathParts.push(text.slice(0, stop));
      }
      break;
    }
    if (text) {
      pathParts.push(text);
    }
  }
  return pathParts;
}

function resolveDynamicRouteParts(pathParts: RoutePart[], leading: string, pages: Component[]): Pick<PageNavigation, "kind" | "target"> {
  let dynIndex = 0;
  const syntheticPath = pathParts
    .map((part) => (typeof part === "string" ? part : `\uE000${dynIndex++}\uE001`))
    .join("")
    .replace(/\/$/, "") || "/";
  if (!syntheticPath.startsWith("/")) {
    return { kind: "dynamic" };
  }
  const structural = pages.filter(
    (page) => page.pageMeta && getMatchingPagePathParams(page.pageMeta.path, syntheticPath) !== false,
  );
  if (structural.length === 1) {
    return { kind: "page", target: structural[0] };
  }
  // When a multi-segment tail is packed into one trailing expression (e.g. "/orders/detail/" + rest),
  // resolve only if a single parameterized page owns that exact static prefix before its first param.
  if (structural.length === 0 && typeof pathParts.at(-1) !== "string" && leading.startsWith("/")) {
    const prefix = leading.split(/[?#]/)[0];
    const prefixedPages = pages.filter((page) => page.pageMeta?.path.startsWith(prefix));
    const exactPrefixMatches = prefixedPages.filter((page) => {
      const pagePath = page.pageMeta?.path;
      if (!pagePath) {
        return false;
      }
      const paramStart = pagePath.indexOf("[");
      return paramStart > 0 && pagePath.slice(0, paramStart) === prefix;
    });
    if (exactPrefixMatches.length === 1 && prefixedPages.length === 1) {
      return { kind: "page", target: exactPrefixMatches[0] };
    }
  }
  return { kind: "dynamic" };
}

/** Never evaluate user code to guess a navigation destination. */
export function resolveNavigationTarget(expr: Expr, pages: Component[]): Pick<PageNavigation, "kind" | "target"> {
  if (isKnownPageHref(expr)) {
    return pages.includes(expr.page) ? { kind: "page", target: expr.page } : { kind: "dynamic" };
  }
  const literalHref = tryExtractString(expr)?.trim();
  const parts: RoutePart[] | undefined = literalHref ? [literalHref] : extractRouteParts(expr);
  if (!parts?.length) {
    return { kind: "dynamic" };
  }
  const leading = extractStaticPrefix(parts);
  if (!leading) {
    return { kind: "dynamic" };
  }
  if (leading.startsWith("#")) {
    return { kind: "anchor" };
  }
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(leading)) {
    return { kind: "external" };
  }
  const pathParts = collectPathnameParts(parts);
  if (!pathParts.some((part) => typeof part !== "string")) {
    const target = matchPathPattern(pathParts.join(""), pages);
    return target ? { kind: "page", target } : { kind: "dynamic" };
  }
  return resolveDynamicRouteParts(pathParts, leading, pages);
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
