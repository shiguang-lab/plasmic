// Local test identity directory. Never use it outside loopback acceptance tests.
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
const config = JSON.parse(
  await readFile(`${os.homedir()}/.plasmic/local-web-env.json`, "utf8"),
);
const users = [
  {
    id: process.env.AI_TEST_OWNER_ID ?? "382914060758286339",
    email: config.PLASMIC_DEV_API_USER,
    displayName: "Local AI Acceptance Owner",
  },
  {
    id: "ai-acceptance-collaborator",
    email: "ai-collaborator@example.test",
    displayName: "Local AI Acceptance Collaborator",
  },
  {
    id: "ai-acceptance-outsider",
    email: "ai-outsider@example.test",
    displayName: "Local AI Acceptance Outsider",
  },
].map((user) => ({
  ...user,
  loginName: user.email,
  state: "STATE_ACTIVE",
  emailVerified: true,
}));
createServer(async (req, res) => {
  let text = "";
  for await (const chunk of req) text += chunk;
  const body = JSON.parse(text || "{}");
  res.setHeader("Content-Type", "application/json");
  if (req.url.endsWith("/batch-get"))
    res.end(
      JSON.stringify({
        users: users.filter((user) => body.ids?.includes(user.id)),
      }),
    );
  else if (req.url.endsWith("/by-email"))
    res.end(
      JSON.stringify({ user: users.find((user) => user.email === body.email) }),
    );
  else if (req.url.endsWith("/query"))
    res.end(
      JSON.stringify({
        users: users.filter((user) => user.email.includes(body.query ?? "")),
      }),
    );
  else {
    res.statusCode = 404;
    res.end("{}");
  }
}).listen(8031, "127.0.0.1", () =>
  console.log("Local acceptance directory: 127.0.0.1:8031"),
);
