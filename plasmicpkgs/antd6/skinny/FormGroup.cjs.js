'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var contexts = require('./contexts-DbLDJr3k.cjs.js');
require('antd');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var React__default = /*#__PURE__*/_interopDefault(React);

function FormGroup(props) {
  const pathCtx = React__default.default.useContext(contexts.PathContext);
  return /* @__PURE__ */ jsxRuntime.jsx(
    contexts.PathContext.Provider,
    {
      value: {
        relativePath: [...pathCtx.relativePath, props.name],
        fullPath: [...pathCtx.fullPath, props.name]
      },
      children: props.children
    }
  );
}

exports.FormGroup = FormGroup;
//# sourceMappingURL=FormGroup.cjs.js.map
