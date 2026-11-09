import { DataContext } from "@plasmicapp/host";
import * as React from "react";

export interface CanvasErrorDisplayProps {
  readonly ctx: unknown;
  readonly nodeOrComponent: unknown;
  readonly nodeProps?: Record<string, unknown>;
  readonly title: React.ReactNode;
  readonly message: string;
  readonly valKey: string;
  readonly ownerKey: string | undefined;
  readonly envId: string;
}

export function CanvasErrorDisplay({ title, message, valKey, ownerKey, envId }: CanvasErrorDisplayProps) {
  return <div className="__wab_error-display" data-plasmic-valkey={valKey} data-plasmic-canvas-envs={envId} data-plasmic-valowner={ownerKey} data-plasmic-classname="__wab_error-display">
    <div className="__wab_error-display__inner">
      <div className="__wab_error-display__heading">{title}</div>
      <div className="__wab_error-display__code">{message}</div>
    </div>
  </div>;
}

export interface CanvasErrorBoundaryProps {
  readonly children: React.ReactNode;
  readonly lifetime: AbortSignal;
  readonly subscribeToChanges: (listener: () => void) => () => void;
  readonly renderError: (error: Error) => React.ReactNode;
  readonly isPendingError: (error: Error) => boolean;
}

/** React exposes descendant error capture through this class lifecycle API. */
interface CanvasErrorBoundaryState {
  readonly lifetime: AbortSignal;
  readonly error?: Error | null;
}

export class CanvasErrorBoundary extends React.Component<CanvasErrorBoundaryProps, CanvasErrorBoundaryState> {
  static contextType = DataContext;
  state: CanvasErrorBoundaryState = { lifetime: this.props.lifetime };

  static getDerivedStateFromProps(props: CanvasErrorBoundaryProps, state: CanvasErrorBoundaryState) {
    return props.lifetime === state.lifetime ? null : { lifetime: props.lifetime, error: null };
  }
  private stopWatching?: () => void;

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidMount() {
    this.props.lifetime.addEventListener("abort", this.stopWatchingOwner, { once: true });
    this.watchError();
  }

  componentDidUpdate(previous: CanvasErrorBoundaryProps) {
    if (previous.lifetime !== this.props.lifetime || previous.subscribeToChanges !== this.props.subscribeToChanges) {
      previous.lifetime.removeEventListener("abort", this.stopWatchingOwner);
      this.stopWatchingOwner();
      this.props.lifetime.addEventListener("abort", this.stopWatchingOwner, { once: true });
    }
    this.watchError();
  }

  componentWillUnmount() {
    this.stopWatchingOwner();
    this.props.lifetime.removeEventListener("abort", this.stopWatchingOwner);
  }

  private resetError = () => {
    if (this.stopWatching && !this.props.lifetime.aborted) {
      this.setState({ error: null });
    }
  };

  private stopWatchingOwner = () => {
    this.stopWatching?.();
    this.stopWatching = undefined;
  };

  private watchError() {
    if (this.props.lifetime.aborted) {
      return;
    }
    if (this.state.error && !this.props.isPendingError(this.state.error)) {
      this.stopWatching ??= this.props.subscribeToChanges(this.resetError);
    } else {
      this.stopWatchingOwner();
    }
  }

  render() {
    if (this.state.error != null) {
      if (this.props.isPendingError(this.state.error)) {
        throw this.state.error;
      }
      return this.props.renderError(this.state.error);
    }
    return this.props.children;
  }
}
