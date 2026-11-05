import assert from "node:assert/strict";
import { parse } from "node-html-parser";

/** Reuse the built-in Host's exact preamble and runtime in the Studio document. */
export function buildBuiltinStudioHtml(studioHtml: string, hostHtml: string) {
  const studio = parse(studioHtml);
  const host = parse(hostHtml);
  const preamble = host.querySelector("#plasmic-host-preamble");
  const runtime = host.querySelector("script[src]");
  assert(preamble && runtime, "Built-in Host preamble and runtime are required");
  const runtimeSrc = runtime.getAttribute("src");
  assert(runtimeSrc, "Built-in Host runtime URL is required");
  const json = (value: string) => JSON.stringify(value).replace(/</g, "\\u003c");

  const devtools = studio.querySelector("#ReactDevToolsScript");
  if (devtools) {
    devtools.insertAdjacentHTML("beforebegin", `<script>
      if (location.href.includes(encodeURIComponent("enableReactDevTools=true"))) {
        document.write(${json('<script src="http://localhost:8097"></script>')});
      }
    </script>`);
    devtools.remove();
  }

  studio.querySelector("html").setAttribute("data-plasmic-host", "self");
  // Keep the Host script parser-blocking, before Studio's modules. Resolve its
  // original URL against this Host-origin document, independently of Studio's base.
  studio.querySelector("head").insertAdjacentHTML("afterbegin", `
    <script>window.__PlasmicStudioArgs = location.hash;</script>
    ${preamble.toString()}
    <script>document.write(${json('<script crossorigin="anonymous" src="')} + new URL(${json(runtimeSrc)}, location.href).href + ${json('"></script>')});</script>
  `);
  return studio.toString();
}
