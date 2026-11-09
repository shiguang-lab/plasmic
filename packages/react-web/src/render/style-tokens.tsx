import React from "react";
import { hasVariant } from "./elements";
import { GlobalVariants } from "./global-variants";

type ClassName = string;
const StyleTokensContext = React.createContext<ClassName[] | undefined>(undefined);

export interface ProjectStyleTokenData {
  base?: ClassName;
  varianted: {
    className: ClassName;
    groupName: string;
    variant: string;
  }[];
}

/** Includes this project's tokens and any overrides from the owning project. */
export function useStyleTokens(tokenData: ProjectStyleTokenData, globalVariants: GlobalVariants): ClassName[] {
  const inherited = React.useContext(StyleTokensContext);
  return Array.from(new Set([
    ...(inherited ?? []),
    ...activeTokensClassNames(tokenData, globalVariants),
  ]));
}

/** Publishes the owning project's token classes to descendant projects. */
export function StyleTokensProvider({tokenData, globalVariants, children}: React.PropsWithChildren<{
  tokenData: ProjectStyleTokenData;
  globalVariants: GlobalVariants;
}>) {
  const tokens = activeTokensClassNames(tokenData, globalVariants);
  return <StyleTokensContext.Provider value={tokens}>{children}</StyleTokensContext.Provider>;
}

function activeTokensClassNames(tokenData: ProjectStyleTokenData, globalVariants: GlobalVariants): ClassName[] {
  const varianted = tokenData.varianted
    .filter(({groupName, variant}) => hasVariant(globalVariants, groupName, variant))
    .map(({className}) => className);
  return [...(tokenData.base?.split(" ") ?? []), ...varianted];
}
