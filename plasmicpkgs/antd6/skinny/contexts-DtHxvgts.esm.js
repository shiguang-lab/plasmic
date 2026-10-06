import { Form } from 'antd';
import React from 'react';

const PathContext = React.createContext({ relativePath: [], fullPath: [] });
const useFormItemRelativeName = (name) => {
  const pathCtx = React.useContext(PathContext);
  return typeof name === "object" ? [...pathCtx.relativePath, ...name] : typeof name === "string" ? [...pathCtx.relativePath, name] : void 0;
};
const useFormItemFullName = (name) => {
  const pathCtx = React.useContext(PathContext);
  return typeof name === "object" ? [...pathCtx.fullPath, ...name] : typeof name === "string" ? [...pathCtx.fullPath, name] : void 0;
};
function useFormInstanceMaybe() {
  return Form.useFormInstance();
}
const InternalFormInstanceContext = React.createContext(void 0);
const FormLayoutContext = React.createContext(void 0);

export { FormLayoutContext as F, InternalFormInstanceContext as I, PathContext as P, useFormItemFullName as a, useFormInstanceMaybe as b, useFormItemRelativeName as u };
//# sourceMappingURL=contexts-DtHxvgts.esm.js.map
