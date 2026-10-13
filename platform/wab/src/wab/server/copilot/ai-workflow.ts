import { proxyActivities, sleep } from "@temporalio/workflow";
import type * as activities from "@/wab/server/copilot/ai-activities";
import type { LocalEditToolResult } from "@/wab/shared/copilot/local-edit";

const a = proxyActivities<typeof activities>({ startToCloseTimeout: "5 minutes", retry: { maximumAttempts: 3 } });
const model = proxyActivities<Pick<typeof activities,"modelStep"|"chooseIntent">>({ startToCloseTimeout: "5 minutes", heartbeatTimeout: "30 seconds", retry: { maximumAttempts: 2 } });

export async function aiChatRun(id: string) {
  let operationIndex = 0;
  const started = Date.now();
  const execute = async (name: string, input: Record<string,unknown>, includeResult = false): Promise<{ operationId: string; result?: LocalEditToolResult }> => {
    const operation = `${id}:${operationIndex++}`;
    await a.requestTool(id,operation,name,input);
    for (;;) {
      const run = await a.runState(id);
      if (run.status !== "running") { throw new Error("Run stopped"); }
      if (run.needsReconciliation) { throw new Error("Verify saved design before another request. The editor operation could not be confirmed."); }
      if (Date.now()-started > 30*60*1000) { throw new Error("Editor wait timed out. Completed changes are retained."); }
      const call = await a.readTool(operation,includeResult);
      if (call?.status === "failed") { throw new Error(call.error); }
      if (call?.status === "completed") {
        if (includeResult && !call.result) { throw new Error("Completed tool result is missing"); }
        return { operationId: operation,result: call.result };
      }
      await sleep("1 second");
    }
  };
  try {
    let run = await a.loadRun(id);
    if (run.status !== "running") { return; }
    const page = await model.chooseIntent(id);
    let contextOperation: string | undefined;
    if (page) {
      await a.setRun(id,{ binding: { ...run.task.binding, mode: "page", componentUuid: null, elementUuids: [], frameUuid: null }, phase: "Creating page" });
      const created = await execute("createComponent",{ type: "page", name: page.name, path: page.path },true);
      if (!created.result) { throw new Error("Created page result is missing"); }
      await execute("navigate",{ componentUuid: created.result.binding.componentUuid });
      contextOperation = (await execute("getEditorContext",{})).operationId;
    }
    run = await a.loadRun(id);
    if (!run.task.binding.componentUuid) { throw new Error("Open a page or select an element before editing."); }
    const binding = run.task.binding;
    const initial = await execute("read",binding.elementUuids.length
      ? { elements: binding.elementUuids.map((elementUuid) => ({ componentUuid: binding.componentUuid, elementUuid })) }
      : { componentUuids: [binding.componentUuid] });
    const overview = await execute("read",{});
    const resources = [initial.operationId,overview.operationId,...(contextOperation ? [contextOperation] : [])];
    const completed = new Map<string,{ signature: string; operationId?: string; error?: string }>();
    let rejectedCalls = 0;
    const limit = binding.elementUuids.length ? 12 : 48;
    for (let step = 0; step < limit; step++) {
      run = await a.loadRun(id);
      if (run.status !== "running") { return; }
      await a.setRun(id,{ phase: "Thinking" });
      const response = await model.modelStep(id,step,resources);
      run = await a.loadRun(id);
      if (run.status !== "running") { return; }
      if (!response.calls.length) { break; }
      for (const [index,call] of response.calls.entries()) {
        const signature = JSON.stringify([call.name,call.input]);
        const previous = completed.get(call.id);
        if (previous) {
          if (previous.signature !== signature) { throw new Error("AI reused a tool identity with different arguments."); }
          await a.recordModelResult(id,step,call.id,previous.operationId,previous.error);
          continue;
        }
        try {
          const output = await execute(call.name,call.input);
          completed.set(call.id,{ signature, operationId: output.operationId });
          await a.recordModelResult(id,step,call.id,output.operationId);
        } catch (error) {
          if (completed.get(call.id)?.operationId) { throw error; }
          const current = await a.loadRun(id);
          if (current.needsReconciliation) { throw error; }
          if (++rejectedCalls > 3) { throw error; }
          const message = error instanceof Error ? error.message : "Tool rejected";
          completed.set(call.id,{signature,error:message});
          await a.recordModelResult(id,step,call.id,undefined,message);
          for (const skipped of response.calls.slice(index+1)) { await a.recordModelResult(id,step,skipped.id,undefined,"Skipped after a rejected call. Replan using the actual error and original scope."); }
          break;
        }
      }
      if (step === limit-1) { throw new Error("AI task reached its step limit. Completed changes are retained."); }
    }
    await a.setRun(id,{ phase: "Checking structure" });
    const checked = await execute("validate",{},true);
    if (!checked.result) { throw new Error("Validation result is missing"); }
    const validation = JSON.parse(checked.result.result);
    if (!validation.valid) { throw new Error(validation.errors.join("; ")); }
    run = await a.loadRun(id);
    if (run.hasChanges) { await execute("save",{}); }
    await a.setRun(id,{ status: "completed", phase: "Completed" });
  } catch (error) {
    const run = await a.loadRun(id);
    if (run.status === "running") {
      await a.setRun(id,{ status: "failed", phase: "Failed", error: error instanceof Error && error.cause instanceof Error ? error.cause.message : error instanceof Error ? error.message : "AI run failed" });
    }
  }
}
