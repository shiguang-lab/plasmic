import { load, ready } from "@/wab/client/components/dashboard/preview/renderer";
import { rasterize, snapshot } from "@/wab/client/components/dashboard/preview/snapshot";
import type { DevFlagsType } from "@/wab/shared/devflags";

export const coverEngine = {
  async load(id: string, revision: number, flags: DevFlagsType) {
    const start = performance.now();
    const payload = await load({
      projectId: id,
      revision,
      flags,
      staticBaseUrl: location.origin + "/static",
    });
    // Only serializable metadata crosses the disposable iframe boundary.
    return {
      id,
      revision,
      pages: payload.pages,
      arena: payload.site.arenas.find((arena) => arena.children.length)?.name ?? "Pages",
      moduleCount: payload.modules.length,
      loadMs: performance.now() - start,
    };
  },
  async render(artboardId: string) {
    await (window as any).__renderCover(artboardId);
    await ready();
  },
  async capture(width: number, height: number) {
    const shot = await snapshot(document, width, height);
    if (shot.stats.assetErrors.length) {
      throw new Error(shot.stats.assetErrors.join("\n"));
    }
    return { blob: await rasterize(shot.svg, width, height), stats: shot.stats };
  },
  ready,
  clear() {
    (window as any).__Sub.hostUtils.setPlasmicRootNode(null);
  },
};
(window as any).coverEngine = coverEngine;
