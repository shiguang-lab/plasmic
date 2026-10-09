import { usePlasmicCanvasContext } from '@plasmicapp/host';
import { Form } from 'antd';
import React, { isValidElement, cloneElement } from 'react';
import { r as reactNodeToString, m as mergeProps } from './react-utils-BpvCcwyE.esm.js';
import { e as ensureArray, g as get } from './utils-CJsqmMg5.esm.js';
import { u as useFormItemRelativeName, a as useFormItemFullName, P as PathContext, F as FormLayoutContext, I as InternalFormInstanceContext, b as useFormInstanceMaybe } from './contexts-DtHxvgts.esm.js';
import 'classnames';
import '@plasmicapp/host/registerComponent';
import '@plasmicapp/host/registerGlobalContext';

const FormItem = Form.Item;
function plasmicRulesToAntdRules(plasmicRules, label) {
  const effectiveLabel = label || "This field";
  const rules = [];
  for (const plasmicRule of plasmicRules) {
    switch (plasmicRule.ruleType) {
      case "enum":
        rules.push({
          type: "enum",
          enum: plasmicRule.options?.map((opt) => opt.value) ?? [],
          message: plasmicRule.message ?? `${effectiveLabel} must be a valid value`
        });
        break;
      case "required":
        rules.push({
          required: true,
          message: plasmicRule.message ?? `${effectiveLabel} is required`
        });
        break;
      case "regex":
        rules.push({
          pattern: new RegExp(plasmicRule.pattern ?? ""),
          message: plasmicRule.message ?? `${effectiveLabel} must be a valid value`
        });
        break;
      case "whitespace":
        rules.push({
          whitespace: true,
          message: plasmicRule.message ?? `${effectiveLabel} is required`
        });
        break;
      case "min":
        rules.push({
          [plasmicRule.ruleType]: plasmicRule.length,
          message: plasmicRule.message ?? `${effectiveLabel} must be at least ${plasmicRule.length} characters`
        });
        break;
      case "len":
        rules.push({
          len: plasmicRule.length,
          message: plasmicRule.message ?? `${effectiveLabel} must be exactly ${plasmicRule.length} characters`
        });
        break;
      case "max":
        rules.push({
          [plasmicRule.ruleType]: plasmicRule.length,
          message: plasmicRule.message ?? `${effectiveLabel} must be at most ${plasmicRule.length} characters`
        });
        break;
      case "advanced":
        rules.push({
          validator: (...args) => plasmicRule.custom?.apply(null, args) ? Promise.resolve() : Promise.reject(),
          message: plasmicRule.message
        });
    }
  }
  return rules;
}
function FormItemWrapper(props) {
  const {
    rules: plasmicRules,
    description,
    noLabel,
    name,
    hideValidationMessage,
    validateFirst = true,
    customizeProps: _customizeProps,
    setControlContextData: _setControlContextData,
    alignLabellessWithControls = true,
    ...rest
  } = props;
  const relativeFormItemName = useFormItemRelativeName(name);
  const fullFormItemName = useFormItemFullName(name);
  const pathCtx = React.useContext(PathContext);
  const fieldEntity = React.useRef({
    preserve: props.preserve ?? true,
    fullPath: pathCtx.fullPath,
    name
  }).current;
  const bestEffortLabel = !noLabel && reactNodeToString(props.label) || ensureArray(props.name).slice(-1)[0];
  const rules = plasmicRules ? plasmicRulesToAntdRules(
    plasmicRules,
    typeof bestEffortLabel === "number" ? "" + bestEffortLabel : bestEffortLabel
  ) : void 0;
  const layoutContext = React.useContext(FormLayoutContext);
  const inCanvas = !!usePlasmicCanvasContext();
  const {
    fireOnValuesChange,
    forceRemount,
    registerField,
    initialValues,
    internalFieldCtx
  } = React.useContext(InternalFormInstanceContext) ?? {};
  if (inCanvas) {
    const form = useFormInstanceMaybe();
    const prevPropValues = React.useRef({
      initialValue: props.initialValue,
      name: props.name
    });
    props.setControlContextData?.({
      internalFieldCtx,
      formInstance: form,
      parentFormItemPath: pathCtx.fullPath,
      layout: layoutContext
    });
    React.useEffect(() => {
      if (prevPropValues.current.name !== props.name) {
        forceRemount?.();
      }
      if (!fullFormItemName || get(initialValues, fullFormItemName) != null || props.initialValue == null) {
        return;
      }
      form?.setFieldValue(fullFormItemName, props.initialValue);
      prevPropValues.current.initialValue = props.initialValue;
      fireOnValuesChange?.();
    }, [
      form,
      props.initialValue,
      JSON.stringify(pathCtx.fullPath),
      props.name,
      props.preserve
    ]);
  }
  React.useEffect(() => {
    fieldEntity.fullPath = [
      ...pathCtx.fullPath,
      ...props.name != null ? [props.name] : []
    ];
    fieldEntity.name = props.name;
    fieldEntity.preserve = props.preserve ?? true;
  }, [pathCtx.fullPath, props.name, props.preserve]);
  React.useEffect(() => {
    const unregister = registerField?.(fieldEntity);
    return () => unregister?.();
  }, []);
  return /* @__PURE__ */ React.createElement(
    FormItem,
    {
      ...rest,
      label: noLabel ? void 0 : props.label,
      name: relativeFormItemName,
      rules,
      validateFirst,
      extra: description,
      help: hideValidationMessage ? "" : props.help,
      colon: noLabel ? false : void 0,
      valuePropName: deriveValuePropName(props),
      trigger: deriveOnChangePropName(props),
      wrapperCol: layoutContext?.layout === "horizontal" && noLabel && alignLabellessWithControls && layoutContext.labelSpan ? { offset: layoutContext.labelSpan } : void 0
    },
    /* @__PURE__ */ React.createElement(FormItemForwarder, { formItemProps: props })
  );
}
function deriveValuePropName(props) {
  if (props.valuePropName) {
    return props.valuePropName;
  }
  const valueProps = (React.Children.map(props.children, (child) => {
    if (React.isValidElement(child)) {
      const childType = child.type;
      if (childType) {
        const x = childType.__plasmicFormFieldMeta?.valueProp;
        if (x) {
          return x;
        }
        const plumeType = childType.__plumeType;
        if (plumeType && (plumeType === "checkbox" || plumeType === "switch")) {
          return "isChecked";
        }
      }
    }
    return void 0;
  }) ?? []).filter((x) => !!x);
  if (valueProps.length > 0) {
    return valueProps[0];
  }
  return void 0;
}
function deriveOnChangePropName(props) {
  if (props.trigger) {
    return props.trigger;
  }
  const triggerProps = (React.Children.map(props.children, (child) => {
    if (React.isValidElement(child)) {
      const childType = child.type;
      if (childType) {
        const x = childType.__plasmicFormFieldMeta?.onChangeProp;
        if (x) {
          return x;
        }
      }
    }
    return void 0;
  }) ?? []).filter((x) => !!x);
  if (triggerProps.length > 0) {
    return triggerProps[0];
  }
  return void 0;
}
function FormItemForwarder({ formItemProps, ...props }) {
  const inCanvas = !!usePlasmicCanvasContext();
  const status = Form.Item.useStatus();
  const internalFormCtx = React.useContext(InternalFormInstanceContext);
  const data = {
    status: status.status
  };
  props.setControlContextData?.({
    internalFormCtx,
    status
  });
  return React.Children.map(formItemProps.children, (child, i) => {
    if (i === 0 && isValidElement(child)) {
      let newProps = {
        name: formItemProps.name,
        ...child.props ?? {},
        ...props,
        ...inCanvas ? { __plasmicFormField: true } : {}
      };
      if (formItemProps.customizeProps) {
        newProps = mergeProps(
          newProps,
          formItemProps.customizeProps(data, newProps)
        );
      }
      return cloneElement(child, newProps);
    } else {
      return child;
    }
  });
}

export { FormItemWrapper };
//# sourceMappingURL=FormItem.esm.js.map
