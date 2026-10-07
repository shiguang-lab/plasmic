import { getShiguangUsers } from "@/wab/server/auth/shiguang-directory";
import {
  ForbiddenError,
  UnauthorizedError,
} from "@/wab/shared/ApiErrors/errors";
import { NextFunction, Request, Response } from "express";
import { JsonWebKey, createPublicKey, verify } from "node:crypto";

const issuer = "https://shiguanglab.com";
const audience = "plasmic-api";
const entitlement = "plasmic:access";
export interface ShiguangIdentity {
  sub: string;
  sid: string;
  roles: string[];
  entitlements: string[];
  exp: number;
  iat: number;
  nbf: number;
  iss: string;
  aud: string | string[];
}

type SigningKey = JsonWebKey & { kid: string; alg?: string; use?: string };
let cachedKeys: { keys: SigningKey[]; expires: number } | undefined;
let pendingKeys: Promise<SigningKey[]> | undefined;
async function signingKeys(force = false): Promise<SigningKey[]> {
  if (!force && cachedKeys && cachedKeys.expires > Date.now()) {
    return cachedKeys.keys;
  }
  return (pendingKeys ??= (async () => {
    const url =
      process.env.SG_IDENTITY_JWKS_URL ??
      `${issuer}/.well-known/sg-identity-jwks.json`;
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) {
      throw new Error("Shiguang signing keys unavailable");
    }
    const data = (await response.json()) as { keys: SigningKey[] };
    if (!Array.isArray(data.keys)) {
      throw new Error("Invalid Shiguang JWKS");
    }
    cachedKeys = { keys: data.keys, expires: Date.now() + 300_000 };
    return data.keys;
  })().finally(() => {
    pendingKeys = undefined;
  }));
}

/** Verify the gateway assertion, including when it is received on a socket handshake. */
export async function verifyShiguangIdentity(
  token: string,
): Promise<ShiguangIdentity> {
  try {
    if (token.length > 16384) {
      throw new Error();
    }
    const parts = token.split(".");
    if (parts.length !== 3 || parts.some((p) => !/^[\w-]+$/.test(p))) {
      throw new Error();
    }
    const [headerPart, payloadPart, signaturePart] = parts;
    const header = JSON.parse(Buffer.from(headerPart, "base64url").toString());
    if (
      header.alg !== "RS256" ||
      header.typ !== "sg-identity+jwt" ||
      typeof header.kid !== "string"
    ) {
      throw new Error();
    }
    let key = (await signingKeys()).find((k) => k.kid === header.kid);
    if (!key) {
      key = (await signingKeys(true)).find((k) => k.kid === header.kid);
    }
    if (
      !key ||
      key.kty !== "RSA" ||
      (key.alg && key.alg !== "RS256") ||
      (key.use && key.use !== "sig")
    ) {
      throw new Error();
    }
    if (
      !verify(
        "RSA-SHA256",
        Buffer.from(`${headerPart}.${payloadPart}`),
        createPublicKey({ key, format: "jwk" }),
        Buffer.from(signaturePart, "base64url"),
      )
    ) {
      throw new Error();
    }
    const claims: ShiguangIdentity = JSON.parse(
      Buffer.from(payloadPart, "base64url").toString(),
    );
    const now = Date.now() / 1000;
    if (
      claims.iss !== issuer ||
      !(Array.isArray(claims.aud)
        ? claims.aud.includes(audience)
        : claims.aud === audience) ||
      typeof claims.sub !== "string" ||
      !claims.sub.trim() ||
      typeof claims.sid !== "string" ||
      !claims.sid.trim() ||
      !Number.isFinite(claims.exp) ||
      !Number.isFinite(claims.nbf) ||
      !Number.isFinite(claims.iat) ||
      claims.exp <= now - 10 ||
      claims.nbf > now + 10 ||
      claims.iat > now + 10 ||
      claims.exp <= claims.iat ||
      !Array.isArray(claims.entitlements) ||
      !claims.entitlements.includes(entitlement) ||
      !Array.isArray(claims.roles) ||
      !claims.roles.every((r) => typeof r === "string")
    ) {
      throw new Error();
    }
    return claims;
  } catch {
    throw new UnauthorizedError("Invalid Shiguang identity");
  }
}

export async function shiguangIdentityMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const token = req.headers["x-sg-identity"];
    if (token !== undefined) {
      if (typeof token !== "string") {
        throw new UnauthorizedError();
      }
      req.shiguangIdentity = await verifyShiguangIdentity(token);
      const [user] = await getShiguangUsers([req.shiguangIdentity.sub]);
      if (
        !user ||
        !["USER_STATE_ACTIVE", "STATE_ACTIVE"].includes(user.state)
      ) {
        throw new UnauthorizedError("Shiguang user is unavailable");
      }
      req.user = user;
    }
    next();
  } catch (error) {
    next(error);
  }
}

export function isShiguangOrigin(
  origin: string | undefined,
  studioOrigin: string,
) {
  const allowed = [new URL(studioOrigin).origin];
  if (process.env.REACT_APP_DEFAULT_HOST_URL) {
    allowed.push(new URL(process.env.REACT_APP_DEFAULT_HOST_URL).origin);
  }
  return !!origin && allowed.includes(origin);
}

/** Shared-cookie mutations must originate in the Studio or its configured canvas. */
export function checkShiguangOrigin(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (
    req.shiguangIdentity &&
    !["GET", "HEAD", "OPTIONS"].includes(req.method)
  ) {
    if (!isShiguangOrigin(req.headers.origin, req.config.host)) {
      return next(new ForbiddenError("Invalid request origin"));
    }
  }
  next();
}
