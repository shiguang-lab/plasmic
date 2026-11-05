import { readFileSync } from "node:fs";
import { parse } from "node-html-parser";
import { runInNewContext } from "node:vm";
import { buildBuiltinStudioHtml } from "./builtin-studio";
import { buildHostPage } from "./host-page";

it("loads the exact Host runtime URL once, before Studio, independently of its base URL", () => {
  const host = buildHostPage(readFileSync("../sub/public/static/host.html", "utf8"), {
    commitHash: "test-build", studioUrl: "https://studio.example",
    hostReadyMessages: {}, resolveUiLocale: "function() {}",
  });
  const result = buildBuiltinStudioHtml('<html><head><base href="https://studio.example"><script defer src="/editor.js"></script></head><body><div id="plasmic-studio-tag"></div></body></html>', host.html);
  const document = parse(result);
  expect(document.querySelector("html").getAttribute("data-plasmic-host")).toBe("self");
  expect(document.querySelectorAll("#plasmic-host-preamble")).toHaveLength(1);
  const scripts = document.querySelectorAll("head > script");
  const write = vi.fn();
  const context = { window: {} as { __PlasmicStudioArgs?: string }, location: { href: "https://canvas.example/static/studio.test-build.html#origin=studio", hash: "#origin=studio" }, document: { write }, URL };
  runInNewContext(scripts[0].textContent, context);
  expect(context.window.__PlasmicStudioArgs).toBe("#origin=studio");
  runInNewContext(scripts[2].textContent, context);
  expect(write).toHaveBeenCalledExactlyOnceWith('<script crossorigin="anonymous" src="https://canvas.example/static/sub/build/client.test-build.js"></script>');
  expect(result.indexOf("document.write")).toBeLessThan(result.indexOf("<base"));
  expect(document.querySelectorAll('script[src="/editor.js"]')).toHaveLength(1);
  expect(document.querySelector(".app-root")).toBeNull();
});

it("fails the build if the built-in Host contract is missing", () => {
  expect(() => buildBuiltinStudioHtml("<html><head></head><body></body></html>", "<html></html>")).toThrow("preamble and runtime");
});

it("loads React DevTools only when the editor URL enables it", () => {
  const html = buildBuiltinStudioHtml(
    '<html><head><script id="ReactDevToolsScript"></script></head><body></body></html>',
    '<html><head><script id="plasmic-host-preamble"></script><script src="/host.js"></script></head></html>',
  );
  const script = parse(html).querySelectorAll("head > script").at(-1).textContent;
  const write = vi.fn();
  const context = { location: { href: "https://canvas.example/studio" }, document: { write } };
  runInNewContext(script, context);
  expect(write).not.toHaveBeenCalled();
  context.location.href += "#hash=" + encodeURIComponent("enableReactDevTools=true");
  runInNewContext(script, context);
  expect(write).toHaveBeenCalledExactlyOnceWith('<script src="http://localhost:8097"></script>');
});
