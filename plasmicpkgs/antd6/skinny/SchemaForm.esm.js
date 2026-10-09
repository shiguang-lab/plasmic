import { usePlasmicDataOp, normalizeData, deriveFieldConfigs } from '@plasmicapp/data-sources';
import { Input, InputNumber } from 'antd';
import React from 'react';
import { AntdCheckbox } from './registerCheckbox.esm.js';
import { AntdDatePicker } from './registerDatePicker.esm.js';
import { AntdRadioGroup } from './registerRadio.esm.js';
import { AntdSelect } from './registerSelect.esm.js';
import { u as usePrevious, E as ErrorBoundary, o as omit } from './utils-CJsqmMg5.esm.js';
import { InputType, SchemaFormContext, FormWrapper } from './Form.esm.js';
import { FormItemWrapper } from './FormItem.esm.js';
import './names-DKofLcnC.esm.js';
import 'classnames';
import 'dayjs';
import './canvas-overlay-Dan70Oxr.esm.js';
import '@plasmicapp/host';
import './react-utils-BpvCcwyE.esm.js';
import '@plasmicapp/host/registerComponent';
import '@plasmicapp/host/registerGlobalContext';
import 'fast-deep-equal';
import './contexts-DtHxvgts.esm.js';

function deriveFormFieldConfigs(dataFormItems, schema, data) {
  return deriveFieldConfigs(
    dataFormItems,
    schema,
    (field) => ({
      inputType: InputType.Text,
      ...field && {
        key: field.id,
        fieldId: field.id,
        label: field.label ?? field.id,
        name: field.id,
        inputType: field.type === "string" ? InputType.Text : field.type === "number" ? InputType.Number : field.type === "boolean" ? InputType.Checkbox : InputType.Text,
        //missing date and date-time
        initialValue: data ? data[field.id] : void 0
      }
    })
  );
}
function useFormItemDefinitions(rawData, props) {
  const { mode, dataFormItems, setControlContextData } = props;
  return React.useMemo(() => {
    const data = rawData && normalizeData(rawData);
    const schema = data && data?.schema;
    if (mode !== "simplified" || !rawData || rawData.isLoading || rawData.error || !data || !schema || !data.data) {
      return void 0;
    }
    const row = data.data.length > 0 ? data.data[0] : void 0;
    return deriveFormFieldConfigs(dataFormItems ?? [], schema, row);
  }, [mode, setControlContextData, dataFormItems, rawData]);
}
const useRawData = (props) => {
  const rawData = usePlasmicDataOp(props.data);
  return props.data ? rawData : void 0;
};
const SchemaForm = React.forwardRef(
  (props, ref) => {
    const [remountKey, setRemountKey] = React.useState(0);
    const forceRemount = React.useCallback(
      () => setRemountKey((k) => k + 1),
      [setRemountKey]
    );
    const rawData = useRawData(props);
    const formItemDefinitions = useFormItemDefinitions(rawData, props);
    React.useEffect(() => {
      if (rawData && !rawData.isLoading) {
        forceRemount();
      }
    }, [rawData]);
    const previousDataOp = usePrevious(props.data);
    React.useEffect(() => {
      if (previousDataOp == null && props.data != null || previousDataOp != null && props.data == null) {
        forceRemount();
      }
    }, [props.data]);
    const { dataFormItems, formItems, data, ...rest } = props;
    const actualFormItems = props.mode === "simplified" && formItemDefinitions ? formItemDefinitions.mergedFields : data ? dataFormItems : formItems;
    const previousFormItems = React.useRef([]);
    React.useEffect(() => {
      if (!(rawData && rawData.isLoading)) {
        previousFormItems.current = actualFormItems ?? [];
      }
    }, [rawData, actualFormItems]);
    if (props.mode === "simplified" && rawData && "error" in rawData) {
      return /* @__PURE__ */ React.createElement("div", null, "Error when fetching data: ", rawData.error.message);
    }
    const childrenNode = props.mode === "simplified" ? /* @__PURE__ */ React.createElement(React.Fragment, null, (actualFormItems ?? []).map((formItem) => /* @__PURE__ */ React.createElement(
      ErrorBoundary,
      {
        canvasEnvId: props["data-plasmic-canvas-envs"],
        message: `Error rendering input for ${formItem.label ?? formItem.name ?? "undefined"}`
      },
      /* @__PURE__ */ React.createElement(
        FormItemWrapper,
        {
          ...omit(formItem, "key"),
          noLabel: formItem.inputType === InputType.Checkbox || formItem.noLabel,
          valuePropName: formItem.valuePropName ?? (formItem.inputType === InputType.Checkbox ? "checked" : void 0),
          style: { width: "100%" }
        },
        formItem.inputType === InputType.Text ? /* @__PURE__ */ React.createElement(Input, null) : formItem.inputType === InputType.Password ? /* @__PURE__ */ React.createElement(Input.Password, null) : formItem.inputType === InputType.TextArea ? /* @__PURE__ */ React.createElement(Input.TextArea, null) : formItem.inputType === InputType.Number ? /* @__PURE__ */ React.createElement(InputNumber, null) : formItem.inputType === InputType.Checkbox ? /* @__PURE__ */ React.createElement(AntdCheckbox, null, formItem.label) : formItem.inputType === InputType.Select ? /* @__PURE__ */ React.createElement(AntdSelect, { options: formItem.options }) : formItem.inputType === InputType.DatePicker ? /* @__PURE__ */ React.createElement(AntdDatePicker, { showTime: formItem.showTime }) : formItem.inputType === InputType.RadioGroup ? /* @__PURE__ */ React.createElement(
          AntdRadioGroup,
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
    return /* @__PURE__ */ React.createElement(
      SchemaFormContext.Provider,
      {
        value: {
          mergedFields: formItemDefinitions?.mergedFields,
          minimalFullLengthFields: formItemDefinitions?.mergedFields,
          schema: rawData?.schema
        }
      },
      /* @__PURE__ */ React.createElement(
        FormWrapper,
        {
          key: remountKey,
          ...rest,
          children: childrenNode,
          formItems: rawData && rawData.isLoading ? previousFormItems.current : actualFormItems,
          ref,
          style: isSchemaForm && isLoadingData ? {
            opacity: 0.5,
            transitionDelay: "250ms",
            transition: "1s"
          } : {}
        }
      ),
      isSchemaForm && isLoadingData && /* @__PURE__ */ React.createElement(
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

export { SchemaForm as FormWrapper, SchemaForm, deriveFormFieldConfigs };
//# sourceMappingURL=SchemaForm.esm.js.map
