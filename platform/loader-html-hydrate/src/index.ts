import { PlasmicHtmlHydrater } from "./hydrater";

const script = document.currentScript as HTMLScriptElement | null;
const hydrater = (window as any).__plasmicHydrater ?? new PlasmicHtmlHydrater(
  script?.src ? new URL("../../", script.src).href.replace(/\/$/, "") : undefined
);
(window as any).__plasmicHydrater = hydrater;

if (window.document.readyState === "loading") {
  window.addEventListener("load", () => hydrater.hydrateAll());
} else {
  hydrater.hydrateAll();
}
