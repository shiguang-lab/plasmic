import {
  checkShiguangOrigin,
  verifyShiguangIdentity,
} from "@/wab/server/auth/shiguang";
import {
  getShiguangUserByEmail,
  getShiguangUsers,
} from "@/wab/server/auth/shiguang-directory";
import type { Response as ExpressResponse, Request } from "express";
import { generateKeyPairSync, sign } from "node:crypto";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const now = Math.floor(Date.now() / 1000);
const valid = {
  sub: "iam-user",
  sid: "iam-session",
  roles: [],
  entitlements: ["plasmic:access"],
  iss: "https://shiguanglab.com",
  aud: "plasmic-api",
  iat: now,
  nbf: now,
  exp: now + 60,
};
function jwt(claims = {}, header = {}) {
  const parts = [
    { alg: "RS256", typ: "sg-identity+jwt", kid: "test", ...header },
    { ...valid, ...claims },
  ].map((x) => Buffer.from(JSON.stringify(x)).toString("base64url"));
  const data = parts.join(".");
  return `${data}.${sign("RSA-SHA256", Buffer.from(data), privateKey).toString("base64url")}`;
}
beforeAll(() => {
  process.env.SG_IDENTITY_JWKS_URL = `data:application/json,${encodeURIComponent(JSON.stringify({ keys: [{ ...publicKey.export({ format: "jwk" }), kid: "test" }] }))}`;
});
afterEach(() => vi.unstubAllGlobals());
it("accepts the signed audience-bound IAM assertion", async () => {
  expect((await verifyShiguangIdentity(jwt())).sub).toBe("iam-user");
});
it.each([
  { iss: "wrong" },
  { aud: "other-product" },
  { sub: "" },
  { sid: "" },
  { roles: [7] },
  { entitlements: [] },
  { exp: now - 20 },
  { nbf: now + 20 },
  { iat: now + 20 },
  { exp: now },
])("rejects invalid signed claims %j", async (claims) => {
  await expect(verifyShiguangIdentity(jwt(claims))).rejects.toThrow(
    "Invalid Shiguang identity",
  );
});
it.each([{ alg: "HS256" }, { typ: "JWT" }, { kid: "missing" }])(
  "rejects invalid header %j",
  async (header) => {
    await expect(verifyShiguangIdentity(jwt({}, header))).rejects.toThrow();
  },
);
it("rejects payload tampering", async () => {
  const token = jwt().split(".");
  token[1] = Buffer.from(
    JSON.stringify({ ...valid, roles: ["system-admin"] }),
  ).toString("base64url");
  await expect(verifyShiguangIdentity(token.join("."))).rejects.toThrow();
});
it("requires an allowed origin for shared-cookie writes", () => {
  const next = vi.fn();
  checkShiguangOrigin(
    {
      shiguangIdentity: valid,
      method: "POST",
      headers: { origin: "https://evil.example" },
      config: { host: "https://studio.plasmic.shiguanglab.com" },
    } as unknown as Request,
    {} as ExpressResponse,
    next,
  );
  expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
  next.mockClear();
  checkShiguangOrigin(
    {
      shiguangIdentity: valid,
      method: "POST",
      headers: { origin: "https://studio.plasmic.shiguanglab.com" },
      config: { host: "https://studio.plasmic.shiguanglab.com" },
    } as unknown as Request,
    {} as ExpressResponse,
    next,
  );
  expect(next).toHaveBeenCalledWith();
});
describe("canonical user directory", () => {
  const profile = {
    id: "iam-user",
    email: "user@example.com",
    displayName: "IAM name",
    loginName: "iam-login",
    state: "STATE_ACTIVE",
    emailVerified: true,
  };
  beforeAll(() => {
    process.env.SG_IDENTITY_API_URL = "http://directory.test";
    process.env.SG_IDENTITY_API_TOKEN = "service-token";
  });
  it("batches and deduplicates directory IDs without storing a profile locally", async () => {
    const calls: string[][] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, init) => {
        expect(init.headers.Authorization).toBe("Bearer service-token");
        const ids = JSON.parse(init.body).ids;
        calls.push(ids);
        return Response.json({ users: ids.map((id) => ({ ...profile, id })) });
      }),
    );
    const ids = Array.from({ length: 201 }, (_, i) => `user-${i}`);
    expect(await getShiguangUsers([...ids, ids[0]])).toHaveLength(201);
    expect(calls.map((x) => x.length)).toEqual([200, 1]);
  });
  it("invitation lookup requires the exact verified email of an active IAM user", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) =>
        Response.json(
          String(url).endsWith("by-email")
            ? { user: { id: profile.id } }
            : { users: [{ ...profile, emailVerified: false }] },
        ),
      ),
    );
    expect(await getShiguangUserByEmail(profile.email)).toBeUndefined();
  });
  it("fails closed when the directory is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 503 })),
    );
    await expect(getShiguangUsers([profile.id])).rejects.toThrow("503");
  });
});
