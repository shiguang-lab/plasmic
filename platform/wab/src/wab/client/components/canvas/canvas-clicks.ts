const clickIntervalMs = 500;
const clickSlopPx = 4;

type ClickEvent = Pick<
  MouseEvent,
  "button" | "screenX" | "screenY" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey"
>;

/** Count completed canvas clicks independently of native dblclick events. */
export class CanvasClickTracker {
  private press?: { event: ClickEvent; context: object; time: number };
  private sequence?: {
    context: object;
    x: number;
    y: number;
    time: number;
    count: number;
  };

  reset() {
    this.press = undefined;
    this.sequence = undefined;
  }

  start(event: ClickEvent, context: object, time = Date.now()) {
    if (
      event.button !== 0 || event.metaKey || event.ctrlKey ||
      event.altKey || event.shiftKey
    ) {
      this.reset();
      return;
    }
    this.press = { event, context, time };
  }

  move(event: Pick<MouseEvent, "screenX" | "screenY">) {
    if (
      this.press && Math.hypot(
        event.screenX - this.press.event.screenX,
        event.screenY - this.press.event.screenY,
      ) >= clickSlopPx
    ) {
      this.reset();
    }
  }

  finish(event: ClickEvent, time = Date.now()) {
    this.move(event);
    const press = this.press;
    this.press = undefined;
    if (
      !press || time - press.time > clickIntervalMs || event.button !== 0 ||
      event.metaKey || event.ctrlKey || event.altKey || event.shiftKey
    ) {
      this.reset();
      return false;
    }
    const previous = this.sequence;
    const continues = previous && previous.context === press.context &&
      time - previous.time <= clickIntervalMs &&
      Math.hypot(press.event.screenX - previous.x, press.event.screenY - previous.y) < clickSlopPx;
    this.sequence = continues
      ? { ...previous, time, count: previous.count + 1 }
      : { context: press.context, x: press.event.screenX, y: press.event.screenY, time, count: 1 };
    return this.sequence.count % 2 === 0;
  }
}
