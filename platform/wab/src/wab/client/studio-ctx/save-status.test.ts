import { act, waitFor } from "@testing-library/react";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { COPILOT_TOOLS } from "@/wab/client/copilot";
import { message, notification } from "antd";
import { vi } from "vitest";
import type { TopFrameApi } from "@/wab/client/frame-ctx/top-frame-api";
import type { DesktopDraft } from "@/wab/shared/desktop-drafts";
import type { ApiUser, UserId } from "@/wab/shared/ApiSchema";
import { mkUuid } from "@/wab/shared/common";
import { mock } from "vitest-mock-extended";
import type { GetProjectResponse } from "@/wab/shared/ApiSchema";
import type { ProjectRevision } from "@/wab/server/entities/Entities";

const activeStudios = new Set<StudioCtx>();
const testDisposals: (() => void)[] = [];
async function readyStudio(options?: Parameters<typeof fakeStudioCtx>[0]) {
  const fixture = fakeStudioCtx(options);
  activeStudios.add(fixture.studioCtx);
  await waitFor(() => expect(fixture.studioCtx.initialRouteReady).toBe(true));
  return fixture;
}
afterEach(async () => {
  testDisposals.splice(0).forEach((stop) => stop());
  for (const studio of activeStudios) {
    await studio.awaitEval();
    studio.dispose();
  }
  activeStudios.clear();
  await act(async () => { message.destroy(); notification.destroy(); });
  vi.restoreAllMocks();
});

test("actual save failure remains unsaved and retry transitions through saving to saved", async () => {
  const feedback = vi.spyOn(message, "error").mockReturnValue(mock());
  const { studioCtx, api } = await readyStudio();
  studioCtx.dbCtx().revisionNum = 0;
  const bundle = studioCtx.bundler().bundle(studioCtx.site, studioCtx.siteInfo.id, studioCtx.appCtx.lastBundleVersion);
  studioCtx.bundler().unbundleAndRecomputeParents(bundle, studioCtx.siteInfo.id);
  await COPILOT_TOOLS.createComponent.execute(studioCtx, { name: "Save status", type: "page", reviewContext: { purpose: "创建页面并验证保存和恢复" }, path: "/save-status" });
  const statuses: string[] = [];
  statuses.push(studioCtx.saveStatus);
  const stop = studioCtx.saveState.store.subscribe((state) => statuses.push(state.saveStatus));
  testDisposals.push(stop);
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
});

