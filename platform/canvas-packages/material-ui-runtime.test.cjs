const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM, VirtualConsole } = require("jsdom");

for (const suffix of ["", "-v2"]) {
  test(`Material UI${suffix} renders, styles and responds in the shipped canvas runtime`, async () => {
    const errors = [];
    const console = new VirtualConsole();
    console.on("error", (...args) => errors.push(args.map(String).join(" ")));
    console.on("jsdomError", (error) => {
      if (error.type !== "css parsing") errors.push(error);
    });
    const dom = new JSDOM('<div id="root"></div>', {
      url: "http://localhost/",
      runScripts: "outside-only",
      pretendToBeVisual: true,
      virtualConsole: console,
    });
    const win = dom.window;
    win.matchMedia = () => ({
      matches: false,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
    });
    win.eval(
      fs.readFileSync(
        path.join(__dirname, "../sub/public/static/sub/build/client.js"),
        "utf8",
      ),
    );
    win.eval(
      fs.readFileSync(
        path.join(__dirname, `build/material-ui${suffix}.js`),
        "utf8",
      ),
    );
    const registrations = win.__PlasmicComponentRegistry.filter((r) =>
      r.meta.name.startsWith("plasmic-material-ui-"),
    );
    assert.equal(registrations.length, 104);
    const get = (name) =>
      registrations.find((r) => r.meta.importName === name).component;
    const Provider = win.__PlasmicContextRegistry.find(
      (r) => r.meta.name === "plasmic-material-ui-theme-provider",
    ).component;
    const { React, ReactDOM, ReactDOMClient } = win.__Sub;
    const h = React.createElement;
    const root = ReactDOMClient.createRoot(win.document.getElementById("root"));
    const flush = async (callback) => {
      ReactDOM.flushSync(callback);
      await new Promise((resolve) => setTimeout(resolve, 30));
    };
    let navigation;
    let closed;
    let nativeClose;
    try {
      await flush(() =>
        root.render(
          h(
            Provider,
            { theme: { palette: { primary: { main: "#663399" } } } },
            h(get("Button"), { variant: "contained", id: "themed" }, "Save"),
            h(
              get("BottomNavigation"),
              {
                defaultValue: "home",
                showLabels: true,
                onChange: (_event, value) => {
                  navigation = value;
                },
              },
              h(get("BottomNavigationAction"), {
                label: "Home",
                value: "home",
              }),
              h(get("BottomNavigationAction"), {
                label: "Profile",
                value: "profile",
              }),
            ),
            h(
              get("Dialog"),
              {
                defaultOpen: true,
                onOpenChange: (value) => {
                  closed = value;
                },
                onClose: (_event, reason) => {
                  nativeClose = reason;
                },
              },
              h(get("DialogTitle"), null, "Confirm"),
            ),
          ),
        ),
      );
      assert.deepEqual(errors, []);
      assert.ok(win.document.querySelector('[role="dialog"]'));
      const styles = [...win.document.querySelectorAll("style[data-emotion]")]
        .flatMap((style) =>
          [...style.sheet.cssRules].map((rule) => rule.cssText),
        )
        .join("\n");
      assert.ok(
        styles.includes("#663399"),
        "theme CSS must be inserted into the canvas document",
      );
      await flush(() =>
        win.document
          .querySelector('[role="dialog"]')
          .dispatchEvent(
            new win.KeyboardEvent("keydown", {
              key: "Escape",
              keyCode: 27,
              bubbles: true,
            }),
          ),
      );
      assert.equal(closed, false);
      assert.equal(nativeClose, "escapeKeyDown");
      const profile = [...win.document.querySelectorAll("button")].find(
        (button) => button.textContent === "Profile",
      );
      await flush(() => profile.click());
      assert.equal(navigation, "profile");
      assert.ok(profile.classList.contains("Mui-selected"));
      assert.deepEqual(errors, []);
    } finally {
      root.unmount();
      win.close();
    }
  });
}
