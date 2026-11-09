import { useDataEnv, useGlobalActions } from "@plasmicapp/host";
import { usePlasmicDataSourceContext } from "@plasmicapp/data-sources-context";
import { usePlasmicInvalidate } from "@plasmicapp/react-web/lib/data-sources";
import { $State, $StateSpec, useDollarState, useDollarStateQueryInput, usePlasmicRefs } from "@plasmicapp/react-web";
import * as React from "react";

export interface CanvasComponentInput<Input> {
  getState(): Input;
  getInitialState(): Input;
  subscribe(listener: () => void): () => void;
}

export type CanvasEvaluatedDataTokens = { $dataTokens: Record<string, any>; pickerEnv: Record<string, any> } | undefined;

export interface CanvasComponentValues {
  readonly evaluatedDataTokens: CanvasEvaluatedDataTokens;
  readonly $ctx: NonNullable<ReturnType<typeof useDataEnv>>;
  readonly $globalActions: ReturnType<typeof useGlobalActions>;
  readonly dataSourcesCtx: ReturnType<typeof usePlasmicDataSourceContext>;
  readonly plasmicInvalidate: ReturnType<typeof usePlasmicInvalidate>;
  readonly getRefs: ReturnType<typeof usePlasmicRefs>["getRefs"];
  readonly registerRef: ReturnType<typeof usePlasmicRefs>["registerRef"];
  readonly $queries: Record<string, any>;
  readonly setDollarQueries: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  readonly $q: Record<string, any>;
  readonly setDollarQ: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  readonly $ccVariants: Record<string, boolean>;
  readonly updateVariant: (changes: Record<string, boolean>) => void;
}

export interface PreparedCanvasComponent<Prepared> {
  readonly data: Prepared;
  readonly stateSpecs: $StateSpec<any>[];
  readonly stateEnv: {
    $props: Record<string, any>;
    $queries: Record<string, any>;
    $q: Record<string, any>;
    $ctx: Record<string, any>;
    getRefs: ReturnType<typeof usePlasmicRefs>["getRefs"];
  };
}

export interface CanvasComponentController<Props, Input, Prepared, Context, TokenDefinitions> {
  readonly input: CanvasComponentInput<Input>;
  dataTokenDefinitions(input: Input): TokenDefinitions;
  evaluateDataTokens(definitions: TokenDefinitions): CanvasEvaluatedDataTokens;
  prepare(props: Props, input: Input, values: CanvasComponentValues): PreparedCanvasComponent<Prepared>;
  finish(prepared: Prepared, commands: $State, state: Readonly<Record<string, any>>, values: CanvasComponentValues): {
    readonly context: Context;
    readonly consumerKey: string;
    readonly consumerSlot: string | undefined;
  };
  retain(consumerKey: string, consumerSlot: string | undefined): () => void;
  commit(context: Context, commands: $State): void;
  render(context: Context): React.ReactNode;
}

export interface CanvasComponentRuntimeProps<Props, Input, Prepared, Context, TokenDefinitions> {
  readonly controller: CanvasComponentController<Props, Input, Prepared, Context, TokenDefinitions>;
  readonly originalProps: Props;
}

/** The state engine, refs, contexts and Hooks all come from this iframe's SDK
 * bundle. Studio supplies the model interpreter and explicit immutable input. */
export function CanvasComponentRuntime<Props, Input, Prepared, Context, TokenDefinitions>({ controller, originalProps }: CanvasComponentRuntimeProps<Props, Input, Prepared, Context, TokenDefinitions>) {
  const input = React.useSyncExternalStore(controller.input.subscribe, controller.input.getState, controller.input.getInitialState);
  const { evaluated: evaluatedDataTokens } = useCanvasDataTokens(controller, input);
  const $ctx = useDataEnv() ?? {};
  const $globalActions = useGlobalActions();
  const dataSourcesCtx = usePlasmicDataSourceContext();
  const plasmicInvalidate = usePlasmicInvalidate();
  const { getRefs, registerRef } = usePlasmicRefs();
  const [$queries, setDollarQueries] = React.useState<Record<string, any>>({});
  const [$q, setDollarQ] = React.useState<Record<string, any>>({});
  const [$ccVariants, setDollarCcVariants] = React.useState<Record<string, boolean>>({});
  const updateVariant = React.useCallback((changes: Record<string, boolean>) => {
    setDollarCcVariants((previous) => Object.keys(changes).some((key) => previous[key] !== changes[key])
      ? { ...previous, ...changes } : previous);
  }, []);
  const values: CanvasComponentValues = { evaluatedDataTokens, $ctx, $globalActions, dataSourcesCtx, plasmicInvalidate, getRefs, registerRef, $queries, setDollarQueries, $q, setDollarQ, $ccVariants, updateVariant };
  const prepared = controller.prepare(originalProps, input, values);
  const commands = useDollarState();
  const state = useDollarStateQueryInput(commands, prepared.stateEnv, prepared.stateSpecs);
  const { context, consumerKey, consumerSlot } = controller.finish(prepared.data, commands, state, values);
  useCanvasDataTokenLease(controller, consumerKey, consumerSlot);
  React.useLayoutEffect(() => controller.commit(context, commands), [controller, context, commands]);
  return controller.render(context);
}

export function useCanvasDataTokens<Input, Definitions>(controller: {
  dataTokenDefinitions(value: Input): Definitions;
  evaluateDataTokens(definitions: Definitions): CanvasEvaluatedDataTokens;
}, input: Input) {
  const definitions = controller.dataTokenDefinitions(input);
  const evaluated = React.useMemo(() => controller.evaluateDataTokens(definitions), [controller, definitions]);
  return { definitions, evaluated };
}

export function useCanvasDataTokenLease(controller: {
  retain(consumerKey: string, consumerSlot: string | undefined): () => void;
}, key: string, slot: string | undefined) {
  React.useLayoutEffect(() => controller.retain(key, slot), [controller, key, slot]);
}
