import { expect, Page } from "@playwright/test";
import { getStudioFrame } from "./studio-utils";

export function studioBody(page: Page) {
  return getStudioFrame(page).locator("body");
}

export async function showAuditLayers(page: Page) {
  const frame = getStudioFrame(page);
  await expect.poll(() => studioBody(page).evaluate(() => {
    const studio = (window as any).studioCtx;
    return !!studio?.initialRouteReady && !!studio?.initialViewportReady;
  }), { timeout: 30000 }).toBe(true);
  const layers = frame.getByRole("button", { name: /^(Layers|图层)$/ });
  if ((await layers.getAttribute("aria-current")) !== "true") { await layers.click(); }
  await expect(frame.locator("#nav-dropdown-plus-btn")).toBeVisible();
}

/** Create through the current project directory rather than the removed scratch-artboard insertable. */
export async function createAuditPage(page: Page, name: string) {
  const frame = getStudioFrame(page);
  await showAuditLayers(page);
  await frame.locator("#nav-dropdown-plus-btn").click();
  await frame.getByRole("menuitem", { name: /^(New page|新建页面)$/ }).click();
  await frame.locator('[data-test-id="prompt"]').fill(name);
  await frame.locator('[data-test-id="prompt-submit"]').click();
  const frameUuid = await studioBody(page).evaluate(async () => {
    const studio = (window as any).studioCtx;
    await studio.awaitStudioReady();
    const active = studio.activeCanvasFrame ?? studio.focusedViewCtx()?.arenaFrame();
    if (!active) { throw new Error("Created page has no active canvas frame"); }
    return active.uuid;
  });
  await expect(frame.locator(`iframe[data-plasmic-frame-uuid="${frameUuid}"]`)).toBeVisible();
}

export async function selectedOpacity(page: Page) {
  return studioBody(page).evaluate(() => {
    const studio = (window as any).studioCtx, view = studio.focusedViewCtx();
    const tpl = view?.focusedTpl(), val = tpl && view.renderState.tpl2bestVal(tpl);
    const dom = val && view.renderState.sel2dom(val, view.canvasCtx);
    return dom?.length ? view.canvasCtx.win().getComputedStyle(dom[0]).opacity : null;
  });
}

export async function setSelectedOpacity(page: Page, opacity: string) {
  await studioBody(page).evaluate(async (_body, value) => {
    const studio = (window as any).studioCtx, view = studio.focusedViewCtx(), tpl = view?.focusedTpl();
    if (!tpl) { throw new Error("No selected template for the live style command"); }
    await studio.changeUnsafe(() => { view.variantTplMgr().ensureBaseVariantSetting(tpl).rs.values.opacity = value; });
    await studio.awaitEval();
  }, opacity);
  await expect.poll(() => selectedOpacity(page)).toBe(opacity);
}

