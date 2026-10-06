'use strict';

var Ant = require('antd');
var equal = require('fast-deep-equal');
var React = require('react');
var utils = require('./utils-CRCm44nj.cjs.js');
var contexts = require('./contexts-DbLDJr3k.cjs.js');
require('@plasmicapp/host/registerComponent');
require('@plasmicapp/host/registerGlobalContext');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var equal__default = /*#__PURE__*/_interopDefault(equal);
var React__default = /*#__PURE__*/_interopDefault(React);

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
const SchemaFormContext = React__default.default.createContext(void 0);
var FormType = /* @__PURE__ */ ((FormType2) => {
  FormType2[FormType2["NewEntry"] = 0] = "NewEntry";
  FormType2[FormType2["UpdateEntry"] = 1] = "UpdateEntry";
  return FormType2;
})(FormType || {});
const Internal = React__default.default.forwardRef(
  (props, ref) => {
    const [isSubmitting, setIsSubmitting] = React__default.default.useState(false);
    const pendingSubmissions = React__default.default.useRef(0);
    const [form] = Ant.Form.useForm();
    const formValues = form.getFieldsValue(true);
    const lastValue = React__default.default.useRef(formValues);
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
    const fireOnValuesChange = React__default.default.useCallback(() => {
      const values = form.getFieldsValue(true);
      if (!equal__default.default(values, lastValue.current)) {
        extendedOnValuesChange?.(values);
        lastValue.current = values;
      }
    }, [form, lastValue]);
    React__default.default.useEffect(() => {
      fireOnValuesChange();
    }, []);
    React__default.default.useImperativeHandle(ref, () => ({
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
        utils.setFieldsToUndefined(values);
        form.setFieldsValue(values);
        extendedOnValuesChange?.(form.getFieldsValue(true));
      }
    }));
    const registerField = React__default.default.useCallback(
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
    const schemaFormCtx = React__default.default.useContext(SchemaFormContext);
    props.setControlContextData?.({
      formInstance: form,
      layout: formLayout,
      internalFieldCtx,
      ...schemaFormCtx ? schemaFormCtx : {}
    });
    const updateIsSubmitting = React__default.default.useCallback(
      (newValue) => {
        setIsSubmitting(newValue);
        onIsSubmittingChange?.(newValue);
      },
      [onIsSubmittingChange, setIsSubmitting]
    );
    return /* @__PURE__ */ React__default.default.createElement(
      contexts.InternalFormInstanceContext.Provider,
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
      /* @__PURE__ */ React__default.default.createElement(contexts.FormLayoutContext.Provider, { value: formLayout }, /* @__PURE__ */ React__default.default.createElement(
        Ant.Form,
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
        /* @__PURE__ */ React__default.default.createElement("style", null, `
          .ant-form-item-explain + div, .ant-form-item-margin-offset {
            display: none;
          }
          `),
        childrenNode
      ))
    );
  }
);
const FormWrapper = React__default.default.forwardRef(
  (props, ref) => {
    const [remountKey, setRemountKey] = React__default.default.useState(0);
    const forceRemount = React__default.default.useCallback(
      () => setRemountKey((k) => k + 1),
      [setRemountKey]
    );
    const previousInitialValues = utils.usePrevious(props.initialValues);
    const wrapperRef = React__default.default.useRef(null);
    React__default.default.useEffect(() => {
      if (previousInitialValues !== props.initialValues && JSON.stringify(previousInitialValues) !== JSON.stringify(props.initialValues)) {
        forceRemount();
      }
    }, [previousInitialValues, props.initialValues]);
    const [internalFieldCtx, setInternalFieldCtx] = React__default.default.useState({
      registeredFields: [],
      preservedRegisteredFields: []
    });
    React__default.default.useImperativeHandle(
      ref,
      () => wrapperRef.current ? { ...wrapperRef.current } : {}
    );
    const formLayout = React__default.default.useMemo(
      () => ({
        layout: props.layout,
        labelSpan: props.labelCol?.span
      }),
      [props.layout, props.labelCol?.span]
    );
    return /* @__PURE__ */ React__default.default.createElement(
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

exports.FormType = FormType;
exports.FormWrapper = FormWrapper;
exports.InputType = InputType;
exports.OPTIMIZED_FORM_IMPORT = OPTIMIZED_FORM_IMPORT;
exports.SchemaFormContext = SchemaFormContext;
exports.formHelpers = formHelpers;
//# sourceMappingURL=Form.cjs.js.map
