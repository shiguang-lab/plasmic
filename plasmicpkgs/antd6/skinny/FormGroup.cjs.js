"use strict";

var React = require("react");
var contexts = require("./contexts-DbLDJr3k.cjs.js");
require("antd");

function _interopDefault(e) {
  return e && e.__esModule ? e : { default: e };
}

var React__default = /*#__PURE__*/ _interopDefault(React);

function FormGroup(props) {
  const pathCtx = React__default.default.useContext(contexts.PathContext);
  return /* @__PURE__ */ React__default.default.createElement(
    contexts.PathContext.Provider,
    {
      value: {
        relativePath: [...pathCtx.relativePath, props.name],
        fullPath: [...pathCtx.fullPath, props.name],
      },
    },
    props.children,
  );
}

exports.FormGroup = FormGroup;
//# sourceMappingURL=FormGroup.cjs.js.map
