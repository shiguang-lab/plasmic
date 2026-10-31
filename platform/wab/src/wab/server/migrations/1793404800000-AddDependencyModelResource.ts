import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddDependencyModelResource1793404800000 implements MigrationInterface {
  async up(runner: QueryRunner) {
    await runner.query(`CREATE TABLE dependency_model_resource (
      id text PRIMARY KEY,
      "pkgVersionId" text NOT NULL REFERENCES pkg_version(id) ON DELETE CASCADE,
      "pkgId" text NOT NULL REFERENCES pkg(id) ON DELETE CASCADE,
      digest text NOT NULL,
      model text NOT NULL,
      UNIQUE ("pkgVersionId", digest)
    )`);
  }
  async down(runner: QueryRunner) {
    await runner.query('DROP TABLE dependency_model_resource');
  }
}
