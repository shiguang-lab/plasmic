const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const { test } = require("node:test");
const { migrateDomains, replaceDomains, targets } = require("./migrate-domains.cjs");

test("only replaces the three exact hostnames", () => {
  assert.equal(replaceDomains("https://canvas.plasmic.shiguanglab.com/static/host.html?a=1"), "https://plasmic-canvas.shiguanglab.com/static/host.html?a=1");
  for (const host of ["my.studio.plasmic.shiguanglab.com", "studio.plasmic.shiguanglab.com.example", "external.example"]) {
    assert.equal(replaceDomains(`https://${host}/`), `https://${host}/`);
  }
});

test("PostgreSQL domain migration preserves design identity, lengths and rollback", { skip: !process.env.DOMAIN_TEST_DATABASE_URI }, async (t) => {
  const { Client } = createRequire(require.resolve("../platform/wab/package.json"))("pg");
  const db = new Client({ connectionString: process.env.DOMAIN_TEST_DATABASE_URI });
  await db.connect();
  t.after(() => db.end());
  const tables = new Map();
  for (const [table, column, type = "text", length, key = "id"] of targets) {
    if (!tables.has(table)) tables.set(table, new Map([[key, "text PRIMARY KEY"]]));
    tables.get(table).set(column, type);
    if (length) tables.get(table).set(length, "integer");
  }
  for (const [table, columns] of tables) {
    await db.query(`CREATE TEMP TABLE "${table}" (${[...columns].map(([name, type]) => `"${name}" ${type}`).join(", ")})`);
  }
  await db.query("CREATE TEMP TABLE partial_revision_cache (id text, data text)");
  await db.query("CREATE TEMP TABLE hostless_library_version (artifact jsonb)");
  const model = JSON.stringify({ uuid: "keep-node-id", text: "页面 🌍", url: "https://studio.plasmic.shiguanglab.com/assets/abc.png", external: "https://external.example/" });
  await db.query('INSERT INTO project (id,"hostUrl") VALUES ($1,$2)', ["keep-project-id", "https://canvas.plasmic.shiguanglab.com/static/host.html"]);
  await db.query('INSERT INTO project_revision (id,data,"dataLength") VALUES ($1,$2,$3)', ["revision", model, model.length]);
  await db.query('INSERT INTO pkg_version (id,model,"modelLength") VALUES ($1,$2,$3)', ["package", model, model.length]);
  await db.query('INSERT INTO preview_publication ("projectId",bundle) VALUES ($1,$2)', ["keep-project-id", JSON.stringify({ code: "fetch('https://studio.plasmic.shiguanglab.com/api/v1/')" })]);
  await db.query("INSERT INTO partial_revision_cache VALUES ('cache','old diff')");
  const before = await migrateDomains(db);
  assert.equal(before.counts["project_revision.data"], 1);
  assert.equal((await db.query('SELECT "hostUrl" FROM project')).rows[0].hostUrl, "https://canvas.plasmic.shiguanglab.com/static/host.html");
  assert.equal((await db.query("SELECT count(*) FROM partial_revision_cache")).rows[0].count, "1");
  await migrateDomains(db, { apply: true });
  assert.deepEqual((await db.query('SELECT id,"hostUrl" FROM project')).rows[0], { id: "keep-project-id", hostUrl: "https://plasmic-canvas.shiguanglab.com/static/host.html" });
  const revision = (await db.query('SELECT data,"dataLength" FROM project_revision')).rows[0];
  assert.deepEqual(JSON.parse(revision.data), { ...JSON.parse(model), url: "https://plasmic-studio.shiguanglab.com/assets/abc.png" });
  assert.equal(revision.dataLength, revision.data.length);
  const pkg = (await db.query('SELECT model,"modelLength" FROM pkg_version')).rows[0];
  assert.equal(pkg.modelLength, pkg.model.length);
  assert.match((await db.query("SELECT bundle FROM preview_publication")).rows[0].bundle.code, /plasmic-studio/);
  assert.equal((await db.query("SELECT count(*) FROM partial_revision_cache")).rows[0].count, "0");
  assert.ok(Object.values((await migrateDomains(db, { apply: true })).counts).every((n) => n === 0));

  await db.query('UPDATE project SET "hostUrl"=$1', ["https://canvas.plasmic.shiguanglab.com/static/host.html"]);
  await db.query("INSERT INTO hostless_library_version VALUES ($1)", [JSON.stringify({ files: { "immutable.js": Buffer.from("https://studio.plasmic.shiguanglab.com/").toString("base64") } })]);
  await assert.rejects(migrateDomains(db, { apply: true }), /library artifact/);
  await db.query("DELETE FROM hostless_library_version");
  await db.query("UPDATE project_revision SET data=$1", ["invalid JSON https://studio.plasmic.shiguanglab.com/"]);
  await assert.rejects(migrateDomains(db, { apply: true }), SyntaxError);
  assert.equal((await db.query('SELECT "hostUrl" FROM project')).rows[0].hostUrl, "https://canvas.plasmic.shiguanglab.com/static/host.html");
});
