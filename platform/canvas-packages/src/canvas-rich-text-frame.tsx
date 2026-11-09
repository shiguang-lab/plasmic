import * as React from "react";
import ResizeObserver from "resize-observer-polyfill";
import type { CanvasSnapshotStore } from "./canvas-frame";

interface CanvasRichTextHandle {
  enterEdit(): string | undefined;
  exitEdit(): void;
}

export function CanvasRichTextFrame({ policy, canEdit, attributeRef, outerRef, render }: {
  readonly policy: CanvasSnapshotStore<{ readonly devMode: boolean }>;
  readonly canEdit: boolean;
  readonly attributeRef?: React.Ref<HTMLElement>;
  readonly outerRef?: React.Ref<HTMLElement>;
  readonly render: (state: { readonly isEditing: boolean; readonly isTextEditable: boolean; readonly ref: React.RefCallback<HTMLElement>; readonly handle: CanvasRichTextHandle }) => React.ReactNode;
}) {
  const [element, setElement] = React.useState<HTMLElement | null>(null);
  const [isEditing, setEditing] = React.useState(false);
  const subscribe = React.useCallback((listener: () => void) => policy.subscribe(listener), [policy]);
  const currentMode = React.useCallback(() => policy.getState().devMode, [policy]);
  const initialMode = React.useCallback(() => policy.getInitialState().devMode, [policy]);
  const devMode = React.useSyncExternalStore(subscribe, currentMode, initialMode);
  const ref = React.useCallback((node: HTMLElement | null) => {
    setElement(node);
    const refs = [attributeRef, outerRef];
    const cleanups = refs.map((target) => {
      if (typeof target === "function") {
        const cleanup = target(node);
        return typeof cleanup === "function" ? cleanup : () => { target(null); };
      }
      if (target) { target.current = node; }
      return () => { if (target) { target.current = null; } };
    });
    return () => { setElement(null); cleanups.forEach((cleanup) => cleanup()); };
  }, [attributeRef, outerRef]);
  const handle: CanvasRichTextHandle = {
    enterEdit() {
      if (!element) { return "Cannot edit the text on canvas because Plasmic is not ready"; }
      if (getComputedStyle(element).visibility === "hidden") {
        return "Cannot edit the text on canvas because it is hidden. Please edit it on the right side bar.";
      }
      setEditing(true);
      return undefined;
    },
    exitEdit() { setEditing(false); },
  };
  return render({ isEditing, isTextEditable: devMode && canEdit, ref, handle });
}

export function CanvasPlaceholder({ summary, resize }: {
  readonly summary: React.ReactNode;
  readonly resize: (element: HTMLDivElement) => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const element = ref.current;
    const parent = element?.parentElement;
    if (!element || !parent) { return; }
    const update = () => resize(element);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [resize]);
  return <div className="__wab_placeholder" ref={ref}>
    <div className="__wab_placeholder__inner" />
    <div className="__wab_placeholder__tag">{summary}</div>
    <div className="__wab_placeholder_border"><div className="__wab_placeholder_border_inner" /></div>
  </div>;
}
