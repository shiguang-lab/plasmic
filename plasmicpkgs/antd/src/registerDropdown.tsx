import registerComponent, {
  CodeComponentMeta,
} from "@plasmicapp/host/registerComponent";
import { Dropdown as AntdDropdown } from "antd";
import type { DropdownButtonProps, DropdownProps } from "antd/es/dropdown";

import { Registerable } from "./registerable";

export const DropdownButton: typeof AntdDropdown.Button = AntdDropdown.Button;
export const Dropdown: typeof AntdDropdown = AntdDropdown;

export const dropdownMeta: CodeComponentMeta<DropdownProps> = {
  name: "AntdDropdown",
  displayName: "Antd Dropdown",
  props: {
    arrow: {
      type: "boolean",
      description: "Whether the dropdown arrow should be visible",
      defaultValueHint: false,
    },
    disabled: {
      type: "boolean",
      description: "Whether the dropdown menu is disabled",
      defaultValueHint: false,
    },
    popupRender: {
      type: "slot",
      renderPropParams: ["menus"],
      allowedComponents: ["AntdMenu"],
      defaultValue: [
        {
          type: "component",
          name: "AntdMenu",
        },
      ],
    },
    placement: {
      type: "choice",
      options: [
        "bottomLeft",
        "bottom",
        "bottomRight",
        "topLeft",
        "top",
        "topRight",
      ],
      description: "Placement of popup menu",
      defaultValueHint: "bottomLeft",
    },
    trigger: {
      type: "choice",
      multiSelect: true,
      options: ["click", "hover", "contextMenu"],
      description: "The trigger mode which executes the dropdown action",
      defaultValueHint: ["hover"],
    },
    open: {
      type: "boolean",
      description: "Toggle visibility of dropdown menu in Plasmic Editor",
      editOnly: true,
      defaultValueHint: false,
    },
    onOpenChange: {
      type: "eventHandler",
      argTypes: [
        { name: "open", type: "boolean" },
        { name: "info", type: "object" },
      ],
    },
    children: {
      type: "slot",
      defaultValue: [
        {
          type: "text",
          value: "Dropdown",
        },
      ],
    },
  },
  importPath: "@plasmicpkgs/antd/skinny/registerDropdown",
  importName: "Dropdown",
};

export function registerDropdown(
  loader?: Registerable,
  customDropdownMeta?: CodeComponentMeta<DropdownProps>
) {
  const doRegisterComponent: typeof registerComponent = (...args) =>
    loader ? loader.registerComponent(...args) : registerComponent(...args);
  doRegisterComponent(Dropdown, customDropdownMeta ?? dropdownMeta);
}

export const dropdownButtonMeta: CodeComponentMeta<DropdownButtonProps> = {
  name: "AntdDropdownButton",
  displayName: "Antd Dropdown Button",
  props: {
    disabled: {
      type: "boolean",
      description: "Whether the dropdown menu is disabled",
      defaultValueHint: false,
    },
    icon: {
      type: "slot",
      hidePlaceholder: true,
    },
    popupRender: {
      type: "slot",
      renderPropParams: ["menus"],
      allowedComponents: ["AntdMenu"],
      defaultValue: [
        {
          type: "component",
          name: "AntdMenu",
        },
      ],
    },
    placement: {
      type: "choice",
      options: [
        "bottomLeft",
        "bottom",
        "bottomRight",
        "topLeft",
        "top",
        "topRight",
      ],
      description: "Placement of popup menu",
      defaultValueHint: "bottomLeft",
    },
    size: {
      type: "choice",
      options: ["small", "middle", "large"],
      description: "Set the size of button",
      defaultValueHint: "middle",
    },
    trigger: {
      type: "choice",
      multiSelect: true,
      options: ["click", "hover", "contextMenu"],
      description: "The trigger mode which executes the dropdown action",
      defaultValueHint: ["hover"],
    },
    type: {
      type: "choice",
      options: ["default", "primary", "dashed", "link", "text"],
      description: "Can be set to primary, dashed, link, text, default",
      defaultValueHint: "default",
    },
    open: {
      type: "boolean",
      description: "Toggle visibility of dropdown menu in Plasmic Editor",
      editOnly: true,
      defaultValueHint: false,
    },
    onOpenChange: {
      type: "eventHandler",
      argTypes: [
        { name: "open", type: "boolean" },
        { name: "info", type: "object" },
      ],
    },
    children: {
      type: "slot",
      defaultValue: [
        {
          type: "text",
          value: "Dropdown",
        },
      ],
    },
  },
  importPath: "@plasmicpkgs/antd/skinny/registerDropdown",
  importName: "DropdownButton",
  parentComponentName: "AntdDropdown",
};

export function registerDropdownButton(
  loader?: Registerable,
  customDropdownButtonMeta?: CodeComponentMeta<DropdownButtonProps>
) {
  const doRegisterComponent: typeof registerComponent = (...args) =>
    loader ? loader.registerComponent(...args) : registerComponent(...args);
  doRegisterComponent(
    DropdownButton,
    customDropdownButtonMeta ?? dropdownButtonMeta
  );
}
