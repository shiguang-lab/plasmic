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

export type BusinessQuery = Record<string, string | string[]>;
export interface BusinessLocation {
  pathname: string;
  search: string;
  hash: string;
}
export type BusinessHref =
  | string
  | {
      pathname?: string | null;
      search?: string | null;
      hash?: string | null;
      query?:
        | string
        | Record<
            string,
            | string
            | number
            | boolean
            | readonly (string | number | boolean)[]
            | null
            | undefined
          >
        | null;
    };

const businessOrigin = "https://business.invalid";
function parseHref(href: string, base?: string) {
  try {
    return new URL(href, base);
  } catch (error) {
    if (error instanceof TypeError) {
      return undefined;
    }
    throw error;
  }
}

function isPreviewContainer(pathname: string) {
  return (
    /^\/(?:d|s)\/[\w-]{10}$/.test(pathname) ||
    /^\/projects\/[^/]+\/preview$/.test(pathname)
  );
}

export function readBusinessLocation(
  hash = "",
  entryPath = "/",
): BusinessLocation {
  const value = hash.startsWith("#/") ? hash.slice(1) : entryPath;
  // A hash contains a pathname, never a URL authority (even when it starts with //).
  const url = new URL(
    businessOrigin + (value.startsWith("/") ? value : `/${value}`),
  );
  return { pathname: url.pathname, search: url.search, hash: url.hash };
}
export function businessPath(location: BusinessLocation) {
  return location.pathname + location.search + location.hash;
}
export function readBusinessAnchor(hash: string) {
  const id = hash.replace(/^#/, "");
  try {
    return decodeURIComponent(id);
  } catch (error) {
    if (error instanceof URIError) {
      return id;
    }
    throw error;
  }
}
export function readBusinessQuery(search: string): BusinessQuery {
  const params = new URLSearchParams(search);
  return Object.fromEntries(
    [...new Set(params.keys())].map((key) => {
      const values = params.getAll(key);
      return [key, values.length === 1 ? values[0] : values];
    }),
  );
}
export function formatBusinessHref(href: BusinessHref): string {
  if (typeof href === "string") {
    return href;
  }
  const query =
    typeof href.query === "string"
      ? new URLSearchParams(href.query)
      : new URLSearchParams();
  if (href.query && typeof href.query !== "string") {
    for (const [key, value] of Object.entries(href.query)) {
      if (value != null) {
        for (const item of Array.isArray(value) ? value : [value]) {
          query.append(key, String(item));
        }
      }
    }
  }
  const pathname = (href.pathname || "").replace(
    /\[\[?\.\.\.(.+?)\]\]?|\[(.+?)\]/g,
    (_match, rest, key) => {
      const name = rest || key;
      const values = query.getAll(name);
      query.delete(name);
      return rest
        ? (typeof href.query === "object" && Array.isArray(href.query?.[name])
            ? values
            : values.flatMap((value) => value.split("/"))
          )
            .map(encodeURIComponent)
            .join("/")
        : encodeURIComponent(values[0] || "");
    },
  );
  const search = href.search ?? query.toString();
  return (
    pathname +
    (search ? `?${search.replace(/^\?/, "")}` : "") +
    (href.hash ? `#${href.hash.replace(/^#/, "")}` : "")
  );
}
/** Resolve links against the business URL, never the enclosing Studio/publication path. */
export function resolveBusinessHref(
  href: string,
  current: BusinessLocation,
  origin?: string,
  containerPath?: string,
): BusinessLocation | undefined {
  if (!href || href.startsWith("//")) {
    return undefined;
  }
  const absoluteHref = /^[a-z][a-z\d+.-]*:/i.test(href);
  if (absoluteHref) {
    if (!origin) {
      return undefined;
    }
    const absolute = parseHref(href);
    if (!absolute || absolute.origin !== origin) {
      return undefined;
    }
    href = absolute.pathname + absolute.search + absolute.hash;
  }
  const url = parseHref(href, businessOrigin + businessPath(current));
  if (!url || url.origin !== businessOrigin) {
    return undefined;
  }
  // Explicit preview addresses identify another context, rather than a business page.
  // Plain business paths remain valid even when they resemble a container path.
  if (
    containerPath &&
    url.pathname !== containerPath &&
    isPreviewContainer(url.pathname) &&
    (absoluteHref || url.hash.startsWith("#/"))
  ) {
    return undefined;
  }
  if (
    containerPath &&
    url.pathname === containerPath &&
    (url.hash.startsWith("#/") || !/^[?#]/.test(href))
  ) {
    return readBusinessLocation(url.hash);
  }
  return { pathname: url.pathname, search: url.search, hash: url.hash };
}
export function publicationPath(code: string, path: string) {
  return `/s/${encodeURIComponent(code)}#${path.startsWith("/") ? path : `/${path}`}`;
}
export function publicationHref(
  code: string,
  value: BusinessHref,
  currentUrl: string,
  entryPath = "/",
) {
  const href = formatBusinessHref(value);
  const current = new URL(currentUrl);
  const prefix = `/s/${encodeURIComponent(code)}`;
  // Already encoded links must not acquire another publication prefix.
  const encoded = parseHref(href, current.href);
  if (!encoded) {
    return href;
  }
  if (
    encoded.origin === current.origin &&
    encoded.pathname === prefix &&
    (encoded.hash.startsWith("#/") || (href && !/^[?#]/.test(href)))
  ) {
    return encoded.hash.startsWith("#/")
      ? prefix + encoded.hash
      : publicationPath(code, entryPath + encoded.hash);
  }
  const destination = resolveBusinessHref(
    href,
    readBusinessLocation(current.hash, entryPath),
    current.origin,
    prefix,
  );
  return destination ? publicationPath(code, businessPath(destination)) : href;
}

export function matchPreviewPage(
  path: string,
  route: string,
): Record<string, string | string[]> | undefined {
  let actual: string[];
  try {
    actual = path.split("/").filter(Boolean).map(decodeURIComponent);
  } catch (error) {
    if (error instanceof URIError) {
      return undefined;
    }
    throw error;
  }
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
  validatePreviewPages(pages);
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

export function validatePreviewPages(pages: PreviewPage[]) {
  const patterns = new Set<string>();
  for (const page of pages) {
    const pattern = page.path
      .split("/")
      .filter(Boolean)
      .map((segment) =>
        segment.startsWith("[[...")
          ? "[[...]]"
          : segment.startsWith("[...")
            ? "[...]"
            : segment.startsWith("[")
              ? "[]"
              : segment,
      )
      .join("/");
    if (patterns.has(pattern)) {
      throw new Error(`Ambiguous page route: ${page.path}`);
    }
    patterns.add(pattern);
  }
}
