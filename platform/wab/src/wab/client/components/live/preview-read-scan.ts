import styles from "@/wab/client/components/canvas/CopilotActivityOverlay.module.scss";
import {
  INSPECTION_SCAN_COLOR,
  MIN_SCAN_MS,
  SCAN_COMPLETION_MS,
} from "@/wab/client/copilot/activity";

export function installPreviewReadScan(win: Window) {
  const iframe = win.frameElement;
  const container = iframe?.parentElement;
  if (!iframe || !container) {
    return;
  }
  // Keep the overlay in Studio so it never enters the inspected business DOM.
  const doc = iframe.ownerDocument;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const region = doc.createElement("div");
  region.className = styles.region;
  region.dataset.plasmicPreviewReadScan = "";
  region.setAttribute("aria-hidden", "true");
  region.style.cssText = "inset:0;border-width:2px;border-radius:inherit";
  region.style.setProperty("--scan-color", INSPECTION_SCAN_COLOR);
  const sweep = doc.createElement("div");
  sweep.className = styles.scan;
  region.append(sweep);

  let deadline = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const clear = () => {
    clearTimeout(timer);
    region.remove();
  };
  const complete = () => {
    if (!region.isConnected || region.dataset.scanning === "false" || performance.now() < deadline) {
      return;
    }
    region.dataset.scanning = "false";
    timer = setTimeout(clear, SCAN_COMPLETION_MS);
  };
  const syncMotion = () => {
    if (!region.isConnected || region.dataset.scanning === "false") {
      return;
    }
    clearTimeout(timer);
    if (reduced.matches) {
      timer = setTimeout(complete, Math.ceil(Math.max(0, deadline - performance.now())));
    }
  };
  const receive = (event: Event) => {
    const { action } = (event as CustomEvent<{ action: string }>).detail ?? {};
    if (action === "hide" || action === "show") {
      // Visibility keeps the current animation running during capture.
      region.style.visibility = action === "hide" ? "hidden" : "";
    } else if (action === "start") {
      deadline = performance.now() + MIN_SCAN_MS;
      region.dataset.scanning = "true";
      if (!region.isConnected) {
        container.append(region);
      }
      syncMotion();
    }
  };
  sweep.addEventListener("animationiteration", complete);
  reduced.addEventListener("change", syncMotion);
  win.addEventListener("plasmic-preview-read-scan", receive);
  win.addEventListener("pagehide", clear);
  return {
    clear,
    dispose() {
      clear();
      sweep.removeEventListener("animationiteration", complete);
      reduced.removeEventListener("change", syncMotion);
      win.removeEventListener("plasmic-preview-read-scan", receive);
      win.removeEventListener("pagehide", clear);
    },
  };
}
