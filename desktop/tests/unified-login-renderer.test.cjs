const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const html = fs.readFileSync(
  path.join(__dirname, "../src/unified-login.html"),
  "utf8",
);
const rendererI18n = fs.readFileSync(
  path.join(__dirname, "../src/renderer-i18n.js"),
  "utf8",
);
const packs = Object.fromEntries(
  ["en", "zh-CN", "zh-TW", "ja", "ko"].map((locale) => [
    locale,
    JSON.parse(
      fs.readFileSync(
        path.join(
          __dirname,
          "../../platform/wab/src/wab/client/i18n/locales",
          locale + ".json",
        ),
        "utf8",
      ),
    ),
  ]),
);
const tick = () => new Promise((resolve) => setImmediate(resolve));
async function fixture(
  t,
  {
    delayedStatus = false,
    delayedCopy = false,
    systemDark = true,
    appearance,
  } = {},
) {
  const dom = new JSDOM(html, {
    runScripts: "outside-only",
    url: "https://studio.example/desktop/unified-login",
  });
  t.after(() => dom.window.close());
  const { window } = dom;
  let emit, resolveInitial, resolveCopy;
  let current = { phase: "idle" };
  const commands = [],
    appearances = [];
  let mediaChange;
  const media = {
    matches: systemDark,
    addEventListener(_event, callback) {
      mediaChange = callback;
    },
  };
  window.matchMedia = () => media;
  if (appearance !== undefined) {
    window.localStorage.setItem("shiguang.ui.appearance", appearance);
  }
  window.desktopEnvironment = {
    getUiMessages: async () => ({ locale: "en", messages: packs.en }),
    onUiLocale() {},
    setUiAppearance: async (value) => {
      appearances.push(value);
    },
    setUiLocale: async (value) => ({
      locale: value === "system" ? "en" : value,
      messages: packs[value === "system" ? "en" : value],
    }),
  };
  window.desktopUnifiedLogin = {
    onStatus: (callback) => {
      emit = callback;
    },
    command: async (command) => {
      commands.push(command);
      if (command === "status" && delayedStatus) {
        return new Promise((resolve) => {
          resolveInitial = resolve;
        });
      }
      if (command === "copy-link" && delayedCopy) {
        return new Promise((resolve) => {
          resolveCopy = resolve;
        });
      }
      if (command === "copy-link") {
        return {
          ...current,
          copied: true,
          authorizationUrl:
            "https://private-auth.example/authorize?secret=must-stay-hidden",
        };
      }
      if (command === "sign-in" || command === "retry") {
        current = { phase: "opening" };
      }
      if (command === "cancel") {
        current = { phase: "idle" };
      }
      return current;
    },
  };
  const inline = [...window.document.querySelectorAll("script:not([src])")];
  window.eval(inline[0].textContent);
  const startupAppearance =
    window.document.documentElement.dataset.uiAppearance;
  window.eval(rendererI18n);
  window.eval(inline[1].textContent);
  await tick();
  return {
    window,
    commands,
    appearances,
    startupAppearance,
    setSystemDark: (value) => {
      media.matches = value;
      mediaChange();
    },
    element: (id) => window.document.getElementById(id),
    emit: (value) => {
      current = value;
      emit(value);
    },
    resolveInitial: (value) => resolveInitial(value),
    resolveCopy: (value) => resolveCopy(value),
  };
}
test("login defaults to dark and respects saved preferences on a light system", async (t) => {
  for (const [appearance, expected] of [
    [undefined, "dark"],
    ["invalid", "dark"],
    ["light", "light"],
    ["system", "light"],
  ]) {
    const f = await fixture(t, { systemDark: false, appearance });
    assert.equal(f.startupAppearance, expected);
    assert.equal(
      f.window.document.documentElement.dataset.uiAppearance,
      expected,
    );
    assert.equal(f.appearances.at(-1), expected);
    if (appearance === undefined) {
      assert.equal(
        f.element("appearance-label").textContent,
        packs.en["Dark appearance"],
      );
      f.setSystemDark(true);
      f.setSystemDark(false);
      assert.equal(
        f.window.document.documentElement.dataset.uiAppearance,
        "dark",
      );
    }
  }
});
test("login commands follow real phases and copied URLs stay out of the DOM", async (t) => {
  const f = await fixture(t);
  f.element("sign-in").click();
  await tick();
  assert.deepEqual(f.commands, ["status", "sign-in"]);
  assert.equal(f.element("open").disabled, true);
  assert.equal(f.element("cancel").hidden, false);
  f.emit({ phase: "waiting" });
  assert.equal(f.element("open").disabled, false);
  assert.equal(
    f.window.document.querySelectorAll(".login-step.complete").length,
    1,
  );
  assert.equal(
    f.window.document.querySelector(".login-step.current").dataset.step,
    "1",
  );
  assert.equal(
    f.window.document
      .querySelector(".login-step.current .step-marker .icon")
      .hasAttribute("hidden"),
    true,
  );
  assert.equal(
    f.window.document
      .querySelector(".login-step.complete .step-marker .icon")
      .hasAttribute("hidden"),
    false,
  );
  f.element("copy").click();
  await tick();
  assert.equal(f.element("hint").textContent, "Link copied");
  assert.doesNotMatch(
    f.window.document.documentElement.outerHTML,
    /private-auth\.example|must-stay-hidden/,
  );
  f.element("open").click();
  await tick();
  assert.equal(f.commands.at(-1), "open-browser");
  f.element("cancel").click();
  await tick();
  assert.equal(f.commands.at(-1), "cancel");
  assert.equal(f.element("sign-in").hidden, false);
  assert.equal(f.element("copy").hidden, true);
  f.emit({ phase: "success" });
  assert.equal(f.element("success").hidden, false);
  assert.equal(f.element("success").disabled, true);
  assert.equal(f.element("cancel").hidden, true);
  assert.equal(
    f.window.document.querySelectorAll(".login-step.complete").length,
    3,
  );
});
test("timeout, cancellation and session recovery have actionable provider-neutral copy", async (t) => {
  const f = await fixture(t);
  for (const [key, title] of [
    ["Sign-in timed out. Please try again.", "Sign-in timed out"],
    ["Shiguang sign-in was cancelled", "Sign-in incomplete"],
    ["Shiguang authorization returned {status}", "Sign-in incomplete"],
  ]) {
    f.emit({
      phase: "error",
      message: "Shiguang internal error",
      uiMessage: { key, values: { status: 503 } },
    });
    assert.equal(f.element("title").textContent, title);
    assert.equal(f.element("message").getAttribute("role"), "alert");
    assert.doesNotMatch(
      f.element("message").textContent,
      /Shiguang|503|internal/,
    );
    assert.equal(f.element("retry").hidden, false);
    assert.equal(
      f.window.document.querySelectorAll(".login-step.complete").length,
      0,
    );
  }
  f.element("retry").click();
  await tick();
  assert.equal(f.commands.at(-1), "retry");
  f.emit({ phase: "idle", sessionExpired: true });
  assert.equal(f.element("title").textContent, "Please sign in again");
  assert.equal(f.element("return-note").hidden, false);
  assert.equal(f.element("benefits").hidden, true);
});
test("preferences use Studio storage and preserve an active sign-in", async (t) => {
  const f = await fixture(t);
  f.emit({ phase: "waiting", copied: true });
  f.element("language").click();
  f.element("language-menu").querySelector('[data-value="ja"]').click();
  await tick();
  assert.equal(f.window.localStorage.getItem("shiguang.ui.language"), "ja");
  assert.equal(f.window.document.documentElement.lang, "ja");
  assert.equal(f.element("hint").textContent, packs.ja["Link copied"]);
  f.element("appearance").click();
  f.element("appearance-menu").querySelector('[data-value="light"]').click();
  await tick();
  assert.equal(
    f.window.localStorage.getItem("shiguang.ui.appearance"),
    "light",
  );
  assert.equal(f.window.document.documentElement.dataset.uiAppearance, "light");
  assert.equal(f.appearances.at(-1), "light");
  assert.equal(f.element("copy").hidden, false);
  f.element("language").click();
  f.element("language-menu").querySelector('[data-value="system"]').click();
  await tick();
  assert.equal(f.window.localStorage.getItem("shiguang.ui.language"), "system");
  assert.equal(f.window.document.documentElement.lang, "en");
  assert.deepEqual(
    f.commands,
    ["status"],
    "settings must not restart authorization",
  );
});
test("blocked preference storage reports the failure without claiming a switch", async (t) => {
  const f = await fixture(t);
  f.window.Storage.prototype.setItem = () => {
    throw new Error("Storage unavailable");
  };
  f.element("appearance").click();
  f.element("appearance-menu").querySelector('[data-value="light"]').click();
  await tick();
  assert.equal(f.window.document.documentElement.dataset.uiAppearance, "dark");
  assert.equal(f.element("settings-error").hidden, false);
  assert.equal(
    f.element("settings-error").textContent,
    packs.en["Unable to save appearance preference on this device."],
  );
  f.element("language").click();
  f.element("language-menu").querySelector('[data-value="ko"]').click();
  await tick();
  assert.equal(f.window.document.documentElement.lang, "en");
  assert.equal(
    f.element("language-label").textContent,
    packs.en["Follow system"],
  );
});
test("a late initial status cannot overwrite a live waiting state", async (t) => {
  const f = await fixture(t, { delayedStatus: true });
  f.emit({ phase: "waiting" });
  f.resolveInitial({ phase: "idle" });
  await tick();
  assert.equal(f.element("copy").hidden, false);
  assert.equal(f.element("sign-in").hidden, true);
});

