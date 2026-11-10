import { expect } from "@playwright/test";
import { test } from "../fixtures/test";

import bundles from "../bundles";
import { goToProject } from "../utils/studio-utils";

const BUNDLE_NAME = "state-management";

test.describe("interactions-event-handlers", () => {
  let projectId: string;
  test.beforeEach(async ({ apiClient, page }) => {
    projectId = await apiClient.importProjectFromTemplate(bundles[BUNDLE_NAME]);

    await goToProject(page, `/projects/${projectId}`);
  });

  test.afterEach(async ({ apiClient }) => {
    await apiClient.removeProjectAfterTest(projectId, "user2@example.com");
  });

  test("can create event handler interactions", async ({ models, page }) => {
    await models.studio.switchArena("invoke event handler interactions");
    await models.studio.waitStudioLoaded();

    const contentFrame = models.studio.frame
      .locator("iframe")
      .first()
      .contentFrame();

    await models.studio.rightPanel.createNewEventHandler("onIncrement", [
      { name: "val", type: "Number" },
      { name: "message", type: "Text" },
    ]);

    await contentFrame
      .locator("text=invoke event handler")
      .click({ force: true });

    await models.studio.rightPanel.addComplexInteraction("onClick", [
      {
        actionName: "invokeEventHandler",
        args: {
          eventRef: "onIncrement",
          arguments: {
            val: "$props.defaultCount+1",
            message: "`Last number: ${$props.defaultCount}`",
          },
        },
      },
    ]);

    await models.studio.switchArena("use invoke event handler");
    await models.studio.waitStudioLoaded();

    const contentFrame2 = models.studio.frame
      .locator("iframe")
      .nth(1)
      .contentFrame();

    await page.waitForTimeout(2_000);
    await contentFrame2
      .locator(':text("invoke event handler")')
      .click({ force: true });

    await models.studio.rightPanel.addComplexInteraction("onIncrement", [
      {
        actionName: "updateVariable",
        args: {
          variable: ["count"],
          operation: "newValue",
          value: "val",
        },
      },
      {
        actionName: "updateVariable",
        args: {
          variable: ["lastMessage"],
          operation: "newValue",
          value: "message",
        },
      },
    ]);

    const selection = () => models.studio.frame.locator("body").evaluate(() => (window as any).studioCtx.focusedViewCtx()?.focusedTpl()?.uuid);
    const selected = await selection();
    await models.studio.interactiveSwitch.click();
    await expect(models.studio.interactiveSwitch).toHaveAttribute("aria-pressed", "true");
    await contentFrame2.locator("text=invoke event handler").click();
    await expect(contentFrame2.locator("#plasmic-app div").getByText("6", { exact: true })).toBeVisible();
    await contentFrame2.locator("text=invoke event handler").click();
    await expect(contentFrame2.locator("#plasmic-app div").getByText("7", { exact: true })).toBeVisible();
    expect(await selection()).toBe(selected);
    await models.studio.interactiveSwitch.click();
    await expect(models.studio.interactiveSwitch).toHaveAttribute("aria-pressed", "false");

    await models.studio.withinLiveMode(async (liveFrame) => {
      await expect(
        liveFrame.locator("#plasmic-app div").getByText("5"),
      ).toBeVisible();
      await expect(
        liveFrame.locator("#plasmic-app div").getByText("none"),
      ).toBeVisible();

      await liveFrame.locator("text=invoke event handler").click();
      await expect(
        liveFrame.locator("#plasmic-app div").getByText("6"),
      ).toBeVisible();
      await expect(
        liveFrame.locator("#plasmic-app div").getByText("Last number: 5"),
      ).toBeVisible();

      await liveFrame.locator("text=invoke event handler").click();
      await expect(
        liveFrame.locator("#plasmic-app div").getByText("7"),
      ).toBeVisible();
      await expect(
        liveFrame.locator("#plasmic-app div").getByText("Last number: 6"),
      ).toBeVisible();
    });
  });
});
