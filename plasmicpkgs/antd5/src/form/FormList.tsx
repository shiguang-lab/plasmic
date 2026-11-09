import {
  DataProvider,
  repeatedElement,
  usePlasmicCanvasContext,
} from "@plasmicapp/host";
import { Form } from "antd";
import type { FormListOperation, FormListProps } from "antd/es/form/FormList";
import React from "react";
import {
  InternalFormInstanceContext,
  PathContext,
  useFormInstanceMaybe,
  useFormItemFullName,
  useFormItemRelativeName,
} from "./contexts";

const FormList = Form.List;

type FormListWrapperProps = Omit<FormListProps, "children"> & {
  children: React.ReactNode;
};

type FormListRenderFuncParams = Parameters<FormListProps["children"]>;

export const FormListWrapper = React.forwardRef(function FormListWrapper(
  props: FormListWrapperProps,
  ref: React.Ref<FormListOperation>
) {
  const relativeFormItemName = useFormItemRelativeName(props.name);
  const fullFormItemName = useFormItemFullName(props.name);
  const operationsRef = React.useRef<FormListRenderFuncParams | undefined>(
    undefined
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
      },
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
    if (!inCanvas) { return; }
    const nameChanged = prevPropValues.current.nameKey !== nameKey;
    prevPropValues.current = { nameKey };
    if (nameChanged) { forceRemount?.(); }
    if (fullNameKey !== undefined) {
      const fullName: (string | number)[] = JSON.parse(fullNameKey);
      form?.setFieldValue(fullName, props.initialValue);
      fireOnValuesChange?.();
    }
  }, [inCanvas, form, nameKey, props.initialValue, fullNameKey, fireOnValuesChange, forceRemount]);
  return (
    <FormList {...props} name={relativeFormItemName ?? []}>
      {(...args) => {
        operationsRef.current = args;
        return args[0].map((field, index) => (
          <PathContext.Provider
            value={{
              relativePath: [field.name],
              fullPath: [...(fullFormItemName ?? []), field.name],
            }}
          >
            <DataProvider name={"currentField"} data={field}>
              <DataProvider name={"currentFieldIndex"} data={index}>
                {repeatedElement(index, props.children)}
              </DataProvider>
            </DataProvider>
          </PathContext.Provider>
        ));
      }}
    </FormList>
  );
});
