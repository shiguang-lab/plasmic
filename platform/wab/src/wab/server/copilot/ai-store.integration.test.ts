import {
  attachmentContent,
  attachmentRow,
  chatStorage,
  claimTool,
  createRun,
  events,
  getRun,
  heartbeatTool,
  history,
  patchTask,
  receipt,
  reconcileRun,
  toolCall,
} from "@/wab/server/copilot/ai-store";
import { AiChat1791849600000 } from "@/wab/server/migrations/1791849600000-AiChat";
import { AiEventParts1791849600001 } from "@/wab/server/migrations/1791849600001-AiEventParts";
import { ensure } from "@/wab/shared/common";
import type { AiSend } from "@/wab/shared/copilot/ai-chat";
import { applyAiEvent } from "@/wab/shared/copilot/ai-chat";
import { CreateBucketCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { Connection, createConnection, getConnection } from "typeorm";

describe.skipIf(!process.env.AI_CHAT_INTEGRATION_DB)(
  "AI chat with real PostgreSQL and private S3",
  () => {
    let connection: Connection;
    const request = (): AiSend => ({
      clientRequestId: randomUUID(),
      prompt: "Local integration test",
      binding: {
        projectId: "ai-test",
        sessionId: "editor-one",
        branchId: null,
        changeCounter: 0,
        componentUuid: "page",
        elementUuids: ["node"],
      },
      context: "{}",
      attachments: [],
    });
    beforeAll(async () => {
      const database = new URL(
        ensure(process.env.AI_CHAT_INTEGRATION_DB, "Test database is required"),
      );
      if (
        !["localhost", "127.0.0.1", "[::1]"].includes(database.hostname) ||
        database.pathname !== "/wab_ai_test"
      ) {
        throw new Error(
          "AI integration tests reset only the local wab_ai_test database",
        );
      }
      connection = await createConnection({
        type: "postgres",
        url: process.env.AI_CHAT_INTEGRATION_DB,
        entities: [],
      });
      await connection.query(
        `DROP SCHEMA public CASCADE; CREATE SCHEMA public; CREATE TABLE project(id text PRIMARY KEY); INSERT INTO project VALUES('ai-test'),('other-project'); CREATE TABLE project_revision(id text PRIMARY KEY,"projectId" text,"branchId" text,revision integer); INSERT INTO project_revision VALUES('revision-one','ai-test',NULL,1)`,
      );
      const runner = connection.createQueryRunner();
      await new AiChat1791849600000().up(runner);
      await new AiEventParts1791849600001().up(runner);
      await runner.release();
      const s3 = chatStorage();
      try {
        await s3.send(
          new CreateBucketCommand({ Bucket: process.env.AI_CHAT_BUCKET }),
        );
      } catch (error) {
        if (
          !(error instanceof Error) ||
          !["BucketAlreadyOwnedByYou", "BucketAlreadyExists"].includes(
            error.name,
          )
        ) {
          throw error;
        }
      } finally {
        s3.destroy();
      }
    }, 30000);
    afterAll(async () => {
      if (connection?.isConnected) {
        await connection.close();
      }
    });
    beforeEach(async () => {
      await getConnection().query(`TRUNCATE ai_conversation CASCADE`);
    });
    it("creates messages, placeholder and run once even for simultaneous duplicate submissions", async () => {
      const send = request();
      const [one, two] = await Promise.all([
        createRun("ai-test", "owner", send),
        createRun("ai-test", "owner", send),
      ]);
      expect(one.id).toBe(two.id);
      expect(
        await getConnection().query(`SELECT * FROM ai_message`),
      ).toHaveLength(2);
      expect((await events("ai-test", 0)).map((e) => e.seq)).toEqual([1]);
      await expect(createRun("ai-test", "owner", request())).rejects.toThrow(
        "Another AI run",
      );
    });
    it("persists file references, checksum and content without base64 in messages or request", async () => {
      const run = await createRun("ai-test", "owner", {
        ...request(),
        attachments: [
          { type: "text", name: "spec.md", text: "# integration document" },
        ],
      });
      const file = run.files[0];
      const read = await attachmentContent("ai-test", file.id);
      expect(read.content.toString()).toBe("# integration document");
      expect(file.sha256).toHaveLength(64);
      expect(JSON.stringify(await getRun(run.id))).not.toContain(
        "# integration document",
      );
      await expect(attachmentRow("other-project", file.id)).rejects.toThrow(
        "not accessible",
      );
    });
    it("allocates continuous committed sequence across concurrent writers and database reconnect", async () => {
      const run = await createRun("ai-test", "owner", request());
      await Promise.all(
        Array.from({ length: 10 }, (_, index) =>
          patchTask(run.id, { phase: `phase ${index}` }),
        ),
      );
      const before = await history("ai-test");
      expect(before.seq).toBe(11);
      expect((await events("ai-test", 0)).map((e) => e.seq)).toEqual(
        Array.from({ length: 11 }, (_, i) => i + 1),
      );
      await connection.close();
      connection = await createConnection({
        type: "postgres",
        url: process.env.AI_CHAT_INTEGRATION_DB,
        entities: [],
      });
      expect((await history("ai-test")).tasks).toEqual(before.tasks);
      await patchTask(run.id, { status: "completed", phase: "Completed" });
      expect((await getRun(run.id)).status).toBe("completed");
      expect((await events("ai-test", 11))[0].update?.fields.status).toBe(
        "completed",
      );
    });
    it("allows only the initiating editor epoch and fences receipts; ACK replay cannot duplicate changes", async () => {
      const run = await createRun("ai-test", "owner", request());
      const operation = `${run.id}:0`;
      await toolCall(run.id, operation, "changeElement", { text: "new" });
      expect(
        await claimTool("ai-test", "collaborator", "editor-one"),
      ).toBeUndefined();
      const first = await claimTool("ai-test", "owner", "editor-one");
      expect(first?.fence).toBe(1);
      expect(
        await claimTool("ai-test", "owner", "another-tab"),
      ).toBeUndefined();
      const ack = {
        sessionId: "editor-one",
        fence: 1,
        result: {
          binding: { ...run.binding, changeCounter: 1 },
          changed: true,
          result: "{}",
          before: "old",
          after: "new",
        },
      };
      await expect(
        receipt("ai-test", "owner", operation, { ...ack, fence: 2 }),
      ).rejects.toThrow("lease");
      await receipt("ai-test", "owner", operation, ack);
      await receipt("ai-test", "owner", operation, ack);
      expect((await getRun(run.id)).task.records).toHaveLength(1);
      expect(await claimTool("ai-test", "owner", "editor-one")).toBeUndefined();
    });
    it("persists operation facts and resolves only explicitly linked retry chains", async () => {
      const run = await createRun("ai-test", "owner", {
        ...request(),
        context: '{"componentName":"StandardListPage"}',
      });
      const failed = `${run.id}:0`,
        unlinked = `${run.id}:1`,
        retry = `${run.id}:2`,
        recovered = `${run.id}:3`;
      const fail = async (id: string) => {
        await claimTool("ai-test", "owner", "editor-one");
        await receipt("ai-test", "owner", id, {
          sessionId: "editor-one",
          fence: 1,
          error: '[{"code":"unrecognized_keys","message":"Unexpected reason"}]',
        });
      };
      const succeed = async (id: string) => {
        await claimTool("ai-test", "owner", "editor-one");
        await receipt("ai-test", "owner", id, {
          sessionId: "editor-one",
          fence: 1,
          result: { binding: run.binding, changed: false, result: "{}" },
        });
      };
      await toolCall(run.id, failed, "read", { componentUuids: ["page"] });
      await fail(failed);
      await toolCall(run.id, unlinked, "read", {});
      await succeed(unlinked);
      expect((await getRun(run.id)).task.operations[0]).toMatchObject({
        title: "Read page structure",
        target: "StandardListPage",
        errorSummary: "Tool arguments were rejected.",
      });
      expect(
        (await getRun(run.id)).task.operations[0].recoveredBy,
      ).toBeUndefined();
      await expect(
        toolCall(run.id, "bad-retry", "validate", {}, failed),
      ).rejects.toThrow("same tool");
      await toolCall(run.id, retry, "read", {}, failed);
      await fail(retry);
      await toolCall(run.id, recovered, "read", {}, retry);
      await succeed(recovered);
      const restored = (await getRun(run.id)).task;
      expect(restored.operations[0].recoveredBy).toBe(recovered);
      expect(restored.operations[2]).toMatchObject({
        retryOf: failed,
        recoveredBy: recovered,
      });
      const chain = await events("ai-test", 0);
      const replay = chain.reduce(
        (current, event) => applyAiEvent(current, event),
        undefined as typeof restored | undefined,
      );
      expect(replay?.operations).toEqual(restored.operations);
    });
    it("keeps a different editor session as an observer without rebinding the old scope", async () => {
      const run = await createRun("ai-test", "owner", request());
      await toolCall(run.id, `${run.id}:0`, "read", {});
      expect(
        await claimTool("ai-test", "owner", "refreshed-session"),
      ).toBeUndefined();
      expect((await getRun(run.id)).status).toBe("running");
      expect((await getRun(run.id)).task.binding.sessionId).toBe("editor-one");
    });
    it("commits receipts with the containing save transaction and rolls them back on save failure", async () => {
      const run = await createRun("ai-test", "owner", request());
      const op = `${run.id}:0`;
      await toolCall(run.id, op, "changeElement", {});
      await claimTool("ai-test", "owner", "editor-one");
      const ack = {
        sessionId: "editor-one",
        fence: 1,
        result: {
          binding: { ...run.binding, changeCounter: 1 },
          changed: true,
          result: "{}",
        },
      };
      await expect(
        getConnection().transaction(async (db) => {
          await receipt("ai-test", "owner", op, ack, db);
          throw new Error("Save failed");
        }),
      ).rejects.toThrow("Save failed");
      expect((await getRun(run.id)).task.records).toHaveLength(0);
      await getConnection().transaction((db) =>
        receipt("ai-test", "owner", op, ack, db),
      );
      expect((await getRun(run.id)).task.records).toHaveLength(1);
    });
    it("retains content after stop and keeps committed events available for reliable publication retry", async () => {
      const run = await createRun("ai-test", "owner", request());
      await patchTask(run.id, {
        messages: ["partial"],
        parts: [{ type: "markdown", channel: "commentary", text: "partial" }],
      });
      await patchTask(run.id, { status: "stopped", phase: "Stopped" });
      await patchTask(run.id, { status: "completed", phase: "Completed" });
      const restored = await getRun(run.id);
      expect(restored.status).toBe("stopped");
      expect(restored.task.messages).toEqual(["partial"]);
      const unpublished = await getConnection().query(
        `SELECT seq FROM ai_event WHERE NOT published ORDER BY seq`,
      );
      expect(unpublished.map((r) => r.seq)).toEqual([1, 2, 3]);
    });
    it("pages the latest history without dropping rows with identical timestamps", async () => {
      for (let i = 0; i < 35; i++) {
        const run = await createRun("ai-test", "owner", request());
        await patchTask(run.id, { status: "completed", phase: "Completed" });
      }
      await getConnection().query(
        `UPDATE ai_run SET "createdAt"='2026-10-13T00:00:00Z'`,
      );
      const first = await history("ai-test");
      const second = await history("ai-test", first.before);
      expect(first.tasks).toHaveLength(30);
      expect(second.tasks).toHaveLength(5);
      expect(
        new Set([...first.tasks, ...second.tasks].map((task) => task.id)).size,
      ).toBe(35);
    });
    it("stores real image previews privately and rejects a mismatched binary format", async () => {
      const image = await sharp({
        create: { width: 500, height: 400, channels: 3, background: "blue" },
      })
        .png()
        .toBuffer();
      const run = await createRun("ai-test", "owner", {
        ...request(),
        attachments: [
          {
            type: "file",
            name: "image.png",
            mediaType: "image/png",
            data: image.toString("base64"),
          },
        ],
      });
      const preview = await attachmentContent("ai-test", run.files[0].id, true);
      const dimensions = await sharp(preview.content).metadata();
      expect(dimensions.width).toBe(256);
      expect(dimensions.height).toBe(205);
      const row = await attachmentRow("ai-test", run.files[0].id);
      const anonymous = await fetch(
        `${process.env.S3_ENDPOINT}/${process.env.AI_CHAT_BUCKET}/${row.objectKey}`,
      );
      expect(anonymous.status).toBe(403);
      await patchTask(run.id, { status: "completed", phase: "Completed" });
      await expect(
        createRun("ai-test", "owner", {
          ...request(),
          attachments: [
            {
              type: "file",
              name: "fake.pdf",
              mediaType: "application/pdf",
              data: image.toString("base64"),
            },
          ],
        }),
      ).rejects.toThrow("does not match");
    });
    it("requires explicit saved-version verification for an uncertain modification and fences late receipts", async () => {
      const run = await createRun("ai-test", "owner", request());
      const operation = `${run.id}:0`;
      await toolCall(run.id, operation, "changeElement", {});
      await claimTool("ai-test", "owner", "editor-one");
      await receipt("ai-test", "owner", operation, {
        sessionId: "editor-one",
        fence: 1,
        error: "Save result unknown",
        uncertain: true,
      });
      await patchTask(run.id, { status: "failed", phase: "Failed" });
      await expect(createRun("ai-test", "owner", request())).rejects.toThrow(
        "reconcile",
      );
      await expect(
        heartbeatTool("ai-test", "collaborator", operation, {
          sessionId: "editor-one",
          fence: 1,
        }),
      ).rejects.toThrow("lease");
      await getConnection().query(
        `UPDATE ai_tool_call SET "claimedAt"=now()-interval '2 minutes' WHERE id=$1`,
        [operation],
      );
      const reopened = {
        ...run.binding,
        sessionId: "reopened-editor",
        changeCounter: 0,
      };
      await expect(
        reconcileRun("ai-test", "owner", run.id, reopened, 2),
      ).rejects.toThrow("Saved design changed");
      await reconcileRun("ai-test", "owner", run.id, reopened, 1);
      await expect(
        receipt("ai-test", "owner", operation, {
          sessionId: "editor-one",
          fence: 1,
          error: "Late result",
        }),
      ).rejects.toThrow("lease");
      expect((await getRun(run.id)).task.needsReconciliation).toBe(false);
      expect((await createRun("ai-test", "owner", request())).status).toBe(
        "running",
      );
    });
    it("reconstructs the exact read model from small ordered deltas and rejects a missing base", async () => {
      const run = await createRun("ai-test", "owner", request());
      const text = "Streaming content ".repeat(1000);
      await patchTask(run.id, {
        parts: [{ type: "markdown", channel: "commentary", text }],
        messages: [text],
      });
      await patchTask(run.id, {
        parts: [
          { type: "markdown", channel: "commentary", text: text + "final" },
        ],
        messages: [text + "final"],
      });
      await patchTask(run.id, { status: "completed", phase: "Completed" });
      const chain = await events("ai-test", 0);
      let task;
      for (const event of chain) {
        task = applyAiEvent(task, event);
      }
      expect(task).toEqual((await getRun(run.id)).task);
      expect(JSON.stringify(chain[2]).length).toBeLessThan(1000);
      expect(applyAiEvent(undefined, chain[2])).toBeUndefined();
      expect(applyAiEvent(task, chain[1])).toEqual(task);
    });
    it("replays reasoning deltas and explicit answer completion metadata", async () => {
      const run = await createRun("ai-test", "owner", request());
      await patchTask(run.id, {
        parts: [
          { type: "reasoning", step: 0, text: "Inspecting", complete: false },
        ],
      });
      await patchTask(run.id, {
        parts: [
          {
            type: "reasoning",
            step: 0,
            text: "Inspecting results",
            complete: true,
          },
          {
            type: "markdown",
            channel: "answer",
            step: 0,
            text: "Result",
            complete: false,
          },
        ],
      });
      await patchTask(run.id, {
        parts: [
          {
            type: "reasoning",
            step: 0,
            text: "Inspecting results",
            complete: true,
          },
          {
            type: "markdown",
            channel: "answer",
            step: 0,
            text: "Result is saved",
            complete: true,
          },
        ],
      });
      let reconstructed;
      for (const event of await events("ai-test", 0)) {
        reconstructed = applyAiEvent(reconstructed, event);
      }
      expect(reconstructed?.parts).toEqual((await getRun(run.id)).task.parts);
      expect(reconstructed?.parts[1]).toMatchObject({
        channel: "answer",
        text: "Result is saved",
        complete: true,
      });
    });
  },
);
