import * as React from "react";
export type { JSX } from "react";
import { jsxShim } from "./util";

export const Fragment = React.Fragment;
export const jsx = jsxShim;
export const jsxs = jsx;
