import { getShiguangUsers } from "@/wab/server/auth/shiguang-directory";
import { MigrationInterface, QueryRunner } from "typeorm";

/** Business references use IAM subjects; no account or password data remains. */
export class ShiguangIdentity1791320000000 implements MigrationInterface {
  name = "ShiguangIdentity1791320000000";

  async up(runner: QueryRunner) {
    const users: {
      id: string;
      email: string;
      extraData: string | null;
      freeTrialStartedAt: Date | null;
    }[] = await runner.query(
      `SELECT "id", "email", "extraData", "freeTrialStartedAt" FROM "user"`,
    );
    const mapping: Record<string, string> = JSON.parse(
      process.env.SG_LEGACY_USER_MAPPING || "{}",
    );
    if (
      !mapping ||
      typeof mapping !== "object" ||
      Array.isArray(mapping) ||
      users.some(
        (user) =>
          typeof mapping[user.id] !== "string" || !mapping[user.id].trim(),
      )
    ) {
      throw new Error(
        "SG_LEGACY_USER_MAPPING must map each local user ID to an existing Shiguang subject before migration",
      );
    }
    const subjects = users.map((user) => mapping[user.id]);
    const profiles = new Map(
      (await getShiguangUsers(subjects)).map((user) => [
        user.id as string,
        user,
      ]),
    );
    if (subjects.some((sub) => !profiles.has(sub))) {
      throw new Error(
        "Mapped Shiguang subjects must exist in the identity directory",
      );
    }

    const tables = await runner.getTables();
    const references: { table: string; column: string }[] = [];
    for (const table of tables) {
      for (const key of [...table.foreignKeys]) {
        if (key.referencedTableName.replace(/^.*\./, "") === "user") {
          references.push(
            ...key.columnNames.map((column) => ({ table: table.name, column })),
          );
          await runner.dropForeignKey(table, key);
        }
      }
    }
    const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;
    await runner.query(
      `DELETE FROM "oauth_token" WHERE "provider" NOT IN ('airtable', 'google-sheets')`,
    );
    // Keep the matching email account's personal team, settings and integrations.
    // Other personal teams remain ordinary teams with their existing permissions.
    users.sort((a, b) => {
      const matches = (user: (typeof users)[number]) =>
        user.email.toLowerCase() ===
        profiles.get(mapping[user.id])?.email.toLowerCase();
      return (
        Number(matches(b)) - Number(matches(a)) || a.id.localeCompare(b.id)
      );
    });
    for (const sub of new Set(subjects)) {
      const ids = users
        .filter((user) => mapping[user.id] === sub)
        .map((user) => user.id);
      if (ids.length < 2) {
        continue;
      }
      await runner.query(
        `UPDATE "team" SET "personalTeamOwnerId" = NULL
         WHERE "personalTeamOwnerId" = ANY($1::text[]) AND id <> (
           SELECT id FROM "team" WHERE "personalTeamOwnerId" = ANY($1::text[])
           ORDER BY array_position($1::text[], "personalTeamOwnerId"), id LIMIT 1
         )`,
        [ids],
      );
      await runner.query(
        `DELETE FROM "oauth_token" WHERE id IN (
           SELECT id FROM (
             SELECT id, row_number() OVER (
               PARTITION BY provider ORDER BY array_position($1::text[], "userId"), id
             ) AS position FROM "oauth_token" WHERE "userId" = ANY($1::text[])
           ) duplicates WHERE position > 1
         )`,
        [ids],
      );
    }
    // One CASE update per column also handles IDs which happen to overlap with old IDs.
    if (users.length) {
      const params = users.flatMap((user) => [user.id, mapping[user.id]]);
      for (const { table, column } of references) {
        const cases = users
          .map(
            (_user, index) => `WHEN $${index * 2 + 1} THEN $${index * 2 + 2}`,
          )
          .join(" ");
        const qualifiedTable = table.split(".").map(quote).join(".");
        await runner.query(
          `UPDATE ${qualifiedTable} SET ${quote(column)} = CASE ${quote(column)} ${cases} ELSE ${quote(column)} END`,
          params,
        );
      }
    }
    await runner.query(
      `CREATE TABLE "user_preferences" ("userId" text PRIMARY KEY, "extraData" text)`,
    );
    await runner.query(
      `CREATE TABLE "user_trial_claim" ("userId" text PRIMARY KEY, "claimedAt" timestamptz NOT NULL)`,
    );
    for (const user of users) {
      if (user.extraData !== null) {
        await runner.query(
          `INSERT INTO "user_preferences" VALUES ($1, $2) ON CONFLICT ("userId") DO NOTHING`,
          [mapping[user.id], user.extraData],
        );
      }
      if (user.freeTrialStartedAt) {
        await runner.query(
          `INSERT INTO "user_trial_claim" VALUES ($1, $2) ON CONFLICT ("userId") DO UPDATE SET "claimedAt" = LEAST(user_trial_claim."claimedAt", EXCLUDED."claimedAt")`,
          [mapping[user.id], user.freeTrialStartedAt],
        );
      }
    }
    await runner.query(
      `ALTER TABLE "oauth_token" DROP COLUMN IF EXISTS "ssoConfigId"`,
    );
    for (const table of [
      "reset_password",
      "email_verification",
      "sso_config",
      "express_session",
      "sign_up_attempt",
      "user",
    ]) {
      await runner.query(`DROP TABLE ${quote(table)}`);
    }
    await runner.query(
      `CREATE TABLE "integration_auth_session" ("id" varchar(255) PRIMARY KEY, "expiredAt" bigint NOT NULL, "json" text NOT NULL)`,
    );
    await runner.query(
      `CREATE INDEX ON "integration_auth_session" ("expiredAt")`,
    );
  }

  async down(): Promise<void> {
    throw new Error(
      "Account removal is irreversible; restore the database backup to roll back",
    );
  }
}
