import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { COPILOT_TOOLS } from "@/wab/client/copilot";
import { message } from "antd";
import { vi } from "vitest";
import { autorun } from "mobx";
import type { TopFrameApi } from "@/wab/client/frame-ctx/top-frame-api";
import type { DesktopDraft } from "@/wab/shared/desktop-drafts";
import type { ApiUser, UserId } from "@/wab/shared/ApiSchema";
import { mkUuid } from "@/wab/shared/common";
import { mock } from "vitest-mock-extended";
import type { GetProjectResponse } from "@/wab/shared/ApiSchema";
import type { ProjectRevision } from "@/wab/server/entities/Entities";

test("actual save failure remains unsaved and retry transitions through saving to saved", async () => {
  const feedback = vi.spyOn(message, "error").mockReturnValue(mock());
  const { studioCtx, api } = fakeStudioCtx();
  studioCtx.dbCtx().revisionNum = 0;
  const bundle = studioCtx.bundler().bundle(studioCtx.site, studioCtx.siteInfo.id, studioCtx.appCtx.lastBundleVersion);
  studioCtx.bundler().unbundleAndRecomputeParents(bundle, studioCtx.siteInfo.id);
  await COPILOT_TOOLS.createComponent.execute(studioCtx, { name: "Save status", type: "page", path: "/save-status" });
  const statuses: string[] = [];
  const stop = autorun(() => statuses.push(studioCtx.saveStatus));
  api.saveProjectRevChanges.mockRejectedValueOnce(new Error("Bad Gateway"));
  await studioCtx.save();
  expect(api.saveProjectRevChanges).toHaveBeenCalledTimes(1);
  expect(studioCtx.saveStatus).toBe("error");
  expect(JSON.parse(await COPILOT_TOOLS.getEditorContext.execute(studioCtx, {})).saveStatus).toBe("error");
  expect(studioCtx.hasUnsavedChanges()).toBe(true);
  expect(studioCtx.alertBannerState.get()).toBeNull();
  expect(feedback).toHaveBeenCalledWith(expect.objectContaining({ type: "error", duration: 4 }));
  api.saveProjectRevChanges.mockResolvedValueOnce({} as any);
  await studioCtx.save();
  expect(studioCtx.saveStatus).toBe("saved");
  expect(JSON.parse(await COPILOT_TOOLS.getEditorContext.execute(studioCtx, {})).saveStatus).toBe("saved");
  expect(studioCtx.hasUnsavedChanges()).toBe(false);
  expect(studioCtx.alertBannerState.get()).toBeNull();
  expect(statuses).toContain("saving");
  expect(statuses).toContain("error");
  stop();
  feedback.mockRestore();
  studioCtx.copilotActivity.dispose();
});

function desktopEditors() {
  const userId = mkUuid<UserId>();
  const files = new Map<string, DesktopDraft>();
  const topFrameApi = mock<TopFrameApi>();
  topFrameApi.openDesktopDrafts.mockImplementation(async () => ({ handle: "handle", drafts: [...files.values()] }));
  topFrameApi.readDesktopDraft.mockImplementation(async (_handle, id) => files.get(id) ?? null);
  topFrameApi.writeDesktopDraft.mockImplementation(async (_handle, draft) => { files.set(draft.id, draft); });
  topFrameApi.removeDesktopDraft.mockImplementation(async (_handle, id, sequence) => {
    const draft = files.get(id);
    if (draft && draft.sequence <= sequence) { files.delete(id); return true; }
    return false;
  });
  const editor = () => {
    const f = fakeStudioCtx({ topFrameApi, devFlagOverrides: { ccStubs: true } });
    f.studioCtx.appCtx.selfInfo = mock<ApiUser>({ id: userId });
    f.studioCtx.dbCtx().revisionNum = 10;
    const bundle = f.studioCtx.bundleSite().site;
    f.studioCtx.bundler().unbundleAndRecomputeParents(bundle, f.studioCtx.siteInfo.id);
    return f;
  };
  return { editor, files };
}

test("Desktop restores an actual unsynced model after reopening and saves it as a full revision", async () => {
  const { editor, files } = desktopEditors();
  const first = editor();
  await first.studioCtx.initializeDesktopDrafts();
  await COPILOT_TOOLS.createComponent.execute(first.studioCtx, { name: "断网编辑", type: "page", path: "/offline" });
  first.api.saveProjectRevChanges.mockRejectedValueOnce(new Error("Bad Gateway"));
  await first.studioCtx.save();
  expect(first.studioCtx.saveStatus).toBe("error");
  expect(first.studioCtx.desktopDraft?.status?.state).toBe("local");
  expect(files.size).toBe(1);
  first.studioCtx.desktopDraft?.dispose();

  const reopened = editor();
  await reopened.studioCtx.initializeDesktopDrafts();
  expect(reopened.studioCtx.site.components.some(component => component.name === "断网编辑")).toBe(true);
  expect(reopened.studioCtx.hasUnsavedChanges()).toBe(true);
  reopened.api.saveProjectRevChanges.mockResolvedValue({});
  await reopened.studioCtx.save();
  expect(reopened.api.saveProjectRevChanges.mock.calls[0][1].incremental).toBe(false);
  expect(reopened.studioCtx.saveStatus).toBe("saved");
  await vi.waitFor(() => expect(files.size).toBe(0));
});

test("Desktop preserves a live revision conflict without replaying edits and switches to remote only on explicit action", async () => {
  const { editor, files } = desktopEditors();
  const f = editor();
  const remote = JSON.stringify(f.studioCtx.bundleSite().site);
  await f.studioCtx.initializeDesktopDrafts();
  await COPILOT_TOOLS.createComponent.execute(f.studioCtx, { name: "本机编辑", type: "page", path: "/local" });
  f.api.saveProjectRevChanges.mockRejectedValueOnce(Object.assign(new Error("revision conflict"), { name: "ProjectRevisionError" }));
  await f.studioCtx.save();
  expect(f.studioCtx.hasUnsavedChanges()).toBe(true);
  expect(f.studioCtx.site.components.some(component => component.name === "本机编辑")).toBe(true);
  expect(f.studioCtx.desktopDraft?.status?.state).toBe("conflict");
  expect(f.studioCtx.desktopDraft?.hasCurrentBackup).toBe(true);
  expect(f.studioCtx.blockChanges).toBe(true);
  expect(f.api.getModelUpdates).not.toHaveBeenCalled();
  await f.studioCtx.save();
  expect(f.api.saveProjectRevChanges).toHaveBeenCalledTimes(1);

  f.api.getSiteInfo.mockResolvedValue(mock<GetProjectResponse>({ rev: mock<ProjectRevision>({ data: remote, revision: 11 }), depPkgs: [] }));
  await f.studioCtx.useRemoteVersion();
  expect(f.studioCtx.hasUnsavedChanges()).toBe(false);
  expect(f.studioCtx.site.components.some(component => component.name === "本机编辑")).toBe(false);
  expect(f.studioCtx.blockChanges).toBe(false);
  expect(f.studioCtx.isAtTip).toBe(true);
  expect(files.size).toBe(1);
  expect(f.studioCtx.desktopDraft?.drafts.length).toBe(1);
});
