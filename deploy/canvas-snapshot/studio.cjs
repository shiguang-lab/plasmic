// Studio's private canvas document and its revision-bound dependency graph.
const fs = require("node:fs");
const http = require("node:http");
const { createHmac, timingSafeEqual } = require("node:crypto");
const { createRequire } = require("node:module");
const { Pool } = createRequire("/plasmic/platform/wab/package.json")("pg");
const express = createRequire("/plasmic/platform/wab/package.json")("express");
const key = fs.readFileSync("/run/secrets/snapshot-key", "utf8").trim();
if (!/^[a-f0-9]{64}$/.test(key))
  throw Error("Invalid screenshot service credential");
function authorized(projectId, header) {
  const match = /^Bearer (\d{10})\.([a-f0-9]{64})$/.exec(header || "");
  if (!match) return false;
  const now = Math.floor(Date.now() / 1000);
  const expiry = Number(match[1]);
  if (expiry < now || expiry > now + 300) return false;
  const expected = createHmac("sha256", key)
    .update(projectId + "." + match[1])
    .digest();
  return timingSafeEqual(expected, Buffer.from(match[2], "hex"));
}
const pool = new Pool({
  host: "db",
  database: "wab",
  user: "plasmic_cover_reader",
  password: fs.readFileSync("/run/secrets/reader-password", "utf8").trim(),
  max: 2,
  options: "-c default_transaction_read_only=on -c statement_timeout=30000",
});
async function readProject(id) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const {
      rows: [project],
    } = await client.query(
      `
      SELECT p.id,p.name,p."createdAt",p."updatedAt",p."hostUrl",r.revision,r.data
      FROM project p CROSS JOIN LATERAL (
        SELECT revision,data FROM project_revision WHERE "projectId"=p.id
        AND "branchId" IS NULL AND "deletedAt" IS NULL ORDER BY revision DESC LIMIT 1
      ) r WHERE p.id=$1 AND p."deletedAt" IS NULL`,
      [id],
    );
    if (!project) return undefined;
    const { data, revision, hostUrl, ...meta } = project;
    if (hostUrl && hostUrl !== process.env.CANVAS_ORIGIN + "/static/host.html")
      throw Error("Custom canvas host is unavailable");
    const bundle = JSON.parse(data);
    const { rows } = await client.query(
      `
      WITH RECURSIVE deps(id) AS (
        SELECT unnest($1::text[])
        UNION SELECT jsonb_array_elements_text(v.model::jsonb->'deps')
        FROM deps JOIN pkg_version v ON v.id=deps.id
      ) SELECT v.id,v."pkgId",v.version,v.model,a.artifact->>'canvas' AS source
      FROM deps JOIN pkg_version v USING(id) LEFT JOIN hostless_library_version a ON a."pkgVersionId"=v.id`,
      [bundle.deps],
    );
    const byId = new Map(rows.map((row) => [row.id, row])),
      complete = new Set(),
      visiting = new Set(),
      dependencies = [],
      libraries = [];
    function visit(id) {
      if (complete.has(id)) return;
      const row = byId.get(id);
      if (!row || visiting.has(id)) throw Error("Invalid dependency graph");
      visiting.add(id);
      const model = JSON.parse(row.model);
      model.deps.forEach(visit);
      dependencies.push({ id, model });
      if (row.source) {
        const dep = model.map[model.root];
        libraries.push({
          name: dep.name,
          projectId: dep.projectId,
          pkgId: row.pkgId,
          version: row.version,
          source: row.source,
        });
      }
      visiting.delete(id);
      complete.add(id);
    }
    bundle.deps.forEach(visit);
    return { project: meta, revision, bundle, dependencies, libraries };
  } finally {
    try {
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  }
}
const app = express();
app.disable("x-powered-by");
app.get(/^\/canvas-snapshot\/([\w-]+)(\/model)?$/, async (req, res) => {
  res.set({
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  });
  if (
    req.method !== "GET" ||
    !authorized(req.params[0], req.get("authorization"))
  ) {
    res.sendStatus(403);
    return;
  }
  if (!req.params[1]) {
    res.set("X-Accel-Redirect", "/_canvas_snapshot_document").end();
    return;
  }
  try {
    const snapshot = await readProject(req.params[0]);
    if (!snapshot) {
      res.sendStatus(404);
      return;
    }
    res.json(snapshot);
  } catch (error) {
    console.error("Snapshot model:", error.message);
    res.sendStatus(500);
  }
});
require("./covers.cjs")
  .startCovers(app, pool)
  .then(() => {
    http.createServer(app).listen(3100, "0.0.0.0");
  })
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
