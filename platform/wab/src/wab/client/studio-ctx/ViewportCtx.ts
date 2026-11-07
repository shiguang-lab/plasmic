import { AnyArena, getArenaFrames } from "@/wab/shared/Arenas";
import { restrictBetweenInclusive } from "@/wab/shared/common";
import type { ModelChange } from "@/wab/shared/core/observable-model";
import { Box, Pt, Transformable } from "@/wab/shared/geom";
import debounce from "lodash/debounce";
import { shallow } from "zustand/shallow";
import { createStore, type StoreApi } from "zustand/vanilla";

const MIN_SCALE = 0.02;
const MAX_SCALE = 256;

export interface DomActions {
  updateCanvasPadding: (padding: Pt) => void;
  updateArenaSize: (arenaSize: Pt) => void;
  scaleTo: (scale: number, smooth: boolean) => void;
  scrollTo: (scroll: Pt, smooth: boolean) => void;
  scrollBy: (scroll: Pt, smooth: boolean) => void;
}

interface Transform {
  arenaSize: Pt;
  canvasPadding: Pt;
  scale: number;
  scroll: Pt;
  smooth: boolean;
}

export interface ViewportSnapshot {
  readonly scale: number;
  readonly scroll: Pt;
  readonly clipperBox: Box;
  readonly arenaScalerSize: Pt;
  readonly arenaSize: Pt;
  readonly canvasPadding: Pt;
  readonly visibleScalerBox: Box;
  readonly isTransforming: boolean;
  readonly hasFrames: boolean;
  readonly extraPadding: Pt;
}

function shareGeometry<T extends { equals(other: T): boolean }>(
  before: T,
  next: T,
): T {
  if (before.equals(next)) {
    return before;
  }
  Object.freeze(next);
  return next;
}

function freezeGeometry<T extends Pt | Box>(value: T): T {
  Object.freeze(value);
  return value;
}

/** Canvas geometry is published once per command, independently of model writes. */
export class ViewportCtx {
  private readonly dom: DomActions;
  private readonly arenaPaddingToClipperRatio: number;
  private currentArena: AnyArena | null;
  private disposed = false;
  private lastTransform: Transform | undefined;
  private pendingTransform: Transform | undefined;
  private readonly state: StoreApi<ViewportSnapshot>;
  private snapshot: ViewportSnapshot;
  private publicationDepth = 0;
  private arenaLifetime = {};
  readonly store: Pick<
    StoreApi<ViewportSnapshot>,
    "getState" | "getInitialState" | "subscribe"
  >;
  private readonly stopDom: () => void;

  constructor(opts: {
    dom: DomActions;
    initialArena: AnyArena | null;
    initialClipperBox: Box;
    initialClipperScroll: Pt;
    scrollPaddingRatio?: number;
  }) {
    this.dom = opts.dom;
    this.currentArena = opts.initialArena;
    this.arenaPaddingToClipperRatio = opts.scrollPaddingRatio ?? 0.95;
    const initial: ViewportSnapshot = {
      scale: 1,
      scroll: Object.freeze(
        new Pt(opts.initialClipperScroll.x, opts.initialClipperScroll.y),
      ),
      clipperBox: freezeGeometry(Box.fromRect(opts.initialClipperBox.rect())),
      arenaScalerSize: Object.freeze(Pt.zero()),
      arenaSize: Object.freeze(Pt.zero()),
      canvasPadding: Object.freeze(Pt.zero()),
      visibleScalerBox: freezeGeometry(Box.zero()),
      isTransforming: false,
      hasFrames: getArenaFrames(opts.initialArena).length > 0,
      extraPadding: Object.freeze(Pt.zero()),
    };
    Object.freeze(initial);
    this.state = createStore<ViewportSnapshot>(() =>
      this.derive(initial, initial),
    );
    this.snapshot = this.state.getState();
    this.store = {
      getState: () => this.snapshot,
      getInitialState: this.state.getInitialState,
      subscribe: this.state.subscribe,
    };
    this.updateDom(this.snapshot);
    this.stopDom = this.state.subscribe((next, previous) =>
      this.updateDom(next, previous),
    );
  }

  dispose = () => {
    this.disposed = true;
    this.debouncedUnsetIsTransforming.cancel();
    this.stopDom();
  };

