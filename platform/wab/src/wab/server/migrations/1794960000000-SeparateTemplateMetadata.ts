import type { MigrationInterface, QueryRunner } from "typeorm";

export class SeparateTemplateMetadata1794960000000
  implements MigrationInterface
{
  async up(runner: QueryRunner) {
    await runner.query(
      `ALTER TABLE "design_template" RENAME COLUMN "draft" TO "metadata"`,
    );
    await runner.query(`UPDATE "design_template"
      SET "published" = "published" - ARRAY['name', 'description', 'kind', 'device', 'category', 'thumbnailUrl']
      WHERE "published" IS NOT NULL`);
  }

  async down(runner: QueryRunner) {
    await runner.query(`UPDATE "design_template"
      SET "published" = "metadata" || "published"
      WHERE "published" IS NOT NULL`);
    await runner.query(
      `ALTER TABLE "design_template" RENAME COLUMN "metadata" TO "draft"`,
    );
  }
}
