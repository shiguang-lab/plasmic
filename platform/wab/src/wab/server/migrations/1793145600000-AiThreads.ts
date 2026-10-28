import type { MigrationInterface, QueryRunner } from "typeorm";

export class AiThreads1793145600000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`
      CREATE TABLE ai_thread (
        id uuid PRIMARY KEY,
        "projectId" text NOT NULL REFERENCES ai_conversation("projectId") ON DELETE CASCADE,
        "branchId" text,
        title text NOT NULL,
        "createdBy" text NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "lastMessageAt" timestamptz NOT NULL DEFAULT now(),
        "archivedAt" timestamptz,
        seq integer NOT NULL DEFAULT 0
      );
      ALTER TABLE ai_run ADD COLUMN "threadId" uuid REFERENCES ai_thread(id) ON DELETE CASCADE;
      INSERT INTO ai_thread(id,"projectId","branchId",title,"createdBy","createdAt","lastMessageAt")
        SELECT md5('ai-history:' || "projectId" || ':' || COALESCE(task->'binding'->>'branchId',''))::uuid,
          "projectId",task->'binding'->>'branchId','Conversation history',(array_agg("authorId" ORDER BY "createdAt",id))[1],min("createdAt"),max("createdAt")
        FROM ai_run GROUP BY "projectId",task->'binding'->>'branchId';
      UPDATE ai_run SET "threadId"=md5('ai-history:' || "projectId" || ':' || COALESCE(task->'binding'->>'branchId',''))::uuid;
      UPDATE ai_run SET task=task || jsonb_build_object('threadId',"threadId"),
        request=request || jsonb_build_object('threadId',"threadId");
      ALTER TABLE ai_run ALTER COLUMN "threadId" SET NOT NULL;
      CREATE INDEX ai_thread_directory ON ai_thread("projectId","branchId","lastMessageAt" DESC,id DESC);
      CREATE INDEX ai_thread_messages ON ai_run("threadId","createdAt" DESC,id DESC);
    `);
  }
  async down(q: QueryRunner) {
    await q.query(
      `ALTER TABLE ai_run DROP COLUMN "threadId"; DROP TABLE ai_thread;`,
    );
  }
}
