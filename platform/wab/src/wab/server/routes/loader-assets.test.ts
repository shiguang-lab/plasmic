import { getHydrationScript, getHydrationScriptVersioned } from "@/wab/server/routes/loader-assets";
import { NotFoundError } from "@/wab/shared/ApiErrors/errors";
import type { Request, Response } from "express-serve-static-core";
import fs from "fs";
import path from "path";

function response() {
  return { setHeader: vi.fn(), redirect: vi.fn(), sendFile: vi.fn() } as unknown as Response;
}

it("redirects the stable hydration URL to the versioned script regardless of directory order", () => {
  vi.stubEnv("CODEGEN_HOST", "https://published.example.test");
  vi.spyOn(fs, "readdirSync").mockReturnValue(["loader-hydrate.js", "loader-hydrate.1234abcd.js.map", "loader-hydrate.1234abcd.js"] as any);
  try {
    const res = response();
    getHydrationScript({} as Request, res);
    expect(res.redirect).toHaveBeenCalledExactlyOnceWith("https://published.example.test/static/js/loader-hydrate.1234abcd.js");
    expect(res.setHeader).toHaveBeenCalledExactlyOnceWith("Cache-Control", "max-age=60, s-maxage=60");
  } finally {
    vi.unstubAllEnvs();
  }
});

it("serves only the requested current hash with the immutable resource cache duration", () => {
  vi.spyOn(fs, "readdirSync").mockReturnValue(["loader-hydrate.js", "loader-hydrate.1234abcd.js"] as any);
  const res = response();
  getHydrationScriptVersioned({ params: { hash: "1234abcd" } } as unknown as Request, res);
  expect(res.sendFile).toHaveBeenCalledExactlyOnceWith(path.resolve(process.cwd(), "../loader-html-hydrate/build/loader-hydrate.1234abcd.js"));
  expect(res.setHeader).toHaveBeenCalledExactlyOnceWith("Cache-Control", "max-age=31536000, s-maxage=31536000");
});

it.each(["deadbeef", "1234abcd.js", "../1234abcd", ""]) ("does not serve latest or cache a mismatched hydration hash: %s", (hash) => {
  vi.spyOn(fs, "readdirSync").mockReturnValue(["loader-hydrate.1234abcd.js"] as any);
  const res = response();
  expect(() => getHydrationScriptVersioned({ params: { hash } } as unknown as Request, res)).toThrow(NotFoundError);
  expect(res.sendFile).not.toHaveBeenCalled();
  expect(res.setHeader).not.toHaveBeenCalled();
});

it.each([
  { files: ["loader-hydrate.js", "loader-hydrate.1234abcd.js.map"] },
  { files: ["loader-hydrate.js", "loader-hydrate.1234abcd.js", "loader-hydrate.deadbeef.js"] },
])("rejects missing or ambiguous versioned hydration assets: %j", ({ files }) => {
  vi.spyOn(fs, "readdirSync").mockReturnValue(files as any);
  const res = response();
  expect(() => getHydrationScript({} as Request, res)).toThrow("Expected exactly one versioned hydration script");
  expect(res.redirect).not.toHaveBeenCalled();
});
