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
    win.matchMedia = (media) => ({
      media, matches: false,
      addListener() {}, removeListener() {},
      addEventListener() {}, removeEventListener() {},
    });
    const load = (file) =>
      win.eval(fs.readFileSync(path.join(base, file), "utf8"));
    const entries = () =>
      (win.__PlasmicComponentRegistry ?? []).filter(
        (x) => x.meta.name.startsWith("plasmic-react-ui-"),
      );
    let root;
    try {
      load("sub/public/static/sub/build/client.js");
      delete win.__Sub.Antd6; // Metadata frames use the shared runtime.
      load("canvas-packages/build/client.js");
      load("canvas-packages/build/antd6-runtime.js");
      load(`canvas-packages/build/overseas${suffix}.js`);
      assert.equal(
        entries().length,
        0,
        "Default host and Overseas must not register React UI",
      );
      load(`canvas-packages/build/react-ui${suffix}.js`);
      assert.deepEqual(Array.from(entries(), (entry) => entry.meta.name).sort(), [
        "plasmic-react-ui-action-group",
        "plasmic-react-ui-intl-department-select",
        "plasmic-react-ui-intl-department-view",
        "plasmic-react-ui-intl-dict-select",
        "plasmic-react-ui-intl-dict-view",
        "plasmic-react-ui-intl-user-select",
        "plasmic-react-ui-intl-user-view",
        "plasmic-react-ui-resource-authorization",
        "plasmic-react-ui-resource-authorization-record",
      ]);
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
      const findComponent = (name) =>
        entries().find(({ meta }) => meta.displayName === name).component;
      let requests = 0;
      win.$$request = { get: () => { requests++; return Promise.resolve({ data: [] }); } };
      ReactDOM.flushSync(() => root.render(React.createElement(React.Fragment, null,
        React.createElement(findComponent("IntlUserSelect"), { defaultValue: "demo-user-1" }),
        React.createElement(findComponent("IntlUserView"), { value: "demo-user-1" }),
        React.createElement(findComponent("IntlDepartmentSelect"), { defaultValue: "demo-operations" }),
        React.createElement(findComponent("IntlDepartmentView"), { value: "demo-operations", showFullPath: true }),
        React.createElement(findComponent("IntlDictSelect"), { defaultValue: "SG" }),
        React.createElement(findComponent("IntlDictView"), { value: "SG" }),
      )));
      const intlText = win.document.getElementById("root").textContent;
      assert.match(intlText, /林晓/);
      assert.match(intlText, /海外业务部 \/ 运营组/);
      assert.match(intlText, /新加坡/);
      assert.equal(requests, 0);
      for (const entry of entries().filter(({ meta }) => meta.name.startsWith("plasmic-react-ui-resource-authorization"))) {
        assert.deepEqual(JSON.parse(JSON.stringify(entry.meta.canvasOverlay)), { triggerSlot: "trigger" });
        assert.equal(entry.meta.props.trigger.type, "slot");
        assert.equal(entry.meta.props.previewOpen, undefined);
        assert.equal(entry.meta.states.open.onChangeProp, "onOpenChange");
        assert.equal(entry.meta.importPath,
          "@shiguang-lab/plasmic-react-ui/skinny/registerResourceAuthorization");
      }
    } finally {
      if (root) {
        win.__Sub.ReactDOM.flushSync(() => root.unmount());
      }
      win.close();
    }
  });
}
