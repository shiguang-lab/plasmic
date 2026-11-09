import { compileModules, type PreviewCompilerReply } from "@/wab/client/components/dashboard/preview/compile-modules";
import type { SourceModule } from "@/wab/client/components/live/preview-types";

const source: SourceModule[] = [{ name: "./root.tsx", lang: "tsx", source: 'export default function Root(){return <span/>;}' }];
const compiled = [{ fileName: "./root.tsx", code: "compiled", imports: [], type: "code" as const }];
const workers: CompilerWorker[] = [];
class CompilerWorker {
  onmessage: ((event: MessageEvent<PreviewCompilerReply>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor(readonly url: URL, readonly options: WorkerOptions) { workers.push(this); }
}
beforeEach(() => { workers.length = 0; vi.stubGlobal("Worker", CompilerWorker); });
afterEach(() => { vi.unstubAllGlobals(); });

it("terminates the classic batch compiler before delivering code to its caller", async () => {
  const controller = new AbortController();
  const remove = vi.spyOn(controller.signal, "removeEventListener");
  const result = compileModules(source, controller.signal).then((modules) => {
    expect(workers[0].terminate).toHaveBeenCalledOnce();
    return modules;
  });
  const worker = workers[0];
  expect(worker.options).toEqual({ type: "classic", name: "dashboard-preview-compiler" });
  expect(worker.url.pathname).toMatch(/\/compiler\.worker\.ts$/);
  expect(worker.postMessage).toHaveBeenCalledExactlyOnceWith(source);
  worker.onmessage?.(new MessageEvent("message", { data: { modules: compiled } }));
  expect(await result).toEqual(compiled);
  expect(remove).toHaveBeenCalledOnce();
  expect(worker.onmessage).toBeNull();
  expect(worker.onerror).toBeNull();
  expect(worker.onmessageerror).toBeNull();
});

it.each(["compiler", "worker", "messageerror", "abort"])("terminates a failed batch (%s) without a fallback", async (kind) => {
  const controller = new AbortController();
  const result = compileModules(source, controller.signal);
  const rejected = expect(result).rejects.toThrow();
  const worker = workers[0];
  if (kind === "compiler") {
    worker.onmessage?.(new MessageEvent("message", { data: { error: { name: "CompilerError", message: "Rejected component", stack: "original stack" } } }));
  } else if (kind === "worker") {
    const event = new ErrorEvent("error", { message: "Compiler chunk failed", cancelable: true });
    worker.onerror?.(event);
    expect(event.defaultPrevented).toBe(true);
  } else if (kind === "messageerror") {
    worker.onmessageerror?.();
  } else {
    controller.abort();
  }
  await rejected;
  expect(worker.terminate).toHaveBeenCalledOnce();
  expect(worker.postMessage).toHaveBeenCalledOnce();
  expect(workers).toHaveLength(1);
  expect(worker.onmessage).toBeNull();
});

it("does not create a compiler for an already retired batch", async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(compileModules(source, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  expect(workers).toHaveLength(0);
});

it("terminates when posting a batch fails", async () => {
  vi.stubGlobal("Worker", class extends CompilerWorker {
    postMessage = vi.fn(() => { throw new DOMException("Cannot clone batch", "DataCloneError"); });
  });
  await expect(compileModules(source, new AbortController().signal)).rejects.toMatchObject({ name: "DataCloneError" });
  expect(workers[0].terminate).toHaveBeenCalledOnce();
});

it.each(["valid", "finally", "invalid-hooks", "unvisited"])("uses the real strict compiler inside the single-use worker (%s)", async (kind) => {
  vi.resetModules();
  const scope: {
    onmessage: ((event: MessageEvent<SourceModule[]>) => Promise<void>) | null;
    postMessage: ReturnType<typeof vi.fn>;
  } = { onmessage: null, postMessage: vi.fn() };
  vi.stubGlobal("self", scope);
  await import("./compiler.worker");
  const input: SourceModule[] = [
    { name: "./root.tsx", lang: "tsx", source: kind === "invalid-hooks"
      ? 'import React from "react"; export function Root({on}){if(on){React.useState(0);}return <span/>;}'
      : kind === "unvisited"
        ? 'import React from "react"; export function Root(){"use no memo";return <span/>;}'
        : kind === "finally"
          ? 'import React from "react"; export function Root({run,cleanup}){return <button onClick={async()=>{try{return await run()}finally{cleanup()}}}/>;}'
        : 'import React from "react"; export function Root({value}){return <span>{value}</span>;}' },
    { name: "./style.css", lang: "css", source: "span{color:red}" },
  ];
  await scope.onmessage?.(new MessageEvent("message", { data: input }));
  expect(scope.onmessage).toBeNull();
  expect(scope.postMessage).toHaveBeenCalledOnce();
  const reply: PreviewCompilerReply = scope.postMessage.mock.calls[0][0];
  if (kind === "invalid-hooks") {
    expect(reply).toMatchObject({ error: { message: expect.stringMatching(/Hooks must|conditionally/) } });
  } else if (kind === "unvisited") {
    expect(reply).toMatchObject({ error: { message: expect.stringContaining("React Compiler did not compile Root") } });
  } else {
    expect(reply).toMatchObject({ modules: [
      { fileName: "./root.tsx", type: "code", code: expect.stringContaining("react/compiler-runtime") },
      { fileName: "./style.css", type: "asset", source: "span{color:red}" },
    ] });
    if (kind === "finally" && "modules" in reply) {
      expect(reply.modules[0]).toMatchObject({ code: expect.stringContaining("finally") });
    }
  }
});
