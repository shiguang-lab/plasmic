/** Fixed navigation presets; authored on Go to page, never on the project. */
export const PAGE_TRANSITION_PRESETS = [
  "none",
  "fade",
  "push-right",
  "slide-up",
] as const;
export type PageTransitionPreset = (typeof PAGE_TRANSITION_PRESETS)[number];

export type PreviewDevice = "desktop" | "phone" | "tablet" | "custom";

export interface PageTransition {
  preset?: PageTransitionPreset;
  reverse?: boolean;
  device?: PreviewDevice;
}

export interface PageNavigationTransition extends PageTransition {
  fromPath: string;
  toPath: string;
}

export function isPageTransitionPreset(value: unknown): value is PageTransitionPreset {
  return PAGE_TRANSITION_PRESETS.some((preset) => preset === value);
}

const activeTransitions = new WeakMap<Document, { transition: ViewTransition; style: HTMLStyleElement }>();
const pendingUpdates = new WeakMap<Document, Promise<void>>();

/** Serialize DOM commits, but let a subsequent navigation interrupt animation.
 * The callback must resolve after the destination has committed to the DOM. */
export function runPageTransition(
  doc: Document,
  update: () => void | Promise<void>,
  options?: PageTransition,
): Promise<void> {
  const run = async () => {
    const previous = activeTransitions.get(doc);
    if (previous) {
      previous.transition.skipTransition();
      previous.style.remove();
      activeTransitions.delete(doc);
    }
    const win = doc.defaultView;
    if (!options || options.preset === "none" || !doc.startViewTransition ||
      (options.device !== "phone" && options.device !== "tablet") ||
      win?.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      await update();
      return;
    }

    const preset = options.preset ?? "push-right";
    const reverse = options.reverse ?? false;
    const oldFrames = preset === "fade"
      ? "from { opacity: 1 } to { opacity: 0 }"
      : preset === "push-right"
        ? `from { transform: translateX(0) } to { transform: translateX(${reverse ? "100%" : "-100%"}) }`
        : reverse
          ? "from { transform: translateY(0) } to { transform: translateY(100%) }"
          : "from { transform: none } to { transform: none }";
    const newFrames = preset === "fade"
      ? "from { opacity: 0 } to { opacity: 1 }"
      : preset === "push-right"
        ? `from { transform: translateX(${reverse ? "-100%" : "100%"}) } to { transform: translateX(0) }`
        : reverse
          ? "from { transform: none } to { transform: none }"
          : "from { transform: translateY(100%) } to { transform: translateY(0) }";
    const style = doc.createElement("style");
    style.dataset.plasmicPageTransition = preset;
    style.dataset.direction = reverse ? "back" : "forward";
    style.textContent = `
      @keyframes plasmic-page-old { ${oldFrames} }
      @keyframes plasmic-page-new { ${newFrames} }
      ::view-transition { pointer-events: none; }
      ::view-transition-group(root) { animation-duration: 0s; }
      ::view-transition-image-pair(root) { isolation: isolate; }
      ::view-transition-old(root), ::view-transition-new(root) {
        height: 100%; mix-blend-mode: normal;
        animation-duration: ${preset === "fade" ? 200 : 300}ms;
        animation-timing-function: cubic-bezier(.22,.61,.36,1);
        animation-fill-mode: both;
      }
      ::view-transition-old(root) { animation-name: plasmic-page-old; z-index: ${reverse ? 2 : 1}; }
      ::view-transition-new(root) { animation-name: plasmic-page-new; z-index: ${reverse ? 1 : 2}; }
    `;
    doc.head.append(style);
    let transition: ViewTransition;
    try {
      transition = doc.startViewTransition(update);
    } catch (error) {
      style.remove();
      throw error;
    }
    const active = { transition, style };
    activeTransitions.set(doc, active);
    const cleanup = () => {
      style.remove();
      if (activeTransitions.get(doc) === active) { activeTransitions.delete(doc); }
    };
    // A skipped animation may reject ready while the DOM update still succeeds.
    void transition.ready.catch(() => undefined);
    void transition.finished.then(cleanup, cleanup);
    await transition.updateCallbackDone;
  };
  const pending = pendingUpdates.get(doc);
  const result = pending ? pending.catch(() => undefined).then(run) : run();
  pendingUpdates.set(doc, result);
  const cleanup = () => {
    if (pendingUpdates.get(doc) === result) { pendingUpdates.delete(doc); }
  };
  void result.then(cleanup, cleanup);
  return result;
}
