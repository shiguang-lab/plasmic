import { getVisibleFrameRect } from "@/wab/client/components/canvas/HoverBox/visible-bounds";
import { frameToScalerRect } from "@/wab/client/coords";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import {
  isCodeComponent,
  isCodeComponentTpl,
} from "@/wab/shared/core/components";
import { SQ, type Selectable } from "@/wab/shared/core/selection";
import { isSlotSelection } from "@/wab/shared/core/slots";
import {
  ancestorsUp,
  isTplTag,
  isTplTextBlock,
  tplChildren,
} from "@/wab/shared/core/tpls";
import type { ValNode } from "@/wab/shared/core/val-nodes";
import { Box } from "@/wab/shared/geom";
import type { TplComponent, TplNode, TplTag } from "@/wab/shared/model/classes";
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

export interface ClippedContentRegion {
  element: HTMLElement;
  horizontal: boolean;
  vertical: boolean;
}

/** Internal viewports are discovered from rendered geometry, never component names or opt-in flags. */
export function findClippedContent(
  root: HTMLElement,
  boundaries = new Set<HTMLElement>(),
): ClippedContentRegion[] {
  const regions: ClippedContentRegion[] = [];
  const pending = [root];
  const win = root.ownerDocument.defaultView;
  while (pending.length) {
    const element = pending.pop();
    if (!element || (element !== root && boundaries.has(element))) {
      continue;
    }
    const css = win?.getComputedStyle(element);
    if (!css || css.display === "none") {
      continue;
    }
    const horizontal =
      element.clientWidth > 0 &&
      /^(auto|scroll|overlay|hidden|clip)$/.test(
        css.overflowX || css.overflow,
      ) &&
      css.textOverflow !== "ellipsis" &&
      element.scrollWidth > element.clientWidth + 1;
    const vertical =
      element.clientHeight > 0 &&
      /^(auto|scroll|overlay|hidden|clip)$/.test(
        css.overflowY || css.overflow,
      ) &&
      element.scrollHeight > element.clientHeight + 1;
    if (horizontal || vertical) {
      regions.push({ element, horizontal, vertical });
    }
    pending.push(
      ...(Array.from(element.children).filter(
        (child): child is HTMLElement =>
          child.namespaceURI === "http://www.w3.org/1999/xhtml",
      ) as HTMLElement[]),
    );
  }
  return regions;
}

function contentRegions(
  vc: ViewCtx,
  tpl: TplComponent | TplTag,
  element: HTMLElement,
) {
  // A child design node owns its own clipping. AppShell's internal viewport is
  // discoverable, while a Table inside its children slot is a separate target.
  const boundaries = new Set(
    tplChildren(tpl).flatMap((child) =>
      vc
        .maybeTpl2ValsInContext(child, { allowAnyContext: true })
        .flatMap((val) => contentElements(vc, val)),
    ),
  );
  return findClippedContent(element, boundaries);
}

export function getContentEditorTarget(
  vc: ViewCtx,
): ContentEditorTarget | undefined {
  if (vc.studioCtx.isInteractiveMode || vc.canvasExporting.get()) {
    return undefined;
  }
  const selected = vc.focusedDomElts().flatMap((elts) => elts?.toArray() ?? []);
  for (const { node } of vc.focusedTplAncestorsThroughComponents()) {
    const tpl = isSlotSelection(node) ? node.getTpl() : node;
    if ((!isCodeComponentTpl(tpl) && !isTplTag(tpl)) || isTplTextBlock(tpl)) {
      continue;
    }
    const targets = vc
      .maybeTpl2ValsInContext(tpl, { allowAnyContext: true })
      .flatMap((val) =>
        contentElements(vc, val).map((element) => ({
          tpl,
          fullKey: val.fullKey,
          element,
        })),
      );
    const target =
      targets.find(({ element }) =>
        selected.some((el) => element.contains(el)),
      ) ?? (targets.length === 1 ? targets[0] : undefined);
    if (target && contentRegions(vc, tpl, target.element).length) {
      return target;
    }
  }
  return undefined;
}

