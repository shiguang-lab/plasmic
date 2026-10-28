import { frameToScalerRect } from "@/wab/client/coords";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import {
  isCodeComponent,
  isCodeComponentTpl,
} from "@/wab/shared/core/components";
import { isSlotSelection } from "@/wab/shared/core/slots";
import { isTplTag, isTplTextBlock } from "@/wab/shared/core/tpls";
import type { ValNode } from "@/wab/shared/core/val-nodes";
import { Box } from "@/wab/shared/geom";
import type { TplComponent, TplTag } from "@/wab/shared/model/classes";
import { observable, reaction } from "mobx";

export interface ContentEditorTarget {
  tpl: TplComponent | TplTag;
  fullKey: string;
  element: HTMLElement;
}

// Components may return editor styles alongside their rendered root.
function contentElements(vc: ViewCtx, val: ValNode) {
  return (vc.eltFinder(val) ?? []).filter(
    (element) => !element.matches("style, script, link, meta, template"),
  );
}

/** Nearest supported owner; code component internals are owned by their registration. */
export function getContentEditorTarget(
  vc: ViewCtx,
): ContentEditorTarget | undefined {
  if (vc.studioCtx.isInteractiveMode || vc.canvasExporting.get()) {
    return undefined;
  }
  const selected = vc.focusedDomElts().flatMap((elts) => elts?.toArray() ?? []);
  for (const { node } of vc.focusedTplAncestorsThroughComponents()) {
    const tpl = isSlotSelection(node) ? node.getTpl() : node;
    if (!isCodeComponentTpl(tpl) && !isTplTag(tpl)) {
      continue;
    }
    const registered =
      isCodeComponentTpl(tpl) && isCodeComponent(tpl.component)
        ? vc.getCodeComponentMeta(tpl.component)?.canvasContentEditor === true
        : false;
    if (!registered && (!isTplTag(tpl) || isTplTextBlock(tpl))) {
      continue;
    }
    const candidates = vc.maybeTpl2ValsInContext(tpl, {
      allowAnyContext: true,
    });
    const targets = candidates.flatMap((val: ValNode) =>
      contentElements(vc, val).map((element: HTMLElement) => ({
        tpl,
        fullKey: val.fullKey,
        element,
      })),
    );
    // A repeated owner must resolve to the selected rendered instance.
    const target =
      targets.find(({ element }) =>
        selected.some((el) => element.contains(el)),
      ) ?? (targets.length === 1 ? targets[0] : undefined);
    if (!target) {
      continue;
    }
    const style = target.element.ownerDocument.defaultView?.getComputedStyle(
      target.element,
    );
    const clipped =
      style &&
      ((/(auto|scroll|hidden)/.test(style.overflowX) &&
        target.element.scrollWidth > target.element.clientWidth) ||
        (/(auto|scroll|hidden)/.test(style.overflowY) &&
          target.element.scrollHeight > target.element.clientHeight));
    if (registered || clipped) {
      return target;
    }
  }
  return undefined;
}

/** Isolates the existing DOM, retaining React ownership and all data providers. */
export function isolateContentElement(element: HTMLElement, minWidth: number) {
  const doc = element.ownerDocument;
  const ancestors: HTMLElement[] = [];
  for (
    let parent = element.parentElement;
    parent;
    parent = parent.parentElement
  ) {
    ancestors.push(parent);
    parent.setAttribute("data-plasmic-content-ancestor", "");
  }
  element.setAttribute("data-plasmic-content-target", "");
  doc.documentElement.setAttribute("data-plasmic-content-editor", "");
  const style = doc.createElement("style");
  style.setAttribute("data-plasmic-editor-style", "");
  style.setAttribute("data-plasmic-content-editor-style", "");
  style.textContent = `
    html[data-plasmic-content-editor] body * { visibility: hidden !important; }
    html[data-plasmic-content-editor], html[data-plasmic-content-editor] body { overflow: hidden !important; background: transparent !important; }
    [data-plasmic-content-ancestor] { overflow: visible !important; clip-path: none !important; contain: none !important; transform: none !important; filter: none !important; perspective: none !important; position: static !important; }
    html[data-plasmic-content-editor] body [data-plasmic-content-target] { visibility: visible !important; position: absolute !important; left: 32px !important; top: 48px !important; margin: 0 !important; transform: none !important; width: max-content !important; min-width: ${minWidth}px !important; max-width: none !important; height: auto !important; min-height: 0 !important; max-height: none !important; overflow: visible !important; }
    html[data-plasmic-content-editor] body [data-plasmic-content-target] * { visibility: visible !important; }
  `;
  doc.head.append(style);
  return () => {
    style.remove();
    element.removeAttribute("data-plasmic-content-target");
    ancestors.forEach((parent) =>
      parent.removeAttribute("data-plasmic-content-ancestor"),
    );
    doc.documentElement.removeAttribute("data-plasmic-content-editor");
  };
}

