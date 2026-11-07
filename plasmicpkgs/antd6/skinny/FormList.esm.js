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
  if (inCanvas) {
    const form = useFormInstanceMaybe();
    const prevPropValues = React.useRef({
      initialValue: props.initialValue,
      name: props.name
    });
    const { fireOnValuesChange, forceRemount } = React.useContext(InternalFormInstanceContext) ?? {};
    React.useEffect(() => {
      if (prevPropValues.current.name !== props.name) {
        forceRemount?.();
      }
      if (fullFormItemName) {
        form?.setFieldValue(fullFormItemName, props.initialValue);
        prevPropValues.current.initialValue = props.initialValue;
        fireOnValuesChange?.();
      }
    }, [JSON.stringify(props.initialValue), JSON.stringify(fullFormItemName)]);
  }
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
