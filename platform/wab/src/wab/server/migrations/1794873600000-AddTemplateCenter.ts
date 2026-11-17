import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddTemplateCenter1794873600000 implements MigrationInterface {
  async up(runner: QueryRunner) {
    await runner.query(
      `ALTER TABLE "project" ADD COLUMN "isTemplate" boolean NOT NULL DEFAULT false`,
    );
    await runner.query(`CREATE TABLE "design_template" (
      "projectId" text PRIMARY KEY REFERENCES "project"("id") ON DELETE CASCADE,
      "draft" jsonb NOT NULL,
      "published" jsonb,
      "updatedAt" timestamptz NOT NULL
    )`);
  }
  async down(runner: QueryRunner) {
    await runner.query(`DROP TABLE "design_template"`);
    await runner.query(`ALTER TABLE "project" DROP COLUMN "isTemplate"`);
  }
}
