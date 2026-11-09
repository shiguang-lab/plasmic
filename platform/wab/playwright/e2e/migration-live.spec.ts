import { expect } from "@playwright/test";
import { test } from "../fixtures/test";
import { modifierKey } from "../utils/key-utils";
import { goToProject } from "../utils/studio-utils";
import { createAuditPage, selectedOpacity, setSelectedOpacity, showAuditLayers, studioBody } from "../utils/migration-live";

test("keeps selection, rendered styles, undo/redo and persisted models coherent across live page switches and reopen", async ({ apiClient, page, models }) => {
  const projectId = await apiClient.setupNewProject({ name: "migration-live" });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error" && message.text().startsWith("Studio operation failed")) { errors.push(message.text()); }
  });
  try {
    await goToProject(page, `/projects/${projectId}`);
    const initialRevision = await apiClient.request.get(`${apiClient.baseUrl}/api/v1/projects/${projectId}/revision-without-data`).then(response => response.json()).then(data => data.rev.revision);
    await createAuditPage(page, "MigrationPrimary");
    await models.studio.leftPanel.insertNode("Text");
    await showAuditLayers(page);
    await models.studio.leftPanel.focusedTreeNode.click();
    const target = await studioBody(page).evaluate(() => {
      const s = (window as any).studioCtx, view = s.focusedViewCtx(), tpl = view.focusedTpl();
      return { uid: tpl.uid, uuid: tpl.uuid, name: tpl.name, component: view.currentComponent().uuid };
    });
    await setSelectedOpacity(page, "0.42");
    await page.keyboard.press(`${modifierKey}+z`);
    await expect.poll(() => selectedOpacity(page)).toBe("1");
    await page.keyboard.press(`${modifierKey}+Shift+z`);
    await expect.poll(() => selectedOpacity(page)).toBe("0.42");
    await createAuditPage(page, "MigrationSecondary");
    await models.studio.leftPanel.insertNode("Text");
    await setSelectedOpacity(page, "0.73");
    await studioBody(page).evaluate(async (_body, id) => {
      const s = (window as any).studioCtx, arena = s.site.pageArenas.find((a: any) => a.component.uuid === id);
      s.changeSelection(() => s.switchToArena(arena)); await s.awaitStudioReady();
    }, target.component);
    await showAuditLayers(page);
    const original = models.studio.frame.locator(`[data-test-id="tpltree-${target.uid}"]`);
    await original.click();
    await expect.poll(() => selectedOpacity(page)).toBe("0.42");
    const saved = await studioBody(page).evaluate(async () => {
      const s = (window as any).studioCtx; await s.awaitEval(); s.needsFullSave = true; await s.save();
      if (s.saveStatus !== "saved" || s._changeRecords.length) { throw new Error("Live project did not save"); }
      return { revision: s.dbCtx().revisionNum, bundle: JSON.stringify(s.bundler().bundle(s.site, s.siteInfo.id, s.appCtx.lastBundleVersion)) };
    });
    expect(saved.revision).toBeGreaterThan(initialRevision);
    const server = await apiClient.request.get(`${apiClient.baseUrl}/api/v1/projects/${projectId}/revision-without-data`).then(response => response.json());
    expect(server.rev.revision).toBe(saved.revision);
    await page.reload();
    await expect.poll(() => studioBody(page).evaluate(() => !!(window as any).studioCtx?.initialViewportReady)).toBe(true);
    const reopened = await studioBody(page).evaluate(async () => {
      const s = (window as any).studioCtx; await s.awaitStudioReady();
      return { revision: s.dbCtx().revisionNum, bundle: JSON.stringify(s.bundler().bundle(s.site, s.siteInfo.id, s.appCtx.lastBundleVersion)) };
    });
    expect(reopened).toEqual(saved);
    expect(errors).toEqual([]);
  } finally { await apiClient.removeProjectAfterTest(projectId, "user2@example.com"); }
});