export class CanvasContentEditor {
  private targetState = observable.box<ContentEditorTarget | undefined>(
    undefined,
    { deep: false },
  );
  readonly size = observable.box<{ width: number; height: number } | undefined>(
    undefined,
    { deep: false },
  );
  // Render dependencies, not navigation history: virtualized ancestors must
  // keep the current target mounted until the entire editing session ends.
  private expandedAncestors = observable.set<string>();
  private cleanup?: () => void;
  private viewport?: ReturnType<
    ViewCtx["studioCtx"]["getCurrentStudioViewportSnapshot"]
  >;

  constructor(private vc: ViewCtx) {}

  get target() {
    return this.targetState.get();
  }

  isExpanded(fullKey: string) {
    return (
      this.target?.fullKey === fullKey || this.expandedAncestors.has(fullKey)
    );
  }

  async enter(target = getContentEditorTarget(this.vc)) {
    const previous = this.target;
    if (
      !target ||
      (previous?.tpl === target.tpl && previous.fullKey === target.fullKey)
    ) {
      return;
    }
    if (!previous) {
      this.vc.studioCtx.viewCtxs.forEach((vc) => vc.contentEditor.exit());
      this.viewport = this.vc.studioCtx.getCurrentStudioViewportSnapshot();
    }
    const arena = this.vc.studioCtx.currentArena;
    const originalWidth = target.element.getBoundingClientRect().width;
    const ancestorPath = this.vc
      .focusedTplAncestorsThroughComponents()
      .map(({ node }) => (isSlotSelection(node) ? node.getTpl() : node));
    const targetIndex = ancestorPath.indexOf(target.tpl);
    const ancestors =
      targetIndex < 0
        ? []
        : ancestorPath.slice(targetIndex + 1).flatMap((tpl) => {
            if (
              !isCodeComponentTpl(tpl) ||
              !isCodeComponent(tpl.component) ||
              !this.vc.getCodeComponentMeta(tpl.component)?.canvasContentEditor
            ) {
              return [];
            }
            return this.vc
              .maybeTpl2ValsInContext(tpl, { allowAnyContext: true })
              .filter(
                (val) =>
                  val.fullKey !== target.fullKey &&
                  contentElements(this.vc, val).some((element) =>
                    element.contains(target.element),
                  ),
              )
              .map((val) => val.fullKey);
          });
    this.cleanup?.();
    this.cleanup = undefined;
    this.expandedAncestors.replace(ancestors);
    this.size.set(undefined);
    this.targetState.set(target);
    this.vc.scheduleSync({ eval: true, styles: false, asap: true });
    await this.vc.awaitSync();
    if (this.targetState.get() !== target) {
      return;
    }
    if (
      this.vc.studioCtx.isInteractiveMode ||
      this.vc.studioCtx.isLiveMode ||
      this.vc.studioCtx.currentArena !== arena ||
      this.vc.canvasExporting.get()
    ) {
      this.exit(false);
      return;
    }
    const selectedPath = this.vc
      .focusedTplAncestorsThroughComponents()
      .map(({ node }) => (isSlotSelection(node) ? node.getTpl() : node));
    if (
      (selectedPath.length > 0 && !selectedPath.includes(target.tpl)) ||
      (this.vc.studioCtx.focusedViewCtx() &&
        this.vc.studioCtx.focusedViewCtx() !== this.vc)
    ) {
      this.exit();
      return;
    }
    const currentVal = this.vc
      .maybeTpl2ValsInContext(target.tpl, { allowAnyContext: true })
      .find((v) => v.fullKey === target.fullKey);
    const currentElement =
      currentVal && contentElements(this.vc, currentVal)[0];
    if (!currentElement) {
      this.exit();
      return;
    }
    const win = currentElement.ownerDocument.defaultView;
    if (!win) {
      this.exit();
      return;
    }
    let element = currentElement;
    let undo = isolateContentElement(element, originalWidth);
    const measure = () => {
      const width =
        Math.ceil(
          Math.max(element.scrollWidth, element.getBoundingClientRect().width),
        ) + 64;
      const height =
        Math.ceil(
          Math.max(
            element.scrollHeight,
            element.getBoundingClientRect().height,
          ),
        ) + 96;
      const prev = this.size.get();
      if (prev?.width !== width || prev.height !== height) {
        this.size.set({ width, height });
      }
    };
    const resize = new ResizeObserver(measure);
    resize.observe(element);
    let pending = 0;
    const mutations = new MutationObserver(() => {
      if (pending) {
        return;
      }
      pending = win.requestAnimationFrame(() => {
        pending = 0;
        if (!element.isConnected) {
          const val = this.vc
            .maybeTpl2ValsInContext(target.tpl, { allowAnyContext: true })
            .find((v) => v.fullKey === target.fullKey);
          const next = val && contentElements(this.vc, val)[0];
          if (!next) {
            this.exit();
            return;
          }
          resize.disconnect();
          undo();
          element = next;
          undo = isolateContentElement(element, originalWidth);
          resize.observe(element);
        }
        measure();
      });
    });
    mutations.observe(element.ownerDocument.body, {
      subtree: true,
      childList: true,
    });
    const stop = reaction(
      () => ({
        path: this.vc
          .focusedTplAncestorsThroughComponents()
          .map(({ node }) => (isSlotSelection(node) ? node.getTpl() : node)),
        active:
          !this.vc.studioCtx.focusedViewCtx() ||
          this.vc.studioCtx.focusedViewCtx() === this.vc,
        interactive:
          this.vc.studioCtx.isInteractiveMode ||
          this.vc.studioCtx.isLiveMode ||
          this.vc.canvasExporting.get(),
        arena: this.vc.studioCtx.currentArena,
        resolved: getContentEditorTarget(this.vc),
      }),
      ({ path, active, interactive, arena: currentArena, resolved }) => {
        if (
          !active ||
          interactive ||
          currentArena !== arena ||
          (path.length > 0 && !path.includes(target.tpl)) ||
          (resolved?.tpl === target.tpl && resolved.fullKey !== target.fullKey)
        ) {
          this.exit(currentArena === arena && active);
        }
      },
    );
    this.cleanup = () => {
      stop();
      mutations.disconnect();
      resize.disconnect();
      win.cancelAnimationFrame(pending);
      undo();
    };
    measure();
    // Keep a readable scale; fit-to-all remains an explicit canvas action.
    win.requestAnimationFrame(() => {
      if (this.target === target) {
        this.locate();
      }
    });
  }

