import type React from "react";

export interface ShellMenuItem {
  key: string;
  label?: React.ReactNode;
  href?: string;
  hidden?: boolean;
  disabled?: boolean;
  type?: "item" | "group" | "divider";
  icon?: React.ReactNode;
  children?: ShellMenuItem[];
}

const routePath = (href: string) => href.split(/[?#]/)[0].replace(/\/+$/, "") || "/";

/** Find the complete menu ancestry, including routes hidden from the sidebar. */
export function findMenuPath(items: ShellMenuItem[], pagePath?: string, selectedKey?: string): ShellMenuItem[] {
  for (const item of items) {
    const childPath = findMenuPath(item.children ?? [], pagePath, selectedKey);
    if (childPath.length) return [item, ...childPath];
    if (item.type !== "divider" && (pagePath
      ? !!item.href && routePath(item.href) === routePath(pagePath)
      : item.key === selectedKey)) return [item];
  }
  return [];
}

/** Hidden page routes still describe navigation, but do not create sidebar items. */
export function visibleMenuItems(items: ShellMenuItem[]): ShellMenuItem[] {
  return items.filter(item => !item.hidden).map(item => {
    const {children, ...rest} = item;
    const visibleChildren = visibleMenuItems(children ?? []);
    return visibleChildren.length ? {...rest, children: visibleChildren} : rest;
  });
}
