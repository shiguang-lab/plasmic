import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddPreviewPublication1791417600000 implements MigrationInterface {
  async up(queryRunner: QueryRunner) {
    await queryRunner.query(`CREATE TABLE "preview_publication" (
      "projectId" text PRIMARY KEY REFERENCES "project"("id") ON DELETE CASCADE,
      "code" text NOT NULL UNIQUE,
      "version" text NOT NULL,
      "enabled" boolean NOT NULL,
      "entryPath" text NOT NULL,
      "pages" jsonb NOT NULL,
      "bundle" jsonb,
      "publishedAt" timestamptz NOT NULL
    )`);
  }
  async down(queryRunner: QueryRunner) {
    await queryRunner.query(`DROP TABLE "preview_publication"`);
  }
}
