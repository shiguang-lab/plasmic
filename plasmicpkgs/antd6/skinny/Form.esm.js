import { Form } from 'antd';
import equal from 'fast-deep-equal';
import React from 'react';
import { s as setFieldsToUndefined, u as usePrevious } from './utils-AeETDTaH.esm.js';
import { I as InternalFormInstanceContext, F as FormLayoutContext } from './contexts-DtHxvgts.esm.js';
import '@plasmicapp/host/registerComponent';
import '@plasmicapp/host/registerGlobalContext';

var InputType = /* @__PURE__ */ ((InputType2) => {
  InputType2["Text"] = "Text";
  InputType2["TextArea"] = "Text Area";
  InputType2["Password"] = "Password";
  InputType2["Number"] = "Number";
  InputType2["Select"] = "Select";
  InputType2["Option"] = "Option";
  InputType2["OptionGroup"] = "Option Group";
  InputType2["Radio"] = "Radio";
  InputType2["RadioGroup"] = "Radio Group";
  InputType2["Checkbox"] = "Checkbox";
  InputType2["DatePicker"] = "DatePicker";
  InputType2["Unknown"] = "Unkown";
  return InputType2;
})(InputType || {});
const SchemaFormContext = React.createContext(void 0);
var FormType = /* @__PURE__ */ ((FormType2) => {
  FormType2[FormType2["NewEntry"] = 0] = "NewEntry";
  FormType2[FormType2["UpdateEntry"] = 1] = "UpdateEntry";
  return FormType2;
})(FormType || {});
const Internal = React.forwardRef(
  (props, ref) => {
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const pendingSubmissions = React.useRef(0);
    const [form] = Form.useForm();
    const formValues = form.getFieldsValue(true);
    const lastValue = React.useRef(formValues);
    const {
      extendedOnValuesChange,
      forceRemount,
      formLayout,
      internalFieldCtx,
      setInternalFieldCtx,
      autoDisableWhileSubmitting = true,
      onIsSubmittingChange,
      disabled,
      ...rest
    } = props;
    const childrenNode = typeof props.children === "function" ? props.children(formValues, form) : props.children;
    const fireOnValuesChange = React.useCallback(() => {
      const values = form.getFieldsValue(true);
      if (!equal(values, lastValue.current)) {
        extendedOnValuesChange?.(values);
        lastValue.current = values;
      }
    }, [form, lastValue]);
    React.useEffect(() => {
      fireOnValuesChange();
    }, []);
    React.useImperativeHandle(ref, () => ({
      formInstance: form,
      setFieldsValue: (newValues) => {
        form.setFieldsValue(newValues);
        extendedOnValuesChange?.(form.getFieldsValue(true));
      },
      setFieldValue: (namePath, value) => {
        form.setFieldValue(namePath, value);
        extendedOnValuesChange?.(form.getFieldsValue(true));
      },
      resetFields: () => {
        form.resetFields();
        extendedOnValuesChange?.(form.getFieldsValue(true));
      },
      validateFields: (...args) => form.validateFields(...args),
      clearFields: () => {
        const values = form.getFieldsValue(true);
        setFieldsToUndefined(values);
        form.setFieldsValue(values);
        extendedOnValuesChange?.(form.getFieldsValue(true));
      }
    }));
    const registerField = React.useCallback(
      (fieldEntity) => {
        setInternalFieldCtx((ctx) => ({
          registeredFields: [...ctx.registeredFields, fieldEntity],
          preservedRegisteredFields: [
            ...ctx.preservedRegisteredFields,
            fieldEntity
          ]
        }));
        return () => {
          setInternalFieldCtx((ctx) => ({
            registeredFields: ctx.registeredFields.filter(
              (ent) => ent !== fieldEntity
            ),
            preservedRegisteredFields: ctx.preservedRegisteredFields.filter(
              (ent) => ent !== fieldEntity || fieldEntity.preserve
            )
          }));
        };
      },
      [setInternalFieldCtx]
    );
    const schemaFormCtx = React.useContext(SchemaFormContext);
    props.setControlContextData?.({
      formInstance: form,
      layout: formLayout,
      internalFieldCtx,
      ...schemaFormCtx ? schemaFormCtx : {}
    });
    const updateIsSubmitting = React.useCallback(
      (newValue) => {
        setIsSubmitting(newValue);
        onIsSubmittingChange?.(newValue);
      },
      [onIsSubmittingChange, setIsSubmitting]
    );
    return /* @__PURE__ */ React.createElement(
      InternalFormInstanceContext.Provider,
      {
        value: {
          layout: formLayout,
          fireOnValuesChange,
          forceRemount,
          registerField,
          internalFieldCtx,
          initialValues: props.initialValues ?? {}
        }
      },
      /* @__PURE__ */ React.createElement(FormLayoutContext.Provider, { value: formLayout }, /* @__PURE__ */ React.createElement(
        Form,
        {
          ...rest,
          key: props.initialValues ? JSON.stringify(props.initialValues) : void 0,
          onValuesChange: (...args) => {
            props.onValuesChange?.(...args);
            extendedOnValuesChange?.(form.getFieldsValue(true));
          },
          onFinish: async (values) => {
            if (pendingSubmissions.current && autoDisableWhileSubmitting) {
              return;
            }
            if (++pendingSubmissions.current === 1) {
              updateIsSubmitting(true);
            }
            try {
              await props.onFinish?.(values);
            } finally {
              if (--pendingSubmissions.current === 0) {
                updateIsSubmitting(false);
              }
            }
          },
          form,
          labelCol: props.labelCol?.horizontalOnly && props.layout !== "horizontal" ? void 0 : props.labelCol,
          wrapperCol: props.wrapperCol?.horizontalOnly && props.layout !== "horizontal" ? void 0 : props.wrapperCol,
          disabled: isSubmitting && autoDisableWhileSubmitting ? true : disabled
        },
        /* @__PURE__ */ React.createElement("style", null, `
          .ant-form-item-explain + div, .ant-form-item-margin-offset {
            display: none;
          }
          `),
        childrenNode
      ))
    );
  }
);
const FormWrapper = React.forwardRef(
  (props, ref) => {
    const [remountKey, setRemountKey] = React.useState(0);
    const forceRemount = React.useCallback(
      () => setRemountKey((k) => k + 1),
      [setRemountKey]
    );
    const previousInitialValues = usePrevious(props.initialValues);
    const wrapperRef = React.useRef(null);
    React.useEffect(() => {
      if (previousInitialValues !== props.initialValues && JSON.stringify(previousInitialValues) !== JSON.stringify(props.initialValues)) {
        forceRemount();
      }
    }, [previousInitialValues, props.initialValues]);
    const [internalFieldCtx, setInternalFieldCtx] = React.useState({
      registeredFields: [],
      preservedRegisteredFields: []
    });
    React.useImperativeHandle(
      ref,
      () => wrapperRef.current ? { ...wrapperRef.current } : {}
    );
    const formLayout = React.useMemo(
      () => ({
        layout: props.layout,
        labelSpan: props.labelCol?.span
      }),
      [props.layout, props.labelCol?.span]
    );
    return /* @__PURE__ */ React.createElement(
      Internal,
      {
        key: remountKey,
        forceRemount,
        formLayout,
        internalFieldCtx,
        setInternalFieldCtx,
        ref: wrapperRef,
        ...props
      }
    );
  }
);
const formHelpers = {
  states: {
    value: {
      onMutate: (value, $ref) => {
        $ref?.formInstance?.setFieldsValue(value);
      }
    }
  }
};
const OPTIMIZED_FORM_IMPORT = {
  name: "FormWrapper",
  path: "@shiguang-lab/plasmic-antd6/skinny/Form"
};

export { FormType, FormWrapper, InputType, OPTIMIZED_FORM_IMPORT, SchemaFormContext, formHelpers };
//# sourceMappingURL=Form.esm.js.map