  arena = () => this.currentArena;
  setArena = (arena: AnyArena | null) => {
    if (this.disposed) {
      return;
    }
    this.currentArena = arena;
    this.syncArenaFrames();
  };
  /** Replacing the Site must not restore a departed arena from an old savepoint. */
  resetArena() {
    this.arenaLifetime = {}; this.pendingTransform = undefined; this.lastTransform = undefined;
    this.setArena(null);
  }
  /** Called explicitly after model transactions that can change arena membership. */
  syncArenaFrames = (changes?: readonly ModelChange[]) => {
    if (
      changes &&
      !changes.some(
        ({ changeNode, path }) =>
          [
            "children",
            "matrix",
            "customMatrix",
            "_focusedFrame",
            "rows",
            "cols",
            "frame",
          ].includes(changeNode.field) &&
          (changeNode.inst === this.currentArena ||
            path?.some(({ inst }) => inst === this.currentArena)),
      )
    ) {
      return;
    }
    this.commit({ hasFrames: getArenaFrames(this.currentArena).length > 0 });
  };
  scale = () => this.snapshot.scale;
  scroll = () => this.snapshot.scroll;
  clipperBox = () => this.snapshot.clipperBox;
  arenaScalerSize = () => this.snapshot.arenaScalerSize;
  arenaSize = () => this.snapshot.arenaSize;
  canvasPadding = () => this.snapshot.canvasPadding;
  visibleScalerBox = () => this.snapshot.visibleScalerBox;
  isTransforming = () => this.snapshot.isTransforming;

  /** Scroll events acknowledge the DOM position; commands never fake that event. */
  setScroll = (scroll: Pt) => this.commit({ scroll });
  setClipperBox = (clipperBox: Box) => this.commit({ clipperBox });
  setArenaScalerSize = (arenaScalerSize: Pt) =>
    this.commit({ arenaScalerSize });

  private debouncedUnsetIsTransforming = debounce(() => {
    this.commit({ isTransforming: false });
  }, 200);

  private derive(
    previous: ViewportSnapshot,
    input: ViewportSnapshot,
  ): ViewportSnapshot {
    const scroll = shareGeometry(previous.scroll, input.scroll);
    const clipperBox = shareGeometry(previous.clipperBox, input.clipperBox);
    const arenaScalerSize = shareGeometry(
      previous.arenaScalerSize,
      input.arenaScalerSize,
    );
    const extraPadding = shareGeometry(
      previous.extraPadding,
      input.extraPadding,
    );
    const canvasPadding = shareGeometry(
      previous.canvasPadding,
      input.hasFrames
        ? new Pt(
            clipperBox.width() * this.arenaPaddingToClipperRatio,
            clipperBox.height() * this.arenaPaddingToClipperRatio,
          ).plus(extraPadding)
        : Pt.zero(),
    );
    const topLeft = scroll.sub(canvasPadding);
    const next: ViewportSnapshot = {
      ...input,
      scroll,
      clipperBox,
      arenaScalerSize,
      extraPadding,
      canvasPadding,
      arenaSize: shareGeometry(
        previous.arenaSize,
        arenaScalerSize.scale(input.scale),
      ),
      visibleScalerBox: shareGeometry(
        previous.visibleScalerBox,
        new Box(
          topLeft.y,
          topLeft.x,
          clipperBox.width(),
          clipperBox.height(),
        ).scale(1 / input.scale),
      ),
    };
    return shallow(previous, next) ? previous : Object.freeze(next);
  }

  private commit(input: Partial<ViewportSnapshot>, transform?: Transform) {
    if (this.disposed) {
      return;
    }
    const previous = this.snapshot;
    const next = this.derive(previous, { ...previous, ...input });
    const old = this.lastTransform;
    if (
      transform &&
      (!old ||
        old.scale !== transform.scale ||
        !old.scroll.equals(transform.scroll) ||
        !old.canvasPadding.equals(transform.canvasPadding) ||
        old.smooth !== transform.smooth)
    ) {
      this.pendingTransform = transform;
      this.lastTransform = transform;
    }
    if (next !== previous) { this.snapshot = next; }
    this.publishCommit();
  }

  deferPublication<Result>(command: () => Result): Result {
    this.publicationDepth++;
    try { return command(); }
    finally { this.publicationDepth--; this.publishCommit(); }
  }

