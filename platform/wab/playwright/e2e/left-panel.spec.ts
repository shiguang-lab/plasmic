import { expect } from "@playwright/test";
import { test } from "../fixtures/test";
import { modifierKey } from "../utils/key-utils";
import { goToProject } from "../utils/studio-utils";
import { createAuditPage, selectedOpacity, setSelectedOpacity, showAuditLayers } from "../utils/migration-live";

test.describe("left-panel", () => {
  let projectId: string;
  let errors: string[];
  test.beforeEach(async ({ apiClient, page }) => {
    errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => {
      if (message.type() === "error" && message.text().startsWith("Studio operation failed")) { errors.push(message.text()); }
    });
    projectId = await apiClient.setupNewProject({ name: "left-panel" });
    await goToProject(page, `/projects/${projectId}`);
    await createAuditPage(page, "OutlineAudit");
  });
  test.afterEach(async ({ apiClient }) => {
    await apiClient.removeProjectAfterTest(projectId, "user2@example.com");
    expect(errors).toEqual([]);
  });

  test("shows the non-default style in the outline popover and clears its actual rendered value", async ({ models, page }) => {
    await models.studio.leftPanel.insertNode("Text");
    await setSelectedOpacity(page, "0.42");
    await showAuditLayers(page);
    const node = models.studio.leftPanel.focusedTreeNode;
    const indicator = node.locator('[data-test-class="left-panel-indicator"] > div');
    await expect(indicator).toBeVisible();
    await indicator.hover();
    const opacity = models.studio.frame.locator(".defined-indicator__source").filter({ hasText: /Opacity|不透明度/ });
    await expect(opacity).toContainText("0.42");
    await opacity.locator('[data-test-class="indicator-clear"]').click();
    await expect.poll(() => selectedOpacity(page)).toBe("1");
    await expect(opacity).toHaveCount(0);
  });

  test("copies and pastes actual nodes from the outline", async ({ page, models }) => {
    await models.studio.leftPanel.insertNode("Vertical stack");
    await showAuditLayers(page);
    const labels = models.studio.leftPanel.treeLabels;
    const original = models.studio.leftPanel.focusedTreeNode;
    await original.click();
    const initialCount = await labels.count();
    await page.keyboard.press(`${modifierKey}+c`);
    for (let i = 1; i <= 10; i++) {
      await page.keyboard.press(`${modifierKey}+v`);
      await expect(labels).toHaveCount(initialCount + i);
    }
    await models.studio.leftPanel.focusedTreeNode.click();
    await page.keyboard.press(`${modifierKey}+c`);
    await page.keyboard.press(`${modifierKey}+v`);
    await expect(labels).toHaveCount(initialCount + 11);
  });
});
