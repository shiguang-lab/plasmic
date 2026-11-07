import type { ModelCommit, StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ModelFieldStore } from "@/wab/client/studio-ctx/model-snapshots";
import type { Component } from "@/wab/shared/model/classes";
import { isKnownObjectPath, isKnownTemplatedString } from "@/wab/shared/model/classes";
import { ensure, maybe, maybeFirst, swallow } from "@/wab/shared/common";
import { getSingleDynExprFromTemplatedString, tryCoerceString } from "@/wab/shared/core/exprs";
import { extractFiltersFromDefaultDataSourceQueries } from "@/wab/shared/data-sources-meta/data-sources";
import { extractParamsFromPagePath } from "@/wab/shared/utils/url-utils";
import { isEqual, size } from "lodash";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import React from "react";

export interface PageDetailsSpec {
  readonly sourceId: string;
  readonly tableId: string;
  readonly pathParams: readonly string[];
}

function projectPageDetails(page: Component): PageDetailsSpec | undefined {
  const pageMeta = ensure(page.pageMeta, "Page component without metadata");
  return maybeFirst(
      page.dataQueries.flatMap((query) => {
        const params = extractParamsFromPagePath(pageMeta.path);
        if (!(
          query.op &&
          ["getMany", "getList"].includes(query.op.opName) &&
          params.length > 0 &&
          query.op.templates.filters
        )) {
          return [];
        }

        const filtersValue = query.op.templates.filters.value;
        const filtersBindings = query.op.templates.filters.bindings;
        const tableId = maybe(
          tryCoerceString(query.op.templates.resource.value),
          JSON.parse,
        );
        if (!(
          tableId &&
          filtersBindings &&
          filtersValue &&
          size(filtersBindings) === size(params)
        )) {
          return [];
        }
        const filters = extractFiltersFromDefaultDataSourceQueries(query.op);
        if (!filters) {
          return [];
        }
        const bindingKeys: string[] = [];
        for (const pathParam of params) {
          const pathParamBinding = Object.keys(filtersBindings).find(
            (bindingKey) => {
              const binding = filtersBindings[bindingKey];
              const dynExpr = swallow(() =>
                isKnownObjectPath(binding)
                  ? binding
                  : isKnownTemplatedString(binding)
                    ? getSingleDynExprFromTemplatedString(binding)
                    : undefined,
              );
              return (
                dynExpr &&
                isKnownObjectPath(dynExpr) &&
                isEqual(dynExpr.path, ["$ctx", "params", pathParam])
              );
            },
          );
          if (!pathParamBinding || filters[pathParam] !== pathParamBinding) {
            return [];
          }
          bindingKeys.push(pathParamBinding);
        }

        return Object.freeze({
          sourceId: query.op.sourceId,
          tableId,
          pathParams: Object.freeze(params),
        });
      }),
    );
}

/** The existing query-to-record projection has one demand-owned native source. */
function createDetailsStore(studio: StudioCtx, page: Component): ModelFieldStore<PageDetailsSpec | undefined> {
  const state = createStore(() => projectPageDetails(page));
  let stopModel: (() => void) | undefined;
  let subscribers = 0;
  const update = () => {
    const next = studio.site.components.includes(page) ? projectPageDetails(page) : undefined;
    state.setState((previous) => isEqual(previous, next) ? previous : next, true);
  };
  const onModel = (event: ModelCommit) => {
    if (event.type === "site-replaced" || event.summary.updatedComponents.has(page) || event.summary.deepUpdatedComponents.has(page) || event.summary.changes.some(({ changeNode }) => changeNode.inst === studio.site && changeNode.field === "components")) {
      update();
    }
  };
  return {
    getState: state.getState,
    getInitialState: state.getInitialState,
    subscribe: (listener) => {
      const stop = state.subscribe(listener);
      subscribers++;
      if (subscribers === 1) {
        stopModel = studio.subscribeModelChanges(onModel);
        update();
      }
      return () => {
        stop();
        subscribers--;
        if (!subscribers) { stopModel?.(); stopModel = undefined; }
      };
    },
  };
}

export function usePageDetailsSpec(studio: StudioCtx, page: Component) {
  const store = React.useMemo(() => createDetailsStore(studio, page), [studio, page]);
  return useStore(store);
}
