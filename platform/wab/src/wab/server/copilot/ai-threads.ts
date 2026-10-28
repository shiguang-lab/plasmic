import { BadRequestError, ForbiddenError } from "@/wab/shared/ApiErrors/errors";
import type { AiThread, AiThreadPage } from "@/wab/shared/copilot/ai-chat";
import { aiThreadPatchSchema } from "@/wab/shared/copilot/ai-chat";
import { EntityManager, getConnection } from "typeorm";
import { z } from "zod";

const threadQuery = `SELECT t.*, (SELECT jsonb_build_object('id',r.id,'prompt',r.task->>'prompt','status',r.status,'createdAt',r.task->>'createdAt','seq',r.task->'seq','needsReconciliation',COALESCE((r.task->>'needsReconciliation')::boolean,false)) FROM ai_run r WHERE r."threadId"=t.id ORDER BY r."createdAt" DESC,r.id DESC LIMIT 1) AS "lastTask" FROM ai_thread t`;

function readThread(row: AiThread): AiThread {
  return {
    ...row,
    createdAt: new Date(row.createdAt).toISOString(),
    lastMessageAt: new Date(row.lastMessageAt).toISOString(),
    archivedAt: row.archivedAt ? new Date(row.archivedAt).toISOString() : null,
    lastTask: row.lastTask ?? undefined,
  };
}

export async function getThread(
  projectId: string,
  id: string,
  db = getConnection().manager,
) {
  const [row] = await db.query(
    `${threadQuery} WHERE t.id=$1 AND t."projectId"=$2`,
    [id, projectId],
  );
  if (!row) {
    throw new ForbiddenError("Conversation is not accessible.");
  }
  return readThread(row);
}

export async function listThreads(
  projectId: string,
  branchId: string | null,
  archived = false,
  query = "",
  before?: string,
): Promise<AiThreadPage> {
  let cursor: { at: string; id: string } | undefined;
  if (before) {
    try {
      cursor = z
        .object({ at: z.string().datetime(), id: z.string().uuid() })
        .strict()
        .parse(JSON.parse(Buffer.from(before, "base64url").toString("utf8")));
    } catch {
      throw new BadRequestError("Invalid conversation cursor.");
    }
  }
  const rows = await getConnection().query(
    `${threadQuery}
    WHERE t."projectId"=$1 AND t."branchId" IS NOT DISTINCT FROM $2
      AND (t."archivedAt" IS NOT NULL)=$3 AND position(lower($4) in lower(t.title))>0
      AND ($5::timestamptz IS NULL OR (t."lastMessageAt",t.id)<($5::timestamptz,$6::uuid))
    ORDER BY t."lastMessageAt" DESC,t.id DESC LIMIT 31`,
    [
      projectId,
      branchId,
      archived,
      query,
      cursor?.at ?? null,
      cursor?.id ?? null,
    ],
  );
  const threads = rows.slice(0, 30).map(readThread);
  const last = threads.at(-1);
  return {
    threads,
    before:
      rows.length > 30 && last
        ? Buffer.from(
            JSON.stringify({ at: last.lastMessageAt, id: last.id }),
          ).toString("base64url")
        : undefined,
  };
}

export async function emitThread(
  db: EntityManager,
  projectId: string,
  id: string,
) {
  const [{ seq }] = await db.query(
    `WITH next AS (UPDATE ai_conversation SET seq=seq+1 WHERE "projectId"=$1 RETURNING seq) SELECT seq FROM next`,
    [projectId],
  );
  await db.query(`UPDATE ai_thread SET seq=$2 WHERE id=$1`, [id, seq]);
  const thread = await getThread(projectId, id, db);
  await db.query(
    `INSERT INTO ai_event("projectId",seq,payload) VALUES($1,$2,$3)`,
    [projectId, seq, { thread }],
  );
  return thread;
}

export async function patchThread(
  projectId: string,
  id: string,
  patch: z.infer<typeof aiThreadPatchSchema>,
) {
  return getConnection().transaction(async (db) => {
    await db.query(
      `SELECT seq FROM ai_conversation WHERE "projectId"=$1 FOR UPDATE`,
      [projectId],
    );
    await getThread(projectId, id, db);
    if (patch.archived) {
      const active = await db.query(
        `SELECT id FROM ai_run WHERE "threadId"=$1 AND status='running'`,
        [id],
      );
      if (active.length) {
        throw new BadRequestError(
          "Finish the running task before archiving this conversation.",
        );
      }
      const unresolved = await db.query(
        `SELECT id FROM ai_run WHERE "threadId"=$1 AND task->>'needsReconciliation'='true' LIMIT 1`,
        [id],
      );
      if (unresolved.length) {
        throw new BadRequestError(
          "Verify the saved design before archiving this conversation.",
        );
      }
    }
    await db.query(
      `UPDATE ai_thread SET title=COALESCE($2,title),"archivedAt"=CASE WHEN $3::boolean IS NULL THEN "archivedAt" WHEN $3 THEN now() ELSE NULL END WHERE id=$1`,
      [id, patch.title ?? null, patch.archived ?? null],
    );
    return emitThread(db, projectId, id);
  });
}
