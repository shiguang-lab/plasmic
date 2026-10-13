import type { MigrationInterface, QueryRunner } from "typeorm";

export class AiChat1791849600000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`
      CREATE TABLE ai_conversation (
        "projectId" text PRIMARY KEY REFERENCES project(id) ON DELETE CASCADE,
        seq integer NOT NULL DEFAULT 0
      );
      CREATE TABLE ai_run (
        id uuid PRIMARY KEY, "projectId" text NOT NULL REFERENCES ai_conversation("projectId") ON DELETE CASCADE,
        "authorId" text NOT NULL, "clientRequestId" uuid NOT NULL,
        request jsonb NOT NULL, task jsonb NOT NULL, status text NOT NULL DEFAULT 'running',
        started boolean NOT NULL DEFAULT false, "createdAt" timestamptz NOT NULL DEFAULT now(),
        UNIQUE ("projectId", "authorId", "clientRequestId")
      );
      CREATE UNIQUE INDEX ai_project_active_run ON ai_run("projectId") WHERE status = 'running';
      CREATE TABLE ai_message (
        id text PRIMARY KEY, "runId" uuid NOT NULL REFERENCES ai_run(id) ON DELETE CASCADE,
        role text NOT NULL CHECK (role IN ('user','assistant')), parts jsonb NOT NULL,
        UNIQUE ("runId", role)
      );
      CREATE TABLE ai_event (
        "projectId" text NOT NULL REFERENCES ai_conversation("projectId") ON DELETE CASCADE,
        seq integer NOT NULL, task jsonb NOT NULL, published boolean NOT NULL DEFAULT false,
        PRIMARY KEY ("projectId", seq)
      );
      CREATE INDEX ai_event_outbox ON ai_event("projectId",seq) WHERE NOT published;
      CREATE TABLE ai_tool_call (
        id text PRIMARY KEY, "runId" uuid NOT NULL REFERENCES ai_run(id) ON DELETE CASCADE,
        call jsonb NOT NULL, "claimedAt" timestamptz, "savedRevisionId" text
      );
      CREATE TABLE ai_model_step (
        "runId" uuid NOT NULL REFERENCES ai_run(id) ON DELETE CASCADE,
        step integer NOT NULL, response jsonb, PRIMARY KEY ("runId",step)
      );
      CREATE TABLE ai_attachment (
        id uuid PRIMARY KEY, "runId" uuid NOT NULL REFERENCES ai_run(id) ON DELETE CASCADE,
        metadata jsonb NOT NULL, "objectKey" text NOT NULL UNIQUE
      );
    `);
  }
  async down(q: QueryRunner) {
    await q.query(`DROP TABLE ai_attachment, ai_model_step, ai_tool_call, ai_event, ai_message, ai_run, ai_conversation`);
  }
}
