import {
  findPreviewPage,
  matchPreviewPage,
  publicationHref,
} from "@plasmic-shared/preview";
import { describe, expect, it } from "vitest";

describe("publication navigation", () => {
  const current =
    "https://preview.plasmic.shiguanglab.com/p/0123456789/groups?status=active";
  it("keeps project links scoped and preserves query parameters and anchors", () => {
    expect(publicationHref("0123456789", "/detail?id=42#info", current)).toBe(
      "/p/0123456789/detail?id=42#info",
    );
    expect(publicationHref("0123456789", "detail?id=42", current)).toBe(
      "/p/0123456789/detail?id=42",
    );
    expect(publicationHref("0123456789", "?status=all", current)).toBe(
      "/p/0123456789/groups?status=all",
    );
    expect(publicationHref("0123456789", "/p/0123456789/groups", current)).toBe(
      "/p/0123456789/groups",
    );
    expect(publicationHref("0123456789", "#info", current)).toBe("#info");
  });
  it("preserves external destinations", () => {
    for (const href of [
      "https://shiguanglab.com",
      "mailto:hello@example.com",
      "//example.com/groups",
    ]) {
      expect(publicationHref("0123456789", href, current)).toBe(href);
    }
  });
});

describe("published page resolution", () => {
  it("supports parameters, catch-all and optional catch-all paths", () => {
    expect(matchPreviewPage("/groups/42", "/groups/[id]")).toEqual({
      id: "42",
    });
    expect(matchPreviewPage("/docs/a/b", "/docs/[...slug]")).toEqual({
      slug: ["a", "b"],
    });
    expect(matchPreviewPage("/docs", "/docs/[...slug]")).toBeUndefined();
    expect(matchPreviewPage("/docs", "/docs/[[...slug]]")).toEqual({
      slug: [],
    });
    expect(matchPreviewPage("/groups/a%2Fb", "/groups/[id]")).toEqual({
      id: "a/b",
    });
    expect(
      matchPreviewPage("/groups/42/extra", "/groups/[id]"),
    ).toBeUndefined();
  });
  it("prefers specific routes regardless of model order", () => {
    const pages = [
      "/[[...all]]",
      "/groups/[...rest]",
      "/groups/[id]",
      "/groups/new",
    ].map((path) => ({ id: path, name: path, path }));
    expect(findPreviewPage(pages, "/groups/new/")?.page.path).toBe(
      "/groups/new",
    );
    expect(findPreviewPage(pages, "/groups/42")?.page.path).toBe(
      "/groups/[id]",
    );
    expect(findPreviewPage(pages, "/groups/42/more")?.page.path).toBe(
      "/groups/[...rest]",
    );
    expect(findPreviewPage(pages, "/unknown")?.page.path).toBe("/[[...all]]");
  });
});