  locate(fitAll = false) {
    const target = this.target;
    if (!target) {
      return;
    }
    const val = this.vc
      .maybeTpl2ValsInContext(target.tpl, { allowAnyContext: true })
      .find((v) => v.fullKey === target.fullKey);
    const element = val && contentElements(this.vc, val)[0];
    if (!element) {
      return;
    }
    const bounds = element.getBoundingClientRect();
    const selection = this.vc.focusedDomElts()[0]?.[0]?.getBoundingClientRect();
    const rect = fitAll
      ? bounds
      : {
          left: Math.max(bounds.left, selection?.left ?? bounds.left),
          top: bounds.top,
          width: Math.min(480, selection?.width ?? bounds.width),
          height: Math.min(320, bounds.height),
        };
    this.vc.studioCtx.viewportCtx?.zoomToScalerBox(
      Box.fromRect(frameToScalerRect(rect, this.vc)),
      {
        maxScale: 1,
        minPadding: { ...this.vc.studioCtx.canvasZoomPadding(), top: 110 },
      },
    );
  }

  exit(restoreViewport = true) {
    if (!this.target) {
      return;
    }
    this.cleanup?.();
    this.cleanup = undefined;
    this.targetState.set(undefined);
    this.expandedAncestors.clear();
    this.size.set(undefined);
    this.vc.scheduleSync({ eval: true, styles: false, asap: true });
    const snapshot = this.viewport;
    this.viewport = undefined;
    if (restoreViewport && snapshot && this.vc.studioCtx.viewportCtx) {
      this.vc.studioCtx.restoreStudioViewportSnapshot(snapshot, false);
    }
  }
}
