import { flattenComponent } from "@/wab/shared/cached-selectors";
import { tryExtractJson } from "@/wab/shared/core/exprs";
import { isKnownCustomCode, isKnownPageHref, type Component, type Expr, type Site } from "@/wab/shared/model/classes";
import { findPreviewPage } from "@plasmic-shared/preview";

/** Only authored, literal links are inspected. Never evaluate prop callbacks or
 * business expressions to predict navigation. Structured menu links work the
 * same way as ordinary href props, independently of their registered component. */
export function staticPreviewPageLinks(site: Site, component: Component): Component[] {
  const pages = site.components.filter(page => page.pageMeta).map(page => ({ id: page.uuid, name: page.name, path: page.pageMeta?.path ?? "" }));
  const linked = new Set<Component>();
  const href = (value: string) => {
    if (!value.startsWith("/") || value.startsWith("//")) { return; }
    const match = findPreviewPage(pages, new URL(value, "https://preview.invalid").pathname);
    const page = match && site.components.find(candidate => candidate.uuid === match.page.id);
    if (page && page !== component) { linked.add(page); }
  };
  const literal = (value: unknown, key?: string) => {
    if (typeof value === "string") { if (key === "href") { href(value); } }
    else if (Array.isArray(value)) { value.forEach(item => literal(item)); }
    else if (value && typeof value === "object") { Object.entries(value).forEach(([name, item]) => literal(item, name)); }
  };
  const expression = (expr: Expr, key: string) => {
    if (isKnownPageHref(expr)) {
      if (expr.page !== component && site.components.includes(expr.page)) { linked.add(expr.page); }
    } else if (key === "href" || isKnownCustomCode(expr) && /["']href["']/.test(expr.code)) {
      literal(tryExtractJson(expr), key);
    }
  };
  for (const node of flattenComponent(component)) {
    for (const setting of node.vsettings) {
      Object.entries(setting.attrs).forEach(([key, expr]) => expression(expr, key));
      setting.args.forEach(arg => expression(arg.expr, arg.param.variable.name));
    }
  }
  return [...linked];
}
