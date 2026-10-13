const { createRequire } = require("node:module");
const path = require("node:path");
const req = createRequire(path.join(__dirname, "../package.json"));
const { app } = req("electron");
const { PDFDocument } = req("pdf-lib");
const { renderCanvas } = req("./src/canvas.cjs");
const assert = require("node:assert/strict");
app.on("window-all-closed", () => {});
app.whenReady().then(async () => {
  try {
    const merged = await PDFDocument.create();
    for (const [width, height] of [
      [800, 600],
      [390, 844],
    ]) {
      const frame = {
        url: "https://canvas.example/static/host.html#canvas=true",
        executeJavaScript: async (script) =>
          script.includes("snapshotDocument")
            ? `<!doctype html><html><head><style>html,body{margin:0} .content{height:1600px;background:linear-gradient(#cff,#fcf);}</style></head><body><main class="content"><h1>PDF ${width} x ${height}</h1><p>one bounded artboard</p></main></body></html>`
            : {
                ready: true,
                width,
                height,
                elements: [{ tag: "main" }],
                images: [],
              },
      };
      const win = {
        webContents: {
          getURL: () => "https://studio.example/projects/test",
          session: undefined,
          mainFrame: { framesInSubtree: [frame] },
        },
      };
      const result = await renderCanvas(win, { width, height, format: "pdf" });
      const pdf = await PDFDocument.load(result.pdf);
      assert.equal(pdf.getPageCount(), 1);
      const size = pdf.getPage(0).getSize();
      assert.ok(Math.abs(size.width - width * 0.75) < 1);
      assert.ok(Math.abs(size.height - height * 0.75) < 1);
      for (const page of await merged.copyPages(pdf, pdf.getPageIndices()))
        merged.addPage(page);
      console.log(
        JSON.stringify({ width, height, pages: pdf.getPageCount(), size }),
      );
    }
    assert.equal(merged.getPageCount(), 2);
    console.log(
      "PASS: 2 requested artboards = 2 PDF pages with correct dimensions",
    );
  } catch (e) {
    console.error(e);
    app.exit(1);
    return;
  }
  app.exit(0);
});
