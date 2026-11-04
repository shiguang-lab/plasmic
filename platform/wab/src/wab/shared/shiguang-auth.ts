export const SHIGUANG_ORIGIN = "https://shiguanglab.com";
export function getShiguangSignInUrl(returnTo: string) {
  const current = new URL(returnTo);
  if (current.pathname === "/login" || current.pathname === "/register") {
    // Startup can fail after the presentation has already redirected to login.
    // Return to its destination directly instead of re-entering the login route.
    const target = new URL(current.searchParams.get("continueTo") ?? "/", current.origin);
    returnTo =
      target.origin === current.origin &&
      target.pathname !== "/login" && target.pathname !== "/register"
        ? target.href
        : current.origin + "/";
  }
  const url = new URL("/login", SHIGUANG_ORIGIN);
  url.searchParams.set("return_to", returnTo);
  return url.href;
}
