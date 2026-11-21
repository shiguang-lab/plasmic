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
    assert.equal(registrations.length, 105);
    const get = (name) =>
      registrations.find((r) => r.meta.importName === name).component;
    const meta = (name) =>
      registrations.find((r) => r.meta.importName === name).meta;
    for (const name of [
      "Box",
      "StepLabel",
      "Divider",
      "Avatar",
      "Skeleton",
      "Snackbar",
      "TableRow",
      "NativeSelect",
    ]) {
      assert.equal(
        meta(name).props.children.hidePlaceholder,
        true,
        `${name} must retain native empty content`,
      );
    }
    for (const name of ["Button", "Typography", "IconButton", "Tooltip"]) {
      assert.equal(meta(name).props.children.type, "slot");
      assert.equal(
        meta(name).props.children.hidePlaceholder,
        false,
        `${name} must retain a content editing target`,
      );
    }
    assert.equal(meta("Alert").props.action.type, "slot");
    assert.equal(meta("Button").props.action.type, "exprEditor");
    assert.equal(meta("Grid").props.container.type, "boolean");
    assert.equal(meta("Stepper").props.activeStep.type, "number");
    assert.equal(meta("Button").props.component.type, "exprEditor");
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
            h(get("Box"), {
              id: "ribbon",
              sx: { backgroundImage: 'url("ribbon.png")' },
            }),
            h(get("MIcon"), { name: "Search", titleAccess: "Search orders" }),
            h(get("Divider"), { id: "divider" }),
            h(
              get("Stepper"),
              null,
              ...[0, 1, 2].map((key) =>
                h(get("Step"), { key }, h(get("StepLabel"))),
              ),
            ),
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
      assert.equal(win.document.getElementById("ribbon").childElementCount, 0);
      assert.equal(win.document.getElementById("divider").tagName, "HR");
      assert.equal(win.document.querySelector("svg[role=img] title")?.textContent, "Search orders");
      assert.equal(
        win.document.querySelectorAll(".MuiStepLabel-label").length,
        0,
      );
      assert.equal(
        win.document.querySelectorAll(".MuiStepIcon-root").length,
        3,
      );
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
        win.document.querySelector('[role="dialog"]').dispatchEvent(
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
      await flush(() =>
        root.render(
          h(
            get("Stepper"),
            { nonLinear: true },
            ...[0, 1].map((key) =>
              h(
                get("Step"),
                { key },
                h(
                  get("StepButton"),
                  null,
                  h(get("StepLabel"), null, `Step ${key + 1}`),
                ),
              ),
            ),
          ),
        ),
      );
      assert.ok(win.document.querySelector('[role="tablist"]'));
      const steps = [...win.document.querySelectorAll('[role="tab"]')];
      assert.equal(steps.length, 2);
      assert.equal(
        win.document.querySelectorAll(".MuiStepLabel-root").length,
        2,
      );
      steps[0].focus();
      await flush(() =>
        steps[0].dispatchEvent(
          new win.KeyboardEvent("keydown", {
            key: "ArrowRight",
            bubbles: true,
          }),
        ),
      );
      assert.equal(win.document.activeElement, steps[1]);
      assert.deepEqual(errors, []);
    } finally {
      root.unmount();
      win.close();
    }
  });
}
