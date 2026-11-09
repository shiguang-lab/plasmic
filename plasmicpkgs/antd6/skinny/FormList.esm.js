import { jsx } from 'react/jsx-runtime';
import { usePlasmicCanvasContext, DataProvider, repeatedElement } from '@plasmicapp/host';
import { Form } from 'antd';
import React from 'react';
import { u as useFormItemRelativeName, a as useFormItemFullName, b as useFormInstanceMaybe, I as InternalFormInstanceContext, P as PathContext } from './contexts-DtHxvgts.esm.js';

const FormList = Form.List;
const FormListWrapper = React.forwardRef(function FormListWrapper2(props, ref) {
  const relativeFormItemName = useFormItemRelativeName(props.name);
  const fullFormItemName = useFormItemFullName(props.name);
  const operationsRef = React.useRef(
    void 0
  );
  React.useImperativeHandle(
    ref,
    () => ({
      add(defaultValue, insertIndex) {
        if (operationsRef.current) {
          const { add } = operationsRef.current[1];
          add(defaultValue, insertIndex);
        }
      },
      remove(index) {
        if (operationsRef.current) {
          const { remove } = operationsRef.current[1];
          remove(index);
        }
      },
      move(from, to) {
        if (operationsRef.current) {
          const { move } = operationsRef.current[1];
          move(from, to);
        }
      }
    }),
    [operationsRef]
  );
  const inCanvas = !!usePlasmicCanvasContext();
  const form = useFormInstanceMaybe();
  const nameKey = JSON.stringify(props.name);
  const prevPropValues = React.useRef({ nameKey });
  const { fireOnValuesChange, forceRemount } = React.useContext(InternalFormInstanceContext) ?? {};
  const fullNameKey = JSON.stringify(fullFormItemName);
  React.useEffect(() => {
    if (!inCanvas) {
      return;
    }
    const nameChanged = prevPropValues.current.nameKey !== nameKey;
    prevPropValues.current = { nameKey };
    if (nameChanged) {
      forceRemount?.();
    }
    if (fullNameKey !== void 0) {
      const fullName = JSON.parse(fullNameKey);
      form?.setFieldValue(fullName, props.initialValue);
      fireOnValuesChange?.();
    }
  }, [inCanvas, form, nameKey, props.initialValue, fullNameKey, fireOnValuesChange, forceRemount]);
  return /* @__PURE__ */ jsx(FormList, { ...props, name: relativeFormItemName ?? [], children: (...args) => {
    operationsRef.current = args;
    return args[0].map((field, index) => /* @__PURE__ */ jsx(
      PathContext.Provider,
      {
        value: {
          relativePath: [field.name],
          fullPath: [...fullFormItemName ?? [], field.name]
        },
        children: /* @__PURE__ */ jsx(DataProvider, { name: "currentField", data: field, children: /* @__PURE__ */ jsx(DataProvider, { name: "currentFieldIndex", data: index, children: repeatedElement(index, props.children) }) })
      },
      field.key
    ));
  } });
});

export { FormListWrapper };
//# sourceMappingURL=FormList.esm.js.map
