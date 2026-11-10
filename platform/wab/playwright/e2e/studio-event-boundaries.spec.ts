import { expect, type Page } from "@playwright/test";
import { test } from "../fixtures/test";
import type { StudioModel } from "../models/studio-model";
import { modifierKey } from "../utils/key-utils";
import {
  createAuditPage,
  setSelectedOpacity,
  showAuditLayers,
} from "../utils/migration-live";
import { goToProject } from "../utils/studio-utils";

async function beginPanelDrag(page: Page, studio: StudioModel) {
  if (!(await studio.leftPanel.addContainer.isVisible())) {
    await studio.leftPanel.addButton.click();
  }
  await studio.leftPanel.addSearchInput.fill("Vertical stack");
  const option = studio.frame
    .getByRole("option", { name: "Vertical stack", exact: true })
    .first();
  await option.hover();
  const source = await option.boundingBox();
  if (!source) {
    throw new Error("Insertable is not on screen");
  }
  const x = source.x + source.width / 2;
  const y = source.y + source.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 12, y, { steps: 4 });
  await expect.poll(() => isDragging(studio)).toBe(true);
}

async function moveDragToArtboard(page: Page, studio: StudioModel) {
  const point = await studio.frame.locator("body").evaluate(() => {
    const sc = (window as any).studioCtx;
    const viewport = sc
      .focusedViewCtx()
      .canvasCtx.viewport() as HTMLIFrameElement;
    const frame = viewport.getBoundingClientRect();
    const clipper = sc.canvasClipper().getBoundingClientRect() as DOMRect;
    const left = Math.max(frame.left, clipper.left);
    const right = Math.min(frame.right, clipper.right);
    const y =
      (Math.max(frame.top, clipper.top) +
        Math.min(frame.bottom, clipper.bottom)) /
      2;
    for (const fraction of [0.5, 0.75, 0.25]) {
      const x = left + (right - left) * fraction;
      const hit = document
        .elementsFromPoint(x, y)
        .find((element) => !element.closest(".drag-guard"));
      if (hit && viewport.parentElement?.contains(hit)) {
        return { x, y };
      }
    }
    return null;
  });
  const origin = await page.locator("iframe.studio-frame").boundingBox();
  if (!point || !origin) {
    throw new Error("No exposed artboard drop point");
  }
  await page.mouse.move(origin.x + point.x, origin.y + point.y, { steps: 18 });
}

function isDragging(studio: StudioModel) {
  return studio.frame
    .locator("body")
    .evaluate(() => (window as any).studioCtx.isDraggingObject());
}

function countDescendants(studio: StudioModel) {
  return studio.frame.locator("body").evaluate(() => {
    const count = (node: any): number =>
      1 +
      (node.children ?? []).reduce(
        (sum: number, child: any) => sum + count(child),
        0,
      );
    return count((window as any).studioCtx.focusedViewCtx().component.tplTree);
  });
}

