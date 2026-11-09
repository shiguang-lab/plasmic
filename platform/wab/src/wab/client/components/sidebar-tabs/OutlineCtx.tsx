import { subscribeStudioArena } from "@/wab/client/studio-ctx/arena-state";
import { subscribeFocusedViewSelection, subscribeStudioSelection } from "@/wab/client/studio-ctx/selection-state";
import { isElementWithComments } from "@/wab/client/components/comments/utils";
import { Matcher } from "@/wab/client/components/view-common";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { toOpaque } from "@/wab/commons/types";
import { AnyArena, FrameViewMode, getArenaFrames } from "@/wab/shared/Arenas";
import { isTplSlotVisible } from "@/wab/shared/cached-selectors";
import { isPlainObjectPropType } from "@/wab/shared/code-components/code-components";
import {
  eagerCoalesce,
  arrayEq,
  ensure,
  filterMapTruthy,
  maybe,
  switchType,
  tuple,
  withoutNils,
} from "@/wab/shared/common";
import { isCodeComponent } from "@/wab/shared/core/components";
import { getOnlyAssetRef } from "@/wab/shared/core/image-assets";
import { isTplAttachedToSite } from "@/wab/shared/core/sites";
import { SlotSelection } from "@/wab/shared/core/slots";
import * as Tpls from "@/wab/shared/core/tpls";
import {
  isTplImage,
  isTplTagOrComponent,
  summarizeSlotParam,
} from "@/wab/shared/core/tpls";
import { ValComponent } from "@/wab/shared/core/val-nodes";
import { asTpl, asTplOrSlotSelection } from "@/wab/shared/core/vals";
import {
  EffectiveVariantSetting,
  getTplComponentActiveVariants,
} from "@/wab/shared/effective-variant-setting";
import {
  COMMENTS_LOWER,
  INTERACTIVE_CAP,
  REPEATED_CAP,
} from "@/wab/shared/Labels";
import {
  ArenaFrame,
  Component,
  isKnownArenaFrame,
  isKnownNodeMarker,
  isKnownRawText,
  isKnownRenderExpr,
  isKnownTplComponent,
  isKnownTplNode,
  TplComponent,
  TplNode,
  TplSlot,
  TplTag,
} from "@/wab/shared/model/classes";
import { getPlumeEditorPlugin } from "@/wab/shared/plume/plume-registry";
import { ReadonlyIRuleSetHelpersX } from "@/wab/shared/RuleSetHelpers";
import {
  getSlotParams,
  getTplSlotForParam,
  isTplPlainText,
} from "@/wab/shared/SlotUtils";
import { $$$ } from "@/wab/shared/TplQuery";
import {
  isVisibilityHidden,
  TplVisibility,
} from "@/wab/shared/visibility-utils";
import * as Immutable from "immutable";
import debounce from "lodash/debounce";
import {
  createOutlineStateStore,
  patchOutlineState,
  type OutlineStateStore,
} from "@/wab/client/components/sidebar-tabs/outline-state";
import type { Opaque } from "type-fest";

export type OutlineNodeKey = Opaque<string, "OutlineNodeKey">;

export interface OutlineNodeData {
  key: OutlineNodeKey;
  item: TplNode | SlotSelection;
  indent: number;
  visibility: TplVisibility;
  isHidden: boolean;
  ancestorHidden: boolean;
  componentFrameNum: number;
  ownerTplComponent: TplComponent;
  isLeaf: boolean;
  ancestorLocked: boolean;
  parentKey: OutlineNodeKey | undefined;
}

export interface OutlineNode {
  self: OutlineNodeData;
  children: OutlineNode[];
}

export class OutlineCtx {
  private frameOutlines = new Map<ArenaFrame, OutlineCtx>();
  readonly stateStore: OutlineStateStore;

