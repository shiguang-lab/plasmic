import { arrayEq, ensure } from "@/wab/shared/common";
import * as React from "react";
import { useStudioSelection } from "@/wab/client/studio-ctx/selection-state";
import { getHostWindow } from "@/wab/client/frame-ctx/host-window";
import { useCanvasFirstRenderComplete } from "@/wab/client/hooks/useCanvasRenderStatus";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { useViewRegistry } from "@/wab/client/studio-ctx/arena-state";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { StyleTokenValue } from "@/wab/commons/StyleToken";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import {
  TokenResolver,
  TokenValueResolver,
  makeTokenResolver,
} from "@/wab/shared/core/site-style-tokens";
import { FinalToken } from "@/wab/shared/core/tokens";
import { StyleToken } from "@/wab/shared/model/classes";

const RE_VARIABLE_REF = /var\((--[^)]+)\)/;

/**
 * Returns a TokenValueResolver that also consults the DOM to dereference
 * css variable references. This is for style tokens whose values
 * are set to `var(--MY-WEIRD-TOKEN)`.
 *
 * The css variable may be resolved from a few different places, and
 * we check in this order:
 *
 * 1. The artboard of the currently-focused ViewCtx
 * 2. The artboard of _any_ ViewCtx in the StudioCtx
 * 3. The parent window (the app host frame containing the studio iframe)
 *
 * We always try to read the css property value from document.documentElement
 * (so, only works for css properties defined via `:root {}`).
 */
function useClientTokenContext() {
  const studio = useStudioCtx();
  const view = useStudioSelection(studio, (state) => state.view);
  const firstEntry = useViewRegistry(studio, (entries) => entries[0]);
  useCanvasFirstRenderComplete(view);
  return { studio, client: view ?? firstEntry?.view ?? studio };
}

export function useClientTokenResolver(): TokenValueResolver {
  const { studio, client } = useClientTokenContext();
  return makeClientTokenResolver(makeTokenResolver(studio.site), client);
}

/** Resolve an already captured native token value through the same DOM path.
 * No token dictionary or model owner is consulted here. */
export interface ClientTokenValueInput {
  readonly value: StyleTokenValue;
  readonly isRegistered: boolean;
  readonly regKey: StyleToken["regKey"];
}

/** One selection/render-status subscription for a dynamic finite input list. */
export function useClientTokenValues(inputs: readonly (ClientTokenValueInput | undefined)[], lifetime: AbortSignal): readonly (StyleTokenValue | undefined)[] {
  const { client } = useClientTokenContext();
  const cached = React.useRef<{ lifetime: AbortSignal; values: readonly (StyleTokenValue | undefined)[] } | undefined>(undefined);
  if (lifetime.aborted) { return cached.current?.lifetime === lifetime ? cached.current.values : []; }
  const values = inputs.map((input) => input && resolveClientTokenValue(input.value, input, client));
  if (cached.current?.lifetime !== lifetime || !arrayEq(cached.current.values, values)) {
    cached.current = { lifetime, values: Object.freeze(values) };
  }
  return ensure(cached.current, "Native token values must be captured").values;
}

export function useClientTokenValue(value: StyleTokenValue | undefined,
  token: Pick<StyleToken, "isRegistered" | "regKey"> | undefined, lifetime: AbortSignal): StyleTokenValue | undefined {
  return useClientTokenValues([value === undefined || !token ? undefined : { value, isRegistered: token.isRegistered, regKey: token.regKey }], lifetime)[0];
}

function extractReferencedVariable(value: string) {
  const m = value.match(RE_VARIABLE_REF);
  return m ? m[1] : undefined;
}
export function makeClientTokenResolver(
  resolver: TokenResolver,
  clientCtx: StudioCtx | ViewCtx | undefined,
): TokenValueResolver {
  return (token: FinalToken<StyleToken>, vsh?: VariantedStylesHelper): StyleTokenValue => {
    const resolved = resolver(token, vsh);
    return resolveClientTokenValue(resolved.value, resolved.token.base, clientCtx);
  };
}

function resolveClientTokenValue(
  value: StyleTokenValue,
  token: Pick<StyleToken, "isRegistered" | "regKey">,
  clientCtx: StudioCtx | ViewCtx | undefined,
): StyleTokenValue {
  const refVarName = extractReferencedVariable(value);
  if (!refVarName) { return value; }
  const studioCtx = clientCtx instanceof ViewCtx ? clientCtx.studioCtx : clientCtx;
  const viewCtx =
    clientCtx instanceof ViewCtx
      ? clientCtx
      : studioCtx?.arenaState.viewRegistry.store.getState()[0]?.view;
  const doc = viewCtx ? viewCtx.canvasCtx.doc() : getHostWindow().document;
  let elt: Element = doc.documentElement;
  if (token.isRegistered && studioCtx && token.regKey) {
    const registration = studioCtx.getTokenRegistration(token);
    if (registration?.selector) {
      elt = doc.querySelector(registration.selector) ?? elt;
    }
  }
  return getCssVariableValue(elt, refVarName) ?? value;
}

function getCssVariableValue(
  elt: Element,
  name: string,
): StyleTokenValue | undefined {
  const win = elt.ownerDocument.defaultView;
  if (!win) {
    return undefined;
  }
  const value = win.getComputedStyle(elt).getPropertyValue(name).trim();
  return value.length === 0 ? undefined : (value as StyleTokenValue);
}
