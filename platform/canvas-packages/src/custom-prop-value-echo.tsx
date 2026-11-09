import type { CustomControl } from "@plasmicapp/host/dist/prop-types";
import * as React from "react";

/** Keeps local edits visible while Studio asynchronously commits model writes. */
export function CustomPropValueEcho(props: {
  impl: CustomControl<any>;
  value: any;
  onChange: (value: any) => void;
  controlProps: any;
}) {
  const key = JSON.stringify(props.value);
  const [state, setState] = React.useState(() => ({
    local: props.value,
    lastPropKey: key,
    pending: [] as (string | undefined)[],
  }));
  if (key !== state.lastPropKey) {
    const acknowledged = state.pending.indexOf(key);
    setState({
      local: acknowledged < 0 ? props.value : state.local,
      lastPropKey: key,
      pending: acknowledged < 0 ? [] : state.pending.slice(acknowledged + 1),
    });
  }
  const Control = props.impl;
  return <Control
    {...props.controlProps}
    value={state.local}
    updateValue={(value: any) => {
      const nextKey = JSON.stringify(value);
      setState((previous) => ({
        ...previous,
        local: value,
        pending: [...previous.pending, nextKey],
      }));
      props.onChange(value);
    }}
  />;
}