  private get expandedFrames(): ReadonlyMap<ArenaFrame, boolean> {
    return this.stateStore.getState().expandedFrames;
  }
  private get visible(): ReadonlySet<string> {
    return this.stateStore.getState().visible;
  }
  private get expanded(): ReadonlyMap<OutlineNodeKey, boolean> {
    return this.stateStore.getState().expanded;
  }
  private get lastViewedArtboard() {
    return {
      get: () => this.stateStore.getState().lastViewedArtboard,
      set: (value: { arena: AnyArena; frame: ArenaFrame } | undefined) =>
        patchOutlineState(this.stateStore, { lastViewedArtboard: value }),
    };
  }

  viewCtx = () => {
    const arena = this.studioCtx.currentArena;
    const frames = getArenaFrames(arena);
    if (this.artboardFrame) {
      return frames.includes(this.artboardFrame)
        ? this.studioCtx.tryGetViewCtxForFrame(this.artboardFrame)
        : undefined;
    }
    const focused = this.studioCtx.focusedViewCtx();
    if (focused && frames.includes(focused.arenaFrame())) {
      return focused;
    }
    const lastViewed = this.lastViewedArtboard.get();
    if (lastViewed?.arena === arena && frames.includes(lastViewed.frame)) {
      const retained = this.studioCtx.tryGetViewCtxForFrame(lastViewed.frame);
      if (retained) {
        return retained;
      }
    }
    const initial = this.studioCtx.focusedOrFirstViewCtx();
    return initial && frames.includes(initial.arenaFrame())
      ? initial
      : undefined;
  };
  // No longer memoized: the tree depends on outline expansion/visibility state,
  // which is not part of the arguments. Callers re-render when the store version
  // changes, and rebuilding is O(nodes).
  private rootTreeForView = (
    view: ViewCtx,
    _context: ReturnType<ViewCtx["selectionStore"]["getState"]>["context"],
    _frames: ReturnType<ViewCtx["variantStore"]["getState"]>["frames"],
    _global: ReturnType<ViewCtx["variantStore"]["getState"]>["global"],
    _showDefaultSlots: boolean,
  ) => makeFrameRootNode(view, this);
  rootTreeNode = () => {
    const view = this.viewCtx();
    if (!view) { return null; }
    const variants = view.variantStore.getState();
    return this.rootTreeForView(view, view.selectionStore.getState().context, variants.frames, variants.global, variants.showDefaultSlots);
  };
  rootNodeKey = () => {
    const view = this.viewCtx();
    return view ? makeNodeKey(view.component.tplTree) : null;
  };
  focusedNodeKeyPath = () => {
    const vc = this.studioCtx.focusedViewCtx();
    if (!vc || vc !== this.viewCtx()) {
      return [];
    }

    const focusedSelectable = vc.focusedSelectable();
    const focusedTplOrSlotSelection = focusedSelectable
      ? asTplOrSlotSelection(focusedSelectable)
      : vc.focusedTpl();

    return getNodeKeyPath(vc, focusedTplOrSlotSelection);
  };

  hoveredNodeKeyPath = () => {
    const vc = this.viewCtx();
    if (!vc) {
      return [];
    }

    const hoveredSelectable = vc.hoveredSelectable();
    if (!hoveredSelectable) {
      return [];
    }

    const tplOrSlotSelection = asTplOrSlotSelection(hoveredSelectable);
    if (!isTplAttachedToSite(this.studioCtx.site, asTpl(tplOrSlotSelection))) {
      // It is possible that whatever we had been hovering on has been detached
      // from the tree, but we haven't updated vc.hoveredSelectable() yet because
      // we're not done evaluating.
      return [];
    }

    return getNodeKeyPath(vc, tplOrSlotSelection);
  };

  private disposals: (() => void)[] = [];

