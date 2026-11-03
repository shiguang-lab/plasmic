export type GeometryStyle = Pick<
  CSSStyleDeclaration,
  | "position"
  | "display"
  | "contain"
  | "transform"
  | "perspective"
  | "filter"
  | "backdropFilter"
  | "willChange"
  | "overflowX"
  | "overflowY"
  | "overflow"
  | "visibility"
>;

type ClientMetrics = Pick<
  HTMLElement,
  | "offsetWidth"
  | "offsetHeight"
  | "clientLeft"
  | "clientTop"
  | "clientWidth"
  | "clientHeight"
>;

/** One synchronous, read-only geometry query. Never retain across DOM writes. */
export class GeometrySnapshot {
  private rects = new Map<Element, DOMRect>();
  private styles = new Map<Element, GeometryStyle>();
  private clientMetrics = new Map<HTMLElement, ClientMetrics>();

  getClientMetrics(element: HTMLElement): ClientMetrics {
    let metrics = this.clientMetrics.get(element);
    if (!metrics) {
      metrics = {
        offsetWidth: element.offsetWidth,
        offsetHeight: element.offsetHeight,
        clientLeft: element.clientLeft,
        clientTop: element.clientTop,
        clientWidth: element.clientWidth,
        clientHeight: element.clientHeight,
      };
      this.clientMetrics.set(element, metrics);
    }
    return metrics;
  }

  getRect(element: Element): DOMRect {
    let rect = this.rects.get(element);
    if (!rect) {
      rect = element.getBoundingClientRect();
      this.rects.set(element, rect);
    }
    return rect;
  }

  getStyle(element: Element): GeometryStyle | undefined {
    const cached = this.styles.get(element);
    if (cached) {
      return cached;
    }
    const win = element.ownerDocument.defaultView;
    if (!win) {
      return undefined;
    }
    const live = win.getComputedStyle(element);
    // CSSStyleDeclaration is live and its getters still enter the browser.
    const style: GeometryStyle = {
      position: live.position,
      display: live.display,
      contain: live.contain,
      transform: live.transform,
      perspective: live.perspective,
      filter: live.filter,
      backdropFilter: live.backdropFilter,
      willChange: live.willChange,
      overflowX: live.overflowX,
      overflowY: live.overflowY,
      overflow: live.overflow,
      visibility: live.visibility,
    };
    this.styles.set(element, style);
    return style;
  }
}
