const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const base = path.resolve(__dirname, "..");
for (const suffix of ["", "-v2"]) {
  test(`React UI registers only through its installed bundle${suffix}`, () => {
    const dom = new JSDOM('<div id="root"></div>', {
      url: "http://localhost/",
      runScripts: "outside-only",
      pretendToBeVisual: true,
    });
    const win = dom.window;
    const load = (file) =>
      win.eval(fs.readFileSync(path.join(base, file), "utf8"));
    const entries = () =>
      (win.__PlasmicComponentRegistry ?? []).filter(
        (x) => x.meta.name === "plasmic-react-ui-action-group",
      );
    let root;
    try {
      load("sub/public/static/sub/build/client.js");
      delete win.__Sub.Antd6; // Metadata frames use the shared runtime.
      load("canvas-packages/build/client.js");
      load(`canvas-packages/build/overseas${suffix}.js`);
      assert.equal(
        entries().length,
        0,
        "Default host and Overseas must not register React UI",
      );
      load(`canvas-packages/build/react-ui${suffix}.js`);
      assert.equal(entries().length, 1);
      assert.equal(
        entries()[0].meta.importPath,
        "@shiguang-lab/plasmic-react-ui/skinny/registerActionGroup",
      );
      const { React, ReactDOM, ReactDOMClient } = win.__Sub;
      root = ReactDOMClient.createRoot(win.document.getElementById("root"));
      ReactDOM.flushSync(() =>
        root.render(
          React.createElement(entries()[0].component, {
            max: 3,
            items: [
              { key: "detail", label: "详情" },
              { key: "edit", label: "编辑" },
              { key: "copy", label: "复制" },
              { key: "delete", label: "删除" },
            ],
          }),
        ),
      );
      const text = win.document.getElementById("root").textContent;
      assert.match(text, /详情/);
      assert.match(text, /编辑/);
      assert.match(text, /更多/);
      assert.doesNotMatch(text, /复制|删除/);
    } finally {
      if (root) {
        win.__Sub.ReactDOM.flushSync(() => root.unmount());
      }
      win.close();
    }
  });
}