  constructor(
    private studioCtx: StudioCtx,
    query: string,
    private artboardFrame?: ArenaFrame,
  ) {
    this.stateStore = createOutlineStateStore(new Matcher(query));
    patchOutlineState(this.stateStore, { query });
    this.fillVisibleSet();

    this.disposals.push(
      studioCtx.commentsCtx.store.subscribe((state, previous) => {
        if (
          state.commentedSubjectIds !== previous.commentedSubjectIds &&
          this.hasQuery()
        ) {
          this.updateVisible();
        }
      }),
      subscribeStudioArena(studioCtx, (state) => state.frames, (frames) => {
        const current = new Set(frames.map((ref) => studioCtx.modelSnapshots.resolve(ref)));
        const departed = [...this.frameOutlines].filter(([frame]) => !current.has(frame));
        if (!departed.length) { return; }
        const expandedFrames = new Map(this.expandedFrames);
        for (const [frame] of departed) {
          this.frameOutlines.delete(frame);
          expandedFrames.delete(frame);
        }
        // Subscribers may synchronously read their previous arena. Publish only
        // after the entire old roster is detached, never while iterating it.
        try { patchOutlineState(this.stateStore, { expandedFrames }); }
        finally { departed.forEach(([, outline]) => outline.dispose()); }
      }),
      subscribeStudioSelection(studioCtx, (state) => state.view, () => this.syncSelection()),
      subscribeFocusedViewSelection(studioCtx, (state) => state.targets[0] ?? state.tpls[0] ?? null, () => this.syncSelection()),
      subscribeFocusedViewSelection(studioCtx, (state) => state.context, () => this.syncSelection()),
      subscribeStudioArena(studioCtx, (state) => state.current, () => this.syncSelection()),
      studioCtx.subscribeModelChanges(() => this.syncSelection()),
    );
    this.lastFocusedKey = this.focusedNodeKeyPath()[0];
    this.syncSelection();
  }

  private lastFocusedKey: OutlineNodeKey | undefined;
  private lastFocusedPath: readonly OutlineNodeKey[] = [];
  private syncSelection() {
    const arena = this.studioCtx.currentArena;
      const view = this.studioCtx.focusedViewCtx();
      if (arena && view && getArenaFrames(arena).includes(view.arenaFrame())) {
        const previous = this.lastViewedArtboard.get();
        if (previous?.arena !== arena || previous.frame !== view.arenaFrame()) {
          this.lastViewedArtboard.set({ arena, frame: view.arenaFrame() });
        }
      }
      const path = this.focusedNodeKeyPath();
      if (!arrayEq(path, this.lastFocusedPath) && path.length) {
        const frame = view?.arenaFrame();
        if (frame) { this.setExpandedFrames(frame, true); }
        for (const key of path) { this.setExpanded(key, true); }
      }
      this.lastFocusedPath = path;
      const focusedKey = path[0];
      const focusChanged = focusedKey !== this.lastFocusedKey;
      this.lastFocusedKey = focusedKey;
      if (focusChanged && this.hasQuery() && focusedKey && !this.isVisible(focusedKey)) { this.clearQuery(); }
  }

  dispose() {
    this.updateVisible.cancel();
    this.disposals.forEach((d) => d());
    this.frameOutlines.forEach((outline) => outline.dispose());
    this.frameOutlines.clear();
  }

  getFrameOutline(frame: ArenaFrame) {
    let outline = this.frameOutlines.get(frame);
    if (!outline) {
      outline = new OutlineCtx(this.studioCtx, "", frame);
      this.frameOutlines.set(frame, outline);
    }
    return outline;
  }

  isFrameExpanded(frame: ArenaFrame, defaultExpanded = false) {
    return this.expandedFrames.get(frame) ?? defaultExpanded;
  }

  setFrameExpanded(frame: ArenaFrame, expanded: boolean) {
    this.setExpandedFrames(frame, expanded);
  }

  isVisible(key: OutlineNodeKey) {
    if (!this.hasQuery()) {
      return true;
    }
    return this.visible.has(key);
  }

