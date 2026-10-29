import {
  businessPath,
  findPreviewPage,
  formatBusinessHref,
  matchPreviewPage,
  publicationHref,
  readBusinessAnchor,
  readBusinessLocation,
  readBusinessQuery,
  resolveBusinessHref,
} from "@plasmic-shared/preview";
import { describe, expect, it } from "vitest";

describe("shared business navigation", () => {
  const current =
    "https://preview.example/s/0123456789#/groups/42?status=active";
  it.each([
    ["/detail?id=42#info", "/detail?id=42#info"],
    ["detail?id=42", "/groups/detail?id=42"],
    ["../list", "/list"],
    ["?status=all&tag=a&tag=b", "/groups/42?status=all&tag=a&tag=b"],
    ["#info", "/groups/42?status=active#info"],
    ["/s/0123456789#/groups", "/groups"],
    ["https://preview.example/s/0123456789#/groups", "/groups"],
    ["/中文/a%2Fb", "/%E4%B8%AD%E6%96%87/a%2Fb"],
  ])("resolves %s against the design URL", (href, expected) => {
    expect(publicationHref("0123456789", href, current)).toBe(
      `/s/0123456789#${expected}`,
    );
  });
  it.each([
    "https://example.com/a",
    "mailto:hello@example.com",
    "tel:123",
    "//example.com/a",
    "data:text/plain,download",
  ])("preserves external/resource link %s", (href) => {
    expect(publicationHref("0123456789", href, current)).toBe(href);
  });
  it("retains anchors and repeated query values without leaking presentation settings", () => {
    const location = readBusinessLocation(
      "#/groups/42?branch=business&tag=a&tag=b#rules",
    );
    expect(businessPath(location)).toBe(
      "/groups/42?branch=business&tag=a&tag=b#rules",
    );
    expect(readBusinessQuery(location.search)).toEqual({
      branch: "business",
      tag: ["a", "b"],
    });
    expect(resolveBusinessHref("?tab=next", location)).toEqual({
      pathname: "/groups/42",
      search: "?tab=next",
      hash: "",
    });
  });
  it("formats object links using design route parameters", () => {
    expect(
      formatBusinessHref({
        pathname: "/groups/[id]",
        query: { id: "a/b", tag: ["a", "b"] },
        hash: "rules",
      }),
    ).toBe("/groups/a%2Fb?tag=a&tag=b#rules");
    expect(
      formatBusinessHref({
        pathname: "/docs/[...slug]",
        query: { slug: ["a", "b"] },
      }),
    ).toBe("/docs/a/b");
    const catchAll = formatBusinessHref({
      pathname: "/docs/[...slug]",
      query: { slug: ["a/b", "中文"] },
    });
    expect(matchPreviewPage(catchAll, "/docs/[...slug]")).toEqual({
      slug: ["a/b", "中文"],
    });
    expect(
      publicationHref(
        "0123456789",
        { pathname: "/groups", query: { count: 2 } },
        current,
      ),
    ).toBe("/s/0123456789#/groups?count=2");
  });
  it("uses the configured entry only when the link has no business route", () => {
    expect(readBusinessLocation("", "/home").pathname).toBe("/home");
    expect(readBusinessLocation("#/unknown", "/home").pathname).toBe(
      "/unknown",
    );
  });
  it("decodes anchor IDs without failing on a literal percent sign", () => {
    expect(readBusinessAnchor("#%E8%A7%84%E5%88%99")).toBe("规则");
    expect(readBusinessAnchor("#discount%")).toBe("discount%");
  });
  it.each([
    "https://preview.example/s/abcdefghij#/detail/7",
    "/s/abcdefghij#/detail/7",
    "https://preview.example/s/abcdefghij",
    "https://preview.example/d/abcdefghij#/detail/7",
  ])("preserves an explicit link to another preview container: %s", (href) => {
    expect(publicationHref("0123456789", href, current)).toBe(href);
  });
  it("resolves the current short address to its configured entry without confusing business paths", () => {
    expect(
      publicationHref("0123456789", "/s/0123456789", current, "/home"),
    ).toBe("/s/0123456789#/home");
    expect(
      publicationHref("0123456789", "/s/0123456789#rules", current, "/home"),
    ).toBe("/s/0123456789#/home#rules");
    expect(publicationHref("0123456789", "/s/abcdefghij", current)).toBe(
      "/s/0123456789#/s/abcdefghij",
    );
    expect(
      publicationHref(
        "0123456789",
        "https://preview.example/detail/7",
        current,
      ),
    ).toBe("/s/0123456789#/detail/7");
  });
  it("does not throw while parsing malformed links or hash routes", () => {
    expect(publicationHref("0123456789", "http://[", current)).toBe("http://[");
    expect(
      resolveBusinessHref(
        "http://[",
        readBusinessLocation("#/groups"),
        "https://preview.example",
      ),
    ).toBeUndefined();
    expect(readBusinessLocation("#//").pathname).toBe("//");
    expect(readBusinessLocation("#//missing").pathname).toBe("//missing");
    expect(readBusinessLocation("#/\\").pathname).toBe("//");
  });
  it("isolates draft container addresses while resolving the current short address", () => {
    const location = readBusinessLocation("#/groups/42?tag=a");
    expect(
      resolveBusinessHref(
        "/d/abcdefghij#/detail/7",
        location,
        "https://studio.example",
        "/d/0123456789",
      ),
    ).toBeUndefined();
    expect(
      resolveBusinessHref(
        "/d/0123456789#/detail/7",
        location,
        "https://studio.example",
        "/d/0123456789",
      ),
    ).toEqual({ pathname: "/detail/7", search: "", hash: "" });
  });
});

describe("shared design route matching", () => {
  it("supports encoded parameters and catch-all paths", () => {
    expect(matchPreviewPage("/groups/a%2Fb", "/groups/[id]")).toEqual({
      id: "a/b",
    });
    expect(matchPreviewPage("/docs/a/b", "/docs/[...slug]")).toEqual({
      slug: ["a", "b"],
    });
    expect(matchPreviewPage("/docs", "/docs/[...slug]")).toBeUndefined();
    expect(matchPreviewPage("/docs", "/docs/[[...slug]]")).toEqual({
      slug: [],
    });
  });
  it("prefers static routes, then parameters, then catch-all", () => {
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

it("reports conflicting route definitions and treats malformed URLs as missing pages", () => {
  expect(matchPreviewPage("/groups/bad%", "/groups/[id]")).toBeUndefined();
  expect(() =>
    findPreviewPage(
      [
        { id: "a", name: "First", path: "/groups/[id]" },
        { id: "b", name: "Second", path: "/groups/[name]" },
      ],
      "/groups/42",
    ),
  ).toThrow("Ambiguous page route");
});
