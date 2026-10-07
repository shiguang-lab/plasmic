import { Cookie } from "@playwright/test";

/** Test accounts and sessions are issued by IAM, never by the product. */
export function shiguangSession(email: string, baseURL: string): Cookie {
  const sessions: Record<string, string> = JSON.parse(
    process.env.SG_E2E_SESSIONS_JSON || "{}",
  );
  const value = sessions[email];
  if (!value) {
    throw new Error(
      `Missing IAM test session for ${email}; set SG_E2E_SESSIONS_JSON`,
    );
  }
  const url = new URL(baseURL);
  return {
    name: "__Secure-sg_session",
    value,
    domain: url.hostname.endsWith(".shiguanglab.com")
      ? ".shiguanglab.com"
      : url.hostname,
    path: "/",
    expires: -1,
    httpOnly: true,
    secure: url.protocol === "https:",
    sameSite: "Lax",
  };
}
