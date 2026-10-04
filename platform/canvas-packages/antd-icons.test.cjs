const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

for (const suffix of ["", "-v2"]) {
  test(`icons are loaded only by the installed library${suffix}`, () => {
    const dom = new JSDOM('<div id="root"></div>', {
      url: "http://localhost/",
      runScripts: "outside-only",
      pretendToBeVisual: true,
    });
    const win = dom.window;
    const evaluate = (file) => win.eval(fs.readFileSync(file, "utf8"));
    const icons = () =>
      (win.__PlasmicComponentRegistry ?? []).filter((entry) =>
        /^plasmic-antd(?:6)?-icon-/.test(entry.meta.name),
      );
    let root;
    try {
      evaluate(
        path.join(__dirname, "../sub/public/static/sub/build/client.js"),
      );
      evaluate(path.join(__dirname, "build", `antd6${suffix}.js`));
      assert.equal(
        icons().length,
        0,
        "the default host and Antd 6 have no icon library",
      );
      evaluate(path.join(__dirname, "build", `antd-icons${suffix}.js`));
      assert.equal(icons().length, 848);
      const plus = icons().find(
        (entry) => entry.meta.importName === "PlusOutlined",
      );
      assert.ok(plus);
      const { React, ReactDOM, ReactDOMClient } = win.__Sub;
      root = ReactDOMClient.createRoot(win.document.getElementById("root"));
      ReactDOM.flushSync(() =>
        root.render(
          React.createElement(plus.component, {
            rotate: 90,
            style: { color: "rgb(255, 0, 0)", fontSize: 20 },
          }),
        ),
      );
      const svg = win.document.querySelector("#root svg");
      assert.ok(
        svg?.querySelector("path"),
        "the official icon renders in the canvas host",
      );
      assert.equal(svg.getAttribute("fill"), "currentColor");
      assert.match(svg.style.transform, /rotate\(90deg\)/);
      assert.equal(
        win.document.querySelector("#root .anticon").style.color,
        "rgb(255, 0, 0)",
      );
    } finally {
      if (root) win.__Sub.ReactDOM.flushSync(() => root.unmount());
      win.close();
    }
  });
}
