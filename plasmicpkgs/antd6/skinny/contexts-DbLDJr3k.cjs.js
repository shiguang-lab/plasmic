'use strict';

var Ant = require('antd');
var React = require('react');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var React__default = /*#__PURE__*/_interopDefault(React);

const PathContext = React__default.default.createContext({ relativePath: [], fullPath: [] });
const useFormItemRelativeName = (name) => {
  const pathCtx = React__default.default.useContext(PathContext);
  return typeof name === "object" ? [...pathCtx.relativePath, ...name] : typeof name === "string" ? [...pathCtx.relativePath, name] : void 0;
};
const useFormItemFullName = (name) => {
  const pathCtx = React__default.default.useContext(PathContext);
  return typeof name === "object" ? [...pathCtx.fullPath, ...name] : typeof name === "string" ? [...pathCtx.fullPath, name] : void 0;
};
function useFormInstanceMaybe() {
  return Ant.Form.useFormInstance();
}
const InternalFormInstanceContext = React__default.default.createContext(void 0);
const FormLayoutContext = React__default.default.createContext(void 0);

exports.FormLayoutContext = FormLayoutContext;
exports.InternalFormInstanceContext = InternalFormInstanceContext;
exports.PathContext = PathContext;
exports.useFormInstanceMaybe = useFormInstanceMaybe;
exports.useFormItemFullName = useFormItemFullName;
exports.useFormItemRelativeName = useFormItemRelativeName;
//# sourceMappingURL=contexts-DbLDJr3k.cjs.js.map
