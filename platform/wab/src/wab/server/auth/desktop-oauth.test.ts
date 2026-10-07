import { createHash, randomBytes } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  consumeDesktopOAuthCode,
  desktopOAuthRedirect,
  parseDesktopOAuthFlow,
} from "./desktop-oauth";

function setup() {
  const verifier = randomBytes(32).toString("base64url");
  const flow = parseDesktopOAuthFlow({
    state: randomBytes(32).toString("base64url"),
    challenge: createHash("sha256").update(verifier).digest("base64url"),
  });
  return { verifier, flow };
}
afterEach(() => vi.useRealTimers());
describe("desktop OAuth handoff", () => {
  it("always returns to the Studio completion page with credentials in the fragment", () => {
    const { flow } = setup();
    const url = new URL(desktopOAuthRedirect(flow, "user"), "https://studio.plasmic.shiguanglab.com");
    expect(url.pathname).toBe("/api/v1/auth/desktop/google/complete");
    expect(url.search).toBe("");
    expect(new URLSearchParams(url.hash.slice(1)).has("code")).toBe(true);
  });
  it("requires unpredictable state and an S256 challenge", () => {
    const { flow } = setup();
    expect(() => parseDesktopOAuthFlow({ ...flow, state: "bad" })).toThrow();
    expect(() =>
      parseDesktopOAuthFlow({ ...flow, challenge: "bad" }),
    ).toThrow();
  });
  it("redeems exactly once with the matching PKCE verifier", () => {
    const { flow, verifier } = setup();
    const url = new URLSearchParams(new URL(desktopOAuthRedirect(flow, "user-1"), "https://studio.test").hash.slice(1));
    const code = url.get("code");
    expect(url.get("state")).toBe(flow.state);
    expect(() =>
      consumeDesktopOAuthCode({
        code,
        verifier: randomBytes(32).toString("base64url"),
      }),
    ).toThrow();
    expect(consumeDesktopOAuthCode({ code, verifier })).toBe("user-1");
    expect(() => consumeDesktopOAuthCode({ code, verifier })).toThrow();
  });
  it("expires codes after five minutes", () => {
    vi.useFakeTimers();
    const { flow, verifier } = setup();
    const code = new URLSearchParams(new URL(desktopOAuthRedirect(flow, "user-2"), "https://studio.test").hash.slice(1)).get("code");
    vi.advanceTimersByTime(300_001);
    expect(() => consumeDesktopOAuthCode({ code, verifier })).toThrow();
  });
  it("does not issue a code for failed or stale authorization", () => {
    const { flow } = setup();
    for (const [value, error] of [
      [desktopOAuthRedirect(flow), "authentication_failed"],
      [desktopOAuthRedirect(
        { ...flow, createdAt: Date.now() - 600_001 },
        "user-3",
      ), "expired"],
    ]) {
      const url = new URLSearchParams(new URL(value, "https://studio.test").hash.slice(1));
      expect(url.has("code")).toBe(false);
      expect(url.get("error")).toBe(error);
    }
  });
});
