"use strict";

var Ant = require("antd");
var cls = require("classnames");
var dayjs = require("dayjs");
var kebabCase = require("lodash/kebabCase");
var React = require("react");
var utils = require("./utils-CRCm44nj.cjs.js");
var localeData = require("dayjs/plugin/localeData");
var weekday = require("dayjs/plugin/weekday");
require("@plasmicapp/host/registerComponent");
require("@plasmicapp/host/registerGlobalContext");

function _interopDefault(e) {
  return e && e.__esModule ? e : { default: e };
}

var cls__default = /*#__PURE__*/ _interopDefault(cls);
var dayjs__default = /*#__PURE__*/ _interopDefault(dayjs);
var kebabCase__default = /*#__PURE__*/ _interopDefault(kebabCase);
var React__default = /*#__PURE__*/ _interopDefault(React);
var localeData__default = /*#__PURE__*/ _interopDefault(localeData);
var weekday__default = /*#__PURE__*/ _interopDefault(weekday);

dayjs__default.default.extend(weekday__default.default);
dayjs__default.default.extend(localeData__default.default);
const RangePicker = Ant.DatePicker.RangePicker;
function getDayjsRange(dateRange) {
  return Array.isArray(dateRange)
    ? [
        dateRange[0] ? dayjs__default.default(dateRange[0]) : null,
        dateRange[1] ? dayjs__default.default(dateRange[1]) : null,
      ]
    : [null, null];
}
function getStrRange(dateRange) {
  return Array.isArray(dateRange)
    ? dateRange.map((date) =>
        date && !(typeof date === "string") && "toISOString" in date
          ? date.toISOString()
          : date === null
            ? void 0
            : date,
      )
    : void 0;
}
function AntdDateRangePicker(props) {
  const {
    defaultStartDate,
    defaultEndDate,
    value,
    defaultValue,
    startDate,
    endDate,
    allowEmpty,
    allowEmptyEndDate,
    allowEmptyStartDate,
    disabled,
    renderExtraFooter,
    disableStartDate,
    disableEndDate,
    presets,
    picker,
    placeholder,
    onChange,
    popupScopeClassName,
    className,
    classNames,
    ...rest
  } = props;
  const presetsDayjs = React.useMemo(
    () =>
      presets
        ?.map((p) => ({ ...p, value: getDayjsRange([p.startDate, p.endDate]) }))
        .filter((p) => p.value[0]?.isValid() && p.value[1]?.isValid()),
    [presets],
  );
  return /* @__PURE__ */ React__default.default.createElement(
    React__default.default.Fragment,
    null,
    /* @__PURE__ */ React__default.default.createElement(RangePicker, {
      ...rest,
      picker,
      presets: presetsDayjs,
      allowEmpty:
        allowEmpty !== void 0
          ? [allowEmpty, allowEmpty]
          : [allowEmptyStartDate, allowEmptyEndDate],
      value:
        value !== void 0
          ? value === null
            ? null
            : getDayjsRange(value)
          : startDate !== void 0 || endDate !== void 0
            ? getDayjsRange([startDate, endDate])
            : void 0,
      defaultValue:
        defaultValue !== void 0
          ? defaultValue
          : defaultStartDate !== void 0 || defaultEndDate !== void 0
            ? getDayjsRange([defaultStartDate, defaultEndDate])
            : void 0,
      renderExtraFooter: renderExtraFooter ? () => renderExtraFooter : void 0,
      className,
      disabled:
        disabled ??
        (disableStartDate !== void 0 || disableEndDate !== void 0
          ? [!!disableStartDate, !!disableEndDate]
          : void 0),
      placeholder: placeholder?.split(/,\s*/).slice(0, 2),
      classNames: (info) => {
        const names =
          typeof classNames === "function" ? classNames(info) : classNames;
        const popup =
          typeof names?.popup === "string"
            ? { root: names.popup }
            : names?.popup;
        return {
          ...names,
          popup: {
            ...popup,
            root: cls__default.default(popup?.root, popupScopeClassName),
          },
        };
      },
      onChange: (values, _dateStrings) => {
        onChange?.(getStrRange(values) || [null, null]);
      },
    }),
  );
}
const dateRangePickerComponentName = "plasmic-antd6-date-range-picker";
const dateRangePickerHelpers = {
  states: {
    startDate: {
      onChangeArgsToValue: (value) => value[0],
      hidden: (ps) => !!ps.__plasmicFormField,
    },
    endDate: {
      onChangeArgsToValue: (value) => value[1],
      hidden: (ps) => !!ps.__plasmicFormField,
    },
  },
};
function registerDateRangePicker(loader) {
  utils.registerComponentHelper(loader, AntdDateRangePicker, {
    name: dateRangePickerComponentName,
    displayName: "Date Range Picker",
    props: {
      inputReadOnly: { type: "boolean", defaultValueHint: false },
      startDate: {
        type: "dateString",
        editOnly: true,
        uncontrolledProp: "defaultStartDate",
        description: "The default start date as ISO strings",
        // TODO: Can there be a default validator attached to each prop type, so dynamic values can be checked?
        hidden: (ps) => !!ps.__plasmicFormField,
      },
      endDate: {
        type: "dateString",
        editOnly: true,
        uncontrolledProp: "defaultEndDate",
        description: "The default end date as ISO strings",
        // TODO: Can there be a default validator attached to each prop type, so dynamic values can be checked?
        hidden: (ps) => !!ps.__plasmicFormField,
      },
      allowClear: {
        type: "boolean",
        advanced: true,
        defaultValueHint: true,
        description: "Whether to show the clear button",
      },
      autoFocus: {
        type: "boolean",
        description: "Focus when component is rendered",
        defaultValueHint: false,
        advanced: true,
      },
      variant: {
        type: "choice",
        options: ["outlined", "borderless", "filled", "underlined"],
        defaultValueHint: "outlined",
      },
      changeOnBlur: {
        type: "boolean",
        advanced: true,
        description:
          "Trigger change when blur. e.g. datetime picker no need click confirm button",
        defaultValueHint: false,
        hidden: (ps) => !ps.showTime,
      },
      disabled: {
        type: "boolean",
        description: "Disable date range inputs",
        defaultValueHint: false,
      },
      disableStartDate: {
        type: "boolean",
        defaultValueHint: false,
        advanced: true,
        description: "Disable start date input only",
        hidden: (ps) => ps.disabled,
      },
      disableEndDate: {
        type: "boolean",
        defaultValueHint: false,
        advanced: true,
        description: "Disable end date input only",
        hidden: (ps) => ps.disabled,
      },
      picker: {
        type: "choice",
        options: ["date", "week", "month", "quarter", "year"].map((value) => ({
          value,
          label: utils.capitalize(value),
        })),
        defaultValueHint: "date",
      },
      placeholder: {
        type: "string",
        advanced: true,
        defaultValueHint: "Start date, End date",
        description:
          "The placeholders of the start and end date inputs, separated by a comma",
      },
      placement: {
        type: "choice",
        options: ["bottomLeft", "bottomRight", "topLeft", "topRight"].map(
          (value) => ({
            value,
            label: kebabCase__default.default(value),
          }),
        ),
        advanced: true,
        defaultValueHint: "bottom-left",
        description: "The position where the selection box pops up",
      },
      presets: {
        type: "array",
        advanced: true,
        description: "The preset ranges for quick selection",
        itemType: {
          type: "object",
          nameFunc: (item) => item.label,
          fields: {
            label: "string",
            startDate: {
              type: "dateString",
            },
            endDate: {
              type: "dateString",
            },
          },
        },
      },
      size: {
        type: "choice",
        advanced: true,
        options: ["small", "medium", "large"].map((value) => ({
          value,
          label: utils.capitalize(value),
        })),
        defaultValueHint: "medium",
      },
      status: {
        type: "choice",
        advanced: true,
        options: ["error", "warning"].map((value) => ({
          value,
          label: utils.capitalize(value),
        })),
        description: "Set validation status",
      },
      allowEmpty: {
        type: "boolean",
        advanced: true,
        description: "Allow leaving start or end input empty",
        defaultValueHint: false,
      },
      allowEmptyStartDate: {
        type: "boolean",
        advanced: true,
        description: "Allow leaving start input empty",
        defaultValueHint: false,
        hidden: (ps) => ps.allowEmpty,
      },
      allowEmptyEndDate: {
        type: "boolean",
        advanced: true,
        description: "Allow leaving end input empty",
        defaultValueHint: false,
        hidden: (ps) => ps.allowEmpty,
      },
      renderExtraFooter: {
        type: "slot",
        displayName: "Extra footer",
        hidePlaceholder: true,
      },
      showTime: {
        type: "boolean",
        description: "Enable time selection",
        defaultValueHint: false,
        hidden: (ps) => ps.picker !== void 0 && ps.picker !== "date",
      },
      popupScopeClassName: {
        type: "styleScopeClass",
        scopeName: "dateRangePickerPopup",
      },
      popupRootClassName: {
        type: "class",
        displayName: "Popup container",
        selectors: [
          {
            selector: ":dateRangePickerPopup .ant-picker-panel-container",
            label: "Base",
          },
        ],
      },
      popupHeaderClassName: {
        type: "class",
        displayName: "Popup header",
        selectors: [
          {
            selector: ":dateRangePickerPopup .ant-picker-header",
            label: "Base",
          },
        ],
      },
      popupBodyClassName: {
        type: "class",
        displayName: "Popup body",
        selectors: [
          {
            selector: ":dateRangePickerPopup .ant-picker-body",
            label: "Base",
          },
        ],
      },
      popupFooterClassName: {
        type: "class",
        displayName: "Popup footer",
        selectors: [
          {
            selector: ":dateRangePickerPopup .ant-picker-footer",
            label: "Base",
          },
        ],
      },
      onChange: {
        type: "eventHandler",
        advanced: true,
        argTypes: [{ name: "value", type: "object" }],
      },
    },
    states: {
      startDate: {
        type: "writable",
        valueProp: "startDate",
        onChangeProp: "onChange",
        variableType: "text",
        ...dateRangePickerHelpers.states.startDate,
      },
      endDate: {
        type: "writable",
        valueProp: "endDate",
        onChangeProp: "onChange",
        variableType: "text",
        ...dateRangePickerHelpers.states.endDate,
      },
    },
    componentHelpers: {
      helpers: dateRangePickerHelpers,
      importName: "dateRangePickerHelpers",
      importPath: "@shiguang-lab/plasmic-antd6/skinny/registerDateRangePicker",
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerDateRangePicker",
    importName: "AntdDateRangePicker",
  });
}

exports.AntdDateRangePicker = AntdDateRangePicker;
exports.dateRangePickerComponentName = dateRangePickerComponentName;
exports.dateRangePickerHelpers = dateRangePickerHelpers;
exports.registerDateRangePicker = registerDateRangePicker;
//# sourceMappingURL=registerDateRangePicker.cjs.js.map
