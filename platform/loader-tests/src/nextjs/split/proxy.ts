import { getMiddlewareResponse } from "@plasmicapp/loader-edge";
import { NextRequest, NextResponse } from "next/server";

const excludePaths = [
  "/api",
  "/favicon",
  "/plasmic-host",
  "/fonts",
  "/images",
  "/videos",
  "/_next",
];

export function proxy(req: NextRequest) {
  if (
    req.method !== "GET" ||
    excludePaths.some((x) => req.nextUrl.pathname.startsWith(x))
  ) {
    return;
  }

  const campaign = req.nextUrl.searchParams.get("utm_campaign");
  const { pathname, cookies } = getMiddlewareResponse({
    cookies: Object.fromEntries(req.cookies.getAll().map(({ name, value }) => [name, value])),
    traits: campaign ? { utm_campaign: campaign } : {},
    path: req.nextUrl.pathname,
  });

  const newUrl = req.nextUrl.clone();
  newUrl.pathname = pathname;

  const res = NextResponse.rewrite(newUrl);
  cookies.forEach((cookie) => {
    res.cookies.set(cookie.key, cookie.value);
  });

  return res;
}
