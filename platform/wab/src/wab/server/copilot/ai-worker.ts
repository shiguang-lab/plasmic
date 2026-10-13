import { Client, Connection, WorkflowExecutionAlreadyStartedError } from "@temporalio/client";
import { NativeConnection, Worker } from "@temporalio/worker";
import { ensureDbConnections, closeDbConnections } from "@/wab/server/db/DbCon";
import { loadConfig } from "@/wab/server/config";
import { getConnection } from "typeorm";
import * as activities from "@/wab/server/copilot/ai-activities";
import { patchTask } from "@/wab/server/copilot/ai-store";

export async function dispatchAiOutbox(client: Client, publish: (projectId: string, seq: number, task: unknown) => Promise<void>) {
  // Delivery is at least once. IDs and continuous project sequence make replay
  // safe; only successful HTTP publication clears the durable outbox bit.
  const db = getConnection();
  const pending = await db.query(`SELECT "projectId",seq FROM ai_event WHERE NOT published ORDER BY "projectId",seq LIMIT 100`);
  for (const event of pending) {
    await publish(event.projectId,event.seq,undefined);
    await db.query(`UPDATE ai_event SET published=true WHERE "projectId"=$1 AND seq=$2`,[event.projectId,event.seq]);
  }
  const runs = await db.query(`SELECT id FROM ai_run WHERE NOT started AND status='running' ORDER BY "createdAt" LIMIT 20`);
  for (const run of runs) {
    try {
      await client.workflow.start("aiChatRun",{ workflowId: `ai-chat:${run.id}`, taskQueue: "plasmic-ai", args: [run.id] });
    } catch (error) {
      if (!(error instanceof WorkflowExecutionAlreadyStartedError)) { throw error; }
    }
    await db.query(`UPDATE ai_run SET started=true WHERE id=$1`,[run.id]);
  }
}

export async function reconcileClosedAiWorkflows(client: Client) {
  const runs = await getConnection().query(`SELECT id FROM ai_run WHERE started AND status='running'`);
  for (const run of runs) {
    const description = await client.workflow.getHandle(`ai-chat:${run.id}`).describe();
    if (description.status.name !== "RUNNING") {
      const [uncertain] = await getConnection().query(`SELECT id FROM ai_tool_call WHERE "runId"=$1 AND (call->>'uncertain'='true' OR call->>'status'='executing') LIMIT 1`,[run.id]);
      await patchTask(run.id,{status:"failed",phase:"Failed",error:"AI workflow interrupted. Saved content and completed changes are retained.",needsReconciliation:!!uncertain});
    }
  }
}

export async function startAiWorker() {
  await ensureDbConnections(loadConfig().databaseUri);
  const address = process.env.TEMPORAL_ADDRESS ?? "localhost:7233";
  const namespace = process.env.TEMPORAL_NAMESPACE ?? "default";
  const connection = await NativeConnection.connect({ address });
  const clientConnection = await Connection.connect({ address });
  const client = new Client({ connection: clientConnection, namespace });
  const worker = await Worker.create({ connection, namespace, taskQueue: "plasmic-ai", workflowsPath: require.resolve("./ai-workflow"), activities });
  let stopped = false;
  const shutdown = () => { stopped = true; worker.shutdown(); };
  process.once("SIGTERM",shutdown); process.once("SIGINT",shutdown);
  const publisher = (async () => {
    let nextAudit = 0;
    while (!stopped) {
      try {
        await dispatchAiOutbox(client,async (projectId,seq) => {
          const response = await fetch(`${process.env.SOCKET_HOST ?? "http://localhost:3004"}/api/v1/projects/broadcast`,{ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ room: `projects/${projectId}`, type: "aiChat", message: { projectId,seq } }), signal: AbortSignal.timeout(5000) });
          if (!response.ok) { throw new Error(`AI publication failed (${response.status})`); }
        });
      } catch (error) { console.error("AI outbox delivery failed",error instanceof Error ? error.name : "Unknown error"); }
      if (Date.now() >= nextAudit) {
        nextAudit = Date.now()+30000;
        try { await reconcileClosedAiWorkflows(client); }
        catch (error) { console.error("AI workflow reconciliation failed",error instanceof Error ? error.name : "Unknown error"); }
      }
      await new Promise((resolve) => setTimeout(resolve,500));
    }
  })();
  try { await worker.run(); }
  finally { stopped = true; await publisher; await clientConnection.close(); await connection.close(); await closeDbConnections(); }
}
if (require.main === module) { void startAiWorker().catch(async (error) => { console.error(error); await closeDbConnections(); process.exitCode = 1; }); }
