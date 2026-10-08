export interface PreviewPage {
  id: string;
  name: string;
  path: string;
}

export interface PreviewPublication {
  projectId: string;
  code: string;
  version: string;
  enabled: boolean;
  entryPath: string;
  pages: PreviewPage[];
  publishedAt: string;
  url: string;
}

export function publicationPath(code: string, path: string) {
  return `/p/${encodeURIComponent(code)}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Keep business URLs unchanged in the model; scope navigation at runtime. */
export function publicationHref(
  code: string,
  href: string,
  currentUrl: string,
) {
  if (!href || href.startsWith("#")) {
    return href;
  }
  const current = new URL(currentUrl);
  const destination = new URL(href, current);
  if (destination.origin !== current.origin) {
    return href;
  }
  const prefix = `/p/${encodeURIComponent(code)}`;
  if (
    destination.pathname === prefix ||
    destination.pathname.startsWith(`${prefix}/`)
  ) {
    return destination.pathname + destination.search + destination.hash;
  }
  return (
    publicationPath(code, destination.pathname) +
    destination.search +
    destination.hash
  );
}

export function matchPreviewPage(
  path: string,
  route: string,
): Record<string, string | string[]> | undefined {
  const actual = path.split("/").filter(Boolean).map(decodeURIComponent);
  const pattern = route.split("/").filter(Boolean);
  const params: Record<string, string | string[]> = {};
  let index = 0;
  for (const segment of pattern) {
    const rest =
      /^\[\[\.\.\.(.+)\]\]$/.exec(segment) ?? /^\[\.\.\.(.+)\]$/.exec(segment);
    if (rest) {
      if (index === actual.length && !segment.startsWith("[[")) {
        return undefined;
      }
      params[rest[1]] = actual.slice(index);
      index = actual.length;
    } else {
      const parameter = /^\[(.+)\]$/.exec(segment);
      if (index >= actual.length) {
        return undefined;
      }
      if (parameter) {
        params[parameter[1]] = actual[index];
      } else if (segment !== actual[index]) {
        return undefined;
      }
      index++;
    }
  }
  return index === actual.length ? params : undefined;
}

export function findPreviewPage(pages: PreviewPage[], path: string) {
  const exact = pages.find(
    (page) => page.path.replace(/\/$/, "") === path.replace(/\/$/, ""),
  );
  if (exact) {
    return { page: exact, params: {} };
  }
  const rank = (segment: string) =>
    segment.startsWith("[[...")
      ? 0
      : segment.startsWith("[...")
        ? 1
        : segment.startsWith("[")
          ? 2
          : 3;
  const ordered = [...pages].sort((a, b) => {
    const left = a.path.split("/").filter(Boolean);
    const right = b.path.split("/").filter(Boolean);
    for (let i = 0; i < Math.max(left.length, right.length); i++) {
      const difference = rank(right[i] ?? "[[...") - rank(left[i] ?? "[[...");
      if (difference) {
        return difference;
      }
    }
    return 0;
  });
  for (const page of ordered) {
    const params = matchPreviewPage(path, page.path);
    if (params) {
      return { page, params };
    }
  }
  return undefined;
}
