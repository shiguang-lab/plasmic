import { readFileSync } from "fs";
import { resolve } from "path";
import { ensure } from "@/wab/shared/common";
import { messages } from "@/wab/client/i18n/locales";
import { resolveUiLocale } from "@/wab/client/i18n/locale-resolution.cjs";

const html = readFileSync(resolve(process.cwd(), "../sub/public/static/host.html"), "utf8");
const start = html.indexOf("      // Only the standalone");
const script = html.slice(start, html.indexOf("</script>", start))
  .replace(/<%= JSON.stringify\(hostReadyMessages\).*?%>/, JSON.stringify(messages))
  .replace("<%= resolveUiLocale %>", resolveUiLocale.toString())
  .replace("<%= JSON.stringify(studioUrl) %>", JSON.stringify("https://studio.example"));

function render(hash: string, embedded = false, stored: Record<string, string> = {}) {
  document.body.innerHTML = html.slice(html.indexOf('<main class="host-ready"'), html.indexOf("</main>") + 7);
  const win = { parent: embedded ? {} : null, matchMedia: () => ({ matches: false, addEventListener: vi.fn() }), addEventListener: vi.fn() };
  win.parent = embedded ? {} : win;
  new Function("window", "document", "location", "studioParams", "navigator", "localStorage", script)(
    win, document, { href: `https://canvas.example/static/host.html${hash}` }, new URLSearchParams(hash.slice(1)),
    { languages: ["en"] }, { getItem: (key: string) => stored[key] ?? null },
  );
  return ensure(document.querySelector<HTMLElement>(".host-ready"));
}

it("localizes standalone onboarding and applies the stored appearance", () => {
  const ready = render("", false, { "shiguang.ui.appearance": "dark", "shiguang.ui.language": "zh-CN" });
  expect(ready.hidden).toBe(false);
  expect(ready.dataset.appearance).toBe("dark");
  expect(ready.querySelector("h1")?.textContent).toBe(messages["zh-CN"]["hostReady.title"]);
  expect(ready.querySelector("a")?.href).toBe("https://studio.example/");
});

it("uses inherited appearance and language without including the hash in the host URL", () => {
  const ready = render("#uiAppearance=light&uiLocale=ja", false, { "shiguang.ui.appearance": "dark" });
  expect(ready.dataset.appearance).toBe("light");
  expect(ready.querySelector("h1")?.textContent).toBe(messages.ja["hostReady.title"]);
  expect(ready.querySelector("input")?.value).toBe("https://canvas.example/static/host.html");
});

it.each([["#canvas=true", false], ["#live=true", false], ["#origin=https://studio.example", true]])(
  "keeps onboarding hidden for canvas, preview and editor frames (%s)", (hash, embedded) => {
    const ready = render(hash as string, embedded as boolean);
    expect(ready.hidden).toBe(true);
    expect(ready.dataset.appearance).toBeUndefined();
  },
);