test.describe("Studio event boundaries", () => {
  let projectId: string;
  test.beforeEach(async ({ apiClient, page }) => {
    projectId = await apiClient.setupNewProject({ name: "event-boundaries" });
    await goToProject(page, `/projects/${projectId}`);
    await createAuditPage(page, "EventAudit");
  });
  test.afterEach(async ({ apiClient }) => {
    await apiClient.removeProjectAfterTest(projectId, "user2@example.com");
  });

  test("outline selection has explicit model focus and preserves native copy/paste commands", async ({
    page,
    models,
  }) => {
    await models.studio.leftPanel.insertNode("Vertical stack");
    await showAuditLayers(page);
    await models.studio.leftPanel.focusedTreeNode.click();
    const focus = await models.studio.frame.locator("body").evaluate(() => {
      const active = document.activeElement;
      return {
        html: active?.outerHTML.slice(0, 800),
        owner: active
          ?.closest("[data-studio-model-input]")
          ?.outerHTML.slice(0, 400),
        scopes: [...document.querySelectorAll("[data-studio-model-input]")].map(
          (element) => element.outerHTML.slice(0, 220),
        ),
        model: active?.matches(
          "[data-studio-model-input], [data-studio-model-input] > [data-overlayscrollbars-viewport]",
        ),
      };
    });
    expect(focus.model, JSON.stringify(focus)).toBe(true);
    const childCount = () =>
      models.studio.frame
        .locator("body")
        .evaluate(
          () =>
            (window as any).studioCtx.focusedViewCtx().component.tplTree
              .children.length as number,
        );
    const count = await childCount();
    await page.keyboard.press(`${modifierKey}+c`);
    for (let index = 1; index <= 10; index++) {
      await page.keyboard.press(`${modifierKey}+v`);
      await expect.poll(childCount).toBe(count + index);
      await expect(models.studio.leftPanel.focusedTreeNode).toBeVisible();
    }
  });

  test("component-panel drags insert, cancel, reject outside drops, and can be repeated", async ({
    page,
    models,
  }) => {
    const body = models.studio.frame.locator("body");
    const childCount = () =>
      body.evaluate(
        () =>
          (window as any).studioCtx.focusedViewCtx().component.tplTree.children
            .length as number,
      );
    const count = await childCount();
    async function startDrag() {
      await beginPanelDrag(page, models.studio);
      await moveDragToArtboard(page, models.studio);
    }
    await startDrag();
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect.poll(childCount).toBe(count);
    await expect
      .poll(() =>
        body.evaluate(() => (window as any).studioCtx.isDraggingObject()),
      )
      .toBe(false);
    await startDrag();
    await page.mouse.move(1000, 30, { steps: 8 });
    await page.mouse.up();
    await expect.poll(childCount).toBe(count);
    await startDrag();
    await page.mouse.up();
    await expect.poll(childCount).toBe(count + 1);
    await expect
      .poll(() =>
        body.evaluate(() => (window as any).studioCtx.isDraggingObject()),
      )
      .toBe(false);
    await page.keyboard.press(`${modifierKey}+z`);
    await expect.poll(childCount).toBe(count);
    await page.keyboard.press(`${modifierKey}+Shift+z`);
    await expect.poll(childCount).toBe(count + 1);
  });

  test("interactive mode keeps the model unchanged until design shortcuts resume", async ({
    page,
    models: { studio },
  }) => {
    const count = await countDescendants(studio);
    await studio.leftPanel.insertNode("Vertical stack");
    await expect.poll(() => countDescendants(studio)).toBe(count + 1);
    const interactive = () =>
      studio.frame
        .locator("body")
        .evaluate(() => (window as any).studioCtx.isInteractiveMode as boolean);
    await page.keyboard.press("Shift+i");
    await expect.poll(interactive).toBe(true);
    await page.keyboard.press(`${modifierKey}+z`);
    await studio.frame
      .locator("body")
      .evaluate(() => (window as any).studioCtx.awaitEval());
    expect(await countDescendants(studio)).toBe(count + 1);
    await page.keyboard.press("Shift+i");
    await expect.poll(interactive).toBe(false);
    await page.keyboard.press(`${modifierKey}+z`);
    await expect.poll(() => countDescendants(studio)).toBe(count);
  });

  test("switching modes cancels a component drag before mouseup", async ({
    page,
    models: { studio },
  }) => {
    const count = await countDescendants(studio);
    await beginPanelDrag(page, studio);
    await moveDragToArtboard(page, studio);
    await studio.frame.locator("body").evaluate(async () => {
      const sc = (window as any).studioCtx;
      await sc.changeUnsafe(() => sc.toggleInteractiveMode());
    });
    await expect.poll(() => isDragging(studio)).toBe(false);
    await page.mouse.up();
    expect(await countDescendants(studio)).toBe(count);
  });

  test("an inspector covering an artboard owns the drop location", async ({
    page,
    models: { studio },
  }) => {
    await studio.leftPanel.insertNode("Vertical stack");
    const panel = studio.frame.locator(
      '[data-test-id="right-panel-shell"][data-open="true"]',
    );
    await expect(panel).toBeVisible();
    const count = await countDescendants(studio);
    const point = await panel.evaluate(async (element) => {
      const sc = (window as any).studioCtx;
      const clipper = sc.canvasClipper() as HTMLElement;
      const frame = clipper.querySelector("iframe")!;
      const initial = frame.getBoundingClientRect();
      const x = element.getBoundingClientRect().left + 32;
      clipper.scrollLeft += initial.left + initial.width / 2 - x;
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      const bounds = frame.getBoundingClientRect();
      const y = bounds.top + Math.min(80, bounds.height / 2);
      return {
        x,
        y,
        covered:
          x > bounds.left &&
          x < bounds.right &&
          element.contains(document.elementFromPoint(x, y)),
      };
    });
    expect(point.covered).toBe(true);
    const origin = await page.locator("iframe.studio-frame").boundingBox();
    if (!origin) {
      throw new Error("Studio is not on screen");
    }
    await beginPanelDrag(page, studio);
    await page.mouse.move(origin.x + point.x, origin.y + point.y, {
      steps: 18,
    });
    expect(
      await panel.evaluate(
        (element, { x, y }) =>
          element.contains(
            document
              .elementsFromPoint(x, y)
              .find((hit) => !hit.closest(".drag-guard")) ?? null,
          ),
        point,
      ),
    ).toBe(true);
    await page.mouse.up();
    await expect.poll(() => isDragging(studio)).toBe(false);
    expect(await countDescendants(studio)).toBe(count);
  });

  test("leaving the Studio iframe clears the held pan key", async ({
    page,
    models: { studio },
  }) => {
    await studio.leftPanel.insertNode("Vertical stack");
    const space = () =>
      studio.frame
        .locator("body")
        .evaluate(() => !!(window as any).studioCtx.isSpaceDown());
    await page.keyboard.down("Space");
    await expect.poll(space).toBe(true);
    await page.evaluate(() => {
      document.body.tabIndex = -1;
      document.body.focus();
    });
    await page.keyboard.up("Space");
    await expect.poll(space).toBe(false);
  });

  test("Escape clears the node selection while retaining model focus", async ({
    page,
    models: { studio },
  }) => {
    await studio.leftPanel.insertNode("Vertical stack");
    const state = () =>
      studio.frame.locator("body").evaluate(() => ({
        selected: !!(window as any).studioCtx.focusedViewCtx()?.focusedTpl(),
        focused: !!document.activeElement?.matches("[data-studio-model-input]"),
      }));
    await expect.poll(state).toEqual({ selected: true, focused: true });
    await page.keyboard.press("Escape");
    await expect.poll(state).toEqual({ selected: false, focused: true });
  });

  test("Escape closes the shortcuts dialog before the project menu", async ({
    page,
    models: { studio },
  }) => {
    const menu = studio.frame.getByRole("button", {
      name: "Project menu",
      exact: true,
    });
    await menu.click();
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("?");
    const shortcuts = studio.frame.getByRole("dialog", {
      name: "Keyboard Shortcuts",
    });
    await expect(shortcuts).toBeVisible();
    await shortcuts.getByRole("textbox").focus();
    await page.keyboard.press("Escape");
    await expect(shortcuts).toBeHidden();
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await menu.focus();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expect(menu).toBeFocused();
  });

  test("canvas pan and zoom stay local and a cross-panel release ends the active gesture", async ({
    page,
    models,
  }) => {
    const body = models.studio.frame.locator("body");
    const canvas = models.studio.frame.locator(
      ".canvas-editor__canvas-clipper",
    );
    const bounds = await canvas.boundingBox();
    if (!bounds) {
      throw new Error("Canvas is not visible");
    }
    const state = () =>
      body.evaluate(() => {
        const studio = (window as any).studioCtx;
        return {
          zoom: studio.zoom,
          scroll: { ...studio.viewportCtx.scroll() },
          panning: studio.isPanning(),
        };
      });
    const before = await state();
    await page.mouse.move(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
    );
    await page.mouse.down({ button: "middle" });
    await expect.poll(async () => (await state()).panning).toBe(true);
    await page.mouse.move(
      bounds.x + bounds.width / 2 - 60,
      bounds.y + bounds.height / 2 - 40,
      { steps: 10 },
    );
    await expect
      .poll(async () => JSON.stringify((await state()).scroll))
      .not.toBe(JSON.stringify(before.scroll));
    await page.mouse.move(30, 100, { steps: 10 });
    await page.mouse.up({ button: "middle" });
    await expect.poll(async () => (await state()).panning).toBe(false);
    const released = await state();
    await page.mouse.move(60, 180, { steps: 5 });
    expect((await state()).scroll).toEqual(released.scroll);
    await page.mouse.move(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
    );
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -100);
    await page.keyboard.up("Control");
    await expect.poll(async () => (await state()).zoom).not.toBe(released.zoom);
    await models.studio.leftPanel.addButton.click();
    const panel = await models.studio.leftPanel.addSearchInput.boundingBox();
    if (!panel) {
      throw new Error("Insert panel is not visible");
    }
    const local = await state();
    await page.mouse.move(panel.x + 10, panel.y + 10);
    await page.mouse.wheel(0, 200);
    expect(await state()).toEqual(local);
  });

  test("existing canvas nodes move, cancel with Escape, and remain selectable by marquee", async ({
    page,
    models,
  }) => {
    await models.studio.leftPanel.insertNode("Vertical stack");
    const body = models.studio.frame.locator("body");
    const uuid = await body.evaluate(async () => {
      const studio = (window as any).studioCtx,
        view = studio.focusedViewCtx(),
        tpl = view.focusedTpl();
      await studio.changeUnsafe(() => {
        Object.assign(
          view.variantTplMgr().ensureBaseVariantSetting(view.component.tplTree)
            .rs.values,
          { display: "block", position: "relative", height: "768px" },
        );
        Object.assign(
          view.variantTplMgr().ensureBaseVariantSetting(tpl).rs.values,
          {
            position: "absolute",
            left: "100px",
            top: "120px",
            width: "120px",
            height: "80px",
          },
        );
      });
      await studio.awaitEval();
      const val = view.renderState.tpl2bestVal(tpl);
      const element = view.renderState.sel2dom(val, view.canvasCtx)[0];
      element.setAttribute("data-event-audit-drag", "");
      return tpl.uuid as string;
    });
    await models.studio.frame
      .getByRole("button", { name: "Locate current canvas" })
      .click();
    const target = models.studio.componentFrame.locator(
      "[data-event-audit-drag]",
    );
    const position = () =>
      body.evaluate((_body, id) => {
        const view = (window as any).studioCtx.focusedViewCtx();
        const find = (node: any): any =>
          node.uuid === id
            ? node
            : (node.children ?? []).map(find).find(Boolean);
        const values = view
          .variantTplMgr()
          .ensureBaseVariantSetting(find(view.component.tplTree)).rs.values;
        return { left: values.left, top: values.top };
      }, uuid);
    const dragging = () =>
      body.evaluate(() => (window as any).studioCtx.isDraggingObject());
    const before = await position();
    async function startDrag(dx: number, dy: number) {
      const bounds = await target.boundingBox();
      if (!bounds) {
        throw new Error("Canvas drag target is not visible");
      }
      const x = bounds.x + bounds.width / 2,
        y = bounds.y + bounds.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + dx, y + dy, { steps: 15 });
      await expect.poll(dragging).toBe(true);
    }
    await startDrag(60, 35);
    await page.mouse.up();
    await expect.poll(dragging).toBe(false);
    await expect.poll(position).not.toEqual(before);
    await startDrag(45, -20);
    const atCancel = await position();
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect.poll(dragging).toBe(false);
    // Existing free-position movement is live; Escape ends following and cancels the pending drop.
    await page.mouse.move(900, 100);
    await expect.poll(position).toEqual(atCancel);
    const bounds = await target.boundingBox();
    if (!bounds) {
      throw new Error("Canvas target disappeared after canceled drag");
    }
    await page.mouse.move(bounds.x - 20, bounds.y - 20);
    await page.mouse.down();
    await page.mouse.move(
      bounds.x + bounds.width + 20,
      bounds.y + bounds.height + 20,
      { steps: 15 },
    );
    await page.mouse.up();
    await expect
      .poll(() =>
        body.evaluate(
          (_body, id) =>
            (window as any).studioCtx
              .focusedViewCtx()
              .focusedTpls()
              .some((tpl: any) => tpl?.uuid === id),
          uuid,
        ),
      )
      .toBe(true);
  });

  test("panel typing and native text copying in a portal preserve the canvas selection", async ({
    page,
    models,
    context,
  }) => {
    await models.studio.leftPanel.insertNode("Text");
    await setSelectedOpacity(page, "0.42");
    await showAuditLayers(page);
    const body = models.studio.frame.locator("body");
    const selection = () =>
      body.evaluate(
        () => (window as any).studioCtx.focusedViewCtx()?.focusedTpl()?.uuid,
      );
    const selected = await selection();
    await models.studio.leftPanel.focusedTreeNode
      .locator('[data-test-class="left-panel-indicator"] > div')
      .hover();
    const label = models.studio.frame
      .locator(".defined-indicator__source-name")
      .filter({ hasText: /Opacity|不透明度/ });
    await expect(label).toBeVisible();
    await label.dblclick();
    const text = await body.evaluate(() => document.getSelection()?.toString());
    expect(text?.length).toBeGreaterThan(0);
    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: "https://localhost:3008",
    });
    await page.keyboard.press(`${modifierKey}+c`);
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe(text);
    expect(await selection()).toBe(selected);
    await models.studio.leftPanel.addButton.click();
    await models.studio.leftPanel.addSearchInput.fill("r t space");
    await page.keyboard.press("Backspace");
    expect(await selection()).toBe(selected);
    await page.keyboard.press("Escape");
    expect(await selection()).toBe(selected);
  });
});
