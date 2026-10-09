import React from "react";
import { createRoot, Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, expect, it } from "vitest";
import { Orders } from "../target-project/src/Orders";
import { queries } from "../target-project/src/orders-service";
let host: HTMLDivElement, root: Root;
beforeEach(async () => {
  queries.length = 0;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root.render(<Orders />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
async function value(label: string, nextValue: string) {
  const el = host.querySelector(`[aria-label="${label}"]`) as
    HTMLInputElement | HTMLSelectElement;
  expect(el).not.toBeNull();
  const ctor =
    el instanceof HTMLSelectElement ? HTMLSelectElement : HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(ctor.prototype, "value")!.set!.call(
      el,
      nextValue,
    );
    el.dispatchEvent(
      new Event(el instanceof HTMLSelectElement ? "change" : "input", {
        bubbles: true,
      }),
    );
  });
}
async function click(label: string) {
  const button = [...host.querySelectorAll("button")].find(
    (b) => b.textContent === label,
  )!;
  expect(button).toBeTruthy();
  await act(async () => button.click());
}
it("uses a real select; Pending sends numeric zero and keyword; query resets pagination", async () => {
  expect(host.querySelector('[aria-label="Status"]')?.tagName).toBe("SELECT");
  await value("Keyword", "alice");
  await value("Status", "0");
  await click("Next");
  await click("Search");
  expect(queries.at(-1)).toEqual({ keyword: "alice", status: 0, page: 1 });
  expect(host.querySelector('[data-testid="page"]')?.textContent).toBe("1");
});
it("Completed sends one and All omits status rather than coercing empty to zero", async () => {
  await value("Status", "1");
  await click("Search");
  expect(queries.at(-1)?.status).toBe(1);
  await value("Status", "");
  await click("Search");
  expect(Object.hasOwn(queries.at(-1)!, "status")).toBe(false);
});
it("reset clears keyword/status and returns pagination to one; later search uses cleared values", async () => {
  await value("Keyword", "bob");
  await value("Status", "1");
  await click("Next");
  await click("Reset");
  expect(
    (host.querySelector('[aria-label="Keyword"]') as HTMLInputElement).value,
  ).toBe("");
  expect(
    (host.querySelector('[aria-label="Status"]') as HTMLSelectElement).value,
  ).toBe("");
  expect(host.querySelector('[data-testid="page"]')?.textContent).toBe("1");
  await click("Search");
  expect(queries.at(-1)?.page).toBe(1);
  expect(Object.hasOwn(queries.at(-1)!, "status")).toBe(false);
  expect(queries.at(-1)?.keyword || "").toBe("");
});
