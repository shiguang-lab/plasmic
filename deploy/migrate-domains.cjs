const { createRequire } = require("node:module");

const origins = {
  "studio.plasmic.shiguanglab.com": "plasmic-studio.shiguanglab.com",
  "canvas.plasmic.shiguanglab.com": "plasmic-canvas.shiguanglab.com",
  "preview.plasmic.shiguanglab.com": "plasmic-preview.shiguanglab.com",
};
const pattern = "(?<![a-zA-Z0-9_.-])(?:studio|canvas|preview)[.]plasmic[.]shiguanglab[.]com(?![a-zA-Z0-9_.-])";
const replaceDomains = (text) => text.replace(new RegExp(pattern, "g"), (host) => origins[host]);
// Only persisted design/configuration fields; credentials and audit logs are excluded.
const targets = [
  ["team", "uiConfig", "jsonb"],
  ["team", "whiteLabelInfo", "jsonb"],
  ["workspace", "uiConfig", "jsonb"],
  ["workspace", "contentCreatorConfig", "jsonb"],
  ["project", "hostUrl"],
  ["project", "uiConfig", "jsonb"],
  ["project", "extraData", "jsonb"],
  ["branch", "hostUrl"],
  ["trusted_host", "hostUrl"],
  ["project_revision", "data", "text", "dataLength"],
  ["pkg_version", "hostUrl"],
  ["pkg_version", "model", "text", "modelLength"],
  ["dev_flag_overrides", "data"],
  ["preview_publication", "pages", "jsonb", null, "projectId"],
  ["preview_publication", "bundle", "jsonb", null, "projectId"],
];

async function migrateDomains(db, { apply = false } = {}) {
  const counts = {};
  await db.query(apply ? "BEGIN" : "BEGIN READ ONLY");
  try {
    if (apply) {
      await db.query("SET LOCAL lock_timeout = '10s'");
      await db.query(`LOCK TABLE ${[...new Set(targets.map(([table]) => `"${table}"`)), '"partial_revision_cache"', '"hostless_library_version"'].join(", ")} IN SHARE ROW EXCLUSIVE MODE`);
    }
    // Library files are content-addressed and immutable. Never rewrite their bytes/digests.
    for (const { artifact } of (await db.query("SELECT artifact FROM hostless_library_version")).rows) {
      const sources = [JSON.stringify(artifact), ...Object.values(artifact.files || {}).map((file) => Buffer.from(file, "base64").toString("utf8"))];
      if (sources.some((source) => replaceDomains(source) !== source)) {
        throw new Error("A library artifact contains old domains; publish a corrected library version before migrating.");
      }
    }
    for (const [table, column, type = "text", length, key = "id"] of targets) {
      const name = `${table}.${column}`;
      counts[name] = Number((await db.query(`SELECT count(*) FROM "${table}" WHERE "${column}"::text ~ $1`, [pattern])).rows[0].count);
      if (!apply || !counts[name]) continue;
      let after = "";
      // Read one bundle at a time; project revisions can be tens of MB each.
      while (true) {
        const { rows } = await db.query(`SELECT "${key}" AS id, "${column}" AS value FROM "${table}" WHERE "${key}" > $1 AND "${column}"::text ~ $2 ORDER BY "${key}" LIMIT 1`, [after, pattern]);
        if (!rows.length) break;
        const { id, value } = rows[0];
        const text = replaceDomains(type === "jsonb" ? JSON.stringify(value) : value);
        if (["data", "model"].includes(column)) JSON.parse(text);
        await db.query(`UPDATE "${table}" SET "${column}"=$1::${type}${length ? `, "${length}"=$3` : ""} WHERE "${key}"=$2`, length ? [text, id, text.length] : [text, id]);
        after = id;
      }
    }
    counts.partialRevisionCaches = Number((await db.query("SELECT count(*) FROM partial_revision_cache")).rows[0].count);
    if (apply) {
      // Cached diffs must not replay pre-migration URLs into a migrated full revision.
      await db.query("DELETE FROM partial_revision_cache");
    }
    await db.query(apply ? "COMMIT" : "ROLLBACK");
    return { apply, counts };
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }
}

if (require.main === module) {
  (async () => {
    if (process.argv.slice(2).some((arg) => arg !== "--apply")) throw new Error("Usage: node deploy/migrate-domains.cjs [--apply]");
    if (!process.env.DATABASE_URI) throw new Error("DATABASE_URI is required");
    const { Client } = createRequire(require.resolve("../platform/wab/package.json"))("pg");
    const db = new Client({ connectionString: process.env.DATABASE_URI });
    await db.connect();
    try { console.log(JSON.stringify(await migrateDomains(db, { apply: process.argv.includes("--apply") }), null, 2)); }
    finally { await db.end(); }
  })().catch((error) => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { migrateDomains, replaceDomains, targets };
