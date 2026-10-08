function forwardRemoteRequest(session, request) {
  const headers = new Headers(request.headers);
  // Intercepted Chromium requests omit Origin. Preserve the browser's initiating
  // origin for mutating requests so IAM can enforce its origin check.
  if (
    !headers.has("origin") &&
    !["GET", "HEAD"].includes(request.method) &&
    request.referrer
  ) {
    headers.set("origin", new URL(request.referrer).origin);
  }
  return session.fetch(request, {
    headers,
    bypassCustomProtocolHandlers: true,
    redirect: "manual",
    credentials: "include",
  });
}
module.exports = { forwardRemoteRequest };
