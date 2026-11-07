import { Corner, Side } from "@/wab/shared/geom";
import L from "lodash";
import * as React from "react";
import { ReactNode } from "react";

interface SidesAndCornersProps {
  empty?: () => ReactNode;
  side?: (side: Side) => ReactNode;
  corner?: (side: Corner) => ReactNode;
  center?: () => ReactNode;
}

export const sidesAndCorners = ({
  empty = () => <div />,
  side = empty,
  corner = empty,
  center = empty,
}: SidesAndCornersProps) => {
  return (
    <>
      {corner("top-left")}
      {side("top")}
      {corner("top-right")}
      {side("left")}
      {center()}
      {side("right")}
      {corner("bottom-left")}
      {side("bottom")}
      {corner("bottom-right")}
    </>
  );
};

export function styleCase(text: string) {
  return L.startCase(text).replace(" ", "");
}

export function isEmptyReactNode(node: ReactNode): boolean {
  if (node == null || typeof node === "boolean" || node === "") {
    return true;
  }
  if (Array.isArray(node)) {
    return node.every(isEmptyReactNode);
  }
  if (React.isValidElement(node) && node.type === React.Fragment) {
    return isEmptyReactNode((node.props as any)?.children);
  }
  return false;
}
