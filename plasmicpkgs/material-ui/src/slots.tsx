import React from "react";

/** Evaluate Studio's reactive slot observer before MUI inspects/clones children. */
export function renderSlot(
  children: React.ReactNode,
  render: (children: React.ReactNode) => React.ReactElement,
): React.ReactElement {
  if (
    React.isValidElement<{
      children?: React.ReactNode | ((...args: unknown[]) => React.ReactNode);
    }>(children) &&
    typeof children.props.children === "function"
  ) {
    const callback = children.props.children;
    return React.cloneElement(children, {
      children: (...args: unknown[]) => renderSlot(callback(...args), render),
    });
  }
  const flatten = (nodes: React.ReactNode): React.ReactNode[] =>
    React.Children.toArray(nodes).flatMap((node) =>
      React.isValidElement<{ children?: React.ReactNode }>(node) &&
      node.type === React.Fragment
        ? flatten(node.props.children)
        : [node],
    );
  return render(flatten(children));
}

/** MUI element props require an element, whereas a Studio slot returns a list. */
export function withSlots<T extends React.ElementType>(
  Native: T,
  singleSlots: string[],
  inspectChildren = false,
) {
  function MaterialSlots(props: React.ComponentProps<T>) {
    const resolve = (
      index: number,
      resolved: Record<string, unknown>,
    ): React.ReactElement => {
      if (index === singleSlots.length) {
        const render = (children: React.ReactNode) =>
          React.createElement(Native, {
            ...props,
            ...resolved,
            ...(inspectChildren ? { children } : {}),
          });
        return inspectChildren
          ? renderSlot(props.children, render)
          : render(undefined);
      }
      const key = singleSlots[index];
      if (props[key] == null) return resolve(index + 1, resolved);
      return renderSlot(props[key], (children) => {
        const items = React.Children.toArray(children);
        const value = items.length ? React.Children.only(items[0]) : undefined;
        if (items.length > 1)
          throw new Error(`${key} requires a single MUI element`);
        return resolve(index + 1, { ...resolved, [key]: value });
      });
    };
    return resolve(0, {});
  }
  // MUI uses muiName for native child recognition (for example StepButton).
  return Object.assign(MaterialSlots, {
    muiName: (Native as T & { muiName?: string }).muiName,
  });
}
