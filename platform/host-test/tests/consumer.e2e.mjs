import assert from "node:assert/strict";
import { createRequire } from "node:module";

const origin = process.env.HOST_TEST_ORIGIN;
assert(
  origin && new URL(origin).hostname === "127.0.0.1",
  "Pass an isolated loopback HOST_TEST_ORIGIN",
);
const require = createRequire(
  new URL("../../wab/package.json", import.meta.url),
);
const { chromium } = require("playwright");
const browser = await chromium.launch({ headless: true });
try {
  for (const route of [
    "plasmic-host",
    "plasmic-host-updated",
    "plasmic-host-style-sections",
  ]) {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.route("https://docs.plasmic.app/**", (route) => route.fulfill({
      contentType: "text/html", body: "<!doctype html><p>Host documentation fixture</p>",
    }));
    await page.goto(`${origin}/${route}`);
    await page.waitForFunction(
      () => window.__PlasmicComponentRegistry?.length > 0,
    );
    const registrations = await page.evaluate(() => {
      const { React, PlasmicQuery } = window.__Sub;
      if (
        React.version !== "19.3.1" ||
        typeof PlasmicQuery.usePlasmicPrepass !== "function" ||
        "isPlasmicPrepass" in PlasmicQuery
      ) {
        throw new Error(
          "Host must consume the newly packed React 19 SDK and query API",
        );
      }
      return window.__PlasmicComponentRegistry.map(({ meta }) => ({
        name: meta.name,
        props: meta.props,
        states: meta.states,
        styleSections: meta.styleSections,
      }));
    });
    if (route === "plasmic-host-style-sections") {
      assert.equal(
        registrations.find((entry) => entry.name === "NoStyleSections")
          .styleSections,
        false,
      );
      assert.equal(
        registrations.find(
          (entry) => entry.name === "StyleSectionsWithClassName",
        ).styleSections,
        true,
      );
    } else {
      const badge = registrations.find((entry) => entry.name === "Badge");
      assert(badge, "Badge registration must exist");
      assert.equal(
        badge.props.name.defaultValue,
        route === "plasmic-host" ? "Plasmic" : "Plasmician",
      );
      if (route === "plasmic-host-updated")
        assert.equal(badge.states.clicks.onChangeProp, "onClicksChange");
      await page.evaluate(() => {
        const registration = window.__PlasmicComponentRegistry.find(
          ({ meta }) => meta.name === "Badge",
        );
        const { React, ReactDOMClient } = window.__Sub;
        const container = document.createElement("div");
        Object.assign(container.style, {
          position: "fixed", inset: "0", zIndex: "2147483647", background: "white",
        });
        document.body.appendChild(container);
        window.badgeEvents = [];
        window.badgeRoot = ReactDOMClient.createRoot(container);
        window.badgeRoot.render(
          React.createElement(registration.component, {
            name: "Consumer",
            year: 2026,
            containerClassName: "test-badge",
            onClicksChange: (count) => window.badgeEvents.push(count),
          }),
        );
      });
      await page.getByRole("button", { name: "Click here" }).click();
      await page.getByRole("button", { name: "Click here" }).click();
      assert.match(
        await page.locator('[data-test-id="badge-component"]').textContent(),
        /State value: 2/,
      );
      assert.deepEqual(await page.evaluate(() => window.badgeEvents), [1, 2]);
      await page.evaluate(() => window.badgeRoot.unmount());
    }
    assert.deepEqual(errors, []);
    await page.close();
    console.log(
      `PASS: packed Host consumer /${route}, React 19 registration and behavior`,
    );
  }
} finally {
  await browser.close();
}