  transaction<Result>(command: () => Result): Result {
    return this.deferPublication(() => {
    const checkpoint = { snapshot: this.snapshot, arena: this.currentArena, lastTransform: this.lastTransform, pendingTransform: this.pendingTransform, lifetime: this.arenaLifetime };
    try { return command(); }
    catch (error) {
      if (!this.disposed && checkpoint.lifetime === this.arenaLifetime) {
        this.snapshot = checkpoint.snapshot; this.currentArena = checkpoint.arena;
        this.lastTransform = checkpoint.lastTransform; this.pendingTransform = checkpoint.pendingTransform;
      }
      throw error;
    }
      });
  }

  publishCommit() {
    if (this.disposed || this.publicationDepth) { return; }
    const previous = this.state.getState();
    if (this.snapshot !== previous) {
      // The DOM listener is registered before external subscribers.
      this.state.setState(this.snapshot, true);
    } else if (this.pendingTransform) { this.updateDom(this.snapshot, previous); }
  }

  private updateDom(next: ViewportSnapshot, previous?: ViewportSnapshot) {
    const transform = this.pendingTransform;
    this.pendingTransform = undefined;
    const paddingChanged =
      !previous || next.canvasPadding !== previous.canvasPadding;
    if (paddingChanged) {
      this.dom.updateCanvasPadding(next.canvasPadding);
    }
    if (transform) {
      this.dom.updateArenaSize(transform.arenaSize);
      this.dom.scaleTo(transform.scale, transform.smooth);
      this.dom.scrollTo(transform.scroll, transform.smooth);
    } else if (paddingChanged || next.arenaSize !== previous?.arenaSize) {
      if (previous && paddingChanged) {
        this.dom.scrollBy(
          next.canvasPadding.sub(previous.canvasPadding),
          false,
        );
      }
      this.dom.updateArenaSize(next.arenaSize);
    }
  }

  private scrollSpaceGrowth(target: Pt, state: ViewportSnapshot): Pt {
    if (!state.hasFrames) {
      return Pt.zero();
    }
    const clipper = state.clipperBox.size();
    const limit = state.arenaSize
      .plus(state.canvasPadding.scale(2))
      .sub(clipper);
    return new Pt(
      target.x < 0
        ? Math.max(clipper.x, -target.x)
        : target.x > limit.x
          ? Math.max(clipper.x, target.x - limit.x)
          : 0,
      target.y < 0
        ? Math.max(clipper.y, -target.y)
        : target.y > limit.y
          ? Math.max(clipper.y, target.y - limit.y)
          : 0,
    );
  }

  private transform(
    scale: number,
    scroll: Pt,
    smooth: boolean,
    paddingGrowth = Pt.zero(),
  ) {
    if (this.disposed) {
      return;
    }
    this.debouncedUnsetIsTransforming();
    const previous = this.snapshot;
    const scaled = this.derive(previous, {
      ...previous,
      scale,
      extraPadding: previous.extraPadding.plus(paddingGrowth),
      isTransforming: true,
    });
    const growth = this.scrollSpaceGrowth(scroll, scaled);
    const next = this.derive(previous, {
      ...scaled,
      extraPadding: scaled.extraPadding.plus(growth),
    });
    this.commit(next, {
      scale,
      scroll: scroll.plus(growth),
      smooth,
      canvasPadding: next.canvasPadding,
      arenaSize: next.arenaSize,
    });
  }

  enqueueTransform = (scale: number, scroll: Pt, smooth: boolean) =>
    this.transform(scale, scroll, smooth);
  scrollBy = (delta: Pt, opts?: { smooth: boolean }) => {
    if (this.disposed) {
      return;
    }
    this.debouncedUnsetIsTransforming();
    const state = this.snapshot;
    const growth = this.scrollSpaceGrowth(state.scroll.plus(delta), state);
    this.commit({
      isTransforming: true,
      extraPadding: state.extraPadding.plus(growth),
    });
    this.dom.scrollBy(delta, opts?.smooth ?? false);
  };
  panTo = (target: Pt) => {
    const state = this.snapshot;
    const growth = this.scrollSpaceGrowth(target, state);
    this.transform(state.scale, target.plus(growth), false, growth);
  };
  scrollTo = (target: Pt, opts?: { smooth: boolean }) =>
    this.transform(this.scale(), target, opts?.smooth ?? false);

