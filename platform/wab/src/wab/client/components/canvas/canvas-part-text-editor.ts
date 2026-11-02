import type { CanvasComponentPart } from "@/wab/client/components/canvas/canvas-component-parts";
import { ensure } from "@/wab/shared/common";

export interface CanvasPartTextEditor {
  input: HTMLInputElement;
  finish: (cancel?: boolean) => void;
}

/** A temporary native input leaves the component's React-owned label intact. */
export function createCanvasPartTextEditor(
  part: Pick<CanvasComponentPart, "element" | "displayName" | "text">,
  value: string,
  onCommit: (value: string) => void,
  onDone: () => void,
  onBoundsChange: (rect: DOMRect) => void,
): CanvasPartTextEditor | undefined {
  const label = part.text && (part.element.querySelector<HTMLElement>(part.text.selector) ?? part.element);
  if (!label || !label.isConnected) {
    return undefined;
  }
  const doc = label.ownerDocument;
  const style = ensure(doc.defaultView, "Canvas document window").getComputedStyle(label);
  const input = doc.createElement("input");
  input.type = "text";
  input.value = value;
  input.setAttribute("aria-label", part.displayName);
  input.setAttribute("data-plasmic-canvas-part-text-editor", "");
  Object.assign(input.style, {
    position: "fixed", zIndex: "2147483647", boxSizing: "border-box",
    margin: "0", padding: "0", border: "0", borderRadius: "0", outline: "none",
    background: "transparent", color: style.color, font: style.font,
    letterSpacing: style.letterSpacing, textAlign: "center", direction: style.direction,
  });
  const visibility = label.style.visibility;
  if (label !== part.element) {
    label.style.visibility = "hidden";
  }
  const originalTexts = label === part.element ? [] : Array.from(label.childNodes)
    .filter((node): node is Text => node.nodeType === Node.TEXT_NODE)
    .map((node) => ({ node, value: node.data }));
  let temporaryText: Text | undefined;
  let finished = false;
  const updateBounds = () => {
    if (finished) {
      return;
    }
    const labelRect = label.getBoundingClientRect();
    const rect = labelRect.width && labelRect.height ? labelRect : part.element.getBoundingClientRect();
    const width = Math.max(rect.width, 20), height = Math.max(rect.height, 20);
    Object.assign(input.style, {
      left: `${rect.left + (rect.width - width) / 2}px`,
      top: `${rect.top + (rect.height - height) / 2}px`,
      width: `${width}px`, height: `${height}px`,
    });
    onBoundsChange(input.getBoundingClientRect());
  };
  const observer = new ResizeObserver(updateBounds);
  const finish = (cancel = false) => {
    if (finished) {
      return;
    }
    finished = true;
    const next = input.value;
    observer.disconnect();
    originalTexts.forEach(({ node, value: original }) => { node.data = original; });
    temporaryText?.remove();
    label.style.visibility = visibility;
    doc.removeEventListener("scroll", onScroll, true);
    doc.defaultView?.removeEventListener("resize", onResize);
    input.remove();
    onDone();
    if (!cancel && next !== value) {
      onCommit(next);
    }
  };
  const onScroll = (event: Event) => { if (event.target !== input) { finish(); } };
  const onResize = () => finish();
  doc.addEventListener("scroll", onScroll, true);
  doc.defaultView?.addEventListener("resize", onResize);
  input.addEventListener("blur", () => finish());
  input.addEventListener("input", () => {
    // Preview in the native label so its real layout constraints size the button.
    // Restore the same text nodes before React receives the committed prop.
    let text = originalTexts[0]?.node;
    if (!text) {
      temporaryText ??= label.appendChild(doc.createTextNode(""));
      text = temporaryText;
    }
    text.data = input.value;
    originalTexts.slice(1).forEach(({ node }) => { node.data = ""; });
    updateBounds();
  });
  input.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.isComposing) {
      return;
    }
    if (event.key === "Escape" || event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      finish(event.key === "Escape");
    }
  });
  doc.body.appendChild(input);
  updateBounds();
  observer.observe(label);
  if (label !== part.element) {
    observer.observe(part.element);
  }
  return { input, finish };
}
