import { strict as assert } from "node:assert";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { build, preview } from "vite";
import { expect, it } from "vitest";

it("builds the production email Host and renders registered compiled email fibers in Chromium", async () => {
  const host = path.resolve(__dirname, "../../src/wab/server/emails/host");
  const output = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-email-host-"));
  const configFile = path.join(host, "vite.config.mts");
  try {
    await build({root: host, configFile, build: {outDir: output, emptyOutDir: true}});
    const server = await preview({root: host, configFile, build: {outDir: output}, preview: {host: "127.0.0.1", port: 0}});
    const browser = await chromium.launch({headless: true});
    try {
      const address = server.httpServer.address();
      assert(address && typeof address !== "string", "Email Host preview must bind a local TCP port");
      const page = await browser.newPage();
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${address.port}/plasmic-host/#canvas=true`);
      await page.waitForFunction("window.__Sub && window.__PlasmicComponentRegistry?.length === 11");
      const registrations = await page.evaluate(() => {
        const runtime = (window as any).__Sub;
        const entries = (window as any).__PlasmicComponentRegistry;
        const lookup = (name: string) => entries.find((entry: any) => entry.meta.name === `plasmic-email-${name}`).component;
        runtime.hostUtils.setPlasmicRootNode(runtime.React.createElement(lookup("section"), {},
          runtime.React.createElement(lookup("text"), {id: "email-host-text"}, "Compiled email first"),
          runtime.React.createElement(lookup("button"), {href: "https://example.com/action"}, "Email action"),
          runtime.React.createElement(lookup("markdown"), {}, "**Compiled markdown**"),
        ));
        return entries.map((entry: any) => entry.meta.name);
      });
      expect(registrations).toHaveLength(11);
      await expect.poll(() => page.locator("#email-host-text").textContent()).toBe("Compiled email first");
      expect(await page.locator("#email-host-text").evaluate(element => (element as HTMLElement).style.boxSizing)).toBe("border-box");
      expect(await page.getByRole("link", {name: "Email action"}).getAttribute("href")).toBe("https://example.com/action");
      expect(await page.locator("strong").textContent()).toBe("Compiled markdown");
      await page.evaluate(() => {
        const runtime = (window as any).__Sub, entries = (window as any).__PlasmicComponentRegistry;
        const Text = entries.find((entry: any) => entry.meta.name === "plasmic-email-text").component;
        const container = document.createElement("div"); document.body.appendChild(container);
        const root = runtime.ReactDOMClient.createRoot(container);
        (window as any).__emailContractRoot = root;
        root.render(runtime.React.createElement(Text, {id: "email-native-text"}, "Native email first"));
      });
      await expect.poll(() => page.locator("#email-native-text").textContent()).toBe("Native email first");
      await page.evaluate(() => {
        const runtime = (window as any).__Sub, entries = (window as any).__PlasmicComponentRegistry;
        const Text = entries.find((entry: any) => entry.meta.name === "plasmic-email-text").component;
        (window as any).__previousEmailText = document.querySelector("#email-native-text");
        (window as any).__emailContractRoot.render(runtime.React.createElement(Text, {id: "email-native-text"}, "Native email updated"));
      });
      await expect.poll(() => page.locator("#email-native-text").textContent()).toBe("Native email updated");
      expect(await page.evaluate(() => (window as any).__previousEmailText === document.querySelector("#email-native-text"))).toBe(true);
      expect(errors).toEqual([]);
    } finally {await browser.close(); await new Promise<void>((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()));}
  } finally {await fs.rm(output, {recursive: true, force: true});}
}, 120_000);
