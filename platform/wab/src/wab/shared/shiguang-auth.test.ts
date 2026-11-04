import { getShiguangSignInUrl } from "@/wab/shared/shiguang-auth";

const origin = "https://plasmic-studio.shiguanglab.com";
const presentation = "/d/0123456789?branch=design&width=1440#/coupons/42?tag=a&tag=b#rules";

it.each(["/login", "/register"])(
  "preserves the presentation destination through %s after startup authentication fails",
  (pathname) => {
    const search = new URLSearchParams({ continueTo: presentation });
    const url = new URL(getShiguangSignInUrl(`${origin}${pathname}?${search}`));
    expect(url.origin + url.pathname).toBe("https://shiguanglab.com/login");
    expect(url.searchParams.get("return_to")).toBe(origin + presentation);
  },
);

it("preserves a direct presentation destination", () => {
  const url = new URL(getShiguangSignInUrl(origin + presentation));
  expect(url.searchParams.get("return_to")).toBe(origin + presentation);
});

it.each([
  undefined,
  "https://other.example/d/0123456789",
  "//other.example/d/0123456789",
  "/login?continueTo=%2Fd%2F0123456789",
  "/register",
])("falls back to the Studio root for an absent or invalid continuation: %s", (continueTo) => {
  const search = new URLSearchParams(continueTo ? { continueTo } : {});
  const url = new URL(getShiguangSignInUrl(`${origin}/login?${search}`));
  expect(url.searchParams.get("return_to")).toBe(origin + "/");
});
