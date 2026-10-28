import * as React from "react";

/** What antd triggers inject into their child: event handlers and a class. */
export type TriggerChildProps = Omit<
  React.DOMAttributes<HTMLElement>,
  "children" | "dangerouslySetInnerHTML"
> & { className?: string };

/**
 * Merges the props an antd trigger injects with the child's own props. Event
 * handlers set on both are chained (the child's first, as antd does when it
 * clones a ref-capable child) and classes are joined, so neither side loses
 * behavior.
 */
export function chainTriggerProps<P extends Record<string, any>>(
  triggerProps: TriggerChildProps,
  ownProps: P,
): P & TriggerChildProps {
  const merged: Record<string, any> = { ...triggerProps, ...ownProps };
  for (const [key, triggerValue] of Object.entries(triggerProps) as [
    string,
    unknown,
  ][]) {
    const ownValue: unknown = ownProps[key];
    if (ownValue == null) {
      // `onClick={undefined}` on the child must not drop the trigger's handler.
      merged[key] = triggerValue;
    } else if (
      /^on[A-Z]/.test(key) &&
      typeof triggerValue === "function" &&
      typeof ownValue === "function"
    ) {
      merged[key] = (...args: unknown[]) => {
        ownValue(...args);
        triggerValue(...args);
      };
    } else if (key === "className" && triggerValue && ownValue) {
      merged[key] = `${ownValue} ${triggerValue}`;
    }
  }
  return merged as P & TriggerChildProps;
}

/**
 * antd 6 Tooltip/Popover/Dropdown locate their anchor only through the child's
 * ref (there is no findDOMNode fallback). Without a DOM anchor the popup is
 * never aligned and presses on the trigger count as outside clicks.
 *
 * Generated Plasmic components are plain function components that drop refs.
 * Put this between the trigger and such a component, and pass both the ref and
 * the trigger's props to the element that should anchor the popup:
 *
 *   <Tooltip title="…">
 *     <TriggerAnchor>
 *       {(ref, triggerProps) => (
 *         <PlasmicFoo {...chainTriggerProps(triggerProps, ownProps)} root={{ ref }} />
 *       )}
 *     </TriggerAnchor>
 *   </Tooltip>
 */
export const TriggerAnchor = React.forwardRef(function TriggerAnchor(
  {
    children,
    ...triggerProps
  }: TriggerChildProps & {
    children: (
      ref: React.Ref<any>,
      triggerProps: TriggerChildProps,
    ) => React.ReactElement;
  },
  ref: React.Ref<any>,
) {
  return children(ref, triggerProps);
});

function setRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") {
    ref(value);
  } else if (ref) {
    (ref as React.MutableRefObject<T | null>).current = value;
  }
}

function isDomElement(value: unknown): value is Element {
  return (
    !!value &&
    typeof value === "object" &&
    (value as Node).nodeType === Node.ELEMENT_NODE
  );
}

/** The DOM element a ref value stands for, if any (antd refs expose it). */
function refValueToDom(value: unknown): Element | undefined {
  if (isDomElement(value)) {
    return value;
  }
  const native = (value as { nativeElement?: unknown } | null)?.nativeElement;
  return isDomElement(native) ? native : undefined;
}

const FORWARD_REF = Symbol.for("react.forward_ref");
const MEMO = Symbol.for("react.memo");

/** Whether a ref on an element of this type may reach a DOM node. */
function mayForwardRef(type: unknown): boolean {
  if (typeof type === "string") {
    return true;
  }
  const typed = type as { $$typeof?: symbol; type?: unknown } | null;
  if (typed?.$$typeof === FORWARD_REF) {
    return true;
  }
  if (typed?.$$typeof === MEMO) {
    return mayForwardRef(typed.type);
  }
  // Plain function components drop refs; class components hand out their
  // instance, which is not a DOM node.
  return false;
}

/**
 * Lets an antd trigger anchor on any child, including components that don't
 * forward refs and children only known at runtime (`{children}`, `{x}`).
 *
 * The child is rendered unchanged, with the trigger's handlers chained onto
 * its props. Host elements and ref-forwarding components get the trigger's
 * ref directly. For anything else (or a forwarded ref that turns out not to
 * be a DOM node) a `<template>` marker rendered right after the child (valid
 * in any parent, never displayed) locates the child's root DOM element, which
 * is handed to the trigger. Text and fragments are wrapped in a `<span>`, as
 * antd does for non-element children.
 */
