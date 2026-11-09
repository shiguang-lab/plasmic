import * as React from "react";

/**
 * Creates a HOC that wraps a node with a Context Provider.
 *
 * ```tsx
 * const providesYourContext = withProvider(YourContext.Provider);
 * function YourComponent() {
 *   return providesYourContext(yourContextValue)(
 *     <YourContent />
 *   );
 * }
 * ```
 */
export function withProvider<PropType>(
  Provider: React.ComponentType<React.ProviderProps<PropType>>,
) {
  return function (value: PropType, key?: string) {
    return function (children: React.ReactNode) {
      return (
        <Provider value={value} key={key}>
          {children}
        </Provider>
      );
    };
  };
}