  /**
   * Open/close state behavior:
   * - Expansion is local to this outline; mixed-arena artboards each have their own outline.
   * - Elements default to closed.
   * - Elements can be manually opened or closed from the outline.
   * - If there's a search query, open all elements.
   * - If an element is hovered, open all its ancestors (except itself), until unhovered.
   * - If an element is focused, open all its ancestors and itself, until manually closed.
   */
  isExpanded(key: OutlineNodeKey) {
    if (this.hasQuery()) {
      return true;
    }

    if (key === this.rootNodeKey()) {
      return true;
    }

    // Search from index 1 to only open hovered element's ancestors and NOT itself.
    const isAncestorOfHovered = this.hoveredNodeKeyPath().indexOf(key, 1) >= 1;
    if (isAncestorOfHovered) {
      return true;
    }

    return this.expanded.get(key) ?? false;
  }

  setExpanded(key: OutlineNodeKey, value: boolean) {
    this.setExpandedValue(key, value);
  }

  expandAll() {
    const tree = this.rootTreeNode();
      if (tree) {
        this.expandTree(tree);
      }
  }

  private expandTree(tree: OutlineNode) {
    this.setExpanded(tree.self.key, true);
    tree.children.forEach((subtree) => this.expandTree(subtree));
  }

  collapseAll() {
    patchOutlineState(this.stateStore, { expanded: new Map(), expandedFrames: new Map() });
    this.frameOutlines.forEach((outline) => outline.collapseAll());
  }

  private setExpandedFrames(frame: ArenaFrame, value: boolean | undefined) {
    const next = new Map(this.expandedFrames);
    if (value === undefined) {
      next.delete(frame);
    } else {
      next.set(frame, value);
    }
    patchOutlineState(this.stateStore, { expandedFrames: next });
  }

  private setExpandedValue(key: OutlineNodeKey, value: boolean) {
    const next = new Map(this.expanded);
    next.set(key, value);
    patchOutlineState(this.stateStore, { expanded: next });
  }

  get query() {
    return this.stateStore.getState().query;
  }

  get matcher() {
    return this.stateStore.getState().matcher;
  }

  setQuery(query: string) {
    patchOutlineState(this.stateStore, { query });
    this.updateVisible();
  }

  clearQuery() {
    this.setQuery("");
  }

  private updateVisible = debounce(() => {
    patchOutlineState(this.stateStore, { matcher: new Matcher(this.query) });
      this.fillVisibleSet();
  }, 300);

  hasQuery() {
    return this.query.trim() !== "";
  }

  refreshVariantSearch() {
    if (this.hasQuery()) { this.fillVisibleSet(); }
  }

