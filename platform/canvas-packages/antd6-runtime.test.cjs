const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM, VirtualConsole } = require("jsdom");

for (const suffix of ["", "-v2"]) {
  for (const hostRuntime of [true, false]) {
    test(`preview bundles${suffix} with ${hostRuntime ? "host" : "canvas"} runtime retain theme styles across account switches`, async () => {
      const dom = new JSDOM('<div id="root"></div>', {
        url: "http://localhost/",
        runScripts: "outside-only",
        pretendToBeVisual: true,
        virtualConsole: new VirtualConsole(),
      });
      const win = dom.window;
      const globals = [
        "window",
        "document",
        "HTMLElement",
        "Element",
        "Node",
        "ShadowRoot",
        "getComputedStyle",
        "navigator",
      ];
      const original = new Map(
        globals.map((key) => [
          key,
          Object.getOwnPropertyDescriptor(globalThis, key),
        ]),
      );
      for (const key of globals) {
        Object.defineProperty(globalThis, key, {
          configurable: true,
          value: win[key],
        });
      }
      win.matchMedia = () => ({
        matches: false,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
      });
      win.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
      win.eval(
        fs.readFileSync(
          path.join(__dirname, "../sub/public/static/sub/build/client.js"),
          "utf8",
        ),
      );
      const { React, ReactDOM, ReactDOMClient } = win.__Sub;
      const flush = async (callback) => {
        ReactDOM.flushSync(callback);
        await new Promise((resolve) => setTimeout(resolve, 30));
      };
      const root = ReactDOMClient.createRoot(
        win.document.getElementById("root"),
      );
      try {
        if (!hostRuntime) {
          delete win.__Sub.Antd6;
          win.__PlasmicComponentRegistry = [];
        }
        const files = hostRuntime
          ? [
              `antd6${suffix}`,
              `overseas${suffix}`,
              `react-ui${suffix}`,
              "client",
            ]
          : [
              "client",
              `antd6${suffix}`,
              `overseas${suffix}`,
              `react-ui${suffix}`,
            ];
        for (const file of files) {
          win.eval(
            fs.readFileSync(
              path.join(__dirname, "build", `${file}.js`),
              "utf8",
            ),
          );
        }
        const registrations = win.__PlasmicComponentRegistry;
        const get = (name) => {
          const entry = registrations.find(
            (registration) => registration.meta.name === name,
          );
          assert.ok(entry, `missing registration: ${name}`);
          return entry.component;
        };
        const Shell = get("plasmic-overseas-app-shell");
        const Actions = get("plasmic-react-ui-action-group");
        const Dropdown = get("plasmic-antd6-dropdown");
        // The actual preview combines a global Antd provider, AppShell and row actions.
        const Provider = win.__PlasmicContextRegistry.find((entry) =>
          /config-provider/.test(entry.meta.name),
        ).component;
        const show = async (readonly) => {
          await flush(() => {
            root.render(
              React.createElement(
                Provider,
                { themeStyles: {} },
                React.createElement(
                  Shell,
                  {
                    userName: readonly ? "只读访客" : "经营 OS 管理员",
                    menuItems: [{ key: "groups", label: "客群列表" }],
                    selectedKeys: ["groups"],
                    userMenuItems: [{ key: "readonly", label: "只读访客" }],
                  },
                  !readonly &&
                    React.createElement(
                      Dropdown,
                      {
                        menuItemsJson: [{ key: "new", label: "新建常规客群" }],
                      },
                      React.createElement("button", {}, "新建客群"),
                    ),
                  React.createElement(Actions, {
                    items: readonly
                      ? [{ key: "detail", label: "详情" }]
                      : [
                          { key: "detail", label: "详情" },
                          { key: "edit", label: "编辑" },
                          { key: "copy", label: "复制" },
                          {
                            key: "delete",
                            label: "删除",
                            confirm: { title: "删除？", okText: "删除" },
                          },
                        ],
                  }),
                ),
              ),
            );
          });
          const nodes = win.document.querySelectorAll('[class*="css-var-"]');
          assert.ok(nodes.length > 0);
          for (const node of nodes) {
            for (const key of node.classList) {
              if (!key.startsWith("css-var-")) {
                continue;
              }
              const styles = [
                ...win.document.querySelectorAll(
                  `style[data-token-hash="${key}"]`,
                ),
              ];
              const prefix = [...node.classList].some((cls) =>
                cls.startsWith("rc-ant-"),
              )
                ? "rc-ant"
                : "ant";
              assert.ok(
                styles.some((style) =>
                  style.textContent.includes(`--${prefix}-color-text:`),
                ),
                `${readonly ? "readonly" : "admin"}: missing ${prefix} base variables on ${node.className}`,
              );
              assert.ok(
                styles.length,
                `${readonly ? "readonly" : "admin"}: missing theme variables ${key} on ${node.className}`,
              );
            }
          }
        };
        for (let cycle = 0; cycle < 3; cycle++) {
          await show(false);
          const newGroup = [...win.document.querySelectorAll("button")].find(
            (node) => node.textContent === "新建客群",
          );
          await flush(() => {
            newGroup.dispatchEvent(
              new win.MouseEvent("mouseover", { bubbles: true }),
            );
          });
          const shellButton = [...win.document.querySelectorAll("button")].find(
            (node) => node.textContent.includes("经营 OS 管理员"),
          );
          await flush(() => {
            shellButton.dispatchEvent(
              new win.MouseEvent("mouseover", { bubbles: true }),
            );
          });
          await new Promise((resolve) => setTimeout(resolve, 200));
          const menuItem = [
            ...win.document.querySelectorAll('[role="menuitem"]'),
          ].find((node) => node.textContent.includes("只读访客"));
          assert.ok(menuItem);
          await flush(() => {
            menuItem.dispatchEvent(
              new win.MouseEvent("click", { bubbles: true }),
            );
          });
          await show(true);
          await new Promise((resolve) => setTimeout(resolve, 600));
          assert.ok(
            [...win.document.querySelectorAll("style")].some((style) =>
              style.textContent.includes(".ant-menu-css-var{"),
            ),
            "sidebar menu variables were removed when the account dropdown closed",
          );
        }
      } finally {
        await flush(() => root.unmount());
        dom.window.close();
        for (const [key, descriptor] of original) {
          if (descriptor) {
            Object.defineProperty(globalThis, key, descriptor);
          } else {
            delete globalThis[key];
          }
        }
      }
    });
  }
}
