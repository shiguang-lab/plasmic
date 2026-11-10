import type { PreviewBatchCompiler } from "@/wab/client/components/live/preview-sync";
import { createPreviewCompiler } from "@/wab/client/components/live/preview-compiler";

/** The compiler isolate belongs to this batch, never to the rendered overview. */
export const compileModules: PreviewBatchCompiler = async (modules, signal) => {
  const compiler = createPreviewCompiler();
  try {
    return await compiler.compile(modules, signal);
  } finally {
    compiler.dispose();
  }
};