  private fillVisibleSet() {
    const visible = new Set<string>();
    if (!this.hasQuery()) {
      patchOutlineState(this.stateStore, { visible });
      return;
    }
    const matcher = this.matcher;

    for (const viewCtx of this.studioCtx.viewCtxs) {
      // This lets us walk up the Tpl ancestor path, but making jumps across
      // component boundaries per the current val component tree.
      // TODO This breaks if there are recursive instances of a component.
      const tplRootToParentTplComponent = new Map(
        viewCtx.currentComponentCtx() != null
          ? viewCtx
              .ancestorComponents(
                ensure(
                  viewCtx.currentComponentCtx(),
                  "ComponentCtx must exist",
                ).valComponent(),
              )
              .map(
                (valComponent) =>
                  tuple(
                    valComponent.tpl.component.tplTree,
                    valComponent.tpl,
                  ) as [TplNode, TplComponent],
              )
          : [],
      );

      // TODO note this is somewhat wasteful for pages since tplSysRoot and
      // tplUserRoot both lead next code block to process top-level tpl tree.
      const tplRoots = tuple(viewCtx.tplSysRoot(), viewCtx.tplUserRoot());
      // This is to help us track which slot any particular child belongs to.
      const tplToSlotArg = new Map();
      // We always want to show nodes that match the typeahead, but also all their
      // ancestors.  The former we call "anchors."
      const visibleAnchors = Immutable.Set(
        (function* () {
          for (const _tplRoot of [
            ...[
              ...new Set([
                ...[...tplRoots],
                ...Array.from(Array.from(tplRootToParentTplComponent.keys())),
              ]),
            ],
          ]) {
            const tpls = Tpls.flattenTpls(_tplRoot);
            // This part is to build tplToSlotArg, not visibleAnchors.
            for (const tpl of tpls) {
              if (isKnownTplComponent(tpl)) {
                const args = viewCtx
                  .variantTplMgr()
                  .effectiveVariantSetting(tpl).args;
                for (const arg of args) {
                  if (isKnownRenderExpr(arg.expr)) {
                    for (const child of [...arg.expr.tpl]) {
                      tplToSlotArg.set(child, { tpl, arg });
                    }
                  }
                }
              }
            }
            // This part is for visibleAnchors.
            for (const tpl of [...tpls]) {
              const vs = isTplTagOrComponent(tpl)
                ? viewCtx.variantTplMgr().effectiveVariantSetting(tpl)
                : undefined;
              if (
                Array.from(getSearchableTexts(tpl, viewCtx, vs)).some((t) =>
                  matcher.matches(t),
                )
              ) {
                yield tpl;
              }
              if (isKnownTplComponent(tpl)) {
                for (const param of [...getSlotParams(tpl.component)]) {
                  if (matcher.matches(summarizeSlotParam(param))) {
                    yield new SlotSelection({
                      tpl,
                      slotParam: param,
                    });
                  }
                }
              }
            }
          }
        })(),
      );

      for (const anchor_ of [...[...(visibleAnchors as any)]]) {
        let anchor: TplComponent;
        if (anchor_ instanceof SlotSelection) {
          visible.add(makeNodeKey(anchor_));
          anchor = ensure(anchor_.tpl, "SlotSelection.tpl must exist");
        } else {
          anchor = anchor_;
        }
        while (true) {
          let ancestor: TplNode | undefined = undefined;
          // This can be short-circuited whenever we encounter an ancestor we've
          // previously visited, rather than visiting all ancestors.
          for (ancestor of [...Tpls.ancestors(anchor).reverse()]) {
            visible.add(makeNodeKey(ancestor));
            // Most of the time, children of a component are specifically arguments
            // passed to the "children" slot, but if there are other slots, we want
            // to make those visible in the outline as well.
            const slotArg = tplToSlotArg.get(ancestor);
            if (slotArg != null) {
              let arg;
              ({ tpl: anchor, arg } = slotArg);
              visible.add(
                makeNodeKey(
                  new SlotSelection({
                    tpl: anchor,
                    slotParam: arg.param,
                  }),
                ),
              );
            }
          }
          // If we are drilled into some component, make the jump up to the outer
          // component context.
          const nextAnchor = tplRootToParentTplComponent.get(
            ensure(ancestor, "ancestor must exist here"),
          );
          if (!nextAnchor) {
            break;
          }
          anchor = nextAnchor;
        }
      }
    }
    patchOutlineState(this.stateStore, { visible });
  }
}

function* getSearchableTexts(
  tpl: TplNode,
  viewCtx: ViewCtx,
  vs?: EffectiveVariantSetting,
) {
  const commentsCtx = viewCtx.studioCtx.commentsCtx;
  if (Tpls.isTplRepeated(tpl)) {
    yield REPEATED_CAP;
  }

  if (Tpls.hasEventHandlers(tpl)) {
    yield INTERACTIVE_CAP;
  }

  if (commentsCtx && isElementWithComments(commentsCtx, tpl)) {
    yield COMMENTS_LOWER;
  }

  if (Tpls.isTplNamable(tpl) && tpl.name) {
    yield tpl.name;
  }
  if (Tpls.isTplTextBlock(tpl)) {
    const content = Tpls.getTplTextBlockContent(tpl, viewCtx);
    if (content) {
      yield content;
    } else {
      yield getNodeSummary(tpl, vs?.rsh());
    }
  } else {
    yield getNodeSummary(tpl, vs?.rsh());
  }
}

