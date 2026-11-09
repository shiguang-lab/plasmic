import * as React from "react";

class PlasmicRefs {
  private readonly refs: Record<string, unknown> = {};
  private readonly callbacks = new Map<string, (value: unknown) => () => void>();
  private readonly registrations = new Map<string, object>();

  getRefs = (): Readonly<Record<string, unknown>> => this.refs;
  registerRef = (name: string) => {
    let callback = this.callbacks.get(name);
    if (!callback) {
      callback = (value: unknown) => {
        const registration = {};
        this.registrations.set(name, registration);
        Object.defineProperty(this.refs, name, { value, enumerable: true, writable: true, configurable: true });
        return () => {
          if (this.registrations.get(name) === registration) {
            this.registrations.delete(name);
            this.refs[name] = null;
          }
        };
      };
      this.callbacks.set(name, callback);
    }
    return callback;
  };
}

/** Imperative refs are commands, not render inputs. Read the canonical record
 * inside an event; later reads after an await still see the latest registration. */
export function usePlasmicRefs() {
  const [source] = React.useState(() => new PlasmicRefs());
  return { getRefs: source.getRefs, registerRef: source.registerRef };
}
