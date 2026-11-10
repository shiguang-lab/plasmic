import { isComposingKeyEvent } from "@/wab/commons/components/ReactUtil";
import { RefObject, useEffect, useEffectEvent } from "react";

type EscapeLayer = {
  element: () => HTMLElement | null;
  dismiss: (event: KeyboardEvent) => void;
  blocksModelCommands?: boolean;
};
const layers = new WeakMap<Document, EscapeLayer[]>();

export function hasStudioEscapeLayer(doc: Document = document) {
  return !!layers.get(doc)?.length;
}

export function hasStudioCommandBarrier(doc: Document = document) {
  return (
    layers.get(doc)?.some((layer) => layer.blocksModelCommands !== false) ??
    false
  );
}

/** One Escape closes one foreground layer, after native child controls. */
export function registerStudioEscape(doc: Document, layer: EscapeLayer) {
  let stack = layers.get(doc);
  if (!stack) {
    stack = [];
    layers.set(doc, stack);
    doc.addEventListener("keydown", handleEscape);
  }
  stack.push(layer);
  return () => {
    const current = layers.get(doc);
    const index = current?.indexOf(layer) ?? -1;
    if (index >= 0) {
      current?.splice(index, 1);
    }
    if (!current?.length) {
      layers.delete(doc);
      doc.removeEventListener("keydown", handleEscape);
    }
  };
}

function handleEscape(event: KeyboardEvent) {
  dismissStudioEscape(event, event.currentTarget as Document);
}

/** Native modal scopes use this before the event reaches their dialog owner. */
export function dismissStudioEscape(event: KeyboardEvent, doc: Document) {
  if (
    event.type !== "keydown" ||
    event.key !== "Escape" ||
    event.defaultPrevented ||
    isComposingKeyEvent(event)
  ) {
    return false;
  }
  const stack = layers.get(doc) ?? [];
  let top: EscapeLayer | undefined;
  for (const layer of stack) {
    if (
      top &&
      top.blocksModelCommands !== false &&
      layer.blocksModelCommands === false
    ) {
      continue;
    }
    if (
      !top ||
      (top.blocksModelCommands === false &&
        layer.blocksModelCommands !== false) ||
      !layer.element()?.contains(top.element())
    ) {
      top = layer;
    }
  }
  if (top?.dismiss) {
    event.preventDefault();
    event.stopPropagation();
    top.dismiss(event);
    return true;
  }
  return false;
}

export function useStudioEscape(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean,
  dismiss: (event: KeyboardEvent) => void,
  blocksModelCommands = true,
) {
  const onEscape = useEffectEvent((event: KeyboardEvent) => dismiss(event));
  useEffect(() => {
    if (!enabled) {
      return;
    }
    return registerStudioEscape(ref.current?.ownerDocument ?? document, {
      element: () => ref.current,
      dismiss: (event) => onEscape(event),
      blocksModelCommands,
    });
  }, [ref, enabled, blocksModelCommands]);
}
