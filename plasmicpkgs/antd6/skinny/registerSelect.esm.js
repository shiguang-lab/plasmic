import "@plasmicapp/host";
import "@plasmicapp/host/registerComponent";
import "@plasmicapp/host/registerGlobalContext";
import { Select } from "antd";
import cls from "classnames";
import React from "react";
import {
  p as previewOpenProp,
  u as useCanvasOverlay,
} from "./canvas-overlay-BurdwRe9.esm.js";
import {
  o as optionComponentName,
  h as optionGroupComponentName,
  s as selectComponentName,
} from "./names-DKofLcnC.esm.js";
import { r as reactNodeToString } from "./react-utils-BpvCcwyE.esm.js";
import {
  r as registerComponentHelper,
  t as traverseReactEltTree,
} from "./utils-CSvRw6Za.esm.js";

const AntdOption = Select.Option;
const AntdOptionGroup = Select.OptGroup;
function AntdSelect(props) {
  const { props: canvasProps, open, isEditing } = useCanvasOverlay(props);
  const {
    popupRootClassName,
    popupScopeClassName,
    defaultStylesClassName,
    suffixIcon,
    mode,
    useChildren,
    classNames,
    ...rest
  } = canvasProps;
  const curated = { ...rest };
  if (useChildren) {
    curated.options = void 0;
  }
  return /* @__PURE__ */ React.createElement(Select, {
    ...curated,
    open,
    onOpenChange: isEditing ? void 0 : props.onOpenChange,
    onChange: isEditing ? void 0 : props.onChange,
    mode: !mode || mode === "single" ? void 0 : mode,
    classNames: (info) => {
      const names =
        typeof classNames === "function" ? classNames(info) : classNames;
      const popup =
        typeof names?.popup === "string" ? { root: names.popup } : names?.popup;
      return {
        ...names,
        popup: {
          ...popup,
          root: cls(
            popup?.root,
            defaultStylesClassName,
            popupScopeClassName,
            popupRootClassName,
          ),
        },
      };
    },
    optionFilterProp:
      curated.optionFilterProp ?? (curated.options ? "label" : void 0),
    filterOption:
      curated.filterOption ??
      (curated.optionFilterProp
        ? void 0
        : (input, option) =>
            reactNodeToString(
              useChildren
                ? option?.children
                : (option?.label ?? option?.value ?? ""),
            )
              .toLowerCase()
              .includes(input.toLowerCase())),
    suffixIcon,
  });
}
function registerSelect(loader) {
  registerComponentHelper(loader, AntdSelect, {
    name: selectComponentName,
    displayName: "Select",
    props: {
      previewOpen: previewOpenProp,
      options: {
        type: "array",
        hidden: (ps) => !!ps.useChildren,
        itemType: {
          type: "object",
          nameFunc: (item) => item.label || item.value,
          fields: {
            type: {
              type: "choice",
              options: [
                { value: "option", label: "Option" },
                { value: "option-group", label: "Option Group" },
              ],
              defaultValue: "option",
            },
            value: {
              type: "string",
              hidden: (_ps, _ctx, { item }) => item.type !== "option",
            },
            label: "string",
            options: {
              type: "array",
              hidden: (_ps, _ctx, { item }) => {
                return item.type !== "option-group";
              },
              itemType: {
                type: "object",
                nameFunc: (item) => item.label || item.value,
                fields: {
                  value: "string",
                  label: "string",
                },
              },
            },
          },
        },
        defaultValue: [
          {
            value: "option1",
            label: "Option 1",
            type: "option",
          },
          {
            value: "option2",
            label: "Option 2",
            type: "option",
          },
        ],
      },
      useChildren: {
        displayName: "Use slot",
        type: "boolean",
        defaultValueHint: false,
        advanced: true,
        description:
          "Instead of configuring a list of options, customize the contents of the Select by dragging and dropping options in the outline/canvas, inside the 'children' slot. Lets you use any content or formatting within the Options, and also use Option Groups.",
      },
      children: {
        type: "slot",
        allowedComponents: [optionComponentName, optionGroupComponentName],
        hidden: (ps) => !ps.useChildren,
      },
      placeholder: {
        type: "slot",
        defaultValue: "Select...",
      },
      suffixIcon: {
        type: "slot",
        hidePlaceholder: true,
      },
      open: {
        type: "boolean",
        editOnly: true,
        uncontrolledProp: "defaultOpen",
      },
      value: {
        type: "choice",
        displayName: "Selected value",
        editOnly: true,
        uncontrolledProp: "defaultValue",
        description: "Initial selected option",
        multiSelect: (ps) => ps.mode === "multiple" || ps.mode === "tags",
        options: (ps) => {
          const options = /* @__PURE__ */ new Set();
          if (!ps.useChildren) {
            const rec = (op) => {
              if (typeof op === "string") {
                return [{ value: op, label: op }];
              } else if ("options" in op) {
                return (op.options ?? []).flatMap((sub) => rec(sub));
              } else {
                return [{ value: op.value, label: op.label || op.value }];
              }
            };
            return (ps.options ?? []).flatMap((o) => rec(o));
          } else {
            traverseReactEltTree(ps.children, (elt) => {
              if (
                elt?.type === Select.Option &&
                typeof elt?.props?.value === "string"
              ) {
                options.add(elt.props.value);
              }
            });
          }
          return Array.from(options.keys());
        },
        hidden: (ps) => !!ps.__plasmicFormField,
      },
      mode: {
        type: "choice",
        options: ["single", "multiple", "tags"],
        defaultValueHint: "single",
        description:
          "Whether to allow single or multiple selection. Tags mode additionally allows selecting options outside the specified set of options.",
      },
      size: {
        type: "choice",
        options: ["small", "medium", "large"],
      },
      disabled: {
        type: "boolean",
        defaultValueHint: false,
      },
      showSearch: {
        type: "boolean",
        defaultValueHint: (ps) => ps.mode === "multiple" || ps.mode === "tags",
        advanced: true,
      },
      status: {
        type: "choice",
        options: ["error", "warning"],
        advanced: true,
      },
      variant: {
        type: "choice",
        options: ["outlined", "borderless", "filled", "underlined"],
        defaultValueHint: "outlined",
      },
      autoFocus: {
        type: "boolean",
        displayName: "Focus automatically",
        defaultValueHint: false,
        advanced: true,
      },
      onChange: {
        type: "eventHandler",
        argTypes: [
          { name: "value", type: "object" },
          { name: "option", type: "object" },
        ],
      },
      popupMatchSelectWidth: {
        type: "boolean",
        displayName: "Should dropdown match trigger button width?",
        defaultValueHint: true,
        advanced: true,
      },
      allowClear: {
        type: "boolean",
        displayName: "Allow clearing the Select",
        defaultValueHint: false,
        advanced: true,
      },
      triggerClassName: {
        type: "class",
        displayName: "Trigger styles",
        noSelf: true,
        selectors: [
          {
            selector: ":component.ant-select",
            label: "Base",
          },
          {
            selector: ":component.ant-select:hover",
            label: "Hovered",
          },
        ],
        advanced: true,
      },
      popupScopeClassName: {
        type: "styleScopeClass",
        scopeName: "popup",
      },
      popupRootClassName: {
        type: "class",
        displayName: "Popup styles",
        selectors: [],
        advanced: true,
      },
      optionClassName: {
        type: "class",
        displayName: "Option styles",
        noSelf: true,
        selectors: [
          {
            selector: ":popup.ant-select-dropdown .ant-select-item-option",
            label: "Base",
          },
          {
            selector:
              ":popup.ant-select-dropdown .ant-select-item-option-active",
            label: "Focused",
          },
          {
            selector:
              ":popup.ant-select-dropdown .ant-select-item-option-selected",
            label: "Selected",
          },
        ],
        advanced: true,
      },
      placeholderClassName: {
        type: "class",
        displayName: "Placeholder styles",
        selectors: [
          {
            selector: ":component .ant-select-placeholder",
            label: "Base",
          },
        ],
        advanced: true,
      },
      defaultStylesClassName: {
        type: "themeResetClass",
      },
    },
    states: {
      value: {
        type: "writable",
        valueProp: "value",
        onChangeProp: "onChange",
        variableType: "object",
        hidden: (ps) => !!ps.__plasmicFormField,
      },
    },
    ...{ trapsSelection: true },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerSelect",
    importName: "AntdSelect",
  });
  registerComponentHelper(loader, AntdOption, {
    name: optionComponentName,
    displayName: "Option",
    parentComponentName: selectComponentName,
    props: {
      children: {
        type: "slot",
        defaultValue: "Option",
        ...{ mergeWithParent: true },
      },
      value: {
        type: "string",
      },
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerSelect",
    importName: "AntdOption",
  });
  registerComponentHelper(loader, AntdOptionGroup, {
    name: optionGroupComponentName,
    displayName: "Option Group",
    parentComponentName: selectComponentName,
    props: {
      children: {
        type: "slot",
        defaultValue: [
          {
            type: "component",
            name: "plasmic-antd6-option",
            props: {
              value: "option1",
              children: {
                type: "text",
                value: "Option 1",
              },
            },
          },
          {
            type: "component",
            name: "plasmic-antd6-option",
            props: {
              value: "option2",
              children: {
                type: "text",
                value: "Option 1",
              },
            },
          },
        ],
      },
      label: {
        type: "slot",
        defaultValue: "Group label",
      },
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerSelect",
    importName: "AntdOptionGroup",
  });
}

export { AntdOption, AntdOptionGroup, AntdSelect, registerSelect };
//# sourceMappingURL=registerSelect.esm.js.map
