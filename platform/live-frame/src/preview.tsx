import * as React from "react";

export type PreviewRender =
  | { notFound: string }
  // Call the `__run` export of this module
  | { run: string }
  | {
      root: string;
      componentUuid: string;
      isPage: boolean;
      depCss: string[];
      propsModule: string;
      globalContexts?: string;
      styleTokensProvider?: string;
      globalVariants: { module: string; provider: string; prop: string }[];
      page?: {
        route: string;
        params?: Record<string, string | string[]>;
        query: Record<string, string | string[]>;
      };
      globals: Record<string, unknown>;
      appUser: unknown;
    };

type Values = Record<string, unknown>;
interface PreviewInputs { readonly props: Values; readonly globals: Values; }

/** Frame commands can arrive before React's first render or while it suspends. */
class PreviewSession {
  private current: PreviewInputs;
  private active = true;
  private listeners = new Set<() => void>();
  constructor(props: Values, globals: Values) {
    this.current = Object.freeze({ props: Object.freeze({...props}), globals: Object.freeze({...globals}) });
  }
  read = () => this.current;
  subscribe = (listener: () => void) => {
    if (!this.active) { return () => undefined; }
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private publish(value: PreviewInputs) {
    if (!this.active) { return; }
    this.current = Object.freeze(value);
    this.listeners.forEach((listener) => listener());
  }
  setProps(props: Values) { this.publish({ ...this.current, props: Object.freeze({...this.current.props, ...props}) }); }
  setGlobals(globals: Values) { this.publish({ ...this.current, globals: Object.freeze({...globals}) }); }
  retire() { this.active = false; this.listeners.clear(); }
}

interface PreviewDefinition {
  readonly Root: React.ElementType;
  readonly isPage: boolean;
  readonly componentUuid: string;
  readonly StyleTokensProvider: React.ElementType | undefined;
  readonly GlobalContexts: React.ElementType | undefined;
  readonly globalVariants: readonly { readonly Provider: React.ElementType; readonly prop: string }[];
  readonly PageParamsProvider: React.ElementType | undefined;
  readonly page: Extract<PreviewRender, { root: string }>["page"];
  readonly DataProvider: React.ElementType | undefined;
  readonly DataSourceContextProvider: React.ElementType;
  readonly appUser: unknown;
}

function PreviewRoot({session, definition}: {session: PreviewSession; definition: PreviewDefinition}) {
  const {props, globals} = React.useSyncExternalStore(session.subscribe, session.read, session.read);
  const {Root, StyleTokensProvider, GlobalContexts, PageParamsProvider, DataProvider, DataSourceContextProvider} = definition;
  let content = <div className={`live-root-container ${definition.isPage ? "" : "live-root-container--centered"}`}
    data-plasmic-preview-component={definition.componentUuid}>
    <Root {...props} __plasmicIsPreviewRoot />
  </div>;
  // Root token overrides take precedence over dependency tokens.
  if (StyleTokensProvider) { content = <StyleTokensProvider>{content}</StyleTokensProvider>; }
  if (GlobalContexts) { content = <GlobalContexts>{content}</GlobalContexts>; }
  for (const {Provider, prop} of definition.globalVariants) { content = <Provider value={globals[prop]}>{content}</Provider>; }
  if (definition.page && PageParamsProvider) { content = <PageParamsProvider {...definition.page}>{content}</PageParamsProvider>; }
  content = <DataSourceContextProvider value={definition.appUser}>{content}</DataSourceContextProvider>;
  if (DataProvider) {
    content = <DataProvider name="plasmicInternalEnableLoadingBoundary" hidden data>
      <React.Suspense fallback="Loading...">{content}</React.Suspense>
    </DataProvider>;
  }
  return content;
}

function NotFound({path}: {path: string}) {
  return <div style={{width: "100%", height: "100%", padding: "0 20px"}}>
    <h1>Page not found</h1><p>There is no page component with path <code style={{background: "#eee", border: "solid 1px #aaa", padding: 3}}>{path}</code> in this Plasmic project.</p>
  </div>;
}

export function createPreview(Sub: any, require: (spec: string) => any, renderRoot: (node: React.ReactNode) => Promise<void>) {
  let current: PreviewSession | undefined;

  function render(spec: PreviewRender) {
    if ("notFound" in spec) {
      return renderRoot(<NotFound path={spec.notFound} />).then(() => { current?.retire(); current = undefined; });
    }
    if ("run" in spec) { return require(spec.run).__run(); }
    spec.depCss.forEach(require);
    const Root = require(spec.root).default;
    const initialProps: Values = require(spec.propsModule).default;
    const definition: PreviewDefinition = Object.freeze({
      Root, isPage: spec.isPage, componentUuid: spec.componentUuid,
      StyleTokensProvider: spec.styleTokensProvider ? require(spec.styleTokensProvider).StyleTokensProvider : undefined,
      GlobalContexts: spec.globalContexts ? require(spec.globalContexts).default : undefined,
      globalVariants: Object.freeze(spec.globalVariants.map(g => Object.freeze({Provider: require(g.module)[g.provider], prop: g.prop}))),
      PageParamsProvider: Sub.PageParamsProvider, page: spec.page,
      DataProvider: Sub.DataProvider,
      DataSourceContextProvider: require("@plasmicapp/react-web").PlasmicDataSourceContextProvider,
      appUser: spec.appUser,
    });
    const session = new PreviewSession(initialProps, spec.globals);
    const previous = current;
    current = session;
    return renderRoot(<PreviewRoot session={session} definition={definition} />).then(() => {
      previous?.retire();
    }, error => {
      session.retire();
      if (current === session) { current = previous; }
      throw error;
    });
  }

  return {render, setProps: (props: Values) => current?.setProps(props), setGlobals: (globals: Values) => current?.setGlobals(globals)};
}
