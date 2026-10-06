'use strict';

var Ant = require('antd');
var React = require('react');
var names = require('./names-DbJduus8.cjs.js');
var utils = require('./utils-DFFF-Zj5.cjs.js');
require('@plasmicapp/host/registerComponent');
require('@plasmicapp/host/registerGlobalContext');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var React__default = /*#__PURE__*/_interopDefault(React);

function AntdCheckbox(props) {
  const { onChange, ...rest } = props;
  const wrappedOnChange = React__default.default.useMemo(() => {
    if (onChange) {
      return (event) => onChange(event.target.checked);
    } else {
      return void 0;
    }
  }, [onChange]);
  return /* @__PURE__ */ React__default.default.createElement(Ant.Checkbox, { ...rest, onChange: wrappedOnChange });
}
AntdCheckbox.__plasmicFormFieldMeta = { valueProp: "checked" };
const AntdCheckboxGroup = Ant.Checkbox.Group;
function registerCheckbox(loader) {
  utils.registerComponentHelper(loader, AntdCheckbox, {
    name: names.checkboxComponentName,
    displayName: "Checkbox",
    props: {
      checked: {
        type: "boolean",
        editOnly: true,
        uncontrolledProp: "defaultChecked",
        description: "Specifies the initial state: whether or not the checkbox is selected",
        defaultValueHint: false,
        hidden: (ps) => !!ps.__plasmicFormField
      },
      disabled: {
        type: "boolean",
        description: "If checkbox is disabled",
        defaultValueHint: false
      },
      indeterminate: {
        type: "boolean",
        description: "The indeterminate checked state of checkbox",
        defaultValueHint: false
      },
      autoFocus: {
        type: "boolean",
        description: "If get focus when component mounted",
        defaultValueHint: false,
        advanced: true
      },
      children: {
        type: "slot",
        defaultValue: [
          {
            type: "text",
            value: "Checkbox"
          }
        ],
        ...{ mergeWithParent: true }
      },
      onChange: {
        type: "eventHandler",
        argTypes: [{ name: "checked", type: "boolean" }]
      }
    },
    states: {
      checked: {
        type: "writable",
        valueProp: "checked",
        onChangeProp: "onChange",
        variableType: "boolean",
        hidden: (ps) => !!ps.__plasmicFormField
      }
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerCheckbox",
    importName: "AntdCheckbox"
  });
  utils.registerComponentHelper(loader, AntdCheckboxGroup, {
    name: names.checkboxGroupComponentName,
    displayName: "Checkbox Group",
    props: {
      value: {
        type: "choice",
        editOnly: true,
        uncontrolledProp: "defaultValue",
        description: "Default selected value",
        multiSelect: true,
        options: (ps) => {
          const options = /* @__PURE__ */ new Set();
          utils.traverseReactEltTree(ps.children, (elt) => {
            if (elt?.type === AntdCheckbox && typeof elt?.props?.value === "string") {
              options.add(elt.props.value);
            }
          });
          return Array.from(options.keys());
        }
      },
      disabled: {
        type: "boolean",
        description: "Disables all checkboxes",
        defaultValueHint: false
      },
      children: {
        type: "slot",
        allowedComponents: [names.checkboxComponentName]
        // Error right now when using default slot content with stateful instances
        // defaultValue: [
        //   {
        //     type: "component",
        //     name: "plasmic-antd6-checkbox",
        //   },
        // ],
      },
      onChange: {
        type: "eventHandler",
        argTypes: [{ name: "value", type: "object" }]
      }
    },
    states: {
      value: {
        type: "writable",
        valueProp: "value",
        onChangeProp: "onChange",
        variableType: "array",
        hidden: (ps) => !!ps.__plasmicFormField
      }
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerCheckbox",
    importName: "AntdCheckboxGroup",
    parentComponentName: names.checkboxComponentName
  });
}

exports.AntdCheckbox = AntdCheckbox;
exports.AntdCheckboxGroup = AntdCheckboxGroup;
exports.registerCheckbox = registerCheckbox;
//# sourceMappingURL=registerCheckbox.cjs.js.map
