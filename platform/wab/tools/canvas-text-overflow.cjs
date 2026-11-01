// Run with: node tools/canvas-text-overflow.cjs
// Compare actual browser pixels for native cells and CanvasText's readonly boxes.
const assert = require("node:assert/strict");
const path = require("node:path");
const sass = require("sass");
const { chromium } = require("playwright");

async function main() {
  const css = sass.compile(
    path.join(__dirname, "../src/wab/styles/canvas/canvas.scss"),
  ).css;
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 700, height: 300 },
    });
    await page.setContent(`<style>${css}
      body { font: 16px Arial; line-height: 24px; }
      table { table-layout: fixed; border-collapse: collapse; }
      td { height: 64px; padding: 16px; vertical-align: top; }
      .ant-table-cell-ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    </style><table id="native"><tr><td class="ant-table-cell-ellipsis"></td></tr></table>
    <table id="canvas"><tr><td class="ant-table-cell-ellipsis" data-plasmic-canvas-part="column"><span class="__wab_text"><span class="__wab_rich_text" style="display:block"></span></span></td></tr></table>`);
    const values = [
      [108, "María López"],
      [161, "Solicité el préstamo y sigue en revisión desde hace dos horas."],
      [168, "借款申请提交后一直显示审核中，等了两个小时没有结果"],
      [124, "Samsung Galaxy A54"],
      [108, "Ana G."],
      [108, "0"],
      [108, "false"],
      [108, ""],
    ];
    for (const rawText of [false, true]) {
      for (const [width, text] of values) {
        await page.evaluate(
          ({ width, text, rawText }) => {
            for (const table of document.querySelectorAll("table")) {
              table.style.width = `${width}px`;
            }
            for (const element of [
              document.querySelector("#native td"),
              document.querySelector(".__wab_rich_text"),
            ]) {
              element.replaceChildren();
              const content = rawText
                ? document.createElement("span")
                : document.createTextNode(text);
              if (rawText) content.textContent = text;
              element.append(content);
            }
          },
          { width, text, rawText },
        );
        const native = await page.locator("#native td").screenshot();
        const canvas = await page.locator("#canvas td").screenshot();
        const sizing = await page.locator("#canvas td").evaluate((cell) => {
          const range = document.createRange();
          range.selectNodeContents(cell);
          const style = getComputedStyle(cell);
          const available =
            cell.clientWidth -
            parseFloat(style.paddingLeft) -
            parseFloat(style.paddingRight);
          const rich = cell.querySelector(".__wab_rich_text");
          return {
            overflows: range.getBoundingClientRect().width > available,
            fits: rich.scrollWidth <= rich.clientWidth,
          };
        });
        if (sizing.overflows) {
          assert(
            native.equals(canvas),
            `Canvas differs from native ellipsis: ${JSON.stringify({ width, text, rawText })}`,
          );
        } else {
          assert(
            sizing.fits,
            `Short value is clipped: ${JSON.stringify({ width, text, rawText })}`,
          );
        }
        assert.equal(
          await page.locator("#canvas td").textContent(),
          text,
          "Complete bound text is preserved",
        );
      }
    }
    const exclusions = await page.evaluate(() => {
      const cell = document.querySelector("#canvas td");
      const text = cell.firstElementChild;
      const rich = text.firstElementChild;
      text.classList.add("__wab_editing");
      const editing = [
        getComputedStyle(text).overflow,
        getComputedStyle(rich).overflow,
      ];
      text.classList.remove("__wab_editing");
      cell.classList.remove("ant-table-cell-ellipsis");
      const plain = [
        getComputedStyle(text).overflow,
        getComputedStyle(rich).overflow,
      ];
      cell.classList.add("ant-table-cell-ellipsis");
      const button = document.createElement("button");
      cell.append(button);
      button.append(text);
      const nestedWidget = [
        getComputedStyle(text).overflow,
        getComputedStyle(rich).overflow,
      ];
      cell.prepend(text);
      text.style.whiteSpace = "pre-wrap";
      const authoredWhitespace = getComputedStyle(text).whiteSpace;
      const popup = document.createElement("div");
      popup.className = "ant-tooltip";
      popup.innerHTML =
        '<span class="__wab_text"><span class="__wab_rich_text" style="display:block">完整提示内容</span></span>';
      document.body.append(popup);
      const tooltip = getComputedStyle(
        popup.querySelector(".__wab_rich_text"),
      ).whiteSpace;
      return { editing, plain, nestedWidget, authoredWhitespace, tooltip };
    });
    assert.deepEqual(exclusions, {
      editing: ["visible", "visible"],
      plain: ["visible", "visible"],
      nestedWidget: ["visible", "visible"],
      authoredWhitespace: "pre-wrap",
      tooltip: "normal",
    });
    console.log(
      "Passed: 8 native/canvas ellipsis pixel comparisons, 8 short/empty value fit checks; complete text, active editing, non-ellipsis cells, nested widgets, authored styles and Tooltip wrapping.",
    );
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
