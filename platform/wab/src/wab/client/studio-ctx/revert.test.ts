import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import type { GetProjectResponse } from "@/wab/shared/ApiSchema";
import type { MinimalRevisionInfo } from "@/wab/shared/SharedApi";
import { mkMixedArena } from "@/wab/shared/Arenas";
import { FastBundler } from "@/wab/shared/bundler";
import { createSite } from "@/wab/shared/core/sites";
import { waitFor } from "@testing-library/react";
import { mock } from "vitest-mock-extended";

it.each([false, true])("restores the current arena after revert (intervening model refresh: %s)", async (refresh) => {
  const site = createSite();
  const arena = mkMixedArena("Business", []);
  site.arenas = [arena];
  const { studioCtx: studio, api, appCtx } = fakeStudioCtx({ site, devFlagOverrides: { ccStubs: true } });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  studio.switchToArena(arena);
  Object.assign(appCtx, { lastBundleVersion: "test" });
  const data = JSON.stringify(new FastBundler().bundle(site, studio.siteInfo.id, "test"));
  api.getSiteInfo.mockImplementation(async () => mock<GetProjectResponse>({ rev: { data, revision: 5 }, depPkgs: [] }));
  if (refresh) {
    const change = studio.change.bind(studio);
    // A remote revision refresh can replace the model while the arena change is queued.
    let refreshed = false;
    vi.spyOn(studio, "change").mockImplementation(async (fn, opts) => {
      if (opts?.noUndoRecord && !refreshed) {
        refreshed = true;
        await studio["loadVersion"](undefined, true);
      }
      return change(fn, opts);
    });
  }
  try {
    await studio.revertTo(mock<MinimalRevisionInfo>({ id: "previous", revision: 3, branchId: null }));
    expect(api.revertProjectToRevision).toHaveBeenCalledExactlyOnceWith(studio.siteInfo.id, "previous", undefined);
    expect(studio.currentArena).toBe(studio.site.arenas[0]);
    expect(studio.currentArena).not.toBe(arena);
    expect(studio.site.arenas[0].name).toBe("Business");
  } finally {
    await studio.awaitEval();
    studio.dispose();
  }
});
