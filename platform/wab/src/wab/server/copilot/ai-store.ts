import {
  aiOperationDetails,
  aiOperationError,
} from "@/wab/server/copilot/ai-operation-details";
import { BadRequestError, ForbiddenError } from "@/wab/shared/ApiErrors/errors";
import { ensure } from "@/wab/shared/common";
import type {
  AiAttachment,
  AiEvent,
  AiEventPayload,
  AiEventUpdate,
  AiMessagePart,
  AiSend,
  AiTask,
  AiToolCall,
} from "@/wab/shared/copilot/ai-chat";
import { aiContextMetadataSchema } from "@/wab/shared/copilot/ai-chat";
import type { LocalEditToolResult } from "@/wab/shared/copilot/local-edit";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { fromBuffer } from "file-type";
import { isEqual } from "lodash";
import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { EntityManager, getConnection } from "typeorm";

export function chatStorage() {
  return new S3Client({
    region: process.env.AWS_REGION ?? "us-east-1",
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true,
  });
}
export function chatBucket() {
  return ensure(process.env.AI_CHAT_BUCKET, "AI_CHAT_BUCKET is required");
}
export async function getRun(id: string, db = getConnection().manager) {
  const [row] = await db.query(`SELECT * FROM ai_run WHERE id=$1`, [id]);
  return ensure(row, "AI run does not exist") as {
    id: string;
    projectId: string;
    authorId: string;
    request: Omit<AiSend, "attachments">;
    task: AiTask;
    status: string;
  };
}
export async function lockRun(id: string, db: EntityManager) {
  // All writers acquire the conversation lock before the run lock. Sequence
  // allocation and the read model are committed with the event and outbox.
  const row = await getRun(id, db);
  await db.query(
    `SELECT seq FROM ai_conversation WHERE "projectId"=$1 FOR UPDATE`,
    [row.projectId],
  );
  await db.query(`SELECT id FROM ai_run WHERE id=$1 FOR UPDATE`, [id]);
  return getRun(id, db);
}
export async function emitTask(db: EntityManager, task: AiTask) {
  const row = await getRun(task.id, db);
  const [{ seq }] = await db.query(
    `WITH next AS (UPDATE ai_conversation SET seq=seq+1 WHERE "projectId"=$1 RETURNING seq) SELECT seq FROM next`,
    [row.projectId],
  );
  task.seq = seq;
  await db.query(`UPDATE ai_run SET task=$2,status=$3 WHERE id=$1`, [
    task.id,
    task,
    task.status,
  ]);
  await db.query(
    `UPDATE ai_message SET parts=$2 WHERE "runId"=$1 AND role='assistant'`,
    [task.id, JSON.stringify(task.parts)],
  );
  let payload: AiEventPayload;
  const previous = row.task;
  if (previous.seq === undefined) {
    payload = { runId: task.id, task };
  } else {
    const fields = Object.fromEntries(
      (
        [
          "status",
          "phase",
          "error",
          "binding",
          "savedRevision",
          "scopeLabel",
          "needsReconciliation",
        ] as const
      )
        .filter(
          (key) => JSON.stringify(task[key]) !== JSON.stringify(previous[key]),
        )
        .map((key) => [key, task[key]]),
    ) as AiEventUpdate["fields"];
    const update: AiEventUpdate = {
      baseSeq: previous.seq,
      fields,
      appendParts: task.parts.slice(previous.parts.length),
      textDeltas: [],
      replaceParts: [],
      appendRecords: task.records.filter(
        (record) => !previous.records.some((old) => old.id === record.id),
      ),
      replaceRecords: task.records.filter((record) => {
        const old = previous.records.find(
          (candidate) => candidate.id === record.id,
        );
        return old && JSON.stringify(old) !== JSON.stringify(record);
      }),
      operations: task.operations.filter(
        (operation) =>
          JSON.stringify(
            previous.operations.find((old) => old.id === operation.id),
          ) !== JSON.stringify(operation),
      ),
    };
    for (let index = 0; index < previous.parts.length; index++) {
      const old = previous.parts[index];
      const part = task.parts[index];
      if (
        (old.type === "markdown" || old.type === "reasoning") &&
        part.type === old.type &&
        part.text.startsWith(old.text) &&
        isEqual({ ...old, text: "" }, { ...part, text: "" })
      ) {
        const text = part.text.slice(old.text.length);
        if (text) {
          update.textDeltas.push({ index, text });
        }
      } else if (JSON.stringify(old) !== JSON.stringify(part)) {
        update.replaceParts.push({ index, part });
      }
    }
    payload = { runId: task.id, update };
  }
  await db.query(
    `INSERT INTO ai_event("projectId",seq,payload) VALUES($1,$2,$3)`,
    [row.projectId, seq, payload],
  );
}
export async function patchTask(id: string, patch: Partial<AiTask>) {
  return getConnection().transaction(async (db) => {
    const row = await lockRun(id, db);
    if (row.status !== "running") {
      return row.task;
    }
    Object.assign(row.task, patch);
    if (patch.status && patch.status !== "running") {
      row.task.parts.push({
        type: "result",
        status: patch.status,
        text: patch.error ?? row.task.phase,
      });
    }
    await emitTask(db, row.task);
    return row.task;
  });
}
export async function createRun(
  projectId: string,
  authorId: string,
  request: AiSend,
  authorName = authorId,
) {
  const existing = await getConnection().query(
    `SELECT task FROM ai_run WHERE "projectId"=$1 AND "authorId"=$2 AND "clientRequestId"=$3`,
    [projectId, authorId, request.clientRequestId],
  );
  if (existing.length) {
    return existing[0].task as AiTask;
  }
  const id = randomUUID();
  const files: (AiAttachment & { objectKey: string })[] = [];
  const s3 = chatStorage();
  const uploadedKeys: string[] = [];
  const cleanup = async (keys: string[]) => {
    const client = chatStorage();
    try {
      await Promise.all(
        keys.map((Key) =>
          client.send(new DeleteObjectCommand({ Bucket: chatBucket(), Key })),
        ),
      );
    } finally {
      client.destroy();
    }
  };
  try {
    for (const attachment of request.attachments) {
      const content =
        attachment.type === "text"
          ? Buffer.from(attachment.text)
          : Buffer.from(attachment.data, "base64");
      if (
        attachment.type === "file" &&
        (await fromBuffer(content))?.mime !== attachment.mediaType
      ) {
        throw new BadRequestError(
          "Attachment content does not match its supported file type.",
        );
      }
      const file = {
        id: randomUUID(),
        name: attachment.name,
        mediaType:
          attachment.type === "text"
            ? attachment.name.endsWith(".md")
              ? "text/markdown"
              : "text/plain"
            : attachment.mediaType,
        size: content.length,
        sha256: createHash("sha256").update(content).digest("hex"),
        objectKey: `${projectId}/${id}/${randomUUID()}`,
      };
      uploadedKeys.push(file.objectKey);
      await s3.send(
        new PutObjectCommand({
          Bucket: chatBucket(),
          Key: file.objectKey,
          Body: content,
          ContentType: file.mediaType,
        }),
      );
      if (file.mediaType.startsWith("image/")) {
        const preview = await sharp(content)
          .resize({
            width: 256,
            height: 256,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp()
          .toBuffer();
        uploadedKeys.push(`${file.objectKey}.preview.webp`);
        await s3.send(
          new PutObjectCommand({
            Bucket: chatBucket(),
            Key: `${file.objectKey}.preview.webp`,
            Body: preview,
            ContentType: "image/webp",
          }),
        );
      }
      files.push(file);
    }
  } catch (error) {
    await cleanup(uploadedKeys);
    throw error;
  } finally {
    s3.destroy();
  }
  try {
    const result = await getConnection().transaction(async (db) => {
      await db.query(
        `INSERT INTO ai_conversation("projectId") VALUES($1) ON CONFLICT DO NOTHING`,
        [projectId],
      );
      await db.query(
        `SELECT seq FROM ai_conversation WHERE "projectId"=$1 FOR UPDATE`,
        [projectId],
      );
      const [duplicate] = await db.query(
        `SELECT task FROM ai_run WHERE "projectId"=$1 AND "authorId"=$2 AND "clientRequestId"=$3`,
        [projectId, authorId, request.clientRequestId],
      );
      if (duplicate) {
        return duplicate.task as AiTask;
      }
      const active = await db.query(
        `SELECT id FROM ai_run WHERE "projectId"=$1 AND status='running'`,
        [projectId],
      );
      if (active.length) {
        throw new BadRequestError("Another AI run is active in this project.");
      }
      const unresolved = await db.query(
        `SELECT t.id FROM ai_tool_call t JOIN ai_run r ON r.id=t."runId" WHERE r."projectId"=$1 AND (t.call->>'uncertain'='true' OR (t.call->>'status'='executing' AND t.call->>'name' NOT IN ('read','queryElements','getEditorContext','selectElement','scrollElementIntoView','navigate','validate','save'))) LIMIT 1`,
        [projectId],
      );
      if (unresolved.length) {
        throw new BadRequestError(
          "Verify saved design to reconcile an unconfirmed editor operation before another request.",
        );
      }
      const references = files.map(
        ({ objectKey: _key, ...metadata }) => metadata,
      );
      const context = aiContextMetadataSchema.parse(
        JSON.parse(request.context),
      );
      const nodes = request.binding.elementUuids.map((uuid) => ({
        uuid,
        name:
          context.path?.find((node) => node.elementUuid === uuid)?.label ??
          uuid,
        page: request.binding.componentUuid,
        branch: request.binding.branchId,
      }));
      const task: AiTask = {
        id,
        authorId,
        authorName,
        nodes,
        designRevision: context.revision,
        scopeLabel: context.componentName ?? undefined,
        createdAt: new Date().toISOString(),
        prompt: request.prompt,
        model: request.model,
        files: references,
        parts: [],
        status: "running",
        phase: "Reading context",
        messages: [],
        records: [],
        operations: [],
        binding: request.binding,
      };
      const { attachments: _attachments, ...storedRequest } = request;
      await db.query(
        `INSERT INTO ai_run(id,"projectId","authorId","clientRequestId",request,task,"createdAt") VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [
          id,
          projectId,
          authorId,
          request.clientRequestId,
          storedRequest,
          task,
          task.createdAt,
        ],
      );
      const userParts: AiMessagePart[] = [
        { type: "markdown", channel: "user", text: request.prompt },
        ...references.map((attachment) => ({
          type: "attachment" as const,
          attachment,
        })),
        ...nodes.map((node) => ({ type: "node" as const, ...node })),
      ];
      await db.query(
        `INSERT INTO ai_message(id,"runId",role,parts) VALUES($1,$2,'user',$3),($4,$2,'assistant','[]')`,
        [`${id}:user`, id, JSON.stringify(userParts), `${id}:assistant`],
      );
      for (const file of files) {
        const { objectKey, ...metadata } = file;
        await db.query(
          `INSERT INTO ai_attachment(id,"runId",metadata,"objectKey") VALUES($1,$2,$3,$4)`,
          [file.id, id, metadata, objectKey],
        );
      }
      await emitTask(db, task);
      return task;
    });
    if (result.id !== id) {
      await cleanup(uploadedKeys);
    }
    return result;
  } catch (error) {
    await cleanup(uploadedKeys);
    throw error;
  }
}
export async function history(projectId: string, before?: string) {
  return getConnection().transaction("REPEATABLE READ", async (db) => {
    const [conversation] = await db.query(
      `SELECT seq FROM ai_conversation WHERE "projectId"=$1`,
      [projectId],
    );
    const rows = await db.query(
      `SELECT task FROM ai_run WHERE "projectId"=$1 AND ($2::uuid IS NULL OR ("createdAt",id)<(SELECT "createdAt",id FROM ai_run WHERE id=$2 AND "projectId"=$1)) ORDER BY "createdAt" DESC,id DESC LIMIT 31`,
      [projectId, before ?? null],
    );
    const page = rows
      .slice(0, 30)
      .reverse()
      .map((row) => row.task as AiTask);
    return {
      tasks: page,
      seq: conversation?.seq ?? 0,
      before: rows.length > 30 ? page[0].id : undefined,
    };
  });
}
export async function events(
  projectId: string,
  after: number,
): Promise<AiEvent[]> {
  const rows = await getConnection().query(
    `SELECT "projectId",seq,payload FROM ai_event WHERE "projectId"=$1 AND seq>$2 ORDER BY seq LIMIT 100`,
    [projectId, after],
  );
  return rows.map((row) => ({
    projectId: row.projectId,
    seq: row.seq,
    ...row.payload,
  }));
}
export async function attachmentRow(projectId: string, id: string) {
  const [row] = await getConnection().query(
    `SELECT a.* FROM ai_attachment a JOIN ai_run r ON r.id=a."runId" WHERE a.id=$1 AND r."projectId"=$2`,
    [id, projectId],
  );
  if (!row) {
    throw new ForbiddenError("Attachment is not accessible.");
  }
  return row as { metadata: AiAttachment; objectKey: string };
}
export async function attachmentContent(
  projectId: string,
  id: string,
  preview = false,
) {
  const row = await attachmentRow(projectId, id);
  const s3 = chatStorage();
  try {
    const thumbnail = preview && row.metadata.mediaType.startsWith("image/");
    const object = await s3.send(
      new GetObjectCommand({
        Bucket: chatBucket(),
        Key: thumbnail ? `${row.objectKey}.preview.webp` : row.objectKey,
      }),
    );
    return {
      metadata: thumbnail
        ? { ...row.metadata, mediaType: "image/webp" }
        : row.metadata,
      content: Buffer.from(
        await ensure(
          object.Body,
          "Attachment object is missing",
        ).transformToByteArray(),
      ),
    };
  } finally {
    s3.destroy();
  }
}
export async function toolCall(
  runId: string,
  id: string,
  name: string,
  input: Record<string, unknown>,
  retryOf?: string,
): Promise<AiToolCall> {
  return getConnection().transaction(async (db) => {
    const row = await lockRun(runId, db);
    const [existing] = await db.query(
      `SELECT call FROM ai_tool_call WHERE id=$1`,
      [id],
    );
    if (existing) {
      return existing.call;
    }
    if (row.status !== "running") {
      throw new Error("Run stopped");
    }
    if (
      retryOf &&
      !row.task.operations.some(
        (operation) =>
          operation.id === retryOf &&
          operation.name === name &&
          operation.status === "failed" &&
          !operation.recoveredBy,
      )
    ) {
      throw new BadRequestError(
        "Retry must reference an unresolved failed call to the same tool.",
      );
    }
    const call: AiToolCall = {
      id,
      runId,
      name,
      input,
      binding: row.task.binding,
      status: "pending",
      fence: 0,
    };
    await db.query(
      `INSERT INTO ai_tool_call(id,"runId",call) VALUES($1,$2,$3)`,
      [id, runId, call],
    );
    row.task.phase = "Waiting for editor";
    row.task.operations.push({
      id,
      name,
      status: "running",
      ...aiOperationDetails(name, input, row.task),
      ...(retryOf ? { retryOf } : {}),
    });
    row.task.parts.push({
      type: "tool",
      operationId: id,
      name,
      status: "pending",
    });
    await emitTask(db, row.task);
    return call;
  });
}
export async function claimTool(
  projectId: string,
  userId: string,
  sessionId: string,
): Promise<AiToolCall | undefined> {
  return getConnection().transaction(async (db) => {
    await db.query(
      `SELECT seq FROM ai_conversation WHERE "projectId"=$1 FOR UPDATE`,
      [projectId],
    );
    const rows = await db.query(
      `SELECT t.id,t.call,t."claimedAt" FROM ai_tool_call t JOIN ai_run r ON r.id=t."runId" WHERE r."projectId"=$1 AND r."authorId"=$2 AND r.status='running' AND t.call->>'status' IN ('pending','executing') ORDER BY t.id LIMIT 1 FOR UPDATE OF t`,
      [projectId, userId],
    );
    if (!rows.length) {
      return;
    }
    const row = rows[0];
    const call = row.call as AiToolCall;
    // Never reassign a dispatched operation. Its effects may have been saved
    // even when the ACK was lost. A new editor epoch requires reconciliation.
    if (call.status === "executing") {
      if (call.sessionId === sessionId) {
        await db.query(
          `UPDATE ai_tool_call SET "claimedAt"=now() WHERE id=$1`,
          [call.id],
        );
        return call;
      }
      return;
    }
    if (call.binding.sessionId !== sessionId) {
      return;
    }
    call.status = "executing";
    call.sessionId = sessionId;
    call.fence++;
    await db.query(
      `UPDATE ai_tool_call SET call=$2,"claimedAt"=now() WHERE id=$1`,
      [call.id, call],
    );
    return call;
  });
}
export async function receipt(
  projectId: string,
  userId: string,
  id: string,
  ack: {
    sessionId: string;
    fence: number;
    result?: LocalEditToolResult;
    error?: string;
    uncertain?: boolean;
  },
  transaction?: EntityManager,
) {
  const write = async (db: EntityManager) => {
    const [ref] = await db.query(
      `SELECT "runId" FROM ai_tool_call WHERE id=$1`,
      [id],
    );
    const run = await lockRun(ensure(ref, "Tool call is missing").runId, db);
    if (run.projectId !== projectId || run.authorId !== userId) {
      throw new ForbiddenError("Only the run initiator can execute tools.");
    }
    const [{ call }] = await db.query(
      `SELECT call FROM ai_tool_call WHERE id=$1 FOR UPDATE`,
      [id],
    );
    const tool = call as AiToolCall;
    if (tool.sessionId !== ack.sessionId || tool.fence !== ack.fence) {
      throw new ForbiddenError("Execution lease is not valid.");
    }
    if (tool.status === "completed" || tool.status === "failed") {
      return tool;
    }
    if (
      ack.result &&
      (ack.result.binding.projectId !== projectId ||
        ack.result.binding.sessionId !== tool.binding.sessionId ||
        ack.result.binding.branchId !== tool.binding.branchId)
    ) {
      throw new BadRequestError("Tool result changed the execution scope.");
    }
    tool.status = ack.error ? "failed" : "completed";
    tool.result = ack.result;
    tool.error = ack.error;
    tool.uncertain = ack.uncertain;
    if (ack.uncertain) {
      run.task.needsReconciliation = true;
    }
    await db.query(`UPDATE ai_tool_call SET call=$2 WHERE id=$1`, [id, tool]);
    if (!ack.uncertain && run.task.needsReconciliation) {
      const unresolved = await db.query(
        `SELECT id FROM ai_tool_call WHERE "runId"=$1 AND (call->>'uncertain'='true' OR call->>'status'='executing') LIMIT 1`,
        [run.id],
      );
      if (!unresolved.length) {
        run.task.needsReconciliation = false;
      }
    }
    const operation = ensure(
      run.task.operations.find((o) => o.id === id),
      "Operation is missing",
    );
    operation.status = tool.status;
    operation.error = tool.error;
    operation.errorSummary = tool.error
      ? aiOperationError(tool.error)
      : undefined;
    if (operation.status === "completed" && operation.retryOf) {
      // A successful explicit retry resolves the whole chain, retaining every attempt.
      let previous = run.task.operations.find(
        (entry) => entry.id === operation.retryOf,
      );
      while (previous) {
        previous.recoveredBy = operation.id;
        previous = previous.retryOf
          ? run.task.operations.find((entry) => entry.id === previous?.retryOf)
          : undefined;
      }
    }
    const part = run.task.parts.find(
      (p) => p.type === "tool" && p.operationId === id,
    );
    if (part?.type === "tool") {
      part.status = tool.status;
    }
    if (ack.result) {
      run.task.binding = ack.result.binding;
      if (tool.name === "getEditorContext") {
        const observed = JSON.parse(ack.result.result) as {
          componentUuid?: string;
          frameUuid?: string;
          sessionId?: string;
          changeCounter?: number;
          branchId?: string | null;
        };
        if (
          observed.componentUuid === tool.binding.componentUuid &&
          observed.sessionId === tool.binding.sessionId &&
          observed.branchId === tool.binding.branchId &&
          observed.changeCounter === tool.binding.changeCounter
        ) {
          run.task.binding = {
            ...run.task.binding,
            frameUuid: observed.frameUuid,
          };
        }
      }
      if (ack.result.changed && tool.name === "undo") {
        const record = ensure(
          run.task.records.find((entry) => entry.id === tool.input.recordId),
          "Undo record is missing",
        );
        record.undone = true;
        const previous = run.task.records
          .filter((entry) => !entry.undone)
          .at(-1);
        if (previous) {
          previous.undoBinding = {
            ...previous.binding,
            changeCounter: ack.result.binding.changeCounter,
          };
        }
        run.task.parts.push({
          type: "result",
          status: "completed",
          text: "Changes undone in the current editor.",
        });
      } else if (ack.result.changed) {
        const before = (ack.result.before ?? "").slice(0, 20000);
        const after = (ack.result.after ?? "").slice(0, 20000);
        run.task.records.push({
          id,
          name: tool.name,
          input: tool.input,
          before,
          after,
          binding: ack.result.binding,
        });
        run.task.parts.push({
          type: "change",
          operationId: id,
          name: tool.name,
        });
      }
      if (tool.name === "save") {
        run.task.savedRevision = JSON.parse(ack.result.result).revision;
      }
    }
    await emitTask(db, run.task);
    return tool;
  };
  return transaction ? write(transaction) : getConnection().transaction(write);
}
export async function prepareUndo(
  projectId: string,
  userId: string,
  runId: string,
  recordId: string,
  clientRequestId: string,
) {
  return getConnection().transaction(async (db) => {
    const run = await lockRun(runId, db);
    if (run.projectId !== projectId || run.authorId !== userId) {
      throw new ForbiddenError(
        "Only the run initiator can undo its current editor changes.",
      );
    }
    const id = `${runId}:undo:${clientRequestId}`;
    const [existing] = await db.query(
      `SELECT call FROM ai_tool_call WHERE id=$1`,
      [id],
    );
    if (existing) {
      return existing.call as AiToolCall;
    }
    const active = await db.query(
      `SELECT id FROM ai_run WHERE "projectId"=$1 AND status='running'`,
      [projectId],
    );
    if (active.length || run.task.needsReconciliation) {
      throw new BadRequestError(
        "Finish or reconcile the active AI operation before undoing.",
      );
    }
    const record = run.task.records.find(
      (entry) => entry.id === recordId && !entry.undone,
    );
    if (!record) {
      throw new BadRequestError("Current editor undo record is not available.");
    }
    const binding = record.undoBinding ?? record.binding;
    const call: AiToolCall = {
      id,
      runId,
      name: "undo",
      input: { recordId },
      binding,
      status: "executing",
      fence: 1,
      sessionId: binding.sessionId,
    };
    await db.query(
      `INSERT INTO ai_tool_call(id,"runId",call,"claimedAt") VALUES($1,$2,$3,now())`,
      [id, runId, call],
    );
    run.task.operations.push({ id, name: "undo", status: "running" });
    run.task.parts.push({
      type: "tool",
      operationId: id,
      name: "undo",
      status: "executing",
    });
    await emitTask(db, run.task);
    return call;
  });
}
export async function reconcileRun(
  projectId: string,
  userId: string,
  id: string,
  binding: AiTask["binding"],
  revision: number,
) {
  return getConnection().transaction(async (db) => {
    const run = await lockRun(id, db);
    if (
      run.projectId !== projectId ||
      run.authorId !== userId ||
      binding.projectId !== projectId ||
      binding.branchId !== run.task.binding.branchId ||
      binding.sessionId === run.task.binding.sessionId ||
      binding.changeCounter !== 0 ||
      run.status === "running"
    ) {
      throw new ForbiddenError(
        "Reopen the saved design in a new editor session before reconciling this run.",
      );
    }
    const [latest] = await db.query(
      `SELECT revision FROM project_revision WHERE "projectId"=$1 AND "branchId" IS NOT DISTINCT FROM $2 ORDER BY revision DESC LIMIT 1`,
      [projectId, binding.branchId],
    );
    if (latest?.revision !== revision) {
      throw new BadRequestError(
        "Saved design changed. Reload and verify the latest revision.",
      );
    }
    const calls = await db.query(
      `SELECT id,call,"claimedAt" FROM ai_tool_call WHERE "runId"=$1 FOR UPDATE`,
      [id],
    );
    for (const row of calls) {
      const call = row.call as AiToolCall;
      if (!call.uncertain && call.status !== "executing") {
        continue;
      }
      if (Date.now() - new Date(row.claimedAt).getTime() < 60000) {
        throw new BadRequestError("The previous editor lease is still active.");
      }
      call.fence++;
      call.status = "failed";
      call.uncertain = false;
      call.error =
        "Saved revision verified. Unconfirmed operation was fenced and was not repeated.";
      await db.query(`UPDATE ai_tool_call SET call=$2 WHERE id=$1`, [
        call.id,
        call,
      ]);
    }
    run.task.needsReconciliation = false;
    run.task.parts.push({
      type: "result",
      status: "verified",
      text: "Saved design verified. Start a new request from the current editor.",
      revision,
    });
    await emitTask(db, run.task);
    return run.task;
  });
}
export async function heartbeatTool(
  projectId: string,
  userId: string,
  id: string,
  lease: { sessionId: string; fence: number },
) {
  await getConnection().transaction(async (db) => {
    const [row] = await db.query(
      `SELECT t.call,r."authorId",r."projectId" FROM ai_tool_call t JOIN ai_run r ON r.id=t."runId" WHERE t.id=$1 FOR UPDATE OF t`,
      [id],
    );
    if (
      !row ||
      row.authorId !== userId ||
      row.projectId !== projectId ||
      row.call.sessionId !== lease.sessionId ||
      row.call.fence !== lease.fence
    ) {
      throw new ForbiddenError("Execution lease is not valid.");
    }
    await db.query(`UPDATE ai_tool_call SET "claimedAt"=now() WHERE id=$1`, [
      id,
    ]);
  });
}
