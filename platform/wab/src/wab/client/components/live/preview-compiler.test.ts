import { createPreviewCompiler, type PreviewCompilerReply } from "@/wab/client/components/live/preview-compiler";
vi.mock("@/wab/client/components/live/preview-worker", () => ({ PreviewWorker: class {
  worker: Worker;
  release = vi.fn();
  constructor(url: URL, options: WorkerOptions) { this.worker = new Worker(url, options); }
} }));
const source = [{ name: "./root.tsx", lang: "tsx", source: "export default () => <span/>" }];
const workers: CompilerWorker[] = [];
class CompilerWorker {
  onmessage: ((event: MessageEvent<PreviewCompilerReply>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() { workers.push(this); }
  reply(id: number, code: string) {
    this.onmessage?.(new MessageEvent("message", { data: { id, modules: [{ fileName: "./root.tsx", type: "code", code, imports: [] }] } }));
  }
}
beforeEach(() => { workers.length = 0; vi.stubGlobal("Worker", CompilerWorker); });
afterEach(() => vi.unstubAllGlobals());

it("reuses pending and completed source across frames without waiting behind other pages", async () => {
  const compiler = createPreviewCompiler(), signal = new AbortController().signal;
  const first = compiler.compile(source, signal), shared = compiler.compile(source, signal);
  expect(workers[0].postMessage).toHaveBeenCalledOnce();
  workers[0].reply(1, "first");
  await expect(first).resolves.toMatchObject([{ code: "first" }]);
  await expect(shared).resolves.toMatchObject([{ code: "first" }]);
  const other = compiler.compile([{ ...source[0], name: "./other.tsx" }], signal);
  await expect(compiler.compile(source, signal)).resolves.toMatchObject([{ code: "first" }]);
  workers[0].reply(2, "other"); await other;
  expect(workers[0].postMessage).toHaveBeenCalledTimes(2);
  compiler.dispose(); compiler.dispose();
  expect(workers[0].terminate).toHaveBeenCalledOnce();
  await expect(compiler.compile(source, signal)).rejects.toMatchObject({ name: "AbortError" });
});

it("cancels only the requesting frame while another frame shares the compilation", async () => {
  const compiler = createPreviewCompiler(), lifetime = new AbortController();
  const first = compiler.compile(source, lifetime.signal), second = compiler.compile(source, new AbortController().signal);
  const rejected = expect(first).rejects.toMatchObject({ name: "AbortError" });
  lifetime.abort(); await rejected;
  expect(workers[0].terminate).not.toHaveBeenCalled();
  workers[0].reply(1, "shared");
  await expect(second).resolves.toMatchObject([{ code: "shared" }]);
  compiler.dispose();
});

it("invalidates edits and jsx pragma changes without older replies replacing newer source", async () => {
  const compiler = createPreviewCompiler(), signal = new AbortController().signal;
  const first = compiler.compile(source, signal);
  const edited = [{ ...source[0], source: "export default () => <button/>" }];
  const second = compiler.compile(edited, signal);
  workers[0].reply(2, "edited"); workers[0].reply(1, "old");
  await expect(first).resolves.toMatchObject([{ code: "old" }]);
  await expect(second).resolves.toMatchObject([{ code: "edited" }]);
  await expect(compiler.compile(edited, signal)).resolves.toMatchObject([{ code: "edited" }]);
  const third = compiler.compile([{ ...edited[0], jsxPragma: "custom" }], signal);
  workers[0].reply(3, "custom"); await third;
  const pending = compiler.compile(source, signal);
  const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
  compiler.dispose(); await rejected;
});

it("handles asset-only updates without starting a Worker", async () => {
  const compiler = createPreviewCompiler();
  await expect(compiler.compile([{ name: "./page.css", lang: "css", source: "body{}" }], new AbortController().signal)).resolves.toEqual([{ fileName: "./page.css", source: "body{}", type: "asset" }]);
  expect(workers).toHaveLength(0); compiler.dispose();
});

it("can compile an edited module after a strict compilation error", async () => {
  const compiler = createPreviewCompiler(), signal = new AbortController().signal;
  const first = compiler.compile(source, signal);
  workers[0].onmessage?.(new MessageEvent("message", { data: { id: 1, error: { name: "CompilerError", message: "Invalid hooks", stack: "original" } } }));
  await expect(first).rejects.toMatchObject({ name: "CompilerError", message: "Invalid hooks", stack: "original" });
  const second = compiler.compile(source, signal); workers[0].reply(2, "fixed");
  await expect(second).resolves.toMatchObject([{ code: "fixed" }]);
  expect(workers).toHaveLength(1); compiler.dispose();
});
