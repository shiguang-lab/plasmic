import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddHostlessLibraryVersion1791417600001 implements MigrationInterface {
  async up(queryRunner: QueryRunner) {
    await queryRunner.query(`CREATE TABLE "hostless_library_version" (
      "pkgVersionId" text PRIMARY KEY REFERENCES "pkg_version"("id") ON DELETE CASCADE,
      "artifact" jsonb NOT NULL
    )`);
  }
  async down(queryRunner: QueryRunner) {
    await queryRunner.query(`DROP TABLE "hostless_library_version"`);
  }
}
