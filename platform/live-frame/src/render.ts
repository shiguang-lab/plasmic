import { createDiagnostics, PreviewErrorLocation } from "./diagnostics";

/** Complete a render when React commits, including a Suspense fallback. */
export function createRenderer(Sub: any) {
  const React = Sub.React;
  const diagnostics = createDiagnostics();
  let errorTitle = "Error";

  const fallback = (error: unknown) => React.createElement("div", {
    role: "alert", "data-plasmic-preview-error": true,
    style: { padding: 12, whiteSpace: "pre-wrap", overflowWrap: "anywhere" },
  }, `${errorTitle}: ${String((error as Error)?.message ?? error)}`);

  class Boundary extends React.Component {
    state = { error: undefined as unknown, failed: false, input: this.props.render };
    private failures = new Set<unknown>();
    static getDerivedStateFromProps(props: any, state: any) {
      // The parent supplies a new closure only when it renders new inputs.
      // An error boundary's own state update must never trigger another attempt.
      return props.render !== state.input
        ? { input: props.render, failed: false, error: undefined }
        : null;
    }
    static getDerivedStateFromError(error: unknown) { return { error, failed: true }; }
    componentDidCatch(error: unknown, info: { componentStack?: string }) {
      this.failures.add(error);
      diagnostics.report(error, { kind: "render", fatal: !!this.props.fatal,
        ...this.props.location, componentStack: info.componentStack }, this.props.generation);
    }
    private recovered = () => {
      for (const error of this.failures) { diagnostics.resolve(error, this.props.generation); }
      this.failures.clear();
    };
    componentWillUnmount() { this.recovered(); }
    render() {
      if (this.state.failed) { return fallback(this.state.error); }
      return this.props.render
        ? React.createElement(Evaluate, { render: this.props.render, onCommit: this.recovered })
        : this.props.children;
    }
  }

  // Evaluate props inside the boundary too; a child-only boundary cannot catch
  // expressions such as records.map() that throw before the child is created.
  function Evaluate({ render, onCommit }: { render: () => unknown; onCommit: () => void }) {
    const node = render();
    React.useLayoutEffect(onCommit);
    return node;
  }

  function renderBoundary(render: () => unknown, location: PreviewErrorLocation) {
    return React.createElement(Boundary, { key: location.elementUuid, location, generation: diagnostics.read().generation, render });
  }

  function renderRoot(node: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const dispose = Sub.hostUtils.registerRenderErrorListener((error: unknown) => {
        diagnostics.report(error, { kind: "render", fatal: true });
        dispose();
        resolve();
      });
      function CommittedRoot() {
        React.useLayoutEffect(() => {
          dispose();
          diagnostics.commit();
          resolve();
        }, []);
        return React.createElement(Boundary, { fatal: true, generation: diagnostics.read().generation }, node);
      }
      try {
        Sub.hostUtils.setPlasmicRootNode(React.createElement(CommittedRoot));
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
