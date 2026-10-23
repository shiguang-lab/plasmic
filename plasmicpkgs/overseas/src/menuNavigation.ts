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

/** Find the longest matching route's ancestry, including hidden detail routes. */
export function findMenuPath(items: ShellMenuItem[], pagePath?: string, selectedKey?: string): ShellMenuItem[] {
  const currentPath = pagePath ? routePath(pagePath) : undefined;
  let matchedPath: ShellMenuItem[] = [];
  let matchedLength = 0;
  let selectedPath: ShellMenuItem[] = [];
  const visit = (entries: ShellMenuItem[], ancestors: ShellMenuItem[]) => {
    for (const item of entries) {
      const path = [...ancestors, item];
      visit(item.children ?? [], path);
      if (item.type === "divider") continue;
      if (!selectedPath.length && item.key === selectedKey) selectedPath = path;
      if (!currentPath || !item.href) continue;
      const hrefPath = routePath(item.href);
      // Exact matches are always longest; descendants must start a new segment.
      if ((currentPath === hrefPath ||
          (hrefPath !== "/" && currentPath.startsWith(`${hrefPath}/`))) &&
          hrefPath.length > matchedLength) {
        matchedPath = path;
        matchedLength = hrefPath.length;
      }
    }
  };
  visit(items, []);
  return matchedPath.length ? matchedPath : selectedPath;
}

/** Hidden page routes still describe navigation, but do not create sidebar items. */
export function visibleMenuItems(items: ShellMenuItem[]): ShellMenuItem[] {
  return items.filter(item => !item.hidden).map(item => {
    const {children, ...rest} = item;
    const visibleChildren = visibleMenuItems(children ?? []);
    return visibleChildren.length ? {...rest, children: visibleChildren} : rest;
  });
}
