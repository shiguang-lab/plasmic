import * as React from "react";
import { StateInitializer, get, getStateCommandValue, useDollarStateQueryInput, useDollarStateSnapshot, $State, $StateSpec } from "@plasmicapp/react-web";
import { usePlasmicDataOp, usePlasmicQueries, QueryComponentNode, PlasmicQueryResult } from "@plasmicapp/react-web/lib/data-sources";
import type { CanvasComponentInput, PreparedCanvasComponent } from "./canvas-component";

type StateEnv = PreparedCanvasComponent<unknown>["stateEnv"];
type RenderEnv = Omit<StateEnv, "getRefs">;
type ServerQueries = Record<string, PlasmicQueryResult>;
type LegacyQueries = Record<string, ReturnType<typeof usePlasmicDataOp>>;

export interface CanvasLegacyQuery {
  readonly key: string;
  readonly name: string;
  evaluate(env: RenderEnv & { $state: Readonly<$State> }): any;
}

export interface CanvasQueryPlan {
  readonly server: QueryComponentNode;
  readonly legacy: readonly CanvasLegacyQuery[];
}

export interface CanvasNodeRenderInput extends CanvasComponentInput<React.ReactNode> {
  commit(): void;
  dispose(): void;
}

export interface CanvasQueryController<Context, Registrations> {
  readonly registrations: CanvasComponentInput<Registrations>;
  plan(context: Context, registrations: Registrations): CanvasQueryPlan;
  environment(context: Context): RenderEnv & { $state: Readonly<$State> };
  refCommands(context: Context): StateEnv["getRefs"] | undefined;
  specs(context: Context): $StateSpec<any>[];
  withQueries(context: Context, state: Readonly<$State>, server: ServerQueries, legacy: LegacyQueries): Context;
  publish(context: Context, server: ServerQueries, legacy: LegacyQueries): void;
  renderInput(context: Context): CanvasNodeRenderInput;
}

interface QueryReader extends PlasmicQueryResult {
  readonly current?: unknown;
  addListener?(listener: () => void): void;
  removeListener?(listener: () => void): void;
}

class QueryResultInput {
  private current?: { results: ServerQueries; states: readonly unknown[] };
  constructor(private readonly results: ServerQueries) {}
  getState = () => {
    const states = Object.values(this.results).map((query: QueryReader) => query.current ?? query);
    if (!this.current || states.some((state, index) => state !== this.current?.states[index])) {
      this.current = { results: Object.freeze({ ...this.results }), states: Object.freeze(states) };
    }
    return this.current;
  };
  subscribe = (listener: () => void) => {
    const readers: QueryReader[] = Object.values(this.results);
    readers.forEach((query) => query.addListener?.(listener));
    return () => readers.forEach((query) => query.removeListener?.(listener));
  };
}

function loadQueries(queries: Record<string, { isLoading?: boolean; data?: any }>) {
  // Suspended query fibers do not run effects. The SDK cache owns these loads;
  // reading a loading proxy starts its fetch without committing component state.
  queueMicrotask(() => {
    for (const query of Object.values(queries)) {
      try {
        if (query?.isLoading) {
          const data = query.data;
          if (data && typeof data === "object" && "value" in data) { data.value; }
        }
      } catch { /* Pending-query promises are consumed by the SDK's cache. */ }
    }
  });
}

/** Registrations can change the server Hook count. This outer fiber keeps its
 * own fixed Hook shape and mounts a new query executor for the new query set. */
export function CanvasQueriesRuntime<Context, Registrations>({ controller, context }: {
  controller: CanvasQueryController<Context, Registrations>;
  context: Context;
}) {
  const registrations = React.useSyncExternalStore(controller.registrations.subscribe, controller.registrations.getState, controller.registrations.getInitialState);
  const plan = controller.plan(context, registrations);
  return <CanvasServerQueries key={JSON.stringify(Object.keys(plan.server.queries))} controller={controller} context={context} plan={plan} />;
}

