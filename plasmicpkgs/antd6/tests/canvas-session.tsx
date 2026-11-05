import { PlasmicCanvasContext } from "@plasmicapp/host";
import React from "react";
import { applyCanvasSessionState, CanvasSessionState } from "../../../platform/wab/src/wab/client/components/canvas/canvas-session-state";
import type { Registerable } from "../src/utils";

/** Exercise the same state binder as Studio with actual registration metadata. */
export function createSessionCanvas(registers: ((loader: Registerable) => void)[]) {
  const registry = new Map<any, any>();
  for (const register of registers) {
    register({ registerComponent: (component, meta) => registry.set(component, meta) } as Registerable);
  }
  return function Canvas({ children, interactive = false }: { children: React.ReactNode; interactive?: boolean }) {
    const [session] = React.useState(() => new CanvasSessionState());
    const [, redraw] = React.useReducer((version) => version + 1, 0);
    const bind = (nodes: React.ReactNode, parent: string): React.ReactNode => React.Children.map(nodes, (node, index) => {
      if (!React.isValidElement(node)) {return node;}
      const instance = parent + "/" + (node.key ?? index);
      const props = { ...node.props };
      const meta = registry.get(node.type);
      if (meta) {
        const specs = Object.values<any>(meta.states ?? {}).filter((state) => state.type === "writable").map((state) => ({
          ...state,
          initialValueProp: state.initialValueProp ?? meta.props[state.valueProp]?.uncontrolledProp,
          controlled: props[state.valueProp] !== undefined && !meta.props[state.valueProp]?.editOnly,
        }));
        if (meta.canvasOverlay && !interactive) {
          const selection = props.__plasmic_selection_prop__;
          session.resolve(instance, "open", props.open, props.defaultOpen);
          props.previewOpen = session.reveal(instance, "open", props.previewOpen ?? (!!props.open || !!selection?.isSelected && (!meta.canvasOverlay.triggerSlot || selection.selectedSlotName !== meta.canvasOverlay.triggerSlot)));
        }
        const states = applyCanvasSessionState(session, instance, props, specs, interactive, redraw, !!meta.canvasOverlay);
        props.__plasmic_selection_prop__ = { ...props.__plasmic_selection_prop__, states };
      } else if (props.children && typeof props.children !== "function") {
        props.children = bind(props.children, instance);
      }
      return React.cloneElement(node, props);
    });
    return <PlasmicCanvasContext.Provider value={{ componentName: "test", globalVariants: {}, interactive }}>{bind(children, "root")}</PlasmicCanvasContext.Provider>;
  };
}
