import type * as React from "react";
import { createPlasmicElementProxy } from "@plasmicapp/react-web";

/**
 * A jsx shim that just calls into createPlasmicElementProxy.  Eventually, should
 * instead be using react/jsx-runtime to do the right thing.
 */
export function jsxShim(
  type: React.ElementType<any>,
  props: any,
  key?: React.Key | null
) {
  const hasChildren = props != null && Object.prototype.hasOwnProperty.call(props, "children");
  const { children, ...restProps } = props ?? {};
  if (key !== undefined) {
    restProps.key = key;
  }
  return createPlasmicElementProxy(
    type,
    restProps,
    ...(hasChildren ? [children] : [])
  );
}
