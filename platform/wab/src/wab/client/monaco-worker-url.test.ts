import { configureMonacoWorkers } from "@/wab/client/monaco-worker-url";
import { expect, it, vi } from "vitest";

vi.mock("@/wab/shared/urls", () => ({ getStaticUrl: () => "https://assets.example.test/static" }));

it("creates native workers for editor, GraphQL and supported language services", () => {
  const workers = vi.fn(function (this: { url: string }, url: string) { this.url = url; });
  vi.stubGlobal("Worker", workers);
  try {
    configureMonacoWorkers();
    const environment = (window as any).MonacoEnvironment;
    for (const [label, filename] of Object.entries({
      typescript: "ts", javascript: "ts", json: "json", html: "html",
      css: "css", graphql: "graphql", editorWorkerService: "editor", unknown: "editor",
    })) {
      const worker = environment.getWorker("", label);
      const [url, options] = workers.mock.calls.at(-1) as unknown as [string, WorkerOptions];
      expect(worker).toBeInstanceOf(workers);
      expect(decodeURIComponent(url.split(",")[1])).toBe(`importScripts("https://assets.example.test/static/${filename}.worker.js");`);
      expect(options).toEqual({ name: label });
    }
    expect(workers).toHaveBeenCalledTimes(8);
    configureMonacoWorkers();
    expect((window as any).MonacoEnvironment).toBe(environment);
  } finally {
    vi.unstubAllGlobals();
  }
});
