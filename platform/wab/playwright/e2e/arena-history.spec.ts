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

for (const kind of [
  "component",
  "free artboard",
  "screen size",
  "variant artboard",
] as const) {
  test(`recreates a ${kind} canvas when redoing creation and undoing deletion`, async ({
    apiClient,
    page,
    models,
  }) => {
    const projectId = await apiClient.setupNewProject({
      name: "arena-history",
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        message.text().startsWith("Studio operation failed")
      ) {
        errors.push(message.text());
      }
    });
    try {
      await goToProject(page, `/projects/${projectId}`);
      const studio = models.studio.frame;
      const body = studioBody(page);
      const position = () =>
        body.evaluate(
          () => (window as any).studioCtx.undoLog._nextInsertPos as number,
        );
      await showAuditLayers(page);
      const createComponent = async () => {
        await studio.locator("#nav-dropdown-plus-btn").click();
        await studio.getByRole("menuitem", { name: "New component" }).click();
        await studio.locator('[data-test-id="prompt"]').fill("RestoredCard");
        await studio.locator('[data-test-id="prompt-submit"]').click();
      };
      if (kind === "variant artboard") {
        await createComponent();
        await expect
          .poll(() =>
            body.evaluate(
              () => (window as any).studioCtx.currentArena?.component?.name,
            ),
          )
          .toBe("RestoredCard");
        await body.evaluate(async () => {
          const s = (window as any).studioCtx;
          if (s.focusedMode) {
            await s.changeUnsafe(() => s.turnFocusedModeOff());
          }
          await s.awaitStudioReady();
        });
      } else if (kind !== "component") {
        await createAuditPage(page, "画板恢复验收");
        await body.evaluate(async (_body, scenario) => {
          const s = (window as any).studioCtx;
          if (scenario === "free artboard") {
            await s.changeUnsafe(() => s.addArena("画板分组"));
          } else if (s.focusedMode) {
            await s.changeUnsafe(() => s.turnFocusedModeOff());
            await s.awaitStudioReady();
          }
        }, kind);
      }

      const beforeCreation = await position();
      let createdFrame: string | undefined;
      if (kind === "component") {
        await createComponent();
      } else {
        createdFrame = await body.evaluate(async (_body, scenario) => {
          const s = (window as any).studioCtx;
          return s.changeUnsafe(() => {
            if (scenario === "free artboard") {
              return s
                .siteOps()
                .createNewFrameForMixedArena(s.site.pageArenas[0].component)
                .uuid;
            }
            const frames = () =>
              s.currentArena.matrix.rows.flatMap((row: any) =>
                row.cols.map((cell: any) => cell.frame),
              );
            const before = new Set(frames());
            if (scenario === "screen size") {
              s.siteOps().addScreenSizeToPageArenas({
                name: "History viewport",
                width: 777,
                height: 650,
              });
            } else {
              s.siteOps().createStyleVariant(s.currentArena.component, [
                ":hover",
              ]);
            }
            const board = frames().find((frame: any) => !before.has(frame));
            if (!board) {
              throw new Error("The new managed artboard is missing");
            }
            s.setStudioFocusOnFrame({ frame: board, autoZoom: true });
            return board.uuid;
          });
        }, kind);
      }
      await expect.poll(position).toBeGreaterThan(beforeCreation);
      if (createdFrame) {
        await expect(
          studio.locator(`iframe[data-plasmic-frame-uuid="${createdFrame}"]`),
        ).toHaveCount(1);
      }
      await body.evaluate(() => (window as any).studioCtx.awaitStudioReady());
      await models.studio.leftPanel.insertNode("Text");
      await setSelectedOpacity(page, "0.42");

      const selection = () =>
        body.evaluate(() => {
          const s = (window as any).studioCtx;
          const view = s.focusedViewCtx();
          return {
            arena: s.currentArena?.uid,
            frame: view?.arenaFrame().uuid,
            component: view?.component.uuid,
            tpl: view?.focusedTpl()?.uuid,
          };
        });
      const target = await selection();
      expect(target.frame).toBeTruthy();
      expect(target.tpl).toBeTruthy();
      if (createdFrame) {
        expect(target.frame).toBe(createdFrame);
      }
      const iframe = studio.locator(
        `iframe[data-plasmic-frame-uuid="${target.frame}"]`,
      );
      const afterEditing = await position();

      const replay = async (action: "Undo" | "Redo") => {
        const before = await position();
        await studio.getByRole("button", { name: action, exact: true }).click();
        await expect.poll(position).toBe(before + (action === "Undo" ? -1 : 1));
        await expect
          .poll(
            () =>
              body.evaluate(
                () => !(window as any).studioCtx.hasPendingModelChanges(),
              ),
            { timeout: 15000 },
          )
          .toBe(true);
      };
      const expectRestored = async () => {
        await expect(iframe).toBeVisible();
        await expect.poll(selection).toEqual(target);
        await expect.poll(() => selectedOpacity(page)).toBe("0.42");
        await expect
          .poll(() =>
            body.evaluate(() => (window as any).studioCtx.activeCanvasReady),
          )
          .toBe(true);
      };

      for (let step = afterEditing; step > beforeCreation; step--) {
        await replay("Undo");
      }
      await expect(iframe).toHaveCount(0);
      for (let step = beforeCreation; step < afterEditing; step++) {
        await replay("Redo");
      }
      await expectRestored();

      const deletion = body.evaluate(async (_body, scenario) => {
        const s = (window as any).studioCtx;
        const view = s.focusedViewCtx();
        if (scenario === "component") {
          await s.changeUnsafe(() =>
            s.siteOps().tryRemoveComponent(view.component),
          );
        } else {
          await s.siteOps().removeArenaFrame(view.arenaFrame());
        }
      }, kind);
      await Promise.all([
        deletion,
        kind === "variant artboard"
          ? studio.locator('[data-test-id="confirm"]').click()
          : undefined,
      ]);
      await expect(iframe).toHaveCount(0);
      await replay("Undo");
      await expectRestored();
      await replay("Redo");
      await expect(iframe).toHaveCount(0);
      await replay("Undo");
      await expectRestored();

      await setSelectedOpacity(page, "0.73");
      await replay("Undo");
      await expect.poll(() => selectedOpacity(page)).toBe("0.42");
      await replay("Redo");
      await expect.poll(() => selectedOpacity(page)).toBe("0.73");
      expect(errors).toEqual([]);
    } finally {
      await apiClient.removeProjectAfterTest(projectId, "user2@example.com");
    }
  });
}