/** Isolates the existing DOM, retaining React ownership and all data providers. */
export function isolateContentElement(
  element: HTMLElement,
  minWidth: number,
  regions = findClippedContent(element),
) {
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
  const expanded = new Set<HTMLElement>();
  for (const region of regions) {
    for (
      let node: HTMLElement | null = region.element;
      node && element.contains(node);
      node = node.parentElement
    ) {
      if (region.horizontal) {
        node.setAttribute("data-plasmic-content-expand-x", "");
      }
      if (region.vertical) {
        node.setAttribute("data-plasmic-content-expand-y", "");
      }
      expanded.add(node);
      if (node === element) {
        break;
      }
    }
  }
  element.setAttribute("data-plasmic-content-target", "");
  doc.documentElement.setAttribute("data-plasmic-content-editor", "");
  const style = doc.createElement("style");
  style.setAttribute("data-plasmic-editor-style", "");
  style.setAttribute("data-plasmic-content-editor-style", "");
  style.textContent = `
    html[data-plasmic-content-editor] body * { visibility: hidden !important; }
    html[data-plasmic-content-editor], html[data-plasmic-content-editor] body { overflow: hidden !important; background: transparent !important; }
    [data-plasmic-content-expand-x] { width: max-content !important; max-width: none !important; overflow: visible !important; flex-shrink: 0 !important; }
    [data-plasmic-content-expand-y] { height: auto !important; min-height: 0 !important; max-height: none !important; overflow: visible !important; flex-basis: auto !important; flex-shrink: 0 !important; }
    [data-plasmic-content-ancestor] { overflow: visible !important; clip-path: none !important; contain: none !important; transform: none !important; filter: none !important; perspective: none !important; position: static !important; }
    html[data-plasmic-content-editor] body [data-plasmic-content-target] { visibility: visible !important; position: absolute !important; left: 32px !important; top: 48px !important; margin: 0 !important; transform: none !important; width: max-content !important; min-width: ${minWidth}px !important; max-width: none !important; height: auto !important; min-height: 0 !important; max-height: none !important; overflow: visible !important; }
    html[data-plasmic-content-editor] body [data-plasmic-content-target] * { visibility: visible !important; }
  `;
  doc.head.append(style);
  return () => {
    style.remove();
    element.removeAttribute("data-plasmic-content-target");
    expanded.forEach((node) => {
      node.removeAttribute("data-plasmic-content-expand-x");
      node.removeAttribute("data-plasmic-content-expand-y");
    });
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
  readonly ready = observable.box(false);
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

  get root() {
    const target = this.target;
    return (
      target &&
      this.vc
        .maybeTpl2ValsInContext(target.tpl, { allowAnyContext: true })
        .find((val) => val.fullKey === target.fullKey)
    );
  }

  containsElement(element: Element) {
    const target = this.target;
    if (!target) {
      return !this.vc.studioCtx.canvasContentEditor;
    }
    const marked = target.element.ownerDocument.querySelector(
      "[data-plasmic-content-target]",
    );
    if (marked) {
      return marked.contains(element);
    }
    const root = this.root;
    return (root ? contentElements(this.vc, root) : [target.element]).some(
      (candidate) => candidate.contains(element),
    );
  }

  contains(selectable: Selectable) {
    if (!this.target) {
      return !this.vc.studioCtx.canvasContentEditor;
    }
    const val = isSlotSelection(selectable) ? selectable.val : selectable;
    if (!val) {
      return false;
    }
    if (
      val.fullKey === this.target.fullKey ||
      contentElements(this.vc, val).some((element) =>
        this.containsElement(element),
      )
    ) {
      return true;
    }
    return SQ(val, this.vc.valState())
      .fullstack()
      .ancestors()
      .toArrayOfValNodes()
      .some((ancestor) => ancestor.fullKey === this.target?.fullKey);
  }

  containsTpl(tpl: TplNode) {
    if (!this.target) {
      return !this.vc.studioCtx.canvasContentEditor;
    }
    return (
      ancestorsUp(tpl).includes(this.target.tpl) ||
      this.vc
        .maybeTpl2ValsInContext(tpl, { allowAnyContext: true })
        .some((val) => this.contains(val))
    );
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
            if (!isCodeComponentTpl(tpl) || !isCodeComponent(tpl.component)) {
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
    this.ready.set(false);
    this.vc.studioCtx.showStackOfParents = false;
    this.vc.studioCtx.viewCtxs.forEach((vc) => {
      vc.setViewCtxHoverBySelectable(null);
      vc.setMeasureToolDomElt(null);
    });
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
    target.element = element;
    let undo = isolateContentElement(
      element,
      originalWidth,
      contentRegions(this.vc, target.tpl, element),
    );
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
    let reveal = 0;
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
          target.element = element;
          undo = isolateContentElement(
            element,
            originalWidth,
            contentRegions(this.vc, target.tpl, element),
          );
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
        resolved: this.vc
          .maybeTpl2ValsInContext(target.tpl, { allowAnyContext: true })
          .find((val) =>
            contentElements(this.vc, val).some((candidateRoot) =>
              this.vc
                .focusedDomElts()
                .some((nodes) =>
                  nodes?.toArray().some((node) => candidateRoot.contains(node)),
                ),
            ),
          ),
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
      win.cancelAnimationFrame(reveal);
      undo();
    };
    measure();
    // Keep a readable scale; fit-to-all remains an explicit canvas action.
    reveal = win.requestAnimationFrame(() => {
      if (this.target === target) {
        measure();
        this.locate();
        reveal = win.requestAnimationFrame(() => {
          if (this.target === target) {
            this.ready.set(true);
          }
        });
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
    // Frame what is visible, like every other element-anchored canvas UI.
    // While editing, the target is isolated (ancestor clipping removed and the
    // artboard sized to it), so this is normally its whole box.
    const bounds = getVisibleFrameRect(element).rect();
    const selectedElement = this.vc.focusedDomElts()[0]?.[0];
    const selection =
      selectedElement && getVisibleFrameRect(selectedElement).rect();
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
    this.ready.set(false);
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
