'use strict';

var Ant = require('antd');
var cls = require('classnames');
var dayjs = require('dayjs');
var React = require('react');
var canvasOverlay = require('./canvas-overlay-B42dlSLB.cjs.js');
var utils = require('./utils-DFFF-Zj5.cjs.js');
require('@plasmicapp/host');
require('@plasmicapp/host/registerComponent');
require('@plasmicapp/host/registerGlobalContext');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var cls__default = /*#__PURE__*/_interopDefault(cls);
var dayjs__default = /*#__PURE__*/_interopDefault(dayjs);
var React__default = /*#__PURE__*/_interopDefault(React);

function AntdDatePicker(props) {
  const { props: canvasProps, open, isEditing } = canvasOverlay.useCanvasOverlay(props);
  const { picker, popupScopeClassName, classNames, ...rest } = canvasProps;
  return /* @__PURE__ */ React__default.default.createElement(React__default.default.Fragment, null, /* @__PURE__ */ React__default.default.createElement(
    Ant.DatePicker,
    {
      key: isEditing ? "edit" : "runtime",
      ...rest,
      open,
      onOpenChange: isEditing ? void 0 : props.onOpenChange,
      onCalendarChange: isEditing ? void 0 : props.onCalendarChange,
      onPanelChange: isEditing ? void 0 : props.onPanelChange,
      picker,
      value: props.value === void 0 ? void 0 : !props.value ? null : Array.isArray(props.value) ? props.value.map((value) => dayjs__default.default(value)) : dayjs__default.default(props.value),
      defaultValue: props.defaultValue === void 0 ? void 0 : Array.isArray(props.defaultValue) ? props.defaultValue.map((value) => dayjs__default.default(value)) : dayjs__default.default(props.defaultValue),
      classNames: (info) => {
        const names = typeof classNames === "function" ? classNames(info) : classNames;
        const popup = typeof names?.popup === "string" ? { root: names.popup } : names?.popup;
        return {
          ...names,
          popup: { ...popup, root: cls__default.default(popup?.root, popupScopeClassName) }
        };
      },
      onChange: (value, _dateString) => {
        if (isEditing) return;
        props.onChange?.(
          Array.isArray(value) ? value.map((date) => date.toISOString()) : value?.toISOString() ?? null
        );
      }
    }
  ));
}
const datePickerComponentName = "plasmic-antd6-date-picker";
const datePickerHelpers = {
  states: {
    value: {
      onChangeArgsToValue: (value) => value,
      hidden: (ps) => !!ps.__plasmicFormField
    }
  }
};
function registerDatePicker(loader) {
  utils.registerComponentHelper(loader, AntdDatePicker, {
    name: datePickerComponentName,
    canvasOverlay: {},
    displayName: "DatePicker",
    props: {
      previewOpen: canvasOverlay.previewOpenProp,
      multiple: { type: "boolean", defaultValueHint: false },
      value: {
        type: "object",
        editOnly: true,
        uncontrolledProp: "defaultValue",
        description: "The current date/time as an ISO string, Date object, or dayjs object",
        hidden: (ps) => !!ps.__plasmicFormField
      },
      disabled: {
        type: "boolean",
        defaultValueHint: false
      },
      autoFocus: {
        type: "boolean",
        description: "Focus when component is rendered",
        defaultValueHint: false,
        advanced: true
      },
      onChange: {
        type: "eventHandler",
        argTypes: [{ name: "value", type: "object" }]
      },
      picker: {
        type: "choice",
        options: ["date", "week", "month", "quarter", "year"].map((value) => ({
          value,
          label: utils.capitalize(value)
        })),
        defaultValueHint: "date"
      },
      popupScopeClassName: {
        type: "styleScopeClass",
        scopeName: "datePickerPopup"
      },
      popupRootClassName: {
        type: "class",
        displayName: "Popup container",
        selectors: [
          {
            selector: ":datePickerPopup .ant-picker-panel-container",
            label: "Base"
          }
        ]
      },
      popupHeaderClassName: {
        type: "class",
        displayName: "Popup header",
        selectors: [
          {
            selector: ":datePickerPopup .ant-picker-header",
            label: "Base"
          }
        ]
      },
      popupBodyClassName: {
        type: "class",
        displayName: "Popup body",
        selectors: [
          {
            selector: ":datePickerPopup .ant-picker-body",
            label: "Base"
          }
        ]
      },
      popupFooterClassName: {
        type: "class",
        displayName: "Popup footer",
        selectors: [
          {
            selector: ":datePickerPopup .ant-picker-footer",
            label: "Base"
          }
        ]
      },
      showTime: {
        type: "boolean",
        description: "Enable time selection"
      },
      variant: {
        type: "choice",
        options: ["outlined", "borderless", "filled", "underlined"],
        defaultValueHint: "outlined"
      },
      // TODO - see how it works with plasmic-rich-components
      // format: {
      //   advanced: true
      // },
      showNow: {
        type: "boolean",
        advanced: true,
        description: 'Whether to show the "Now" button',
        defaultValueHint: true,
        hidden: (ps) => !ps.showTime
      },
      showToday: {
        type: "boolean",
        advanced: true,
        description: 'Whether to show the "Today" button',
        defaultValueHint: true,
        hidden: (ps) => ps.showTime
      },
      // disabledDate: {
      //   type: "function",
      //   advanced: true,
      //   description: "Dates to disable",
      // },
      // disabledTime: {
      //   type: "function",
      //   advanced: true,
      //   description: "Times to disable",
      // },
      allowClear: {
        type: "boolean",
        advanced: true,
        description: "Whether to show the clear button"
      }
    },
    states: {
      value: {
        type: "writable",
        valueProp: "value",
        onChangeProp: "onChange",
        variableType: "object",
        ...datePickerHelpers.states.value
      }
    },
    componentHelpers: {
      helpers: datePickerHelpers,
      importName: "datePickerHelpers",
      importPath: "@shiguang-lab/plasmic-antd6/skinny/registerDatePicker"
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerDatePicker",
    importName: "AntdDatePicker"
  });
}

exports.AntdDatePicker = AntdDatePicker;
exports.datePickerComponentName = datePickerComponentName;
exports.datePickerHelpers = datePickerHelpers;
exports.registerDatePicker = registerDatePicker;
//# sourceMappingURL=registerDatePicker.cjs.js.map
