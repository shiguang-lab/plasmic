/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
/* prettier-ignore-start */
"use client";
import * as React from "react";
import { createScreenVariantStore, useScreenVariants as useProjectScreenVariants } from "@plasmicapp/react-web";

export const ScreenContext = React.createContext(
  "PLEASE_RENDER_INSIDE_PROVIDER"
);

export function ScreenContextProvider(props) {
  return (
    <ScreenContext.Provider value={props.value}>
      {props.children}
    </ScreenContext.Provider>
  );
}

const screenVariantStore = createScreenVariantStore({
  desktopOnly: "(min-width:768px)"
});
export function useScreenVariants() { return useProjectScreenVariants(screenVariantStore, true); }

export default ScreenContext;
/* prettier-ignore-end */