export function getNodeSummary(node: TplNode, rsh?: ReadonlyIRuleSetHelpersX) {
  if (isTplImage(node)) {
    const asset = getOnlyAssetRef(node);
    if (asset) {
      return asset.name;
    }
  }
  return Tpls.summarizeTpl(node, rsh);
}

export function makeNodeKey(
  tpl: TplNode | SlotSelection | ArenaFrame,
): OutlineNodeKey {
  if (isKnownArenaFrame(tpl)) {
    return toOpaque(`${tpl.uid}`);
  } else if (tpl instanceof SlotSelection) {
    return toOpaque(
      `${
        ensure(tpl.toTplSlotSelection().tpl, "SlotSelection.tpl must exist").uid
      }-${tpl.slotParam.uid}`,
    );
  } else {
    return toOpaque(`${tpl.uid}`);
  }
}

function getNodeKeyPath(
  vc: ViewCtx,
  tplOrSelection: TplNode | SlotSelection | null,
): OutlineNodeKey[] {
  const frame = vc.arenaFrame();

  if (!tplOrSelection) {
    return [makeNodeKey(frame)];
  }
  const isHiddenRoot =
    tplOrSelection === vc.component.tplTree &&
    vc.arenaFrame().viewMode === FrameViewMode.Stretch;

  if (isHiddenRoot) {
    return [makeNodeKey(frame)];
  }

  const ancestors = $$$(tplOrSelection).ancestorsWithSlotSelections().toArray();

  const curCtxAncestors = vc
    .componentStackFrames()
    .slice(1)
    .flatMap((f) =>
      $$$(f.tplComponent).ancestorsWithSlotSelections().toArray(),
    );

  return [...ancestors, ...curCtxAncestors, frame].map(makeNodeKey);
}

function makeFrameRootNode(viewCtx: ViewCtx, outlineCtx: OutlineCtx) {
  const frame = viewCtx.arenaFrame();
  const key = makeNodeKey(frame);
  const root = viewCtx.tplUserRoot();
  const ownerTplComponent = viewCtx.tplSysRoot();
  return makeNode(
    /*node*/ root,
    viewCtx,
    outlineCtx,
    /*indent*/ 0,
    /*ancestorHidden*/ false,
    /*ancestorLocked*/ false,
    ownerTplComponent,
    /*componentFrameNum*/ 0,
    /*parentKey*/ key,
  );
}

function makeNode(
  node: TplNode | SlotSelection,
  viewCtx: ViewCtx,
  outlineCtx: OutlineCtx,
  indent: number,
  ancestorHidden: boolean,
  ancestorLocked: boolean,
  ownerTplComponent: TplComponent,
  componentFrameNum: number,
  parentKey: OutlineNodeKey | undefined,
): OutlineNode | undefined {
  const effectiveVs = isTplTagOrComponent(node)
    ? viewCtx.variantTplMgr().effectiveVariantSetting(node)
    : undefined;
  const visibility = getTreeNodeVisibility(viewCtx, node);
  const isHidden = isVisibilityHidden(
    visibility,
    effectiveVs?.dataCond,
    () => isKnownTplNode(node) ? viewCtx.getCanvasEnvForTpl(node) : undefined,
    { projectFlags: viewCtx.projectFlags(), component: ownerTplComponent.component, inStudio: true },
  );

  const { children, childrenFrameNum } = getTreeNodeChildren(
    viewCtx,
    node,
    componentFrameNum,
    ownerTplComponent,
  );

  const self: OutlineNodeData = {
    key: makeNodeKey(node),
    item: node,
    indent,
    visibility,
    isHidden,
    ancestorHidden,
    ownerTplComponent,
    componentFrameNum,
    isLeaf: children.length === 0,
    ancestorLocked,
    parentKey,
  };

  // When we encounter a descendant TplSlot, we may show either the arg for that slot,
  // or the default contents for that slot.  "Usually" we would show the default contents,
  // but when we are in spotlight mode, and not showingDefaultSlotContents, we would want
  // to show the arg content corresponding to that slot for the TplComponent.  This
  // ownerTplComponent is the TplComponent where we can look for the arg.  It starts
  // out as tplSysRoot(), and as we descend and encouter the TplComponent that we are
  // drilled into, we switch to that as the ownerTplComponent.
  const childrenOwnerTplComponent =
    isKnownTplComponent(node) &&
    viewCtx.componentStackFrames().find((sf) => sf.tplComponent === node)
      ? node
      : ownerTplComponent;

  const childrenNodes = withoutNils(
    children.map((child) => {
      const _ancestorLocked =
        isKnownTplNode(node) && node.locked === false
          ? false
          : isKnownTplNode(node) && node.locked === true
            ? true
            : ancestorLocked;

      return makeNode(
        /*node*/ child,
        viewCtx,
        outlineCtx,
        /*indent*/ indent + 1,
        /*ancestorHidden*/ isHidden || ancestorHidden,
        _ancestorLocked,
        /*ownerTplComponent*/ childrenOwnerTplComponent,
        /*componentFrameNum*/ childrenFrameNum,
        /*parentKey*/ self.key,
      );
    }),
  );

  return {
    self,
    children: childrenNodes,
  };
}