test("a delayed copy response cannot restore waiting after cancellation", async (t) => {
  const f = await fixture(t, { delayedCopy: true });
  f.emit({ phase: "waiting" });
  f.element("copy").click();
  f.element("cancel").click();
  await tick();
  assert.equal(f.element("sign-in").hidden, false);
  f.resolveCopy({ phase: "waiting", copied: true });
  await tick();
  assert.equal(f.element("sign-in").hidden, false);
  assert.equal(f.element("copy").hidden, true);
});

test("dropdowns support keyboard navigation, dismissal and all appearance preferences", async (t) => {
  const f = await fixture(t);
  const key = (target, value) =>
    target.dispatchEvent(
      new f.window.KeyboardEvent("keydown", { key: value, bubbles: true }),
    );
  assert.equal(f.window.document.querySelector("select"), null);
  key(f.element("language"), "ArrowDown");
  assert.equal(f.element("language-menu").hidden, false);
  key(f.window.document.activeElement, "End");
  assert.equal(f.window.document.activeElement.dataset.value, "ko");
  key(f.window.document.activeElement, "Escape");
  assert.equal(f.element("language-menu").hidden, true);
  assert.equal(f.window.document.activeElement, f.element("language"));
  f.element("language").click();
  f.element("appearance").click();
  assert.equal(f.element("language-menu").hidden, true);
  const menu = f.element("appearance-menu");
  assert.deepEqual(
    [...menu.querySelectorAll("[data-value]")].map(
      (item) => item.dataset.value,
    ),
    ["system", "light", "dark"],
  );
  for (const value of ["light", "dark", "system"]) {
    menu.querySelector(`[data-value="${value}"]`).click();
    assert.equal(
      f.window.localStorage.getItem("shiguang.ui.appearance"),
      value,
    );
    assert.equal(
      menu.querySelector('[aria-checked="true"]').dataset.value,
      value,
    );
  }
  f.setSystemDark(false);
  assert.equal(f.window.document.documentElement.dataset.uiAppearance, "light");
  assert.equal(f.appearances.at(-1), "light");
  assert.equal(
    f.element("appearance-label").textContent,
    packs.en["Follow system"],
  );
  f.element("appearance").click();
  f.window.document.body.click();
  assert.equal(menu.hidden, true);
});
