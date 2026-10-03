import {
  BadRequestError,
  UnauthorizedError,
} from "@/wab/shared/ApiErrors/errors";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

const token = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const flowSchema = z.object({
  state: token,
  challenge: token,
});
export type DesktopOAuthFlow = z.infer<typeof flowSchema> & {
  createdAt: number;
};
declare module "express-session" {
  interface SessionData {
    desktopOAuth?: DesktopOAuthFlow;
  }
}

export function parseDesktopOAuthFlow(input: unknown): DesktopOAuthFlow {
  const parsed = flowSchema.safeParse(input);
  if (!parsed.success)
    throw new BadRequestError("Invalid desktop OAuth request");
  return { ...parsed.data, createdAt: Date.now() };
}

// One NAS app-server process owns these short-lived handoff codes. They are
// independent of browser cookies and never contain Google credentials.
const codes = new Map<
  string,
  { userId: string; challenge: string; expiresAt: number }
>();
export function desktopOAuthRedirect(flow: DesktopOAuthFlow, userId?: string) {
  const redirect = new URLSearchParams({ state: flow.state });
  if (!userId || Date.now() - flow.createdAt > 10 * 60_000) {
    redirect.set("error", userId ? "expired" : "authentication_failed");
  } else {
    for (const [code, entry] of codes) {
      if (entry.expiresAt <= Date.now()) codes.delete(code);
    }
    if (codes.size >= 1000)
      throw new BadRequestError("Too many pending desktop logins");
    const code = randomBytes(32).toString("base64url");
    codes.set(code, {
      userId,
      challenge: flow.challenge,
      expiresAt: Date.now() + 5 * 60_000,
    });
    redirect.set("code", code);
    redirect.set("expiresAt", String(Date.now() + 5 * 60_000));
  }
  return "/api/v1/auth/desktop/google/complete#" + redirect.toString();
}

export function consumeDesktopOAuthCode(input: unknown) {
  const parsed = z.object({ code: token, verifier: token }).safeParse(input);
  if (!parsed.success)
    throw new UnauthorizedError("Invalid desktop login code");
  const { code, verifier } = parsed.data;
  const entry = codes.get(code);
  if (!entry || entry.expiresAt <= Date.now()) {
    codes.delete(code);
    throw new UnauthorizedError("Desktop login code expired or already used");
  }
  if (
    createHash("sha256").update(verifier).digest("base64url") !==
    entry.challenge
  ) {
    throw new UnauthorizedError("Invalid desktop login verifier");
  }
  codes.delete(code);
  return entry.userId;
}
