import { useServerFunctionRegistration } from "@/wab/client/components/sidebar-tabs/ServerQuery/server-function-registration-inputs";
import { usePropExpressionValue } from "@/wab/client/components/sidebar-tabs/ComponentProps/prop-expression-inputs";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import {
  buildCustomCodePlasmicQuery,
  captureCustomFunctionParams,
  evaluateCapturedCustomFunctionParams,
  getInvalidFunctionArgs,
  wrapPlasmicQueryFetch,
} from "@/wab/shared/core/custom-functions";
import { ExprCtx } from "@/wab/shared/core/exprs";
import { InvalidArg } from "@/wab/shared/core/invalid-arg";
import { customFunctionId } from "@/wab/shared/core/query-ids";
import {
  CustomCode,
  CustomFunctionExpr,
  isKnownCustomCode,
} from "@/wab/shared/model/classes";
import type {
  PlasmicQuery,
  QueryComponentNode,
  QueryExecutionContext,
} from "@plasmicapp/data-sources";
import {
  _StatefulQueryResult as StatefulQueryResult,
  _StatefulQueryState as StatefulQueryState,
  usePlasmicQueries,
} from "@plasmicapp/data-sources";
import type { SWRResponse } from "@plasmicapp/query";
import { usePlasmicDataConfig } from "@plasmicapp/query";
import React from "react";

interface CustomFunctionOpArgs {
  expr: CustomFunctionExpr;
  env: Record<string, any>;
  exprCtx: ExprCtx;
  currGlobalThis?: typeof globalThis;
}

export interface CustomCodeOpArgs {
  fnId: string;
  code: CustomCode;
  env: Record<string, any>;
}

export type ServerQueryOpArgs = CustomFunctionOpArgs | CustomCodeOpArgs;

export interface ServerQueryOpResult<T> {
  queryState: StatefulQueryState<T> | undefined;
  swrResponse: Pick<SWRResponse<T>, "mutate">;
  invalidArgs: Record<string, InvalidArg> | undefined;
}

function isCustomCodeOpArgs(args: ServerQueryOpArgs): args is CustomCodeOpArgs {
  return "code" in args && isKnownCustomCode(args.code);
}

// NOOP_QUERY is used when we don't want to execute anything, but we still
// need to supply valid inputs for usePlasmicQueries, since it renders a
// different number of hooks depending on the number of queries.
const EMPTY_ENV = Object.freeze({}) as Record<string, any>;

const NOOP_QUERY: PlasmicQuery = {
  id: "__noop__",
  fn: async () => undefined,
  args: () => [],
};

/**
 * Runs a server query op (CustomFunctionExpr or CustomCode) for the Studio editor.
 *
 * The fetch uses `studioCtx.executeServerQuery` so preview, modal, and the canvas all share
 * one cache entry per query id/args. This ensures non-deterministic/stateful functions execute
 * once per refresh and show identical results.
 */
