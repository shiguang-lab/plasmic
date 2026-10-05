import {
  DataProvider,
  repeatedElement,
  usePlasmicCanvasContext,
} from "@plasmicapp/host";
import { Form } from "antd";
import React from "react";
import {
  I as InternalFormInstanceContext,
  P as PathContext,
  b as useFormInstanceMaybe,
  a as useFormItemFullName,
  u as useFormItemRelativeName,
} from "./contexts-DtHxvgts.esm.js";

const FormList = Form.List;
const FormListWrapper = React.forwardRef(function FormListWrapper2(props, ref) {
  const relativeFormItemName = useFormItemRelativeName(props.name);
  const fullFormItemName = useFormItemFullName(props.name);
  const operationsRef = React.useRef(void 0);
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
      },
    }),
    [operationsRef],
  );
  const inCanvas = !!usePlasmicCanvasContext();
  if (inCanvas) {
    const form = useFormInstanceMaybe();
    const prevPropValues = React.useRef({
      initialValue: props.initialValue,
      name: props.name,
    });
    const { fireOnValuesChange, forceRemount } =
      React.useContext(InternalFormInstanceContext) ?? {};
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
  return /* @__PURE__ */ React.createElement(
    FormList,
    { ...props, name: relativeFormItemName ?? [] },
    (...args) => {
      operationsRef.current = args;
      return args[0].map((field, index) =>
        /* @__PURE__ */ React.createElement(
          PathContext.Provider,
          {
            key: field.key,
            value: {
              relativePath: [field.name],
              fullPath: [...(fullFormItemName ?? []), field.name],
            },
          },
          /* @__PURE__ */ React.createElement(
            DataProvider,
            { name: "currentField", data: field },
            /* @__PURE__ */ React.createElement(
              DataProvider,
              { name: "currentFieldIndex", data: index },
              repeatedElement(index, props.children),
            ),
          ),
        ),
      );
    },
  );
});

export { FormListWrapper };
//# sourceMappingURL=FormList.esm.js.map
