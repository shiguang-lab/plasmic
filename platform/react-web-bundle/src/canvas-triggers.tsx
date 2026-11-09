import * as React from "react";
import { useHover, usePressed, useFocused, useFocusVisible, useFocusedWithin, useFocusVisibleWithin } from "@plasmicapp/react-web";

export type CanvasTriggerName = "useHover" | "usePressed" | "useFocused" | "useFocusVisible" | "useFocusedWithin" | "useFocusVisibleWithin";
export interface CanvasTriggerStep {
  readonly group: string;
  readonly hook: CanvasTriggerName;
  readonly opposite: boolean;
  readonly propName: string;
}
export interface CanvasTriggerResult {
  readonly interactive: boolean;
  readonly triggers: Record<string, boolean>;
  readonly triggerProps: Record<string, React.HTMLAttributes<HTMLElement>>;
}
export interface CanvasTriggersProps<Policy extends { readonly interactive: boolean }> {
  readonly policy: { getState(): Policy; subscribe(listener: () => void): () => void };
  readonly steps: readonly CanvasTriggerStep[];
  readonly render: (result: CanvasTriggerResult) => React.ReactNode;
}
interface TriggerChainProps {
  readonly steps: readonly CanvasTriggerStep[];
  readonly index: number;
  readonly result: CanvasTriggerResult;
  readonly render: (result: CanvasTriggerResult) => React.ReactNode;
}
export function CanvasTriggersRuntime<Policy extends { readonly interactive: boolean }>({ policy, steps, render }: CanvasTriggersProps<Policy>) {
  const { interactive } = React.useSyncExternalStore(policy.subscribe, policy.getState, policy.getState);
  return <CanvasTriggerChain steps={steps} index={0} result={{ interactive, triggers: {}, triggerProps: {} }} render={render} />;
}
function CanvasTriggerChain(props: TriggerChainProps) {
  const step = props.steps[props.index];
  if (!step) { return props.render(props.result); }
  switch (step.hook) {
    case "useHover": return <CanvasHoverTrigger {...props} />;
    case "usePressed": return <CanvasPressedTrigger {...props} />;
    case "useFocused": return <CanvasFocusedTrigger {...props} />;
    case "useFocusVisible": return <CanvasFocusVisibleTrigger {...props} />;
    case "useFocusedWithin": return <CanvasFocusedWithinTrigger {...props} />;
    case "useFocusVisibleWithin": return <CanvasFocusVisibleWithinTrigger {...props} />;
  }
}
function continueTriggerChain(props: TriggerChainProps, active: boolean, eventProps: React.HTMLAttributes<HTMLElement>) {
  const step = props.steps[props.index];
  const previous = props.result.triggers[step.group] ?? props.result.interactive;
  const triggered = previous && (step.opposite ? !active : active);
  const result: CanvasTriggerResult = {
    ...props.result,
    triggers: { ...props.result.triggers, [step.group]: triggered },
    triggerProps: { ...props.result.triggerProps, [step.propName]: eventProps },
  };
  return <CanvasTriggerChain {...props} index={props.index + 1} result={result} />;
}
function CanvasHoverTrigger(props: TriggerChainProps) {
  const [active, eventProps] = useHover();
  return continueTriggerChain(props, active, eventProps);
}
function CanvasPressedTrigger(props: TriggerChainProps) {
  const [active, eventProps] = usePressed();
  return continueTriggerChain(props, active, eventProps);
}
function CanvasFocusedTrigger(props: TriggerChainProps) {
  const [active, eventProps] = useFocused({});
  return continueTriggerChain(props, active, eventProps);
}
function CanvasFocusVisibleTrigger(props: TriggerChainProps) {
  const [active, eventProps] = useFocusVisible({});
  return continueTriggerChain(props, active, eventProps);
}
function CanvasFocusedWithinTrigger(props: TriggerChainProps) {
  const [active, eventProps] = useFocusedWithin({});
  return continueTriggerChain(props, active, eventProps);
}
function CanvasFocusVisibleWithinTrigger(props: TriggerChainProps) {
  const [active, eventProps] = useFocusVisibleWithin({});
  return continueTriggerChain(props, active, eventProps);
}
