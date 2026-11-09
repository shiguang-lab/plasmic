import type { PreviewCompilerReply } from "@/wab/client/components/dashboard/preview/compile-modules";
import type { SourceModule } from "@/wab/client/components/live/preview-types";
import { createTranspiler } from "@/wab/client/components/live/preview-transpiler";

self.onmessage = async ({ data }: MessageEvent<SourceModule[]>) => {
  self.onmessage = null;
  let reply: PreviewCompilerReply;
  try {
    const transpile = createTranspiler();
    reply = { modules: await Promise.all(data.map(transpile)) };
  } catch (error) {
    const failure = error instanceof Error ? error : new Error(String(error));
    reply = { error: { name: failure.name, message: failure.message, stack: failure.stack } };
  }
  self.postMessage(reply);
};
