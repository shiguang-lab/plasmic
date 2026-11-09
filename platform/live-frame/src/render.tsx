import * as React from "react";
import { createDiagnostics, PreviewErrorLocation } from "./diagnostics";

type Diagnostics = ReturnType<typeof createDiagnostics>;
interface BoundaryProps {
  render?: () => React.ReactNode;
  children?: React.ReactNode;
  fallback: (error: unknown) => React.ReactNode;
  diagnostics: Diagnostics;
  generation: number;
  fatal?: boolean;
  location?: PreviewErrorLocation;
}
interface BoundaryState {
  error: unknown;
  failed: boolean;
  input: BoundaryProps["render"];
}

/** React's descendant error capture and its associated diagnostic lifetime. */
export class PreviewErrorBoundary extends React.Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: undefined, failed: false, input: this.props.render };
  private failures = new Set<unknown>();
  static getDerivedStateFromProps(props: BoundaryProps, state: BoundaryState) {
    return props.render !== state.input
      ? { input: props.render, failed: false, error: undefined }
      : null;
  }
  static getDerivedStateFromError(error: unknown) { return { error, failed: true }; }
  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    this.failures.add(error);
    this.props.diagnostics.report(error, { kind: "render", fatal: !!this.props.fatal,
      ...this.props.location, componentStack: info.componentStack ?? undefined }, this.props.generation);
  }
  private recovered = () => {
    for (const error of this.failures) { this.props.diagnostics.resolve(error, this.props.generation); }
    this.failures.clear();
  };
  componentWillUnmount() { this.recovered(); }
  render() {
    if (this.state.failed) { return this.props.fallback(this.state.error); }
    return this.props.render
      ? <Evaluate render={this.props.render} onCommit={this.recovered} />
      : this.props.children;
  }
}

/** Evaluate expressions inside the boundary, before creating their child tree. */
function Evaluate({ render, onCommit }: { render: () => React.ReactNode; onCommit: () => void }) {
  const node = render();
  React.useLayoutEffect(onCommit);
  return node;
}

function CommittedRoot({ children, onCommit }: { children: React.ReactNode; onCommit: () => void }) {
  React.useLayoutEffect(onCommit, [onCommit]);
  return children;
}

function PreviewErrorFallback({ error, title }: { error: unknown; title: string }) {
  return <div role="alert" data-plasmic-preview-error style={{ padding: 12, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
    {`${title}: ${String((error as Error)?.message ?? error)}`}
  </div>;
}

/** Commands belong to the frame; native fibers above own React lifecycles. */
export function createRenderer(Sub: any) {
  const diagnostics = createDiagnostics();
  let errorTitle = "Error";
  let request = 0;
  const fallback = (error: unknown) => <PreviewErrorFallback error={error} title={errorTitle} />;

  function renderBoundary(render: () => React.ReactNode, location: PreviewErrorLocation) {
    return <PreviewErrorBoundary key={location.elementUuid} location={location} generation={diagnostics.read().generation}
      diagnostics={diagnostics} fallback={fallback} render={render} />;
  }

  function renderRoot(node: React.ReactNode): Promise<void> {
    return new Promise((resolve, reject) => {
      const dispose = Sub.hostUtils.registerRenderErrorListener((error: unknown) => {
        diagnostics.report(error, { kind: "render", fatal: true });
        dispose();
        resolve();
      });
      const onCommit = () => { dispose(); diagnostics.commit(); resolve(); };
      try {
        Sub.hostUtils.setPlasmicRootNode(<CommittedRoot key={++request} onCommit={onCommit}>
          <PreviewErrorBoundary fatal generation={diagnostics.read().generation} diagnostics={diagnostics} fallback={fallback}>
            {node}
          </PreviewErrorBoundary>
        </CommittedRoot>);
      } catch (error) {
        dispose();
        reject(error);
      }
    });
  }

  function showError(error: unknown) {
    diagnostics.report(error, { kind: "evaluation", fatal: true });
    return renderRoot(fallback(error));
  }

  return { renderRoot, showError, renderBoundary,
    beginRender: diagnostics.begin,
    getDiagnostics: diagnostics.read,
    reportError: diagnostics.report,
    setErrorTitle: (title: string) => { errorTitle = title; },
  };
}