  /**
   * Scale the viewport at a fixed point.
   *
   * The fixed point should have the same client and scaler point before and after scaling.
   */
  scaleAtFixedPt = (
    scale: number,
    scalerPt: Pt,
    clientPt: Pt,
    opts?: {
      smooth?: boolean;
    },
  ) => {
    const { smooth = false } = opts ?? {};
    const newScale = restrictBetweenInclusive(scale, MIN_SCALE, MAX_SCALE);
    const newScroll = this.clipperBox()
      .topLeft()
      .plus(this.canvasPadding())
      .sub(clientPt)
      .plus(scalerPt.scale(newScale));
    this.enqueueTransform(newScale, newScroll, smooth);
  };

  /**
   * Scale the viewport at the viewport midpoint.
   */
  scaleAtMidPt = (
    scale: number,
    opts?: {
      minScale?: number;
      maxScale?: number;
      smooth?: boolean;
    },
  ) => {
    const scalerPt = this.visibleScalerBox().midpt();
    const clientPt = this.scalerToClient(scalerPt);
    return this.scaleAtFixedPt(scale, scalerPt, clientPt, opts);
  };

  /**
   * Zooms (scale + scroll) to fit a scaler box in the center of the viewport
   * with the specified padding in client pixels.
   */
  zoomToScalerBox = (
    scalerBox: Box,
    opts?: {
      minScale?: number;
      maxScale?: number;
      minPadding?:
        | number
        | {
            left?: number;
            right?: number;
            top?: number;
            bottom?: number;
          };
      ignoreHeight?: boolean;
      smooth?: boolean;
    },
  ) => {
    const {
      minScale = 0,
      maxScale = Number.POSITIVE_INFINITY,
      minPadding = 0,
      ignoreHeight = false,
      smooth = false,
    } = opts ?? {};
    const minLeftPadding =
      typeof minPadding === "number" ? minPadding : (minPadding.left ?? 0);
    const minRightPadding =
      typeof minPadding === "number" ? minPadding : (minPadding.right ?? 0);
    const minTopPadding =
      typeof minPadding === "number" ? minPadding : (minPadding.top ?? 0);
    const minBottomPadding =
      typeof minPadding === "number" ? minPadding : (minPadding.bottom ?? 0);

    const clipperBox = this.clipperBox();
    const maxClientWidth =
      clipperBox.width() - minLeftPadding - minRightPadding;
    const maxClientHeight =
      clipperBox.height() - minTopPadding - minBottomPadding;
    const newScale = restrictBetweenInclusive(
      restrictBetweenInclusive(
        ignoreHeight
          ? maxClientWidth / scalerBox.width()
          : Math.min(
              maxClientWidth / scalerBox.width(),
              maxClientHeight / scalerBox.height(),
            ),
        minScale,
        maxScale,
      ),
      MIN_SCALE,
      MAX_SCALE,
    );

    const leftPadding =
      minLeftPadding +
      Math.max(0, (maxClientWidth - scalerBox.width() * newScale) / 2);
    const topPadding =
      minTopPadding +
      (ignoreHeight
        ? 0
        : Math.max(0, (maxClientHeight - scalerBox.height() * newScale) / 2));

    const newScroll = this.canvasPadding()
      .plus(scalerBox.topLeft().scale(newScale))
      .moveBy(-leftPadding, -topPadding);

    this.enqueueTransform(newScale, newScroll, smooth);
  };

  /**
   * Converts a scaler pt/box to a client pt/box.
   *
   * A scaler pt is a point in the scaler, without scaling.
   * A client pt is a point in the top most window's viewport.
   */
  scalerToClient<T extends Transformable<T>>(scaler: T): T {
    return scaler
      .scale(this.scale())
      .plus(this.clipperBox().topLeft())
      .plus(this.canvasPadding())
      .sub(this.scroll());
  }

  /**
   * Converts a client pt/box to a scaler pt/box.
   *
   * A client point is a point in the top most window's viewport.
   * A scaler point is a point in the scaler, without scaling.
   */
  clientToScaler<T extends Transformable<T>>(client: T): T {
    return client
      .plus(this.scroll())
      .sub(this.canvasPadding())
      .sub(this.clipperBox().topLeft())
      .scale(1 / this.scale());
  }
}
