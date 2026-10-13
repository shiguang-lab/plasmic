import { AiEventCursor, LocalEditSession, aiChatRequest } from "@/wab/client/copilot/local-edit-session";
import type { AiTask, AiEvent } from "@/wab/shared/copilot/ai-chat";
const task: AiTask = { id: "run",authorId: "user",createdAt: "2026-10-13T00:00:00Z",prompt: "hello",files: [],parts: [],status: "running",phase: "Thinking",messages: [],records: [],operations: [],binding: { projectId: "project",sessionId: "session",branchId: null,changeCounter: 0,componentUuid: "page",elementUuids: [] } };
const event = (seq: number): AiEvent => ({ projectId: "project",runId: task.id,seq,task: { ...task,phase: `step ${seq}` } });
it("does not advance across gaps and applies duplicate and out-of-order events exactly once",() => {
  const cursor = new AiEventCursor(); const apply = vi.fn();
  cursor.accept(event(3),apply); cursor.accept(event(2),apply);
  expect(cursor.seq).toBe(0); expect(apply).not.toHaveBeenCalled(); expect(cursor.gap).toBe(true);
  cursor.accept(event(1),apply); cursor.accept(event(2),apply);
  expect(cursor.seq).toBe(3); expect(apply.mock.calls.map(([e]) => e.task.phase)).toEqual(["step 1","step 2","step 3"]); expect(cursor.gap).toBe(false);
});
it("reconciles live events buffered during the history snapshot",() => {
  const cursor = new AiEventCursor(); const apply = vi.fn();
  cursor.accept(event(12),apply); cursor.reset(10); cursor.accept(event(11),apply);
  expect(cursor.seq).toBe(12); expect(apply).toHaveBeenCalledTimes(2);
  cursor.accept(event(10),apply); expect(apply).toHaveBeenCalledTimes(2);
});
it("keeps drafts and model preferences local and notifies subscribers",() => {
  const session = new LocalEditSession("project"); const notify = vi.fn(); const unsubscribe = session.subscribe(notify);
  session.selectedModel = "model"; session.selectedModel = "model";
  expect(notify).toHaveBeenCalledTimes(1);
  session.draft = { prompt: "Draft",attachments: [{ type: "text",name: "spec.md",text: "spec" }] };
  expect(session.draft.prompt).toBe("Draft"); expect(session.tasks).toEqual([]);
  unsubscribe(); session.draft = { prompt: "",attachments: [] }; expect(notify).toHaveBeenCalledTimes(2);
});
it("does not expose native undo for historical operations",() => {
  const session = new LocalEditSession("project");
  expect(session.canUndo({ id: "historical",name: "changeElement",input: {},before: "",after: "",binding: task.binding })).toBe(false);
});
it("discards an earlier-history response after the account changes",async () => {
  const session = new LocalEditSession("project");
  session.userId = "original"; session.before = "cursor";
  const {promise,resolve} = Promise.withResolvers<unknown>();
  vi.stubGlobal("fetch",vi.fn().mockReturnValue(promise));
  try {
    const loading = session.loadEarlier();
    session.userId = "another";
    resolve({ok:true,json:async () => ({tasks:[task],before:"old-cursor"})});
    await loading;
    expect(session.tasks).toEqual([]); expect(session.before).toBeUndefined();
  } finally { vi.unstubAllGlobals(); }
});

it("accepts a failed tool receipt as acknowledged data and does not retry it forever",async () => {
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true,json:async()=>({status:"failed",error:"Tool input rejected"})}));
  try { await expect(aiChatRequest("/receipt",{})).resolves.toEqual({status:"failed",error:"Tool input rejected"}); }
  finally { vi.unstubAllGlobals(); }
});
it("rejects authorization failures using the HTTP status",async () => {
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:false,json:async()=>({error:{message:"Forbidden"}})}));
  try { await expect(aiChatRequest("/receipt",{})).rejects.toThrow("Forbidden"); }
  finally { vi.unstubAllGlobals(); }
});
