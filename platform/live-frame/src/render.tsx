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
  onError?: (error: unknown) => void;
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
    this.props.onError?.(error);
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

export interface PreviewErrorRecovery { label: string; onReturn: () => void; }

function PreviewErrorFallback({ title, recovery }: { title: string; recovery?: PreviewErrorRecovery }) {
  return <div role="alert" data-plasmic-preview-error style={{ margin: "48px auto", padding: 24, maxWidth: 360,
    border: "1px solid #e5e7eb", borderRadius: 12, fontFamily: "system-ui", color: "#1f2937", background: "#fff" }}>
    <p style={{ margin: "0 0 16px", fontSize: 16 }}>{title}</p>
    {recovery && <button type="button" onClick={recovery.onReturn} style={{ padding: "8px 16px", cursor: "pointer" }}>{recovery.label}</button>}
  </div>;
}

/** Commands belong to the frame; native fibers above own React lifecycles. */
export function createRenderer(Sub: any) {
  const diagnostics = createDiagnostics();
  let errorTitle = "Preview unavailable";
  let recovery: PreviewErrorRecovery | undefined;
  let hasSuccessfulRoot = false;
  let lastSuccessfulRoot: React.ReactNode;
  const fallback = (_error: unknown) => <PreviewErrorFallback title={errorTitle} recovery={recovery} />;
  const rootFallback = (_error: unknown) => hasSuccessfulRoot
    ? <PreviewErrorBoundary generation={diagnostics.read().generation} diagnostics={diagnostics} fallback={fallback} render={() => lastSuccessfulRoot} />
    : fallback(_error);

  function renderBoundary(render: () => React.ReactNode, location: PreviewErrorLocation) {
    return <PreviewErrorBoundary key={location.elementUuid} location={location} generation={diagnostics.read().generation}
      diagnostics={diagnostics} fallback={fallback} render={render} />;
  }

  function renderRoot(node: React.ReactNode): Promise<void> {
    return new Promise((resolve, reject) => {
      let failure: { error: unknown } | undefined;
      const dispose = Sub.hostUtils.registerRenderErrorListener((error: unknown) => {
        diagnostics.report(error, { kind: "render", fatal: true });
        dispose();
        reject(error);
      });
      const onCommit = () => {
        dispose();
        if (diagnostics.read().status !== "failed") { lastSuccessfulRoot = node; hasSuccessfulRoot = true; }
        diagnostics.commit();
        if (failure) { reject(failure.error); } else { resolve(); }
      };
      try {
        Sub.hostUtils.setPlasmicRootNode(<CommittedRoot onCommit={onCommit}>
          <PreviewErrorBoundary fatal onError={error => { failure = { error }; }} generation={diagnostics.read().generation} diagnostics={diagnostics} fallback={rootFallback} render={() => node} />
        </CommittedRoot>);
      } catch (error) {
        dispose();
        reject(error);
      }
    });
  }

  function showError(error: unknown) {
    // Render boundaries already recorded the original cause and component stack.
    if (!diagnostics.read().errors.some(entry => entry.fatal && entry.kind === "render")) {
      diagnostics.report(error, { kind: "evaluation", fatal: true });
    }
    if (hasSuccessfulRoot) { return Promise.resolve(); }
    return renderRoot(fallback(error));
  }

  return { renderRoot, showError, renderBoundary,
    beginRender: diagnostics.begin,
    getDiagnostics: diagnostics.read,
    reportError: diagnostics.report,
    setErrorTitle: (title: string, action?: PreviewErrorRecovery) => { errorTitle = title; recovery = action; },
  };
}
