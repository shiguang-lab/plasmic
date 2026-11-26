import { getStaticBaseUrl } from "@/wab/shared/urls";

export interface BundledFontsManifest {
  readonly families: Readonly<Record<string, string>>;
  readonly fallbacks: Readonly<Record<string, string>>;
}

const EMPTY_MANIFEST: BundledFontsManifest = Object.freeze({
  families: Object.freeze({}),
  fallbacks: Object.freeze({}),
});

const BUNDLED_FONTS_PLACEHOLDER = "__PLASMIC_BUNDLED_FONTS__";

// Replaced at release/desktop asset-bundling time by scripts/bundle-studio-fonts.mjs
// with base64-encoded JSON (`families` and `fallbacks` relative to static/desktop-fonts/).
const RAW_BUNDLED_FONTS = BUNDLED_FONTS_PLACEHOLDER;

function decodeBase64Utf8(encoded: string): string {
  if (typeof atob === "function") {
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  return Buffer.from(encoded, "base64").toString("utf8");
}

function freezeStringRecord(value: unknown): Readonly<Record<string, string>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return Object.freeze({});
  }
  const entries = Object.entries(value).filter(
    (entry): entry is [string, string] =>
      typeof entry[0] === "string" && typeof entry[1] === "string",
  );
  return Object.freeze(Object.fromEntries(entries));
}

export function parseBundledFontsManifest(raw: string): BundledFontsManifest {
  if (!raw || raw.startsWith("__PLASMIC_")) {
    return EMPTY_MANIFEST;
  }
  try {
    const parsed = JSON.parse(decodeBase64Utf8(raw)) as {
      families?: unknown;
      fallbacks?: unknown;
    };
    return Object.freeze({
      families: freezeStringRecord(parsed.families),
      fallbacks: freezeStringRecord(parsed.fallbacks),
    });
  } catch {
    return EMPTY_MANIFEST;
  }
}

let cachedManifest: BundledFontsManifest | undefined;

export function getBundledFontsManifest(): BundledFontsManifest {
  if (!cachedManifest) {
    cachedManifest = parseBundledFontsManifest(RAW_BUNDLED_FONTS);
  }
  return cachedManifest;
}

export function resolveBundledFontUrl(
  relativePath: string | undefined,
): string | undefined {
  if (!relativePath) {
    return undefined;
  }
  return `${getStaticBaseUrl()}/desktop-fonts/${relativePath}`;
}
