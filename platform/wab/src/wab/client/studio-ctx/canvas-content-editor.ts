import { uniq } from "lodash";
import type { AnyArena } from "@/wab/shared/Arenas";
import { subscribeStudioRenderPolicy } from "@/wab/client/studio-ctx/studio-render-policy";
import { subscribeStudioSelection, subscribeViewSelection } from "@/wab/client/studio-ctx/selection-state";
import { subscribeStudioLiveMode } from "@/wab/client/studio-ctx/studio-mode-state";
import { subscribeStudioArena } from "@/wab/client/studio-ctx/arena-state";
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
import type { ModelFieldStore, ModelRef } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { arrayEq, assert } from "@/wab/shared/common";
import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";

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
  return Array.from(iterateClippedContent(root, boundaries));
}

function* iterateClippedContent(
  root: HTMLElement,
  boundaries: Set<HTMLElement>,
): Generator<ClippedContentRegion> {
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
      yield { element, horizontal, vertical };
    }
    pending.push(
      ...(Array.from(element.children).filter(
        (child): child is HTMLElement =>
          child.namespaceURI === "http://www.w3.org/1999/xhtml",
      ) as HTMLElement[]),
    );
  }
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
  return iterateClippedContent(element, boundaries);
}

export function getContentEditorTarget(
  vc: ViewCtx,
): ContentEditorTarget | undefined {
  if (vc.studioCtx.isInteractiveMode || vc.canvasExporting) {
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
    if (target && !contentRegions(vc, tpl, target.element).next().done) {
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

export interface CanvasContentEditorSnapshot {
  readonly target: Readonly<{ tpl: ModelRef<TplComponent | TplTag>; fullKey: string; element: HTMLElement }> | undefined;
  readonly size: Readonly<{ width: number; height: number }> | undefined;
  readonly ready: boolean;
  readonly expandedAncestors: readonly string[];
}
interface ContentEditorSession {
  readonly target: ContentEditorTarget | undefined;
  readonly size: CanvasContentEditorSnapshot["size"];
  readonly ready: boolean;
  readonly expandedAncestors: readonly string[];
}
const emptyAncestors: readonly string[] = Object.freeze([]);
const emptyContentEditor = Object.freeze({ target: undefined, size: undefined, ready: false, expandedAncestors: emptyAncestors });
const emptyContentEditorStore = createStore<CanvasContentEditorSnapshot>(() => emptyContentEditor);

/** A derived command-handle index. Its roster priority is the original
 * viewCtxs.find ordering; the per-view editor remains the only session owner. */
export class CanvasContentEditorIndex {
  private current: CanvasContentEditor | undefined;
  private readonly state = createStore<CanvasContentEditor | undefined>(() => undefined);
  private readonly listeners = new Set<() => void>();
  private readonly pending = new Set<() => void>();
  private depth = 0;
  private disposed = false;
  constructor(private readonly views: () => readonly ViewCtx[]) {}
  readonly store: ModelFieldStore<CanvasContentEditor | undefined> = {
    getState: () => this.current,
    getInitialState: this.state.getInitialState,
    subscribe: (listener) => {
      if (this.disposed) { return () => undefined; }
      const off = this.state.subscribe(listener);
      const stop = () => { off(); this.listeners.delete(stop); };
      this.listeners.add(stop); return stop;
    },
  };
  prepare() { if (!this.disposed) { this.current = this.views().find((view) => view.contentEditor.target)?.contentEditor; } }
  queue(publish: () => void) { assert(!this.disposed, "Cannot publish a closed content-editor index"); this.prepare(); this.pending.add(publish); this.flush(); }
  sync() { this.prepare(); this.flush(); }
  deferPublication<Result>(command: () => Result): Result {
    this.depth++;
    try { return command(); }
    finally { this.depth--; this.flush(); }
  }
  private flush() {
    if (this.depth || this.disposed) { return; }
    const pending = [...this.pending]; this.pending.clear();
    pending.forEach((publish) => publish());
    if (this.state.getState() !== this.current) { this.state.setState(this.current, true); }
  }
  dispose() {
    if (this.disposed) { return; }
    this.current = undefined; this.pending.clear(); this.state.setState(undefined, true);
    this.disposed = true; this.listeners.forEach((stop) => stop()); this.listeners.clear();
  }
}

const emptyActiveEditor = createStore<CanvasContentEditor | undefined>(() => undefined);
export function useActiveContentEditor(studio: Pick<StudioCtx, "activeContentEditorStore"> | undefined) {
  return useStore(studio ? studio.activeContentEditorStore : emptyActiveEditor);
}
export function useContentEditor<Selected>(editor: CanvasContentEditor | undefined, select: (state: CanvasContentEditorSnapshot) => Selected): Selected {
  return useStore(editor ? editor.store : emptyContentEditorStore, select);
}

/** Exact session-scope input for helpers that still read command models/DOM. */
export function useContentEditorScope(studio: Pick<StudioCtx, "activeContentEditorStore"> | undefined) {
  return useContentEditor(useActiveContentEditor(studio), (state) => state.target);
}

export function subscribeContentEditorScope(studio: Pick<StudioCtx, "activeContentEditorStore">, listener: () => void) {
  let editor = studio.activeContentEditorStore.getState();
  let previous = editor?.store.getState().target;
  let stopEditor: (() => void) | undefined;
  let closed = false;
  const sync = () => {
    if (closed) { return; }
    const nextEditor = studio.activeContentEditorStore.getState();
    if (editor !== nextEditor) {
      stopEditor?.(); editor = nextEditor;
      stopEditor = editor?.store.subscribe(sync);
    }
    const next = editor?.store.getState().target;
    if (next !== previous) { previous = next; listener(); }
  };
  stopEditor = editor?.store.subscribe(sync);
  const stopIndex = studio.activeContentEditorStore.subscribe(sync);
  return () => { if (!closed) { closed = true; stopEditor?.(); stopIndex(); } };
}

export class CanvasContentEditor {
  private session: ContentEditorSession = emptyContentEditor;
  private current: CanvasContentEditorSnapshot = emptyContentEditor;
  private readonly state = createStore<CanvasContentEditorSnapshot>(() => emptyContentEditor);
  private readonly listeners = new Set<() => void>();
  private disposed = false;
  private cleanup?: () => void;
  private sessionArena: AnyArena | null | undefined;
  private viewport?: ReturnType<ViewCtx["studioCtx"]["getCurrentStudioViewportSnapshot"]>;
  constructor(private vc: ViewCtx) {}
  get viewCtx() { return this.vc; }
  get target() { return this.session.target; }
  get size() { return this.session.size; }
  get ready() { return this.session.ready; }
  readonly store: ModelFieldStore<CanvasContentEditorSnapshot> = {
    getState: () => this.current,
    getInitialState: this.state.getInitialState,
    subscribe: (listener) => {
      if (this.disposed) { return () => undefined; }
      const off = this.state.subscribe(listener);
      const stop = () => { off(); this.listeners.delete(stop); };
      this.listeners.add(stop); return stop;
    },
  };
  private commitSession(session: ContentEditorSession) {
    assert(!this.disposed, "Cannot update a disposed content editor");
    this.session = session;
    const previous = this.current;
    const runtime = session.target;
    const target = runtime ? (() => {
      const tpl = this.vc.studioCtx.modelSnapshots.ref(runtime.tpl);
      return previous.target?.tpl === tpl && previous.target.fullKey === runtime.fullKey && previous.target.element === runtime.element
        ? previous.target : Object.freeze({ tpl, fullKey: runtime.fullKey, element: runtime.element });
    })() : undefined;
    const size = session.size?.width === previous.size?.width && session.size?.height === previous.size?.height ? previous.size : session.size;
    const expandedAncestors = arrayEq(previous.expandedAncestors, session.expandedAncestors) ? previous.expandedAncestors : session.expandedAncestors;
    this.current = target === previous.target && size === previous.size && session.ready === previous.ready && expandedAncestors === previous.expandedAncestors
      ? previous : Object.freeze({ target, size, ready: session.ready, expandedAncestors });
    const expandedChanged = runtime?.fullKey !== previous.target?.fullKey || expandedAncestors !== previous.expandedAncestors;
    const expanded = runtime ? [runtime.fullKey, ...expandedAncestors] : emptyAncestors;
    const publishRender = expandedChanged ? this.vc.canvasRenderOwner.prepareContentEditor(expanded) : () => undefined;
    this.vc.studioCtx.publishContentEditorInputs(() => { publishRender(); this.publishCurrent(); });
  }
  private publishCurrent() {
    if (this.state.getState() !== this.current) { this.state.setState(this.current, true); }
    if (this.disposed) { this.listeners.forEach((stop) => stop()); this.listeners.clear(); }
  }
  private setSize(size: CanvasContentEditorSnapshot["size"]) {
    const frozen = size && Object.freeze({ width: size.width, height: size.height });
    this.commitSession({ ...this.session, size: frozen });
  }
  private setReady(ready: boolean) { this.commitSession({ ...this.session, ready }); }
  private updateTargetElement(target: ContentEditorTarget, element: HTMLElement) {
    if (this.target !== target) { return; }
    target.element = element;
    this.commitSession(this.session);
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
      this.target?.fullKey === fullKey || this.session.expandedAncestors.includes(fullKey)
    );
  }

  async enter(requestedTarget?: ContentEditorTarget) {
    assert(!this.disposed, "Cannot enter a disposed content editor");
    const target = requestedTarget === undefined ? getContentEditorTarget(this.vc) : requestedTarget;
    const previous = this.target;
    if (
      !target ||
      (previous?.tpl === target.tpl && previous.fullKey === target.fullKey)
    ) {
      return;
    }
    const { arena, originalWidth } = this.vc.studioCtx.withContentEditorPublication(() => {
    if (!previous) {
      this.vc.studioCtx.viewCtxs.forEach((vc) => vc.contentEditor.exit());
      this.viewport = this.vc.studioCtx.getCurrentStudioViewportSnapshot();
    }
    const enteredArena = this.vc.studioCtx.currentArena;
    this.sessionArena = enteredArena;
    const enteredWidth = target.element.getBoundingClientRect().width;
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
    this.vc.studioCtx.setShowStackOfParents(false);
    this.vc.studioCtx.viewCtxs.forEach((vc) => {
      vc.setViewCtxHoverBySelectable(null);
      vc.setMeasureToolDomElt(null);
    });
    this.commitSession({ target, size: undefined, ready: false, expandedAncestors: Object.freeze(uniq(ancestors)) });
    this.vc.scheduleSync({ eval: true, styles: false, asap: true });
    return { arena: enteredArena, originalWidth: enteredWidth };
    });
    await this.vc.awaitSync();
    if (this.target !== target) {
      return;
    }
    if (
      this.vc.studioCtx.isInteractiveMode ||
      this.vc.studioCtx.isLiveMode ||
      this.vc.studioCtx.currentArena !== arena ||
      this.vc.canvasExporting
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
    this.vc.studioCtx.withContentEditorPublication(() => {
    let closed = false;
    let element = currentElement;
    this.updateTargetElement(target, element);
    let undo = isolateContentElement(
      element,
      originalWidth,
      Array.from(contentRegions(this.vc, target.tpl, element)),
    );
    const measure = () => {
      if (closed || this.target !== target) { return; }
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
      const prev = this.size;
      if (prev?.width !== width || prev.height !== height) {
        this.setSize({ width, height });
      }
    };
    const resize = new ResizeObserver(measure);
    resize.observe(element);
    let pending = 0;
    let reveal = 0;
    const mutations = new MutationObserver(() => {
      if (closed || this.target !== target || pending) {
        return;
      }
      pending = win.requestAnimationFrame(() => {
        if (closed || this.target !== target) { return; }
        pending = 0;
        checkSelection();
        if (closed || this.target !== target) { return; }
        this.vc.studioCtx.withContentEditorPublication(() => {
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
          this.updateTargetElement(target, element);
          undo = isolateContentElement(
            element,
            originalWidth,
            Array.from(contentRegions(this.vc, target.tpl, element)),
          );
          resize.observe(element);
        }
        measure();
        });
      });
    });
    mutations.observe(element.ownerDocument.body, {
      subtree: true,
      childList: true, attributes: true, characterData: true,
    });
    const ancestry = this.vc.canvasRenderOwner.ancestryInput(this.vc);
    const rootInput = this.vc.canvasRenderOwner.variantInputs(this.vc).rootStore;
    const frameInfo = this.vc.canvasCtx.frameInfo(this.vc);
    const targetRef = this.current.target?.tpl;
    const readSelection = () => {
      const currentArena = this.vc.studioCtx.currentArena;
      const focused = this.vc.studioCtx.focusedViewCtx();
      const active = !focused || focused === this.vc;
      const interactive = this.vc.studioCtx.isInteractiveMode || this.vc.studioCtx.isLiveMode || frameInfo.getState().exporting;
      // A new arena can be published while the old target is still mounted.
      // Do not traverse that target's model or evaluator once it loses ownership.
      const owned = active && currentArena === arena;
      const path = owned ? ancestry.getState() : [];
      const resolved = owned ? this.vc.maybeTpl2ValsInContext(target.tpl, { allowAnyContext: true })
        .find((val) => contentElements(this.vc, val).some((candidateRoot) =>
          this.vc.focusedDomElts().some((nodes) => nodes?.toArray().some((node) => candidateRoot.contains(node))))) : undefined;
      return { currentArena, active, interactive, path, resolved };
    };
    const checkSelection = () => {
      if (closed || this.target !== target) { return; }
      const { currentArena, active, interactive, path, resolved } = readSelection();
      if (!active || interactive || currentArena !== arena ||
        (path.length > 0 && !path.some((ref) => ref === targetRef)) ||
        (resolved?.tpl === target.tpl && resolved.fullKey !== target.fullKey)) {
        this.exit(currentArena === arena && active);
      }
    };
    const stops = [
      subscribeStudioArena(this.vc.studioCtx, (state) => state.current, checkSelection),
      subscribeStudioSelection(this.vc.studioCtx, (state) => state.view, checkSelection),
      subscribeViewSelection(this.vc, (state) => state.tpls, checkSelection),
      subscribeViewSelection(this.vc, (state) => state.targets, checkSelection),
      subscribeViewSelection(this.vc, (state) => state.context, checkSelection),
      subscribeViewSelection(this.vc, (state) => state.doms, checkSelection),
      subscribeViewSelection(this.vc, (state) => state.cloneKeys, checkSelection),
      this.vc.canvasRenderOwner.subscribeAncestryBeforePublish(this.vc, checkSelection),
      this.vc.frameState.valRootStore.subscribe(checkSelection),
      rootInput.subscribe(checkSelection),
      subscribeStudioLiveMode(this.vc.studioCtx, checkSelection),
      subscribeStudioRenderPolicy(this.vc.studioCtx, (policy) => policy.interactive, checkSelection),
      this.vc.csEvaluator.renderStatusStore.subscribe(checkSelection),
    ];
    let exporting = frameInfo.getState().exporting;
    const stopExporting = frameInfo.subscribe((next) => {
      if (next.exporting !== exporting) { exporting = next.exporting; checkSelection(); }
    });
    this.cleanup = () => {
      if (closed) { return; } closed = true;
      stops.forEach((unsubscribe) => unsubscribe());
      stopExporting();
      mutations.disconnect();
      resize.disconnect();
      win.cancelAnimationFrame(pending);
      win.cancelAnimationFrame(reveal);
      undo();
    };
    measure();
    // Keep a readable scale; fit-to-all remains an explicit canvas action.
    reveal = win.requestAnimationFrame(() => {
      if (!closed && this.target === target) {
        this.vc.studioCtx.withContentEditorPublication(() => {
          measure();
          this.locate();
          reveal = win.requestAnimationFrame(() => {
            if (!closed && this.target === target) {
              this.vc.studioCtx.withContentEditorPublication(() => this.setReady(true));
            }
          });
        });
      }
    });
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

  /** Completed native ownership inputs close a departing session before their
   * first UI subscriber can encounter its old model/evaluator. */
  prepareOwnership(input: { live?: boolean; interactive?: boolean } = {}) {
    if (!this.target || this.disposed) { return; }
    const studio = this.vc.studioCtx;
    const focused = studio.focusedViewCtx();
    const active = !focused || focused === this.vc;
    const sameArena = studio.currentArena === this.sessionArena;
    if (!active || !sameArena || (input.live ?? studio.isLiveMode) || (input.interactive ?? studio.isInteractiveMode) || this.vc.canvasExporting) {
      this.exit(sameArena && active);
    }
  }

  exit(restoreViewport = true) {
    if (this.disposed || !this.target) {
      return;
    }
    this.vc.studioCtx.withContentEditorPublication(() => {
    this.cleanup?.();
    this.cleanup = undefined;
    this.commitSession({ target: undefined, size: undefined, ready: false, expandedAncestors: emptyAncestors });
    this.vc.scheduleSync({ eval: true, styles: false, asap: true });
    const snapshot = this.viewport;
    this.viewport = undefined;
    this.sessionArena = undefined;
    if (restoreViewport && snapshot && this.vc.studioCtx.viewportCtx) {
      this.vc.studioCtx.restoreStudioViewportSnapshot(snapshot, false);
    }
    });
  }

  dispose() {
    if (this.disposed) { return; }
    this.vc.studioCtx.withContentEditorPublication(() => {
      this.exit(false);
      this.disposed = true;
      this.vc.studioCtx.publishContentEditorInputs(() => this.publishCurrent());
    });
  }
}
