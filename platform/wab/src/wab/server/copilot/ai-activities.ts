import {
  attachmentContent,
  emitTask,
  getRun,
  lockRun,
  patchTask,
  toolCall,
} from "@/wab/server/copilot/ai-store";
import {
  generateLocalEditStep,
  resolveLocalAiIntent,
} from "@/wab/server/copilot/local-edit";
import type {
  LocalAiAttachment,
  LocalAiStreamPart,
  LocalEditRequest,
  LocalEditResponse,
  LocalEditStep,
} from "@/wab/shared/copilot/local-edit";
import { Context, heartbeat } from "@temporalio/activity";
import { ApplicationFailure } from "@temporalio/common";
import { getConnection } from "typeorm";
import { conversationContext, type ConversationTurn } from "@/wab/server/copilot/ai-conversation-context";

async function readConversation(run: Awaited<ReturnType<typeof getRun>>): Promise<ConversationTurn[]> {
  return getConnection().query(
    `SELECT id,task->>'prompt' AS prompt,task->'messages'->>-1 AS answer,status,task->'files' AS files,
      (SELECT jsonb_agg(jsonb_build_object('name',record->>'name','undone',record->'undone')) FROM jsonb_array_elements(task->'records') record) AS changes
      FROM ai_run WHERE "projectId"=$1 AND "threadId"=$2 AND id<>$3 AND ("createdAt",id)<(SELECT "createdAt",id FROM ai_run WHERE id=$3) ORDER BY "createdAt" DESC,id DESC LIMIT 100`,
    [run.projectId, run.task.threadId, run.id],
  );
}

