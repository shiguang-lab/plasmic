import { createDatabase } from "@/wab/server/__testonly__/backend-util";
import {
  createTestUser,
  testProfile,
} from "@/wab/server/__testonly__/shiguang-fixture";
import { ensureDbConnection } from "@/wab/server/db/DbCon";
import { DbMgr, SUPER_USER, normalActor } from "@/wab/server/db/DbMgr";
import { ShiguangIdentity1791320000000 } from "@/wab/server/migrations/1791320000000-ShiguangIdentity";
import { Connection } from "typeorm";
import { afterAll, beforeAll, expect, it } from "vitest";
let con: Connection;
let cleanup: () => Promise<void>;
beforeAll(async () => {
  const database = await createDatabase("iam_migration");
  con = database.con;
  cleanup = database.cleanup;
});
afterAll(async () => {
  delete process.env.SG_LEGACY_USER_MAPPING;
  await cleanup?.();
});
it("repeated IAM access provisions one personal workspace and adopts only verified email invitations", async () => {
  await con.transaction(async (em) => {
    const db = new DbMgr(em, SUPER_USER);
    const owner = await createTestUser(db, {
      email: "migration-owner@example.com",
      createTeam: true,
    });
    const ownerDb = new DbMgr(em, normalActor(owner.id));
    const { project } = await ownerDb.createProject({
      name: "Invitation fixture",
    });
    await ownerDb.grantProjectPermissionByEmail(
      project.id,
      "invitee@example.com",
      "editor",
    );
    const invitee = testProfile("invitee@example.com");
    invitee.emailVerified = false;
    await db.ensurePersonalWorkspace(invitee);
    await db.ensurePersonalWorkspace(invitee);
    expect(
      await em.query(
        `SELECT count(*)::int AS count FROM team WHERE "personalTeamOwnerId"=$1`,
        [invitee.id],
      ),
    ).toEqual([{ count: 1 }]);
    expect(
      await em.query(`SELECT "userId" FROM permission WHERE email=$1`, [
        invitee.email,
      ]),
    ).toEqual([{ userId: null }]);
    invitee.emailVerified = true;
    await db.ensurePersonalWorkspace(invitee);
    expect(
      await em.query(
        `SELECT "userId",email FROM permission WHERE "projectId"=$1`,
        [project.id],
      ),
    ).toEqual(expect.arrayContaining([{ userId: invitee.id, email: null }]));
    await new DbMgr(em, normalActor(invitee.id)).getProjectById(project.id);
  });
});
it("runs the complete migration chain on an empty database", async () => {
  const base = new URL(
    process.env.WAB_TEST_SUPER_DATABASE_URI ||
      "postgresql://superwab@localhost/postgres",
  );
  const admin = await ensureDbConnection(base.href, "migration-admin");
  const name = "sg_migration_chain_" + Date.now();
  await admin.query(`CREATE DATABASE ${name} OWNER wab`);
  let migrationCon: Connection | undefined;
  try {
    base.username = "wab";
    base.pathname = `/${name}`;
    migrationCon = await ensureDbConnection(base.href, name);
    await migrationCon.runMigrations({ transaction: "all" });
    expect(
      await migrationCon.query(`SELECT to_regclass('public.user') AS account`),
    ).toEqual([{ account: null }]);
    expect(
      await migrationCon.query(
        `SELECT count(*)::int AS count FROM user_preferences`,
      ),
    ).toEqual([{ count: 0 }]);
  } finally {
    await migrationCon?.close();
    await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);
    await admin.close();
  }
});
it("refuses missing mappings before deleting accounts, then transfers business references and preferences", async () => {
  const runner = con.createQueryRunner();
  await runner.startTransaction();
  try {
    // Isolated schema models the account-era constraints while retaining a real PostgreSQL transaction.
    await runner.query(
      `CREATE SCHEMA legacy_identity; SET LOCAL search_path TO legacy_identity`,
    );
    await runner.query(
      `CREATE TABLE "user" (id text PRIMARY KEY, email text, "extraData" text, "freeTrialStartedAt" timestamptz)`,
    );
    await runner.query(
      `CREATE TABLE project (id text PRIMARY KEY, "createdById" text REFERENCES "user"(id))`,
    );
    for (const table of [
      "reset_password",
      "email_verification",
      "sso_config",
      "express_session",
      "sign_up_attempt",
    ]) {
      await runner.query(`CREATE TABLE "${table}" (id text PRIMARY KEY)`);
    }
    await runner.query(
      `CREATE TABLE oauth_token (id text PRIMARY KEY,provider text NOT NULL,"ssoConfigId" text,"userId" text REFERENCES "user"(id))`,
    );
    await runner.query(
      `INSERT INTO "user" VALUES ('old-user','legacy@example.com','{"seenTutorials":["basic"]}',now())`,
    );
    await runner.query(
      `INSERT INTO project VALUES ('retained-project','old-user')`,
    );
    const migration = new ShiguangIdentity1791320000000();
    await expect(migration.up(runner)).rejects.toThrow(
      "SG_LEGACY_USER_MAPPING",
    );
    expect(
      await runner.query(`SELECT count(*)::int AS count FROM "user"`),
    ).toEqual([{ count: 1 }]);
    const profile = testProfile("legacy@example.com");
    process.env.SG_LEGACY_USER_MAPPING = JSON.stringify({
      "old-user": profile.id,
    });
    await runner.query(
      `CREATE TABLE team (id text PRIMARY KEY, "personalTeamOwnerId" text UNIQUE REFERENCES "user"(id))`,
    );
    await runner.query(
      `ALTER TABLE oauth_token ADD UNIQUE ("userId", provider)`,
    );
    await runner.query(
      `INSERT INTO "user" VALUES ('old-admin','admin@example.com','{"admin":true}','2020-01-01')`,
    );
    await runner.query(
      `INSERT INTO team VALUES ('admin-team','old-admin'),('personal-team','old-user')`,
    );
    await runner.query(
      `INSERT INTO project VALUES ('admin-project','old-admin')`,
    );
    await runner.query(
      `INSERT INTO oauth_token VALUES ('admin-oauth','airtable',null,'old-admin'),('user-oauth','airtable',null,'old-user')`,
    );
    process.env.SG_LEGACY_USER_MAPPING = JSON.stringify({
      "old-user": profile.id,
      "old-admin": profile.id,
    });
    await migration.up(runner);
    expect(
      await runner.query(
        `SELECT id,"personalTeamOwnerId" FROM team ORDER BY id`,
      ),
    ).toEqual([
      { id: "admin-team", personalTeamOwnerId: null },
      { id: "personal-team", personalTeamOwnerId: profile.id },
    ]);
    expect(await runner.query(`SELECT id,"userId" FROM oauth_token`)).toEqual([
      { id: "user-oauth", userId: profile.id },
    ]);
    expect(
      await runner.query(`SELECT "claimedAt" FROM user_trial_claim`),
    ).toEqual([{ claimedAt: new Date("2020-01-01") }]);
    expect(await runner.query(`SELECT "createdById" FROM project`)).toEqual([
      { createdById: profile.id },
      { createdById: profile.id },
    ]);
    expect(
      await runner.query(`SELECT "extraData" FROM user_preferences`),
    ).toEqual([{ extraData: '{"seenTutorials":["basic"]}' }]);
    expect(await runner.query(`SELECT "userId" FROM user_trial_claim`)).toEqual(
      [{ userId: profile.id }],
    );
    expect(
      await runner.query(
        `SELECT to_regclass('legacy_identity.user') AS account`,
      ),
    ).toEqual([{ account: null }]);
  } finally {
    await runner.rollbackTransaction();
    await runner.release();
    delete process.env.SG_LEGACY_USER_MAPPING;
  }
});
