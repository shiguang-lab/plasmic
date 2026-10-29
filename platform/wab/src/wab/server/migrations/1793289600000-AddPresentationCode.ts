import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddPresentationCode1793289600000 implements MigrationInterface {
  async up(runner: QueryRunner) {
    await runner.query(
      'ALTER TABLE "project" ADD COLUMN "presentationCode" text UNIQUE',
    );
  }
  async down(runner: QueryRunner) {
    await runner.query('ALTER TABLE "project" DROP COLUMN "presentationCode"');
  }
}
