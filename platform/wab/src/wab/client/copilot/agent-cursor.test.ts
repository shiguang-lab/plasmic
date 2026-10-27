import { createAgentCursor, installPreviewAgentCursor } from "@/wab/client/copilot/agent-cursor";
import { ensure } from "@/wab/shared/common";
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });

function clock() {
  let now = 100, next = 0;
  const callbacks = new Map<number, FrameRequestCallback>();
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    callbacks.set(++next, callback);
    return next;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => { callbacks.delete(id); });
  return {
    step(time: number) {
      now = time;
      const batch = [...callbacks.values()];
      callbacks.clear();
      batch.forEach((callback) => callback(time));
    },
    callbacks,
  };
}

it("reuses one cursor, travels continuously, retains active work, and fades idle work", () => {
  const c = clock();
  let scale = 1;
  const cursor = createAgentCursor(document.body, { label: "AI assistant", color: "#1677ff", scale: () => scale });
  const root = ensure(document.querySelector<HTMLElement>("[data-plasmic-agent-cursor]"), "Cursor root was not mounted");
  cursor.update(1, { x: 100, y: 80 }, true);
  c.step(300);
  expect(root.style.opacity).toBe("1");
  cursor.update(2, { x: 300, y: 80 }, true);
  c.step(350);
  const x = Number(root.style.transform.match(/translate3d\(([^p]+)/)?.[1]);
  expect(x).toBeGreaterThan(100);
  expect(x).toBeLessThan(300);
  expect(document.querySelector("[data-plasmic-agent-cursor]")).toBe(root);
  scale = 2;
  c.step(7000);
  expect(root.style.transform).toContain("scale(0.5)");
  expect(root.style.display).toBe("block");
  cursor.update(2, { x: 300, y: 80 }, false);
  c.step(12500);
  expect(Number(root.style.opacity)).toBeGreaterThan(0);
  expect(Number(root.style.opacity)).toBeLessThan(1);
  c.step(13500);
  expect(root.style.display).toBe("none");
  expect(c.callbacks.size).toBe(0);
  cursor.dispose();
  expect(root.isConnected).toBe(false);
});

it("isolates UI from inspection, disables motion when requested, and restores capture visibility", () => {
  const c = clock();
  vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
  const cursor = createAgentCursor(document.body, { label: "AI assistant", color: "#1677ff", scale: () => 1 });
  cursor.update(1, { x: 100, y: 80 }, false);
  c.step(110);
  cursor.update(2, { x: 300, y: 80 }, false);
  c.step(120);
  const root = ensure(document.querySelector<HTMLElement>("[data-plasmic-agent-cursor]"), "Cursor root was not mounted");
  expect(root.style.transform).toBe("translate3d(300px,80px,0) scale(1)");
  expect(root.style.pointerEvents).toBe("none");
  expect(document.body.textContent).toBe("");
  expect(root.shadowRoot?.textContent).toContain("AI assistant");
  cursor.hide(true);
  c.step(130);
  expect(root.style.display).toBe("none");
  cursor.hide(false);
  expect(root.style.display).toBe("block");
  window.dispatchEvent(new Event("pagehide"));
  expect(root.style.display).toBe("none");
  cursor.dispose();
});

it("tracks preview elements, clears replaced targets and navigation, and does not respawn after expiry", () => {
  const c = clock();
  const el = document.createElement("button");
  document.body.append(el);
  let left = 100;
  el.getBoundingClientRect = () => ({ left, top: 40, width: 100, height: 30 } as DOMRect);
  const dispose = installPreviewAgentCursor(window, { label: "AI assistant", color: "#1677ff", scale: () => 1 });
  const send = (detail: object) => window.dispatchEvent(new CustomEvent("plasmic-agent-cursor", { detail }));
  send({ action: "move", element: el, point: { x: 20, y: 10 }, caller: { id: "codex", name: "Codex" } });
  c.step(300);
  const root = ensure(document.querySelector<HTMLElement>("[data-plasmic-agent-cursor] [data-plasmic-agent-cursor]"), "Preview cursor was not mounted");
  expect(root.style.transform).toContain("translate3d(120px,50px");
  expect(root.shadowRoot?.querySelector("span")?.textContent).toBe("Codex");
  send({ action: "move", element: el, point: { x: 20, y: 10 }, caller: { id: "chatgpt", name: "ChatGPT" } });
  expect(root.shadowRoot?.querySelector("span")?.textContent).toBe("ChatGPT");
  left = 200;
  c.step(320); c.step(400);
  expect(Number(root.style.transform.match(/translate3d\(([^p]+)/)?.[1])).toBeGreaterThan(120);
  c.step(6700); c.step(6800);
  expect(root.style.display).toBe("none");
  expect(c.callbacks.size).toBe(0);
  send({ action: "move", element: el });
  expect(root.shadowRoot?.querySelector("span")?.textContent).toBe("AI assistant");
  c.step(6900);
  el.remove();
  c.step(7000);
  expect(root.style.display).toBe("none");
  send({ action: "move", element: document.body });
  send({ action: "clear" });
  expect(c.callbacks.size).toBe(0);
  dispose();
  expect(document.querySelector("[data-plasmic-agent-cursor]")).toBeNull();
});
