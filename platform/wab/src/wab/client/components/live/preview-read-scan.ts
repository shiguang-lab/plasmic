import styles from "@/wab/client/components/canvas/CopilotActivityOverlay.module.scss";
import {
  clipBox,
  computeClipBounds,
} from "@/wab/client/components/canvas/HoverBox/visible-bounds";
import {
  INSPECTION_SCAN_COLOR,
  MIN_SCAN_MS,
  SCAN_COMPLETION_MS,
} from "@/wab/client/copilot/activity";
import { Box } from "@/wab/shared/geom";

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
  region.style.cssText = "inset:0;border-radius:inherit";
  region.style.setProperty("--scan-color", INSPECTION_SCAN_COLOR);
  region.style.setProperty("--scan-completion-duration", `${SCAN_COMPLETION_MS}ms`);
  const sweep = doc.createElement("div");
  sweep.className = styles.scan;
  region.append(sweep);

  let deadline = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let target: Element | undefined;
  let frame: number | undefined;
  let captureHidden = false;
  const clear = () => {
    clearTimeout(timer);
    if (frame !== undefined) {
      win.cancelAnimationFrame(frame);
      frame = undefined;
    }
    target = undefined;
    region.remove();
  };
  const position = () => {
    if (!target) {
      Object.assign(region.style, {
        inset: "0",
        width: "",
        height: "",
        borderRadius: "inherit",
      });
      return true;
    }
    if (!target.isConnected || !target.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) {
      return false;
    }
    const rect = clipBox(
      Box.fromRect(target.getBoundingClientRect()),
      computeClipBounds(target),
    )?.rect();
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return false;
    }
    Object.assign(region.style, {
      inset: "auto",
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      borderRadius: "",
    });
    return true;
  };
  const track = () => {
    frame = undefined;
    if (position()) {
      frame = win.requestAnimationFrame(track);
    } else {
      clear();
    }
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
    const { action, element } =
      (event as CustomEvent<{ action: string; element?: Element }>).detail ?? {};
    if (action === "hide" || action === "show") {
      // Visibility keeps the current animation running during capture.
      captureHidden = action === "hide";
      region.style.visibility = captureHidden ? "hidden" : "";
    } else if (action === "start") {
      if (element && element.ownerDocument !== win.document) {
        return;
      }
      if (frame !== undefined) {
        win.cancelAnimationFrame(frame);
        frame = undefined;
      }
      target = element;
      if (!position()) {
        clear();
        return;
      }
      deadline = performance.now() + MIN_SCAN_MS;
      region.dataset.scanning = "true";
      region.style.visibility = captureHidden ? "hidden" : "";
      if (!region.isConnected) {
        container.append(region);
      }
      if (target) {
        frame = win.requestAnimationFrame(track);
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
