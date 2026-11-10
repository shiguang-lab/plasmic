import { expect } from "@playwright/test";
import { test } from "../fixtures/test";
import {
  createAuditPage,
  selectedOpacity,
  setSelectedOpacity,
  showAuditLayers,
  studioBody,
} from "../utils/migration-live";
import { goToProject } from "../utils/studio-utils";

test("recreates a page after undoing its creation and continues editing, saving and reopening", async ({
  apiClient,
  page,
  models,
}) => {
  const projectId = await apiClient.setupNewProject({ name: "page-history" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await goToProject(page, `/projects/${projectId}`);
    const body = studioBody(page);
    const position = () =>
      body.evaluate(
        () => (window as any).studioCtx.undoLog._nextInsertPos as number,
      );
    await showAuditLayers(page);
    const start = await position();
    await createAuditPage(page, "页面恢复验收");
    await models.studio.leftPanel.insertNode("Text");
    await setSelectedOpacity(page, "0.42");
    const target = await body.evaluate(() => {
      const s = (window as any).studioCtx,
        v = s.focusedViewCtx();
      return {
        page: v.component.uuid,
        tpl: v.focusedTpl().uuid,
        frame: v.arenaFrame().uuid,
      };
    });
    const end = await position();
    const undo = models.studio.frame.getByRole("button", {
      name: "Undo",
      exact: true,
    });
    const redo = models.studio.frame.getByRole("button", {
      name: "Redo",
      exact: true,
    });
    for (let cycle = 0; cycle < 2; cycle++) {
      while ((await position()) > start) {
        const before = await position();
        await undo.click();
        await expect.poll(position).toBeLessThan(before);
        await expect
          .poll(() =>
            body.evaluate(
              () => !(window as any).studioCtx.hasPendingModelChanges(),
            ),
          )
          .toBe(true);
      }
      await expect
        .poll(() =>
          body.evaluate(() => (window as any).studioCtx.site.pageArenas.length),
        )
        .toBe(0);
      await expect(
        models.studio.frame.locator(
          `iframe[data-plasmic-frame-uuid="${target.frame}"]`,
        ),
      ).toHaveCount(0);
      while ((await position()) < end) {
        const before = await position();
        await redo.click();
        await expect.poll(position).toBeGreaterThan(before);
        await expect
          .poll(
            () =>
              body.evaluate(
                () => !(window as any).studioCtx.hasPendingModelChanges(),
              ),
            { timeout: 15000 },
          )
          .toBe(true);
      }
      await body.evaluate(async () => {
        await (window as any).studioCtx.awaitStudioReady();
      });
      await expect.poll(() => selectedOpacity(page)).toBe("0.42");
      expect(
        await body.evaluate(() => {
          const s = (window as any).studioCtx,
            v = s.focusedViewCtx();
          return {
            page: v.component.uuid,
            tpl: v.focusedTpl().uuid,
            frame: v.arenaFrame().uuid,
          };
        }),
      ).toEqual(target);
      await expect(
        models.studio.frame.getByText("Loading project…", { exact: true }),
      ).toHaveCount(0);
    }
    await setSelectedOpacity(page, "0.73");
    await undo.click();
    await expect.poll(() => selectedOpacity(page)).toBe("0.42");
    await redo.click();
    await expect.poll(() => selectedOpacity(page)).toBe("0.73");
    // The same restoration path must mount a deleted page when undo brings it back.
    await body.evaluate(async () => {
      const s = (window as any).studioCtx;
      await s.changeUnsafe(() =>
        s.tplMgr().removeComponent(s.currentArena.component),
      );
    });
    await expect
      .poll(() =>
        body.evaluate(() => (window as any).studioCtx.site.pageArenas.length),
      )
      .toBe(0);
    await undo.click();
    await body.evaluate(async () => {
      await (window as any).studioCtx.awaitStudioReady();
    });
    await expect.poll(() => selectedOpacity(page)).toBe("0.73");
    await redo.click();
    await expect
      .poll(() =>
        body.evaluate(() => (window as any).studioCtx.site.pageArenas.length),
      )
      .toBe(0);
    await undo.click();
    await body.evaluate(async () => {
      await (window as any).studioCtx.awaitStudioReady();
    });
    await expect.poll(() => selectedOpacity(page)).toBe("0.73");
    await body.evaluate(async () => {
      const s = (window as any).studioCtx;
      await s.awaitEval();
      s.needsFullSave = true;
      await s.save();
      if (s.saveStatus !== "saved") {
        throw new Error("Restored page did not save");
      }
    });
    await page.reload();
    await showAuditLayers(page);
    await body.evaluate(async (_body, expectedTarget) => {
      const s = (window as any).studioCtx;
      await s.awaitStudioReady();
      const v = s.focusedViewCtx();
      const tpl = v.component.tplTree.children.find(
        (node: any) => node.uuid === expectedTarget.tpl,
      );
      if (v.component.uuid !== expectedTarget.page || !tpl) {
        throw new Error("Restored page content missing after reopen");
      }
      s.changeSelection(() => v.setStudioFocusByTpl(tpl));
    }, target);
    await expect.poll(() => selectedOpacity(page)).toBe("0.73");
    expect(errors).toEqual([]);
  } finally {
    await apiClient.removeProjectAfterTest(projectId, "user2@example.com");
  }
});
