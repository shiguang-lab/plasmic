import { ProjectConfig } from "@/wab/shared/codegen/types";

/**
This is a subset of code from:
- packages/react-web/src/render/elements.ts
- packages/react-web/src/render/global-variants.ts
- packages/react-web/src/styles/plasmic.css
- packages/react-web/render/triggers.ts

@plasmicapp/react-web is still used in the exported code
but this additional files are added to the project, so that
it's possible to achieve functional screen or interaction variants
without @plasmicapp/react-web dependency.
*/
export const reactWebExportedFiles: ProjectConfig["reactWebExportedFiles"] = [
  {
    fileName: "global-variants.ts",
    content: `
interface Variants {
  [vg: string]: any;
}

export function hasVariant<V extends Variants>(
  variants: V | undefined,
  groupName: keyof V,
  variant: string
) {
  if (variants == null) {
    return false;
  }
  const groupVariants = variants[groupName];
  if (groupVariants == null) {
    return false;
  } else if (groupVariants === true) {
    return variant === groupName;
  } else if (groupVariants === false) {
    return false;
  } else if (Array.isArray(groupVariants)) {
    return groupVariants.includes(variant);
  } else if (typeof groupVariants === "string") {
    return groupVariants === variant;
  } else {
    return (
      groupVariants[variant] !== undefined && groupVariants[variant] !== false
    );
  }
}

const isDefaultValue = (val: string) => val === "PLEASE_RENDER_INSIDE_PROVIDER";
const seenDefaultVariants: Record<string, boolean> = {};
export function ensureGlobalVariants<T extends Record<string, any>>(
  globalVariantValues: T
) {
  Object.entries(globalVariantValues)
    .filter(([_, value]) => isDefaultValue(value))
    .forEach(([key, _]) => {
      (globalVariantValues as any)[key] = undefined;

      if (!seenDefaultVariants[key] && process.env.NODE_ENV === "development") {
        seenDefaultVariants[key] = true;
        const providerName = \`\${key[0].toUpperCase()}\${key.substring(
          1
        )}Context.Provider\`;
        console.warn(
          \`Plasmic context value for global variant "\${key}" was not provided; please use \${providerName} at the root of your React app. Learn More: https://www.plasmic.app/learn/other-assets/#global-variants\`
        );
      }
    });
  return globalVariantValues;
}
`.trim(),
  },
  {
    fileName: "react-web.css",
    content: `
:where(.__wab_flex-container),
:where(.ρfc) {
  display: flex;
  flex: 1;
  align-self: stretch;
  pointer-events: none;
}

:where(.__wab_flex-container > *),
:where(.ρfc > *) {
  pointer-events: auto;
}

:where(.__wab_slot),
:where(.ρs) {
  display: contents;
}

:where(.__wab_slot-string-wrapper),
:where(.ρsw) {
  position: relative;
}

:where(.__wab_passthrough) {
  display: contents;
}

:where(.__wab_img-wrapper) {
  position: relative;
  display: inherit;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;
}

:where(.__wab_slot > .__wab_img-wrapper),
:where(.ρs > .__wab_img-wrapper) {
  display: block;
}

:where(.__wab_passthrough > .__wab_img-wrapper) {
  display: block;
}

:where(.__wab_img-spacer-svg) {
  display: block;
  margin: 0;
  border: none;
  padding: 0;
}

:where(.__wab_img) {
  position: absolute;
  inset: 0;
  margin: 0;
  padding: 0;
  border: none;
  display: block;
  width: 100%;
  min-width: 100%;
  max-width: 100%;
  min-height: 100%;
  max-height: 100%;
  box-sizing: border-box;
}

:where(.__wab_picture) {
  display: contents;
}
`.trim(),
  },
  {
    fileName: "screen-variants.ts",
    content: `
import * as React from "react";
const isBrowser = typeof window !== "undefined";

type Queries = { [name: string]: string };
const queries: Queries = {};
const listeners = new Set<() => void>();
const empty: string[] = [];
let current: string[] | undefined;

function recalculateScreenVariants() {
  if (!isBrowser) return;
  const next = Object.entries(queries).filter(([, query]) => window.matchMedia(query).matches).map(([name]) => name);
  if (!current || next.length !== current.length || next.some((name, index) => name !== current?.[index])) {
    current = next;
    listeners.forEach(listener => listener());
  }
}

const store = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    if (listeners.size === 1 && isBrowser) window.addEventListener("resize", recalculateScreenVariants);
    recalculateScreenVariants();
    return () => {
      listeners.delete(listener);
      if (!listeners.size && isBrowser) window.removeEventListener("resize", recalculateScreenVariants);
    };
  },
  getSnapshot: () => current ?? empty,
  getServerSnapshot: () => empty,
};

/** Registers the queries from a generated project module. */
export function createScreenVariantStore(screenQueries: Queries) {
  Object.assign(queries, screenQueries);
  current = undefined;
  return store;
}

export function useScreenVariants(screenStore: typeof store, isMulti: true): string[];
export function useScreenVariants(screenStore: typeof store, isMulti: false): string | undefined;
export function useScreenVariants(screenStore: typeof store, isMulti: boolean): string[] | string | undefined;
export function useScreenVariants(screenStore: typeof store, isMulti: boolean) {
  const active = React.useSyncExternalStore(screenStore.subscribe, screenStore.getSnapshot, screenStore.getServerSnapshot);
  return isMulti ? active : active[active.length - 1];
}
`.trim(),
  },
  {
    fileName: "triggers.ts",
    content: `
import {
  FocusRingAria,
  useFocusRing as useAriaFocusRing,
} from "@react-aria/focus";
import {
  HoverResult,
  PressResult,
  useHover as useAriaHover,
  usePress as useAriaPress,
} from "@react-aria/interactions";

type FocusHookResult = [boolean, FocusRingAria["focusProps"]];
type HoverHookResult = [boolean, HoverResult["hoverProps"]];
type PressHookResult = [boolean, PressResult["pressProps"]];

export function useFocused(opts: { isTextInput?: boolean }): FocusHookResult {
  const { isFocused, focusProps } = useAriaFocusRing({
    within: false,
    isTextInput: opts.isTextInput,
  });

  return [isFocused, focusProps];
}

export function useFocusVisible(opts: { isTextInput?: boolean }): FocusHookResult {
  const { isFocusVisible, focusProps } = useAriaFocusRing({
    within: false,
    isTextInput: opts.isTextInput,
  });

  return [isFocusVisible, focusProps];
}

export function useFocusedWithin(opts: { isTextInput?: boolean }): FocusHookResult {
  const { isFocused, focusProps } = useAriaFocusRing({
    within: true,
    isTextInput: opts.isTextInput,
  });

  return [isFocused, focusProps];
}

export function useFocusVisibleWithin(opts: {
  isTextInput?: boolean;
}): FocusHookResult {
  const { isFocusVisible, focusProps } = useAriaFocusRing({
    within: true,
    isTextInput: opts.isTextInput,
  });

  return [isFocusVisible, focusProps];
}

export function useHover(): HoverHookResult {
  const { isHovered, hoverProps } = useAriaHover({});
  return [isHovered, hoverProps];
}

export function usePressed(): PressHookResult {
  const { isPressed, pressProps } = useAriaPress({
    onPress: (e) => e.continuePropagation(),
    onPressStart: (e) => e.continuePropagation(),
    onPressEnd: (e) => e.continuePropagation(),
    onPressUp: (e) => e.continuePropagation(),
  });
  return [isPressed, pressProps];
}

`.trim(),
  },
];
