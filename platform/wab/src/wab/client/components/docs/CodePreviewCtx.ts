import { formatDocsCode } from "@/wab/client/components/docs/serialize-docs-preview";
import { mkUuid, spawn } from "@/wab/shared/common";
import { createStore } from "zustand/vanilla";

/** One mounted example; no asynchronous work is started during render. */
export class CodePreviewCtx {
  readonly uuid = mkUuid();
  private readonly state;
  readonly store;
  constructor(code: string) {
    this.state = createStore(() => code);
    this.store = {
      getState: this.state.getState,
      getInitialState: this.state.getInitialState,
      subscribe: this.state.subscribe,
    };
  }
  getCode() {
    return this.store.getState();
  }
  setCode(code: string) {
    this.state.setState(code, true);
  }
  formatInitialCode() {
    const initial = this.store.getInitialState();
    let active = true;
    spawn(
      Promise.resolve().then(async () => {
        // StrictMode cleanup can cancel before expensive formatting starts.
        if (!active || this.getCode() !== initial) {
          return;
        }
        const formatted = await formatDocsCode(initial);
        if (active && this.getCode() === initial) {
          this.setCode(formatted);
        }
      }),
    );
    return () => {
      active = false;
    };
  }
}
