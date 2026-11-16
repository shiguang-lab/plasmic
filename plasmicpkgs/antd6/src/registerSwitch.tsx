import { Switch } from "antd";
import type { SwitchSemanticType } from "antd/es/switch";
import React from "react";
import { switchComponentName } from "./names";
import { semanticAppearance } from "./semantic-appearance";
import { Registerable, registerComponentHelper } from "./utils";

export function AntdSwitch(props: React.ComponentProps<typeof Switch>) {
  return <Switch {...props} />;
}
AntdSwitch.__plasmicFormFieldMeta = { valueProp: "checked" };

export function registerSwitch(loader?: Registerable) {
  registerComponentHelper(loader, AntdSwitch, {
    description: "Toggle a boolean setting between on and off, with checked and change-event bindings.",
    name: switchComponentName,
    displayName: "Switch",
    props: {
      checked: {
        type: "boolean",
        editOnly: true,
        uncontrolledProp: "defaultChecked",
        description: "Whether the switch is toggled on",
        defaultValueHint: false,
        hidden: (ps: any) => !!ps.__plasmicFormField,
      },
      disabled: {
        type: "boolean",
        description: "If switch is disabled",
        defaultValueHint: false,
      },
      autoFocus: {
        type: "boolean",
        description: "If get focus when component mounted",
        defaultValueHint: false,
        advanced: true,
      },
      ...semanticAppearance(
        {
          root: "Switch container",
          content: "Content",
          indicator: "Thumb indicator",
        } satisfies Record<
          keyof NonNullable<SwitchSemanticType["classNames"]>,
          string
        >,
        { advanced: true },
      ),
      onChange: {
        type: "eventHandler",
        argTypes: [{ name: "checked", type: "boolean" }],
      } as any,
    },
    states: {
      checked: {
        type: "writable",
        valueProp: "checked",
        onChangeProp: "onChange",
        variableType: "boolean",
        hidden: (ps: any) => !!ps.__plasmicFormField,
      },
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerSwitch",
    importName: "AntdSwitch",
  });
}
