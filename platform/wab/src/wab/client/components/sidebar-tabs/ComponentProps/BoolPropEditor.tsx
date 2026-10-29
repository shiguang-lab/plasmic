import { ValueSetState } from "@/wab/client/components/sidebar/sidebar-helpers";
import StyleSwitch from "@/wab/client/components/style-controls/StyleSwitch";
import React from "react";

export function BoolPropEditor(props: {
  onChange: (value: boolean) => void;
  value: boolean | undefined;
  defaultValueHint?: boolean;
  valueSetState?: ValueSetState;
  disabled?: boolean;
  "data-plasmic-prop"?: string;
  "aria-label"?: string;
}) {
  return (
    <div className="flex justify-start">
      <StyleSwitch
        isChecked={props.value ?? props.defaultValueHint ?? false}
        onChange={(checked) => props.onChange(checked)}
        valueSetState={props.valueSetState}
        isDisabled={props.disabled}
        data-plasmic-prop={props["data-plasmic-prop"]}
        aria-label={props["aria-label"]}
      >
        {null}
      </StyleSwitch>
    </div>
  );
}
