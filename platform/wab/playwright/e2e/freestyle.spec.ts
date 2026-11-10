import { expect } from "@playwright/test";
import { test } from "../fixtures/test";
import { goToProject, waitForFrameToLoad } from "../utils/studio-utils";
import { createAuditPage, showAuditLayers } from "../utils/migration-live";

test.describe("freestyle", () => {
  let projectId: string;

  test.beforeEach(async ({ apiClient, page }) => {
    projectId = await apiClient.setupNewProject({ name: "freestyle" });
    await goToProject(page, `/projects/${projectId}`);
  });

  test.afterEach(async ({ apiClient }) => {
    await apiClient.removeProjectAfterTest(projectId, "user2@example.com");
  });

  test("can draw tweet", async ({ page, models }) => {
    await createAuditPage(page, "FreestyleAudit");
    await waitForFrameToLoad(page);

    await models.studio.frames.first().waitFor({ state: "visible" });
    const framed = models.studio.getComponentFrameByIndex(0);
    await framed.locator("body").waitFor({ state: "visible" });

    // Drawing requires a definite free-positioned root, matching this fixture's layout.
    await models.studio.frame.locator("body").evaluate(async () => {
      const studio = (window as any).studioCtx, view = studio.focusedViewCtx();
      await studio.changeUnsafe(() => Object.assign(view.variantTplMgr().ensureBaseVariantSetting(view.component.tplTree).rs.values, { display: "block", position: "relative", height: "768px" }));
      await studio.awaitEval();
    });
    await models.studio.frame.getByRole("button", { name: "Locate current canvas" }).click();
    await framed.locator("body").click();

    const initX = 5;
    const initY = 20;
    const lineHeight = 25;
    const spanInterval = 35;
    const imgSize = 30;
    const containerWidth = 176;
    const textLeft = initX + imgSize + 20;

    const position = () => models.studio.frame.locator("body").evaluate(() => (window as any).studioCtx.undoLog._nextInsertPos as number);
    const fixturePosition = await position();
    await page.keyboard.press("r");
    await models.studio.drawRectRelativeToElt(
      framed.locator("body"),
      initX + 10,
      initY + 10,
      imgSize,
      imgSize,
    );

    await models.studio.plotText(
      framed,
      textLeft + spanInterval * 0,
      initY + 10,
      "Yang",
    );

    await models.studio.plotText(
      framed,
      textLeft + spanInterval * 1,
      initY + 10,
      "@yang",
    );

    await models.studio.plotText(
      framed,
      textLeft + spanInterval * 2 + 5,
      initY + 10,
      "23m ago",
    );

    await models.studio.plotText(
      framed,
      textLeft,
      initY + 10 + lineHeight * 1,
      "Hello world!",
    );

    await models.studio.plotText(
      framed,
      textLeft,
      initY + 10 + lineHeight * 2,
      "3 likes",
    );

    await page.keyboard.press("h");
    await page.waitForTimeout(500);
    await models.studio.drawRectRelativeToElt(
      framed.locator("body"),
      textLeft - 3,
      initY + 8,
      containerWidth - textLeft + 1,
      25,
    );

    await page.keyboard.press("v");
    await page.waitForTimeout(500);
    await models.studio.drawRectRelativeToElt(
      framed.locator("body"),
      textLeft - 5,
      initY + 5,
      containerWidth - textLeft + 3,
      80,
    );

    await page.keyboard.press("h");
    await page.waitForTimeout(500);
    await models.studio.drawRectRelativeToElt(
      framed.locator("body"),
      initX + 5,
      initY + 3,
      containerWidth - 5,
      110,
    );

    await models.studio.withinLiveMode(async (liveFrame) => {
      const bodyText = await liveFrame.locator("body").textContent();
      expect(bodyText).toContain("Yang");
      expect(bodyText).toContain("@yang");
      expect(bodyText).toContain("23m ago");
      expect(bodyText).toContain("Hello world!");
      expect(bodyText).toContain("3 likes");
    });

    async function checkEndState() {
      const tags = await models.studio.frame.locator("body").evaluate(() => {
        const root = (window as any).studioCtx.focusedViewCtx().component.tplTree;
        const result: string[] = [];
        const walk = (node: any) => { result.push(node.type === "text" ? "text" : "container"); (node.children ?? []).forEach(walk); };
        walk(root); return result.sort();
      });
      expect(tags).toEqual([...Array(5).fill("container"), ...Array(5).fill("text")]);
    }
    await showAuditLayers(page);
    await checkEndState();
    const undo = models.studio.frame.getByRole("button", { name: "Undo", exact: true });
    const redo = models.studio.frame.getByRole("button", { name: "Redo", exact: true });
    const finalPosition = await position();
    let operations = 0;
    while (await position() > fixturePosition) {
      if (++operations > 100) { throw new Error("Undo history did not drain"); }
      const before = await position(); await undo.click();
      await expect.poll(position).toBeLessThan(before);
    }
    expect(operations).toBeGreaterThan(9);
    while (await position() < finalPosition) {
      const before = await position(); await redo.click();
      await expect.poll(position).toBeGreaterThan(before);
      if (await position() > finalPosition) { throw new Error("Redo passed the original history position"); }
    }
    await expect(redo).toBeDisabled();
    await checkEndState();
  });
});