function CanvasServerQueries<Context, Registrations>({ controller, context, plan }: {
  controller: CanvasQueryController<Context, Registrations>;
  context: Context;
  plan: CanvasQueryPlan;
}) {
  const env = controller.environment(context);
  const results = usePlasmicQueries(plan.server, { $ctx: env.$ctx, $props: env.$props, $state: env.$state });
  const input = React.useMemo(() => new QueryResultInput(results), [results]);
  const snapshot = React.useSyncExternalStore(input.subscribe, input.getState, input.getState);
  const server = snapshot.results;
  const specs = controller.specs(context);
  const commands = getStateCommandValue(env.$state);
  const state = useDollarStateQueryInput(commands, { ...env, $q: server, getRefs: controller.refCommands(context) }, specs);
  const queryContext = controller.withQueries(context, state, server, env.$queries);
  loadQueries(server);
  return plan.legacy.length
    ? <CanvasLegacyQueryChain key={plan.legacy[0].key} controller={controller} ownerContext={context} context={queryContext} queries={plan.legacy} index={0} server={server} results={{}} />
    : <CanvasStateView controller={controller} ownerContext={context} context={queryContext} server={server} legacy={{}} />;
}

function CanvasLegacyQueryChain<Context, Registrations>({ controller, ownerContext, context, queries, index, server, results }: {
  ownerContext: Context;
  controller: CanvasQueryController<Context, Registrations>;
  context: Context;
  queries: readonly CanvasLegacyQuery[];
  index: number;
  server: ServerQueries;
  results: LegacyQueries;
}) {
  const query = queries[index];
  const previous = controller.environment(context);
  const env = { ...previous, $q: server, $queries: { ...previous.$queries, ...results } };
  const state = useDollarStateQueryInput(getStateCommandValue(previous.$state), { ...env, getRefs: controller.refCommands(context) }, controller.specs(context));
  const result = usePlasmicDataOp(() => query.evaluate({ ...env, $state: state }));
  const next = { ...results, [query.name]: result };
  loadQueries({ [query.name]: result });
  return index + 1 < queries.length
    ? <CanvasLegacyQueryChain key={queries[index + 1].key} controller={controller} ownerContext={ownerContext} context={context} queries={queries} index={index + 1} server={server} results={next} />
    : <CanvasStateView controller={controller} ownerContext={ownerContext} context={context} server={server} legacy={next} />;
}

function readInitialStateValues(state: Readonly<$State>, specs: $StateSpec<any>[]) {
  for (const spec of specs) {
    if (!spec.path.includes("[]")) { get(state, spec.path.split(".")); }
  }
}

function CanvasStateView<Context, Registrations>({ controller, ownerContext, context, server, legacy }: {
  ownerContext: Context;
  controller: CanvasQueryController<Context, Registrations>;
  context: Context;
  server: ServerQueries;
  legacy: LegacyQueries;
}) {
  const previous = controller.environment(context);
  const env = { ...previous, $q: server, $queries: legacy };
  const specs = controller.specs(context);
  const state = useDollarStateSnapshot(getStateCommandValue(previous.$state), { ...env, getRefs: controller.refCommands(context) }, specs);
  readInitialStateValues(state, specs);
  const current = controller.withQueries(context, state, server, legacy);
  const rendered = React.useMemo(() => controller.renderInput(current), [controller, current]);
  const node = React.useSyncExternalStore(rendered.subscribe, rendered.getState, rendered.getInitialState);
  React.useLayoutEffect(() => { rendered.commit(); }, [rendered, node]);
  React.useEffect(() => () => rendered.dispose(), [rendered]);
  React.useLayoutEffect(() => { controller.publish(ownerContext, server, legacy); }, [controller, ownerContext, server, legacy]);
  return <StateInitializer state={state} initializers={specs.filter((spec) => !spec.path.includes("[]")).map((spec) => ({ path: spec.path }))}>{node}</StateInitializer>;
}
