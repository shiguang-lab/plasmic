import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Repository acceptance uses the existing WAB Playwright installation.
const require = createRequire(
  new URL("../../../platform/wab/package.json", import.meta.url),
);
const { chromium } = require("playwright");
const browser = await chromium.launch({
  executablePath:
    process.env.PLASMIC_BROWSER_PATH ??
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1024 },
  timezoneId: "Asia/Shanghai",
});
page.setDefaultTimeout(15000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const read = async (id) => JSON.parse(await page.getByTestId(id).innerText());
async function expectValue(id, key, expected) {
  await page.waitForFunction(
    ({ id, key, expected }) => {
      const element = document.querySelector(`[data-testid="${id}"]`);
      if (!element) return false;
      const value = JSON.parse(element.textContent);
      return value[key] === expected;
    },
    { id, key, expected },
  );
}
try {
  await page.goto(
    process.env.PLASMIC_SEARCH_FORM_URL ?? "http://127.0.0.1:3106/?search-form",
  );
  await expectValue("draft", "keyword", "initial");
  assert.equal(
    await page.getByRole("textbox", { name: /日期/ }).isVisible(),
    false,
  );
  await page.getByRole("textbox", { name: /关键词/ }).fill("edited");
  await page.getByRole("checkbox", { name: /仅启用/ }).check();
  await page.getByRole("button", { name: /^查\s*询$/ }).click();
  await expectValue("applied", "keyword", "edited");
  assert.equal((await read("applied")).enabled, true);
  assert.equal((await read("applied")).day, "2026-10-04");
  assert((await read("counts")).controlEvents > 0);

  await page.getByText("展开", { exact: true }).click();
  await page.getByRole("textbox", { name: /日期/ }).fill("2026-10-05");
  await page.getByRole("textbox", { name: /日期/ }).press("Enter");
  await expectValue("draft", "day", "2026-10-04T16:00:00.000Z");
  await page.getByText("收起", { exact: true }).click();
  await page.getByRole("button", { name: /^查\s*询$/ }).click();
  await expectValue("applied", "day", "2026-10-04T16:00:00.000Z");

  await page.getByRole("button", { name: /^重\s*置$/ }).click();
  await expectValue("applied", "keyword", "initial");
  assert.equal((await read("applied")).enabled, false);
  assert.equal((await read("applied")).status, "all");
  assert.equal((await read("applied")).day, "2026-10-04");
  await page.getByRole("combobox", { name: /状态/ }).click();
  await page.getByText("启用", { exact: true }).last().click();
  await expectValue("draft", "status", "active");
  await page.locator(".ant-select").hover();
  await page.locator(".ant-select-clear").click();
  await expectValue("draft", "status", "all");
  await page.getByRole("button", { name: /^导\s*出$/ }).click();
  await expectValue("counts", "exports", 1);

  await page.getByRole("button", { name: "设置草稿" }).click();
  await expectValue("draft", "keyword", "via-action");
  await page.getByRole("button", { name: "触发查询" }).click();
  await expectValue("applied", "keyword", "via-action");
  await page.getByRole("button", { name: "触发重置" }).click();
  await expectValue("draft", "keyword", "initial");

  await page.getByRole("button", { name: "插入/删除地区" }).click();
  await expectValue("draft", "region", "MX");
  await page.getByText("展开", { exact: true }).click();
  await page.getByRole("textbox", { name: /地区/ }).fill("BR");
  await page.getByRole("button", { name: "修改字段标签" }).click();
  assert.equal(
    await page.getByRole("textbox", { name: /市场/ }).inputValue(),
    "BR",
  );
  await page.getByRole("button", { name: /^查\s*询$/ }).click();
  await expectValue("applied", "region", "BR");
  await page.getByRole("button", { name: "插入/删除地区" }).click();
  await page.getByRole("button", { name: /^查\s*询$/ }).click();
  await page.waitForFunction(
    () =>
      !(
        "region" in
        JSON.parse(
          document.querySelector('[data-testid="applied"]').textContent,
        )
      ),
  );
  assert.equal("region" in (await read("draft")), false);

  await page.getByRole("button", { name: "切换必填" }).click();
  await page.getByRole("textbox", { name: /关键词/ }).fill("");
  const appliedBeforeInvalid = await read("applied");
  await page.getByRole("button", { name: /^查\s*询$/ }).click();
  await page.getByText("请填写关键词", { exact: true }).waitFor();
  assert.deepEqual(await read("applied"), appliedBeforeInvalid);
  await page.getByRole("textbox", { name: /关键词/ }).fill("valid");
  await page.getByRole("button", { name: /^查\s*询$/ }).click();
  await expectValue("applied", "keyword", "valid");
  await page.locator(".ant-picker").hover();
  await page
    .locator(".ant-picker")
    .getByRole("button", { name: "Clear" })
    .click();
  await expectValue("draft", "day", null);
  await page.getByText("收起", { exact: true }).click();
  await page.getByRole("button", { name: /^查\s*询$/ }).click();
  await page.getByText("请填写日期", { exact: true }).waitFor();
  assert.equal(
    await page.getByRole("textbox", { name: /日期/ }).isVisible(),
    true,
  );
  await page.getByRole("button", { name: "触发重置" }).click();
  const output = fileURLToPath(
    new URL("../../../desktop/desktop-report/search-form/", import.meta.url),
  );
  await mkdir(output, { recursive: true });
  await page.screenshot({ path: `${output}/runtime.png`, fullPage: true });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: query/hidden values, collapse preservation, reset, clearValue, Checkbox, control events, extra Slot, ref actions, field insert/edit/delete and hidden-field validation expansion",
  );
} finally {
  await browser.close();
}
