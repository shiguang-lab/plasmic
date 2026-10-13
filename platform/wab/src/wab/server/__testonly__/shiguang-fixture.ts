import { startTestServer } from "@/wab/server/__testonly__/test-server";
import { DbMgr, normalActor } from "@/wab/server/db/DbMgr";
import { User } from "@/wab/server/entities/Entities";
import { UserId } from "@/wab/shared/ApiSchema";
import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { vi } from "vitest";

const profiles = vi.hoisted(() => new Map<string, User>());
vi.mock("@/wab/server/auth/shiguang-directory", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/wab/server/auth/shiguang-directory")
  >()),
  getShiguangUsers: vi.fn(async (ids: string[]) =>
    [...new Set(ids)].flatMap((id) =>
      profiles.has(id) ? [profiles.get(id)] : [],
    ),
  ),
  getShiguangUserByEmail: vi.fn(async (email: string) =>
    [...profiles.values()].find(
      (user) =>
        user.email.toLowerCase() === email.toLowerCase() && user.emailVerified,
    ),
  ),
}));

export function testProfile(email: string, displayName = email): User {
  const user: User = {
    id: `iam-${email}` as UserId,
    email,
    displayName,
    loginName: email,
    state: "STATE_ACTIVE",
    emailVerified: true,
  };
  profiles.set(user.id, user);
  return user;
}
for (const email of [
  "admin@admin.example.com",
  "user@example.com",
  "user2@example.com",
]) {
  testProfile(email);
}

/** Worker processes use HTTP because Vitest's in-memory mock stays in this process. */
export async function startTestDirectory() {
  const token = randomUUID();
  const server = await startTestServer("127.0.0.1", async (req, res) => {
    if (req.headers.authorization !== `Bearer ${token}`) {
      res.writeHead(401).end();
      return;
    }
    if (req.method !== "POST" || req.url !== "/v1/identity/users/batch-get") {
      res.writeHead(404).end();
      return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.from(chunk));
    }
    const { ids } = JSON.parse(Buffer.concat(chunks).toString());
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        users: [...new Set<string>(ids)].flatMap((id) =>
          profiles.has(id) ? [profiles.get(id)] : [],
        ),
      }),
    );
  });
  return { ...server, token };
}

export async function createTestUser(
  db: DbMgr,
  input: {
    email: string;
    displayName?: string;
    id?: UserId;
    createTeam?: boolean;
  },
) {
  const user = testProfile(input.email, input.displayName);
  if (input.id) {
    profiles.delete(user.id);
    user.id = input.id;
    profiles.set(user.id, user);
  }
  await db.ensurePersonalWorkspace(user);
  if (input.createTeam) {
    const owner = new DbMgr(db.getEntMgr(), normalActor(user.id));
    const team = await owner.createTeam(`${user.displayName}'s team`);
    await owner.createWorkspace({
      name: "Workspace",
      description: "",
      teamId: team.id,
    });
  }
  return user;
}

const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
process.env.SG_IDENTITY_JWKS_URL = `data:application/json,${encodeURIComponent(JSON.stringify({ keys: [{ ...publicKey.export({ format: "jwk" }), kid: "fixture" }] }))}`;
export function testIdentityAssertion(email: string) {
  const user = [...profiles.values()].find((u) => u.email === email);
  if (!user) {
    throw new Error(`No fixture identity for ${email}`);
  }
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", typ: "sg-identity+jwt", kid: "fixture" }),
  ).toString("base64url");
  const body = Buffer.from(
    JSON.stringify({
      iss: "https://shiguanglab.com",
      aud: "plasmic-api",
      sub: user.id,
      sid: randomUUID(),
      roles: [],
      entitlements: ["plasmic:access"],
      iat: now,
      nbf: now,
      exp: now + 3600,
    }),
  ).toString("base64url");
  return `${header}.${body}.${sign("RSA-SHA256", Buffer.from(`${header}.${body}`), privateKey).toString("base64url")}`;
}
