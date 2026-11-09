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
  const [height, setHeight] = React.useState(0);
  React.useEffect(() => {
    if (!content.current || pending) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setHeight(entry.contentRect.height);
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
    root.toggleAttribute("inert", pending);
    return () => {
      root.removeAttribute("inert");
    };
  }, [pending]);
  return (
    <div
      ref={content}
      aria-busy={pending}
      style={{ overflowAnchor: "none", ...(pending ? { minHeight: height, flexShrink: 0 } : {}) }}
    >
      {pending ? null : children}
    </div>
  );
}
