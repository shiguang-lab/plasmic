'use strict';

var dataSources = require('@plasmicapp/data-sources');
var Ant = require('antd');
var React = require('react');
var registerCheckbox = require('./registerCheckbox.cjs.js');
var registerDatePicker = require('./registerDatePicker.cjs.js');
var registerRadio = require('./registerRadio.cjs.js');
var registerSelect = require('./registerSelect.cjs.js');
var utils = require('./utils-DDtpTQdQ.cjs.js');
var Form = require('./Form.cjs.js');
var FormItem = require('./FormItem.cjs.js');
require('./names-DbJduus8.cjs.js');
require('classnames');
require('dayjs');
require('./canvas-overlay-x9v6z73H.cjs.js');
require('@plasmicapp/host');
require('./react-utils-CP3JYj1p.cjs.js');
require('@plasmicapp/host/registerComponent');
require('@plasmicapp/host/registerGlobalContext');
require('fast-deep-equal');
require('./contexts-DbLDJr3k.cjs.js');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var React__default = /*#__PURE__*/_interopDefault(React);

function deriveFormFieldConfigs(dataFormItems, schema, data) {
  return dataSources.deriveFieldConfigs(
    dataFormItems,
    schema,
    (field) => ({
      inputType: Form.InputType.Text,
      ...field && {
        key: field.id,
        fieldId: field.id,
        label: field.label ?? field.id,
        name: field.id,
        inputType: field.type === "string" ? Form.InputType.Text : field.type === "number" ? Form.InputType.Number : field.type === "boolean" ? Form.InputType.Checkbox : Form.InputType.Text,
        //missing date and date-time
        initialValue: data ? data[field.id] : void 0
      }
    })
  );
}
function useFormItemDefinitions(rawData, props) {
  const { mode, dataFormItems, setControlContextData } = props;
  return React__default.default.useMemo(() => {
    const data = rawData && dataSources.normalizeData(rawData);
    const schema = data && data?.schema;
    if (mode !== "simplified" || !rawData || rawData.isLoading || rawData.error || !data || !schema || !data.data) {
      return void 0;
    }
    const row = data.data.length > 0 ? data.data[0] : void 0;
    return deriveFormFieldConfigs(dataFormItems ?? [], schema, row);
  }, [mode, setControlContextData, dataFormItems, rawData]);
}
const useRawData = (props) => {
  const rawData = dataSources.usePlasmicDataOp(props.data);
  return props.data ? rawData : void 0;
};
const SchemaForm = React__default.default.forwardRef(
  (props, ref) => {
    const [remountKey, setRemountKey] = React__default.default.useState(0);
    const forceRemount = React__default.default.useCallback(
      () => setRemountKey((k) => k + 1),
      [setRemountKey]
    );
    const wrapperRef = React__default.default.useRef(null);
    React__default.default.useImperativeHandle(
      ref,
      () => wrapperRef.current ? { ...wrapperRef.current } : {}
    );
    const rawData = useRawData(props);
    const formItemDefinitions = useFormItemDefinitions(rawData, props);
    React__default.default.useEffect(() => {
      if (rawData && !rawData.isLoading) {
        forceRemount();
      }
    }, [rawData]);
    const previousDataOp = utils.usePrevious(props.data);
    React__default.default.useEffect(() => {
      if (previousDataOp == null && props.data != null || previousDataOp != null && props.data == null) {
        forceRemount();
      }
    }, [props.data]);
    const { dataFormItems, formItems, data, ...rest } = props;
    const actualFormItems = props.mode === "simplified" && formItemDefinitions ? formItemDefinitions.mergedFields : data ? dataFormItems : formItems;
    const previousFormItems = React__default.default.useRef([]);
    React__default.default.useEffect(() => {
      if (!(rawData && rawData.isLoading)) {
        previousFormItems.current = actualFormItems ?? [];
      }
    }, [rawData, actualFormItems]);
    if (props.mode === "simplified" && rawData && "error" in rawData) {
      return /* @__PURE__ */ React__default.default.createElement("div", null, "Error when fetching data: ", rawData.error.message);
    }
    const childrenNode = props.mode === "simplified" ? /* @__PURE__ */ React__default.default.createElement(React__default.default.Fragment, null, (actualFormItems ?? []).map((formItem) => /* @__PURE__ */ React__default.default.createElement(
      utils.ErrorBoundary,
      {
        canvasEnvId: props["data-plasmic-canvas-envs"],
        message: `Error rendering input for ${formItem.label ?? formItem.name ?? "undefined"}`
      },
      /* @__PURE__ */ React__default.default.createElement(
        FormItem.FormItemWrapper,
        {
          ...utils.omit(formItem, "key"),
          noLabel: formItem.inputType === Form.InputType.Checkbox || formItem.noLabel,
          valuePropName: formItem.valuePropName ?? (formItem.inputType === Form.InputType.Checkbox ? "checked" : void 0),
          style: { width: "100%" }
        },
        formItem.inputType === Form.InputType.Text ? /* @__PURE__ */ React__default.default.createElement(Ant.Input, null) : formItem.inputType === Form.InputType.Password ? /* @__PURE__ */ React__default.default.createElement(Ant.Input.Password, null) : formItem.inputType === Form.InputType.TextArea ? /* @__PURE__ */ React__default.default.createElement(Ant.Input.TextArea, null) : formItem.inputType === Form.InputType.Number ? /* @__PURE__ */ React__default.default.createElement(Ant.InputNumber, null) : formItem.inputType === Form.InputType.Checkbox ? /* @__PURE__ */ React__default.default.createElement(registerCheckbox.AntdCheckbox, null, formItem.label) : formItem.inputType === Form.InputType.Select ? /* @__PURE__ */ React__default.default.createElement(registerSelect.AntdSelect, { options: formItem.options }) : formItem.inputType === Form.InputType.DatePicker ? /* @__PURE__ */ React__default.default.createElement(registerDatePicker.AntdDatePicker, { showTime: formItem.showTime }) : formItem.inputType === Form.InputType.RadioGroup ? /* @__PURE__ */ React__default.default.createElement(
          registerRadio.AntdRadioGroup,
          {
            options: formItem.options,
            optionType: formItem.optionType,
            style: { padding: "8px" }
          }
        ) : null
      )
    )), props.submitSlot) : props.children;
    const isSchemaForm = props.mode === "simplified" && !!props.data;
    const isLoadingData = rawData?.isLoading;
    return /* @__PURE__ */ React__default.default.createElement(
      Form.SchemaFormContext.Provider,
      {
        value: {
          mergedFields: formItemDefinitions?.mergedFields,
          minimalFullLengthFields: formItemDefinitions?.mergedFields,
          schema: rawData?.schema
        }
      },
      /* @__PURE__ */ React__default.default.createElement(
        Form.FormWrapper,
        {
          key: remountKey,
          ...rest,
          children: childrenNode,
          formItems: rawData && rawData.isLoading ? previousFormItems.current : actualFormItems,
          ref: wrapperRef,
          style: isSchemaForm && isLoadingData ? {
            opacity: 0.5,
            transitionDelay: "250ms",
            transition: "1s"
          } : {}
        }
      ),
      isSchemaForm && isLoadingData && /* @__PURE__ */ React__default.default.createElement(
        "div",
        {
          style: {
            position: "absolute",
            width: "100%",
            height: "100%"
          }
        }
      )
    );
  }
);

exports.FormWrapper = SchemaForm;
exports.SchemaForm = SchemaForm;
exports.deriveFormFieldConfigs = deriveFormFieldConfigs;
//# sourceMappingURL=SchemaForm.cjs.js.map
