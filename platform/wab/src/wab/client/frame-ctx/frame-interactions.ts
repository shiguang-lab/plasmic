import { ensure } from "@/wab/shared/common";

export type FrameInteraction = Pick<
  MouseEvent,
  | "button"
  | "buttons"
  | "clientX"
  | "clientY"
  | "ctrlKey"
  | "altKey"
  | "shiftKey"
  | "metaKey"
> & {
  type: "pointerdown" | "pointerup" | "click";
  pointerId: number;
  pointerType: string;
};

const forwardedEvents = new WeakSet<Event>();
export function isForwardedFrameInteraction(event: Event) {
  return forwardedEvents.has(event);
}

/** Notify the receiving document's ordinary outside-interaction listeners.
 * Dispatching an event does not perform the browser's default focus transfer.
 * Never blur an active iframe: its text editor or preview input owns focus.
 */
export function dispatchFrameInteraction(
  doc: Document,
  interaction: FrameInteraction,
) {
  const win = ensure(doc.defaultView, "Frame document has no window");
  if (interaction.type === "pointerdown") {
    const active = doc.activeElement;
    if (
      active instanceof win.HTMLElement &&
      active !== doc.body &&
      active.tagName !== "IFRAME"
    ) {
      active.blur();
    }
  }
  const types =
    interaction.type === "pointerdown"
      ? ["pointerdown", "mousedown"]
      : interaction.type === "pointerup"
        ? ["pointerup", "mouseup"]
        : ["click"];
  for (const type of types) {
    const init = { ...interaction, bubbles: true, cancelable: true };
    const event =
      type.startsWith("pointer") && win.PointerEvent
        ? new win.PointerEvent(type, init)
        : new win.MouseEvent(type, init);
    forwardedEvents.add(event);
    doc.body.dispatchEvent(event);
  }
}

/** Capture before canvas selection cancels propagation/default mouse events. */
export function trackFrameInteractions(
  doc: Document | HTMLElement,
  notify: (event: FrameInteraction, source: MouseEvent) => void,
) {
  const win = ensure(
    (doc.nodeType === 9 ? (doc as Document) : doc.ownerDocument)?.defaultView,
    "Frame document has no window",
  );
  const listener = (raw: Event) => {
    if (!(raw instanceof win.MouseEvent)) {
      return;
    }
    const event = raw;
    const pointer = event as PointerEvent;
    notify(
      {
        type: event.type as FrameInteraction["type"],
        button: event.button,
        buttons: event.buttons,
        clientX: event.clientX,
        clientY: event.clientY,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
        metaKey: event.metaKey,
        pointerId: pointer.pointerId ?? 1,
        pointerType: pointer.pointerType ?? "mouse",
      },
      event,
    );
  };
  const types = ["pointerdown", "pointerup", "click"] as const;
  types.forEach((type) => doc.addEventListener(type, listener, true));
  return () =>
    types.forEach((type) => doc.removeEventListener(type, listener, true));
}
