import { preparePreviewModules, preparePreviewPages } from "@/wab/client/components/live/live-syncer";
import type { PreviewBatchCompiler } from "@/wab/client/components/live/preview-sync";
import type { PreviewCtx } from "@/wab/client/components/live/PreviewCtx";
import * as codegen from "@/wab/client/components/live/preview-codegen";
import { ComponentType, mkComponent, mkPageMeta } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { CustomCode } from "@/wab/shared/model/classes";

it("prepares static menu destinations without applying their props or mounting business state", async () => {
  const page = (path: string) => mkComponent({ type: ComponentType.Page, pageMeta: mkPageMeta({ path }), tplTree: baseVariant => mkTplTagX("div", { baseVariant, styles: {} }) });
  const current = page("/config"), target = page("/users");
  current.tplTree.vsettings[0].attrs.menuItems = new CustomCode({ code: '[{"href":"/users"}]', fallback: null });
  const site = createSite({ components: [current, target] });
  const currentModule = { name: "./config.tsx", source: "config", lang: "tsx" };
  const props = { name: "./preview-props.tsx", source: "current props", lang: "tsx" };
  const targetModule = { name: "./users.tsx", source: "users", lang: "tsx" };
  vi.spyOn(codegen, "buildPreviewUpdate").mockReturnValue({ modules: [currentModule, props] });
  vi.spyOn(codegen, "buildPreviewModules").mockImplementation((_ctx, component) => ({ modules: [component === current ? currentModule : targetModule] } as ReturnType<typeof codegen.buildPreviewModules>));
  const compile = vi.fn<PreviewBatchCompiler>(async () => []);
  const ctx = { component: current, isLive: true, previewData: {}, studioCtx: { site, currentAppUserCtx: {} }, previewCompiler: { compile } } as unknown as PreviewCtx;
  await preparePreviewModules(ctx, new AbortController().signal);
  expect(compile.mock.calls.map(call => call[0])).toEqual([[currentModule, props], [targetModule]]);
  expect(ctx.component).toBe(current);
  compile.mockClear();
  const abort = new AbortController(); abort.abort();
  await preparePreviewPages(ctx, current, abort.signal);
  expect(compile).not.toHaveBeenCalled();
});
