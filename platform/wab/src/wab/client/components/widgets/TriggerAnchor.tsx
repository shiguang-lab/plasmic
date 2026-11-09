import * as React from "react";
import { mergeRefs } from "@plasmicapp/react-web";

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

function setRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") {
    return ref(value);
  } else if (ref) {
    (ref as React.MutableRefObject<T | null>).current = value;
  }
  return undefined;
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
  // React 19 function components receive ref through their native props.
  return typeof type === "function" && !(type as { prototype?: { isReactComponent?: unknown } }).prototype?.isReactComponent;
}

/**
 * Lets an antd trigger anchor on any child, including components that don't
 * forward refs and children only known at runtime (`{children}`, `{x}`).
 *
 * The child is rendered unchanged, with the trigger's handlers chained onto
 * its props. Host elements and React 19 ref-prop components get the trigger's
 * ref directly. For class handles without a DOM node (or a forwarded ref that turns out not to
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
    ? (children.props as { ref?: React.Ref<unknown> }).ref
    : undefined;
  const forwardDomRef = React.useCallback(
    (value: unknown) => {
      if (value == null) {
        return setRef(ref, null);
      }
      const dom = refValueToDom(value);
      if (dom) {
        return setRef(ref, dom);
      } else {
        // e.g. an imperative handle: locate the DOM node with the marker.
        setRefIsNotDom(true);
      }
      return undefined;
    },
    [ref],
  );
  const childRef = React.useCallback((value: unknown) => mergeRefs(childOwnRef, forwardDomRef)(value), [childOwnRef, forwardDomRef]);
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
  const Child = element.type;
  const childProps = chainTriggerProps(triggerProps, element.props);
  const child = useMarker
    ? <Child {...childProps} key={element.key} />
    : <Child {...childProps} ref={childRef} key={element.key} />;
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
