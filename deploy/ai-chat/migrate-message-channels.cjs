const {
  ensureDbConnections,
  closeDbConnections,
} = require("../../platform/wab/src/wab/server/db/DbCon");
const { getConnection } = require("../../platform/wab/node_modules/typeorm");
const {
  lockRun,
  emitTask,
} = require("../../platform/wab/src/wab/server/copilot/ai-store");
const {
  migrateAiMessageChannels,
} = require("../../platform/wab/src/wab/server/copilot/ai-message-channels");
(async () => {
  try {
    await ensureDbConnections(process.env.DATABASE_URI);
    const count = await getConnection().transaction(async (db) => {
      const runs = await db.query(
        `SELECT id,task FROM ai_run WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(task->'parts') p WHERE p->>'type'='markdown' AND NOT(p ? 'channel')) `,
      );
      if (runs.some((run) => run.task.status === "running"))
        throw Error(
          "Wait for active AI runs before migrating message channels",
        );
      for (const run of runs) {
        const steps = await db.query(
          `SELECT step,response FROM ai_model_step WHERE "runId"=$1 ORDER BY step`,
          [run.id],
        );
        const current = await lockRun(run.id, db);
        current.task.parts = migrateAiMessageChannels(
          current.task.parts,
          steps,
        );
        await emitTask(db, current.task);
      }
      await db.query(
        `UPDATE ai_message SET parts=(SELECT jsonb_agg(CASE WHEN p->>'type'='markdown' THEN p||'{"channel":"user"}'::jsonb ELSE p END) FROM jsonb_array_elements(parts) p) WHERE role='user' AND EXISTS(SELECT 1 FROM jsonb_array_elements(parts) p WHERE p->>'type'='markdown' AND NOT(p ? 'channel'))`,
      );
      return runs.length;
    });
    console.log({ migratedRuns: count });
  } finally {
    await closeDbConnections();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
