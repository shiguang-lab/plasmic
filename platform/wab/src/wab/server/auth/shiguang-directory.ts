import type { User } from "@/wab/server/entities/Entities";
import { UserId } from "@/wab/shared/ApiSchema";
import { ensure } from "@/wab/shared/common";

async function directoryRequest(path: string, body: object) {
  const base = ensure(
    process.env.SG_IDENTITY_API_URL,
    "SG_IDENTITY_API_URL is required",
  );
  const token = ensure(
    process.env.SG_IDENTITY_API_TOKEN,
    "SG_IDENTITY_API_TOKEN is required",
  );
  const response = await fetch(new URL(path, base), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) {
    throw new Error(`Shiguang directory returned ${response.status}`);
  }
  return response.json();
}

export async function getShiguangUsers(
  ids: readonly string[],
): Promise<User[]> {
  const uniqueIds = [...new Set(ids)];
  const users: User[] = [];
  for (let i = 0; i < uniqueIds.length; i += 200) {
    const requested = uniqueIds.slice(i, i + 200);
    const data = await directoryRequest("/v1/identity/users/batch-get", {
      ids: requested,
    });
    if (!Array.isArray(data.users)) {
      throw new Error("Invalid Shiguang directory response");
    }
    for (const user of data.users) {
      if (
        typeof user.id !== "string" ||
        !requested.includes(user.id) ||
        typeof user.email !== "string" ||
        typeof user.displayName !== "string" ||
        typeof user.loginName !== "string" ||
        typeof user.state !== "string"
      ) {
        throw new Error("Invalid Shiguang user");
      }
      users.push({
        id: user.id as UserId,
        email: user.email,
        displayName: user.displayName,
        emailVerified: user.emailVerified === true,
        loginName: user.loginName,
        state: user.state,
      });
    }
  }
  return users;
}

export async function getShiguangUserByEmail(
  email: string,
): Promise<User | undefined> {
  const data = await directoryRequest("/v1/identity/users/by-email", { email });
  if (!data.user) {
    return undefined;
  }
  const [user] = await getShiguangUsers([data.user.id]);
  return user &&
    ["USER_STATE_ACTIVE", "STATE_ACTIVE"].includes(user.state) &&
    user.emailVerified &&
    user.email.toLowerCase() === email.toLowerCase()
    ? user
    : undefined;
}

export async function searchShiguangUsers(query: string) {
  const data = await directoryRequest("/v1/identity/users/query", {
    query,
    limit: 10,
  });
  if (!Array.isArray(data.users)) {
    throw new Error("Invalid Shiguang search response");
  }
  if (data.users.some((user) => typeof user.id !== "string")) {
    throw new Error("Invalid Shiguang search response");
  }
  return (await getShiguangUsers(data.users.map((user) => user.id))).filter(
    (user) => ["USER_STATE_ACTIVE", "STATE_ACTIVE"].includes(user.state),
  );
}
