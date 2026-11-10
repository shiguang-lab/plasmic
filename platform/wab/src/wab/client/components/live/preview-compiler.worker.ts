import type { PreviewCompilerReply, PreviewCompilerRequest } from "@/wab/client/components/live/preview-compiler";
import { transpilePreviewModule } from "@/wab/client/components/live/preview-transpiler";

let pending = Promise.resolve();
self.onmessage = ({ data }: MessageEvent<PreviewCompilerRequest>) => {
  pending = pending.then(async () => {
    let reply: PreviewCompilerReply;
    try {
      reply = { id: data.id, modules: await Promise.all(data.modules.map(transpilePreviewModule)) };
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      reply = { id: data.id, error: { name: failure.name, message: failure.message, stack: failure.stack } };
    }
    self.postMessage(reply);
  });
  return pending;
};
