export const SHIGUANG_ORIGIN = "https://shiguanglab.com";
export function getShiguangSignInUrl(returnTo: string) {
  const url = new URL("/login", SHIGUANG_ORIGIN);
  url.searchParams.set("return_to", returnTo);
  return url.href;
}
