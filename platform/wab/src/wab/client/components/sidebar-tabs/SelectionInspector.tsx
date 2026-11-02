import * as React from "react";

/** Preserve the scroll range while committing controls after canvas focus paints. */
export function SelectionInspector({
  pending,
  children,
}: {
  pending: boolean;
  children: React.ReactNode;
}) {
  const content = React.useRef<HTMLDivElement>(null);
  const height = React.useRef(0);
  React.useEffect(() => {
    if (!content.current || pending) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        height.current = entry.contentRect.height;
      }
    });
    observer.observe(content.current);
    return () => observer.disconnect();
  }, [pending]);
  React.useLayoutEffect(() => {
    const root =
      content.current?.closest<HTMLElement>(".style-tab") ?? content.current;
    if (!root) {
      return;
    }
    root.inert = pending;
    return () => {
      root.inert = false;
    };
  }, [pending]);
  return (
    <div
      ref={content}
      aria-busy={pending}
      style={{ overflowAnchor: "none", ...(pending ? { minHeight: height.current, flexShrink: 0 } : {}) }}
    >
      {pending ? null : children}
    </div>
  );
}
