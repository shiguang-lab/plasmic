const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  assert = require("node:assert/strict"),
  { createRequire } = require("node:module");
const root = process.cwd(),
  wab = path.join(root, "platform/wab"),
  req = createRequire(path.join(wab, "package.json"));
const config = JSON.parse(
  fs.readFileSync(
    process.env.PLASMIC_LOCAL_ENV_FILE ??
      path.join(os.homedir(), ".plasmic/local-web-env.json"),
  ),
);
assert(
  ["localhost", "127.0.0.1", "[::1]"].includes(
    new URL(config.DATABASE_URI).hostname,
  ),
);
const projectId = process.env.AI_CHAT_TEST_PROJECT_ID;
assert(
  projectId,
  "AI_CHAT_TEST_PROJECT_ID must identify the local acceptance project",
);
const tokens = JSON.parse(fs.readFileSync(process.env.AI_CHAT_TEST_TOKEN_FILE));
Object.assign(process.env, config, {
  NODE_ENV: "development",
  SG_IDENTITY_API_URL:
    process.env.AI_CHAT_TEST_DIRECTORY ?? "http://127.0.0.1:8031",
});
process.chdir(wab);
req("esbuild-register");
req("dotenv/config");
const { ensureDbConnections, closeDbConnections } = req(
  "./src/wab/server/db/DbCon",
);
const { DbMgr, SUPER_USER } = req("./src/wab/server/db/DbMgr");
const { getConnection } = req("typeorm");
const { io } = req("socket.io-client");
const output =
  process.env.AI_CHAT_TEST_OUTPUT ?? "/tmp/plasmic-ai-chat-acceptance";
fs.mkdirSync(output, { recursive: true });
const identityHeaders = (identity) => ({
  "Content-Type": "application/json",
  "x-plasmic-api-user":
    identity === "owner"
      ? config.PLASMIC_DEV_API_USER
      : identity === "collaborator"
        ? "ai-collaborator@example.test"
        : "ai-outsider@example.test",
  "x-plasmic-api-token":
    identity === "owner"
      ? config.PLASMIC_DEV_API_TOKEN
      : tokens["ai-acceptance-" + identity],
});
const api = async (suffix, identity = "owner") => {
  const response = await fetch(
    `http://localhost:3004/api/v1/projects/${projectId}/ai/chat${suffix}`,
    { headers: identityHeaders(identity) },
  );
  return { status: response.status, data: await response.json() };
};
const publish = (event) =>
  fetch("http://localhost:3004/api/v1/projects/broadcast", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "aiChat",
      room: `projects/${projectId}`,
      message: { projectId, seq: event.seq, task: { fake: true } },
    }),
  });
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
let socket,
  revoked = false;
(async () => {
  await ensureDbConnections(config.DATABASE_URI);
  const mgr = new DbMgr(getConnection().manager, SUPER_USER);
  const [owner, collaborator, outsider] = await Promise.all([
    api(""),
    api("", "collaborator"),
    api("", "outsider"),
  ]);
  assert.deepEqual(
    [owner.status, collaborator.status, outsider.status],
    [200, 200, 403],
  );
  assert.deepEqual(owner.data, collaborator.data);
  const file = owner.data.tasks.find((t) => t.files.length)?.files[0];
  if (file)
    assert.equal(
      (await api("/attachments/" + file.id, "outsider")).status,
      403,
    );
  socket = io("http://localhost:3004", {
    path: "/api/v1/socket",
    transports: ["websocket"],
    extraHeaders: identityHeaders("collaborator"),
  });
  await new Promise((resolve, reject) => {
    socket.once("connect", () => {
      socket.emit("subscribe", {
        namespace: "projects",
        projectIds: [projectId],
        studio: false,
      });
      setTimeout(resolve, 500);
    });
    socket.once("connect_error", reject);
  });
  const live = [];
  socket.on("aiChat", (event) => live.push(event));
  const [event] = (await api("/events?afterSeq=" + (owner.data.seq - 1))).data;
  assert.equal((await publish(event)).status, 200);
  await sleep(500);
  assert.deepEqual(live.at(-1), event);
  await mgr.revokeProjectPermissionsByEmails(
    projectId,
    ["ai-collaborator@example.test"],
    true,
  );
  revoked = true;
  const before = live.length;
  await publish(event);
  await sleep(500);
  assert.equal(live.length, before);
  assert.equal(socket.connected, false);
  assert.equal((await api("", "collaborator")).status, 403);
  await mgr.grantProjectPermissionByEmail(
    projectId,
    "ai-collaborator@example.test",
    "editor",
  );
  revoked = false;
  assert.equal((await api("", "collaborator")).status, 200);
  fs.writeFileSync(
    path.join(output, "access-report.json"),
    JSON.stringify(
      {
        projectId,
        historyAccess: [200, 200, 403],
        outsiderFileAccess: file ? 403 : undefined,
        canonicalEvent: true,
        revokedSocketDisconnected: true,
        revokedHistoryAccess: 403,
        fixturePermissionRestored: true,
      },
      null,
      2,
    ),
  );
  console.log("PROJECT_ACCESS_CANONICAL_EVENTS_AND_REVOCATION_PASSED");
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (socket) socket.close();
    if (revoked)
      await new DbMgr(
        getConnection().manager,
        SUPER_USER,
      ).grantProjectPermissionByEmail(
        projectId,
        "ai-collaborator@example.test",
        "editor",
      );
    await closeDbConnections();
  });
