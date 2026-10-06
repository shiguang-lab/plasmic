import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { COPILOT_TOOLS } from "@/wab/client/copilot";
import { AlertSpec } from "@/wab/client/components/widgets/plasmic/AlertBanner";
import { autorun } from "mobx";

test("actual save failure remains unsaved and retry transitions through saving to saved", async () => {
  const { studioCtx, api } = fakeStudioCtx();
  const bundle = studioCtx.bundler().bundle(studioCtx.site, studioCtx.siteInfo.id, studioCtx.appCtx.lastBundleVersion);
  studioCtx.bundler().unbundleAndRecomputeParents(bundle, studioCtx.siteInfo.id);
  await COPILOT_TOOLS.createComponent.execute(studioCtx, { name: "Save status", type: "page", path: "/save-status" });
  const statuses: string[] = [];
  const stop = autorun(() => statuses.push(studioCtx.saveStatus));
  api.saveProjectRevChanges.mockRejectedValueOnce(new Error("Bad Gateway"));
  await studioCtx.save();
  expect(api.saveProjectRevChanges).toHaveBeenCalledTimes(1);
  expect(studioCtx.saveStatus).toBe("error");
  expect(studioCtx.hasUnsavedChanges()).toBe(true);
  expect(studioCtx.alertBannerState.get()).toBe(AlertSpec.SaveFailed);
  api.saveProjectRevChanges.mockResolvedValueOnce({} as any);
  await studioCtx.save();
  expect(studioCtx.saveStatus).toBe("saved");
  expect(studioCtx.hasUnsavedChanges()).toBe(false);
  expect(studioCtx.alertBannerState.get()).toBeNull();
  expect(statuses).toContain("saving");
  expect(statuses).toContain("error");
  stop();
  studioCtx.copilotActivity.dispose();
});