export const TriggerTarget = React.forwardRef(function TriggerTarget(
  {
    children,
    ...triggerProps
  }: TriggerChildProps & { children?: React.ReactNode },
  ref: React.Ref<Element>,
) {
  const isElement =
    React.isValidElement(children) && children.type !== React.Fragment;
  // Derived on every render so a child whose type changes (e.g. from a host
  // element to a plain function component) still gets an anchor. A forwarded
  // ref that turns out not to be a DOM node switches to the marker for good.
  const [refIsNotDom, setRefIsNotDom] = React.useState(false);
  const useMarker = isElement && (refIsNotDom || !mayForwardRef(children.type));
  const childOwnRef = isElement
    ? (children as React.ReactElement & { ref?: React.Ref<unknown> }).ref
    : undefined;
  const childRef = React.useCallback(
    (value: unknown) => {
      setRef(childOwnRef as React.Ref<unknown>, value);
      if (value == null) {
        setRef(ref, null);
        return;
      }
      const dom = refValueToDom(value);
      if (dom) {
        setRef(ref, dom);
      } else {
        // e.g. an imperative handle: locate the DOM node with the marker.
        setRefIsNotDom(true);
      }
    },
    [ref, childOwnRef],
  );
  const markerRef = React.useRef<HTMLTemplateElement>(null);
  React.useLayoutEffect(() => {
    if (!useMarker) {
      return;
    }
    // Only the node right before the marker belongs to the child; text or
    // nothing there means the child rendered no element to anchor on.
    const previous = markerRef.current?.previousSibling;
    setRef(ref, isDomElement(previous) ? previous : null);
  });
  React.useLayoutEffect(
    () => () => {
      if (useMarker) {
        setRef(ref, null);
      }
    },
    [ref, useMarker],
  );
  if (!isElement) {
    return (
      <span {...triggerProps} ref={ref as React.Ref<HTMLSpanElement>}>
        {children}
      </span>
    );
  }
  const element = children as React.ReactElement<Record<string, any>>;
  const child = React.cloneElement(element, {
    ...chainTriggerProps(triggerProps, element.props),
    ...(!useMarker && { ref: childRef }),
  });
  return useMarker ? (
    <>
      {child}
      <template ref={markerRef} />
    </>
  ) : (
    child
  );
});

const POPUP_SELECTOR = ".ant-tooltip, .ant-popover, .ant-dropdown";

/**
 * Development aid: warns when an antd popup opens without a DOM anchor. Such
 * popups keep antd's off-screen placeholder position (`-1000vw`) because the
 * trigger child never received a DOM ref; wrap that child in `TriggerTarget`.
 */
export function watchUnanchoredPopups(doc: Document = document) {
  const reported = new WeakSet<Element>();
  const check = (popup: HTMLElement) => {
    if (
      reported.has(popup) ||
      !popup.isConnected ||
      /-hidden\b/.test(popup.className) ||
      popup.style.left !== "-1000vw"
    ) {
      return;
    }
    reported.add(popup);
    console.warn(
      "[TriggerTarget] An antd popup opened without a DOM anchor. Its trigger " +
        "child does not forward refs; wrap it in <TriggerTarget>.",
      popup,
    );
  };
  const timers = new Map<Element, number>();
  const schedule = (popup: HTMLElement) => {
    window.clearTimeout(timers.get(popup));
    // Give antd a moment to align a popup that does have an anchor.
    timers.set(
      popup,
      window.setTimeout(() => check(popup), 500),
    );
  };
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      const target = mutation.target;
      if (target instanceof HTMLElement && target.matches(POPUP_SELECTOR)) {
        schedule(target);
      }
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          node.querySelectorAll<HTMLElement>(POPUP_SELECTOR).forEach(schedule);
          if (node.matches(POPUP_SELECTOR)) {
            schedule(node);
          }
        }
      });
    }
  });
  observer.observe(doc.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["class", "style"],
  });
  return () => {
    observer.disconnect();
    timers.forEach((timer) => window.clearTimeout(timer));
  };
}
