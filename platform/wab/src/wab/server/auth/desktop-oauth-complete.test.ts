import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const html = readFileSync(new URL("./desktop-oauth-complete.html", import.meta.url), "utf8");
const match = html.match(/<script nonce="__NONCE__">([\s\S]*?)<\/script>/);
assert(match, "OAuth completion script is missing");
const script = match[1];
const state = "s".repeat(43);
const code = "c".repeat(43);

function render(params: Record<string, string>) {
  const elements = Object.fromEntries(["title", "message", "open"].map(id => [id, { textContent: "", hidden: true, href: "" }]));
  const assign = vi.fn();
  runInNewContext(script, {
    URL, URLSearchParams, Date,
    location: { hash: "#" + new URLSearchParams(params), assign },
    document: { getElementById: (id: string) => elements[id] },
    setTimeout: vi.fn(),
  });
  return { assign, elements };
}

describe("desktop OAuth completion page", () => {
  it("immediately opens the exact app callback and retains the manual link", () => {
    const { assign, elements } = render({ state, code, expiresAt: String(Date.now() + 300_000) });
    const target = `plasmic-desktop://oauth/google/callback?state=${state}&code=${code}`;
    expect(assign).toHaveBeenCalledExactlyOnceWith(target);
    expect(elements.open.href).toBe(target);
    expect(elements.open.hidden).toBe(false);
  });
  it("does not launch the app for invalid, failed or expired authorization", () => {
    const cases: Record<string, string>[] = [
      { state: "invalid", code, expiresAt: String(Date.now() + 300_000) },
      { state, error: "authentication_failed" },
      { state, error: "expired" },
      { state, code, expiresAt: String(Date.now() - 1) },
    ];
    for (const params of cases) {
      expect(render(params).assign).not.toHaveBeenCalled();
    }
  });
});