function desktopEditors() {
  const userId = mkUuid<UserId>();
  const files = new Map<string, DesktopDraft>();
  const topFrameApi = mock<TopFrameApi>();
  topFrameApi.componentReuse.mockResolvedValue({ available: false });
  topFrameApi.openDesktopDrafts.mockImplementation(async () => ({ handle: "handle", drafts: [...files.values()] }));
  topFrameApi.readDesktopDraft.mockImplementation(async (_handle, id) => files.get(id) ?? null);
  topFrameApi.writeDesktopDraft.mockImplementation(async (_handle, draftJson) => { const draft: DesktopDraft = JSON.parse(draftJson); files.set(draft.id, draft); });
  topFrameApi.removeDesktopDraft.mockImplementation(async (_handle, id, sequence) => {
    const draft = files.get(id);
    if (draft && draft.sequence <= sequence) { files.delete(id); return true; }
    return false;
  });
  const editor = async () => {
    const f = await readyStudio({ topFrameApi, devFlagOverrides: { ccStubs: true } });
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
  const first = await editor();
  await first.studioCtx.initializeDesktopDrafts();
  await COPILOT_TOOLS.createComponent.execute(first.studioCtx, { name: "断网编辑", type: "page", reviewContext: { purpose: "创建页面并验证保存和恢复" }, path: "/offline" });
  first.api.saveProjectRevChanges.mockRejectedValueOnce(new Error("Bad Gateway"));
  await first.studioCtx.save();
  expect(first.studioCtx.saveStatus).toBe("error");
  expect(first.studioCtx.desktopDraft?.store.getState().status?.state).toBe("local");
  expect(files.size).toBe(1);
  first.studioCtx.dispose();
  activeStudios.delete(first.studioCtx);

  const reopened = await editor();
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
  const f = await editor();
  const remote = JSON.stringify(f.studioCtx.bundleSite().site);
  await f.studioCtx.initializeDesktopDrafts();
  await COPILOT_TOOLS.createComponent.execute(f.studioCtx, { name: "本机编辑", type: "page", reviewContext: { purpose: "创建页面并验证保存和恢复" }, path: "/local" });
  f.api.saveProjectRevChanges.mockRejectedValueOnce(Object.assign(new Error("revision conflict"), { name: "ProjectRevisionError" }));
  await f.studioCtx.save();
  expect(f.studioCtx.hasUnsavedChanges()).toBe(true);
  expect(f.studioCtx.site.components.some(component => component.name === "本机编辑")).toBe(true);
  expect(f.studioCtx.desktopDraft?.store.getState().status?.state).toBe("conflict");
  expect(f.studioCtx.desktopDraft?.hasCurrentBackup).toBe(true);
  expect(f.studioCtx.blockChanges).toBe(true);
  expect(f.api.getModelUpdates).not.toHaveBeenCalled();
  await f.studioCtx.save();
  expect(f.api.saveProjectRevChanges).toHaveBeenCalledTimes(1);

  f.api.getSiteInfo.mockResolvedValue(mock<GetProjectResponse>({ rev: mock<ProjectRevision>({ data: remote, revision: 11 }), depPkgs: [] }));
  const previousSnapshots = f.studioCtx.modelSnapshots;
  const previousSite = f.studioCtx.site;
  const previousComponents = previousSnapshots.field(previousSite, "components");
  const previousValues = previousComponents.getState();
  const oldPublish = vi.fn();
  const stopOldModel = previousComponents.subscribe(oldPublish);
  await f.studioCtx.restoreRemoteVersion();
  expect(f.studioCtx.modelSnapshots).not.toBe(previousSnapshots);
  expect(() => previousSnapshots.field(previousSite, "components")).toThrow("disposed");
  expect(previousComponents.getState()).toBe(previousValues);
  expect(oldPublish).not.toHaveBeenCalled();
  expect(f.studioCtx.modelSnapshots.field(f.studioCtx.site, "components").getState()
    .some(ref => f.studioCtx.modelSnapshots.resolve(ref).name === "本机编辑")).toBe(false);
  stopOldModel();
  expect(f.studioCtx.hasUnsavedChanges()).toBe(false);
  expect(f.studioCtx.site.components.some(component => component.name === "本机编辑")).toBe(false);
  expect(f.studioCtx.blockChanges).toBe(false);
  expect(f.studioCtx.isAtTip).toBe(true);
  expect(files.size).toBe(1);
  expect(f.studioCtx.desktopDraft?.store.getState().drafts.length).toBe(1);
});


test("agent save returns the original API failure without showing a toast", async () => {
  const feedback = vi.spyOn(message, "error").mockReturnValue(mock());
  const { studioCtx, api } = await readyStudio();
  studioCtx.dbCtx().revisionNum = 0;
  const bundle = studioCtx.bundler().bundle(studioCtx.site, studioCtx.siteInfo.id, studioCtx.appCtx.lastBundleVersion);
  studioCtx.bundler().unbundleAndRecomputeParents(bundle, studioCtx.siteInfo.id);
  await COPILOT_TOOLS.createComponent.execute(studioCtx, { name: "Agent save", type: "page", reviewContext: { purpose: "创建页面并验证保存和恢复" }, path: "/agent-save" });
  const error = new Error("Service unavailable: original API error");
  api.saveProjectRevChanges.mockRejectedValueOnce(error);
  await expect(COPILOT_TOOLS.save.execute(studioCtx, {})).rejects.toBe(error);
  expect(feedback).not.toHaveBeenCalled();
  expect(studioCtx.hasUnsavedChanges()).toBe(true);
  expect(studioCtx.saveStatus).toBe("error");
  feedback.mockRestore();
});


test("notification ownership is scoped to each queued change", async () => {
  const { err } = await import("neverthrow");
  const feedback = vi.spyOn(message, "error").mockReturnValue(mock());
  const { studioCtx } = await readyStudio();
  const failure = new Error("Invalid agent operation");
  const agent = await studioCtx.change(() => err(failure), { noErrorNotification: true });
  expect(agent.isErr()).toBe(true);
  expect(feedback).not.toHaveBeenCalled();
  await studioCtx.change(() => err(new Error("User operation failed")));
  expect(feedback).toHaveBeenCalledOnce();
  feedback.mockRestore();
});