export function useServerQueryOp(
  args: ServerQueryOpArgs | undefined,
): ServerQueryOpResult<unknown> {
  const studioCtx = useStudioCtx();
  const expression = args ? (isCustomCodeOpArgs(args) ? args.code : args.expr) : undefined;
  const incomingFunction = args && !isCustomCodeOpArgs(args) ? args.expr : undefined;
  const incomingCode = args && isCustomCodeOpArgs(args) ? args.code : undefined;
  const component = args && !isCustomCodeOpArgs(args) ? args.exprCtx.component : undefined;
  const expressionCtx = args && !isCustomCodeOpArgs(args) ? args.exprCtx : undefined;
  const customCodeId = args && isCustomCodeOpArgs(args) ? args.fnId : undefined;
  const capture = React.useCallback(() => incomingFunction && expressionCtx
    ? { kind: "function" as const, fnId: customFunctionId(incomingFunction.func), func: incomingFunction.func, params: captureCustomFunctionParams(incomingFunction, expressionCtx) }
    : incomingCode && customCodeId ? { kind: "code" as const, fnId: customCodeId, code: incomingCode.code } : undefined,
    [incomingFunction, incomingCode, customCodeId, expressionCtx]);
  const input = usePropExpressionValue(studioCtx, expression ?? studioCtx, expression, component, capture);
  const func = input?.kind === "function" ? input.func : undefined;
  const params = input?.kind === "function" ? input.params : undefined;
  const registration = useServerFunctionRegistration(studioCtx, func);
  const fnReg = registration?.runtime;
  const wrapFetch = studioCtx.executeServerQuery;
  const env = args?.env ?? EMPTY_ENV;
  const fnId = input?.fnId ?? NOOP_QUERY.id;
  const code = input?.kind === "code" ? input.code : undefined;
  const currGlobalThis = args && !isCustomCodeOpArgs(args) ? args.currGlobalThis : undefined;

  // Memoized so stable inputs (e.g. the modal's executeArgs snapshot) don't
  // re-evaluate params on every render; the sidebar previews rebuild `env`
  // from canvas data, so validation recomputes there as that data changes.
  const invalidArgs = React.useMemo(() => {
    if (!params || !func || !fnReg) {
      return undefined;
    }
    try {
      const fnArgs = evaluateCapturedCustomFunctionParams(params, env, currGlobalThis);
      return getInvalidFunctionArgs(fnArgs, func, fnReg.meta.params);
    } catch {
      return undefined;
    }
  }, [env, fnReg, params, func, currGlobalThis]);
  const hasInvalidArgs = !!invalidArgs;

  const queryTree = React.useMemo((): QueryComponentNode => {
    let query: PlasmicQuery;
    if (fnId === NOOP_QUERY.id) {
      // No args supplied.
      query = NOOP_QUERY;
    } else if (code !== undefined) {
      query = buildCustomCodePlasmicQuery(
        fnId,
        code,
        () => env,
      );
    } else if (fnReg && params && !hasInvalidArgs) {
      query = {
        id: fnId,
        fn: fnReg.function,
        args: ({ $q, $props, $ctx, $state }: QueryExecutionContext) =>
          evaluateCapturedCustomFunctionParams(
            params,
            {
              ...env,
              $q: { ...(env.$q ?? {}), ...$q },
              $props,
              $ctx,
              $state,
            },
            currGlobalThis,
          ),
      };
    } else {
      // Missing registration or has invalid args.
      query = NOOP_QUERY;
    }

    return {
      type: "component",
      queries: {
        [fnId]:
          query === NOOP_QUERY
            ? NOOP_QUERY
            : wrapPlasmicQueryFetch(query, wrapFetch),
      },
      propsContext: {},
      stateSpecs: [],
      children: [],
    };
  }, [
    fnId,
    hasInvalidArgs,
    code,
    fnReg,
    params,
    currGlobalThis,
    wrapFetch,
    env,
  ]);

  const $queries = usePlasmicQueries(queryTree, {
    $ctx: env.$ctx ?? {},
    $props: env.$props ?? {},
    $state: env.$state ?? {},
  });

  const $query =
    fnId === NOOP_QUERY.id
      ? undefined
      : ($queries[fnId] as StatefulQueryResult);
  const subscribeQuery = React.useCallback((listener: () => void) => {
    $query?.addListener(listener);
    return () => $query?.removeListener(listener);
  }, [$query]);
  const readQuery = () => $query?.current;
  const queryState = React.useSyncExternalStore(subscribeQuery, readQuery, readQuery);

  const { mutate } = usePlasmicDataConfig();
  const swrResponse = {
      mutate: async () => {
        const key = $query?.current.key;
        if (!key) {
          return undefined;
        }
        // Clear the shared studio execution cache first, since revalidation invokes the
        // wrapped fetcher, which otherwise resolves to the cached promise for this key.
        studioCtx.mutateDataOp(key);
        return mutate(key);
      },
    };

  return {
    queryState,
    swrResponse,
    invalidArgs,
  };
}