export async function loadRun(id: string) {
  const run = await getRun(id);
  return {
    id: run.id,
    status: run.status,
    needsReconciliation: run.task.needsReconciliation,
    hasChanges: run.task.records.length > 0,
    task: {
      prompt: run.task.prompt,
      model: run.task.model,
      binding: run.task.binding,
      intent: run.task.intent,
    },
  };
}
export async function runState(id: string) {
  const run = await getRun(id);
  return {
    status: run.status,
    needsReconciliation: run.task.needsReconciliation,
  };
}
export async function setRun(
  id: string,
  patch: Parameters<typeof patchTask>[1],
) {
  await patchTask(id, patch);
}
export async function chooseIntent(id: string) {
  const run = await getRun(id);
  if (run.request.target && run.request.target !== "auto") {
    return { mode: "page" as const, ...run.request.target };
  }
  const timer = setInterval(() => heartbeat(), 1000);
  try {
    const result = await resolveLocalAiIntent(
      {
        prompt: run.task.prompt,
        hasCurrentPage:
          !!run.task.binding.componentUuid ||
          run.task.binding.canvasName !== undefined,
        model: run.task.model,
        allowPageCreation: run.request.target === "auto",
        conversation: conversationContext(await readConversation(run)),
      },
      Context.current().cancellationSignal,
    );
    return result.mode === "page" && run.request.target !== "auto" ? { mode: "discuss" as const } : result;
  } catch {
    throw ApplicationFailure.nonRetryable(
      "AI intent request failed. Start a new request.",
    );
  } finally {
    clearInterval(timer);
  }
}
export async function requestTool(
  id: string,
  operation: string,
  name: string,
  input: Record<string, unknown>,
  retryOf?: string,
) {
  await toolCall(id, operation, name, input, retryOf);
}
export async function readTool(id: string, includeResult: boolean) {
  const [row] = await getConnection().query(
    `SELECT call,"claimedAt" FROM ai_tool_call WHERE id=$1`,
    [id],
  );
  if (
    row?.call.status === "executing" &&
    Date.now() - new Date(row.claimedAt).getTime() > 60000
  ) {
    await patchTask(row.call.runId, { needsReconciliation: true });
    throw ApplicationFailure.nonRetryable(
      "Editor execution lost its lease. Verify saved changes before a new request.",
    );
  }
  if (!row) {
    return undefined;
  }
  const output = includeResult ? row.call.result : undefined;
  return {
    status: row.call.status as string,
    error: row.call.error as string | undefined,
    result: output
      ? {
          result: output.result as string,
          binding: output.binding as LocalEditRequest["binding"],
          changed: output.changed as boolean,
        }
      : undefined,
  };
}
export async function modelStep(
  id: string,
  step: number,
  resources: string[],
  channel: "commentary" | "answer",
): Promise<LocalEditResponse> {
  const cached = await getConnection().transaction(async (db) => {
    const run = await lockRun(id, db);
    if (run.status !== "running") {
      throw ApplicationFailure.nonRetryable("Run stopped");
    }
    const [existing] = await db.query(
      `SELECT response FROM ai_model_step WHERE "runId"=$1 AND step=$2`,
      [id, step],
    );
    if (existing) {
      if (existing.response) {
        return existing.response as LocalEditResponse;
      }
      throw ApplicationFailure.nonRetryable(
        "Model stream interrupted. Partial output is retained; start a new request.",
      );
    }
    await db.query(`INSERT INTO ai_model_step("runId",step) VALUES($1,$2)`, [
      id,
      step,
    ]);
    return undefined;
  });
  if (cached) {
    return cached;
  }
  const run = await getRun(id);
  const documents = await getConnection().query(
    `SELECT call->>'name' AS name,call->'result'->>'result' AS content FROM ai_tool_call WHERE "runId"=$1 AND id=ANY($2::text[]) AND call->>'status'='completed' ORDER BY id`,
    [id, resources],
  );
  const observed = documents.find(
    (document) => document.name === "getEditorContext",
  );
  const currentContext = observed ? JSON.parse(observed.content) : undefined;
  const editorContext =
    run.task.binding.mode === "page"
      ? currentContext?.componentUuid === run.task.binding.componentUuid
        ? currentContext
        : null
      : JSON.parse(run.request.context);
  const turns = await getConnection().query(
    `SELECT response FROM ai_model_step WHERE "runId"=$1 AND step<$2 AND response IS NOT NULL ORDER BY step`,
    [id, step],
  );
  const allHistory = turns.map((turn) => ({
    ...turn.response,
    results: turn.response.results ?? [],
  })) as LocalEditStep[];
  const history = allHistory.slice(-6);
  const summary = allHistory.slice(0, -6).map((turn) => ({
    text: turn.text.slice(-1000),
    tools: turn.calls.map((call) => ({ id: call.id, name: call.name })),
  }));
  let request: Omit<LocalEditRequest, "attachments"> = {
    binding: run.task.binding,
    prompt: run.task.prompt,
    model: run.task.model,
    intent: run.task.intent,
    resources: `${documents
      .filter((document) => document.name !== "getEditorContext")
      .map((document) => document.content)
      .join(
        "\n",
      )}\nEditor context for the bound page/canvas (selection is context):\n${JSON.stringify(editorContext)}\nEarlier recorded steps (summary only):\n${JSON.stringify(summary)}`,
    history,
  };
  const recent = await readConversation(run);
  const conversation = conversationContext(recent);
  request = {
    ...request,
    resources: `${request.resources}\nConversation history (context only; latest user corrections take precedence; historical IDs require live verification):\n${conversation}`,
  };
  const attachments: LocalAiAttachment[] = [];
  const contextFiles = run.task.files.length ? run.task.files : recent.find(turn => turn.files?.length)?.files ?? [];
  for (const file of contextFiles) {
    const { metadata, content } = await attachmentContent(
      run.projectId,
      file.id,
    );
    attachments.push(
      metadata.mediaType.startsWith("text/")
        ? { type: "text", name: metadata.name, text: content.toString("utf8") }
        : {
            type: "file",
            name: metadata.name,
            mediaType: metadata.mediaType as
              "application/pdf" | "image/png" | "image/jpeg" | "image/webp",
            data: content.toString("base64"),
          },
    );
  }
  const controller = new AbortController();
  let checking = false;
  const timer = setInterval(() => {
    heartbeat();
    if (!checking) {
      checking = true;
      void getRun(id)
        .then((r) => {
          if (r.status !== "running") {
            controller.abort();
          }
        })
        .catch(() => {
          controller.abort();
        })
        .finally(() => {
          checking = false;
        });
    }
  }, 1000);
  let buffer: LocalAiStreamPart | undefined;
  let lastFlush = Date.now();
  const flush = async () => {
    if (!buffer) {
      return;
    }
    const update = buffer;
    buffer = undefined;
    await getConnection().transaction(async (db) => {
      const current = await lockRun(id, db);
      const part = current.task.parts.at(-1);
      if (
        part?.type === update.type &&
        part.step === step &&
        (part.type === "reasoning" || part.channel === channel)
      ) {
        part.text += update.text;
        part.complete = update.complete;
      } else if (update.text) {
        current.task.parts.push(
          update.type === "reasoning"
            ? {
                type: "reasoning",
                step,
                text: update.text,
                complete: update.complete,
              }
            : {
                type: "markdown",
                channel,
                step,
                text: update.text,
                complete: update.complete,
              },
        );
      }
      current.task.messages = current.task.parts
        .filter((p) => p.type === "markdown")
        .map((p) => p.text);
      await emitTask(db, current.task);
    });
    lastFlush = Date.now();
  };
  try {
    const response = await generateLocalEditStep(
      { ...request, attachments },
      channel,
      AbortSignal.any([
        controller.signal,
        Context.current().cancellationSignal,
      ]),
      async (part) => {
        if (buffer && (buffer.type !== part.type || buffer.complete)) {
          await flush();
        }
        buffer = { ...part, text: (buffer?.text ?? "") + part.text };
        if (
          part.complete ||
          Date.now() - lastFlush >= 100 ||
          buffer.text.length >= 2000
        ) {
          await flush();
        }
      },
    );
    await flush();
    await getConnection().query(
      `UPDATE ai_model_step SET response=$3 WHERE "runId"=$1 AND step=$2`,
      [id, step, response],
    );
    return response;
  } catch {
    throw ApplicationFailure.nonRetryable(
      "AI model stream failed. Partial output is retained; start a new request.",
    );
  } finally {
    clearInterval(timer);
    await flush();
  }
}

export async function recordModelResult(
  id: string,
  step: number,
  callId: string,
  operationId?: string,
  error?: string,
) {
  await getConnection().transaction(async (db) => {
    const [row] = await db.query(
      `SELECT response FROM ai_model_step WHERE "runId"=$1 AND step=$2 FOR UPDATE`,
      [id, step],
    );
    if (!row?.response) {
      throw new Error("Recorded model response is missing");
    }
    const response = row.response as LocalEditStep;
    response.results ??= [];
    if (response.results.some((result) => result.id === callId)) {
      return;
    }
    let output: string;
    if (operationId) {
      const [operation] = await db.query(
        `SELECT call FROM ai_tool_call WHERE id=$1 AND "runId"=$2`,
        [operationId, id],
      );
      if (operation?.call.status !== "completed" || !operation.call.result) {
        throw new Error("Committed tool result is missing");
      }
      output = operation.call.result.result;
    } else {
      output = JSON.stringify({ error });
    }
    response.results.push({ id: callId, output });
    await db.query(
      `UPDATE ai_model_step SET response=$3 WHERE "runId"=$1 AND step=$2`,
      [id, step, response],
    );
  });
}
