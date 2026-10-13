import type { MigrationInterface, QueryRunner } from "typeorm";

export class AiEventParts1791849600001 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`ALTER TABLE ai_event RENAME COLUMN task TO payload`);
    await q.query(`UPDATE ai_event SET payload=jsonb_build_object('runId',payload->>'id','task',payload)`);
  }
  async down(_q: QueryRunner) {
    throw new Error("AI event history cannot be reverted to snapshots without losing its recorded contents.");
  }
}