export function getTreeNodeVisibility(
  viewCtx: ViewCtx,
  node: TplNode | SlotSelection,
) {
  if (node instanceof SlotSelection) {
    const tplComponent = node.getTpl();
    const component = tplComponent.component;
    const tplSlot = getTplSlotForParam(component, node.slotParam);
    if (!tplSlot) {
      return TplVisibility.Visible;
    }
    return isTplSlotVisible(
      component,
      tplSlot,
      getTplComponentActiveVariants(
        tplComponent,
        viewCtx.variantTplMgr().getEffectiveVariantComboForNode(tplComponent),
      ),
    );
  } else if (Tpls.isTplVariantable(node)) {
    return viewCtx.getViewOps().getEffectiveTplVisibility(node);
  } else {
    return TplVisibility.Visible;
  }
}

/**
 * Returns children tree nodes and the children ComponentFrame to use.
 */
function getTreeNodeChildren(
    viewCtx: ViewCtx,
    item: TplNode | SlotSelection,
    componentFrameNum: number,
    ownerTplComponent: TplComponent,
  ): { children: (TplNode | SlotSelection)[]; childrenFrameNum: number } {
    return switchType(item)
      .when(TplTag, (tpl) => {
        const childrenFrameNum = componentFrameNum;
        if (!Tpls.isTplTextBlock(tpl)) {
          return {
            children: $$$(tpl).children().toArrayOfTplNodes(),
            childrenFrameNum,
          };
        }

        const vs = viewCtx.effectiveCurrentVariantSetting(tpl);
        if (!isKnownRawText(vs.text)) {
          return { children: [], childrenFrameNum };
        }

        const visibleChildren = filterMapTruthy(
          vs.text.markers,
          (m) => isKnownNodeMarker(m) && m.tpl,
        );
        return { children: visibleChildren, childrenFrameNum };
      })
      .when(TplComponent, (tpl) => {
        const isAncestorComponentOfFocus = viewCtx
          .componentStackFrames()
          .map((f) => f.tplComponent)
          .includes(tpl);
        if (isAncestorComponentOfFocus) {
          // We are currently in spotlight mode, so the tplComponents on the spotlight
          // stack should all be rendering the innards of the Component, and not the
          // Slot args
          return {
            children: [tpl.component.tplTree],
            childrenFrameNum: componentFrameNum + 1,
          };
        }
        // Otherwise, we render the slots and their args as children of TplComponent
        let slotParams = getCachedSlotParams(tpl.component);
        const plumePlugin = getPlumeEditorPlugin(tpl.component);
        if (plumePlugin && plumePlugin.shouldShowInstanceProp) {
          slotParams = slotParams.filter((p) =>
            plumePlugin.shouldShowInstanceProp!(tpl, p),
          );
        }
        const meta = viewCtx.studioCtx.getCodeComponentMeta(tpl.component);
        if (isCodeComponent(tpl.component) && meta) {
          const valComps = viewCtx.maybeTpl2ValsInContext(tpl);
          if (valComps && valComps.length > 0) {
            const valComp = valComps[0] as ValComponent;
            const valCompProps = valComp.codeComponentProps;
            const ccContextData = viewCtx.getContextData(valComp);
            slotParams = slotParams.filter((p) => {
              const propType = meta.props[p.variable.name];
              if (
                isPlainObjectPropType(propType) &&
                propType.type === "slot" &&
                (propType as any).hidden
              ) {
                return !(propType as any).hidden(valCompProps, ccContextData);
              }
              return true;
            });
          } else {
            slotParams = slotParams.filter((p) => {
              const propType = meta.props[p.variable.name];
              return !isPlainObjectPropType(propType) || !propType.hidden;
            });
          }
        }
        return {
          children: slotParams.map(
            (slotParam) => new SlotSelection({ tpl, slotParam }),
          ),
          childrenFrameNum: componentFrameNum,
        };
      })
      .when(SlotSelection, (ss) => {
        return {
          children: eagerCoalesce(
            maybe(
              $$$(
                ensure(
                  ss.toTplSlotSelection().tpl,
                  "SlotSelection is expected to have a tpl",
                ),
              ).getSlotArg(ss.slotParam.variable.name),
              (arg) => (isKnownRenderExpr(arg.expr) ? arg.expr.tpl : []),
            ),
            [],
          ),
          childrenFrameNum: componentFrameNum,
        };
      })
      .when(TplSlot, (slot) => {
        // We show the slot args passed in from outside the component this
        // slot is part of.
        //
        // Note that this is limited to just showing a RenderExpr that is
        // directly passed in.
        //
        // If the slot were passed an arg via a CustomCode (not a RenderExpr)
        // that is forwarding slot args passed into an outer component, we
        // aren't currently able to show that (even if it ultimately
        // originated from a RenderExpr).  We probably need more source
        // infrastructure---all a slot is given is some CustomCode expr
        // passing in ValNodes---you'd need to look at the ValNode tpl
        // pointers and locate those, but that would only work if there are
        // any ValNodes (TplNodes could have conditionally rendered into
        // nothing).
        //
        // We could alternatively render defaultContents when we're ready to
        // tackle that.
        //
        // To determine the RenderExpr, we need val info.  Consider:
        //
        // A =
        //   <Framer>
        //     <B>
        //
        // B =
        //   <Framer>
        //     <C>
        //
        // Framer =
        //   <div>     <-- say this is the current tpl
        //     <slot>  <-- what should children be? depends which Framer inst!
        //
        // Framer could be called from anywhere, so we need to rely on val
        // info to know which call and what args were passed in.
        //
        // However, recursion so far only is tracking tpl, not val.
        //
        // We need to pass down the val info as well, or we could just pass
        // down the owner (somewhat replicating componentAncestors()).
        const arg = viewCtx
          .variantTplMgr()
          .getEffectiveArgForParam(ownerTplComponent, slot.param);

        const shouldShowDefaultSlotContents =
          viewCtx.showingDefaultSlotContentsFor(ownerTplComponent);

        const slotContents = shouldShowDefaultSlotContents
          ? slot.defaultContents
          : arg && isKnownRenderExpr(arg.expr)
            ? arg.expr.tpl
            : [];

        return {
          children:
            slotContents.length === 1 &&
            isTplPlainText(slotContents[0]) &&
            !isCodeComponent(ownerTplComponent.component)
              ? []
              : slotContents,
          childrenFrameNum: shouldShowDefaultSlotContents
            ? componentFrameNum
            : componentFrameNum - 1,
        };
      })
      .result();
}

export const _testOnlyUtils = { getTreeNodeChildren };

function getCachedSlotParams(component: Component) {
  // No MobX cache: `getSlotParams` is a cheap read and the outline re-renders
  // when the component revision changes.
  return getSlotParams(component);
}
