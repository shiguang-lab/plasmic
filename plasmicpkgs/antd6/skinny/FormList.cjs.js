'use strict';

var jsxRuntime = require('react/jsx-runtime');
var host = require('@plasmicapp/host');
var Ant = require('antd');
var React = require('react');
var contexts = require('./contexts-DbLDJr3k.cjs.js');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var React__default = /*#__PURE__*/_interopDefault(React);

const FormList = Ant.Form.List;
const FormListWrapper = React__default.default.forwardRef(function FormListWrapper2(props, ref) {
  const relativeFormItemName = contexts.useFormItemRelativeName(props.name);
  const fullFormItemName = contexts.useFormItemFullName(props.name);
  const operationsRef = React__default.default.useRef(
    void 0
  );
  React__default.default.useImperativeHandle(
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
  const inCanvas = !!host.usePlasmicCanvasContext();
  const form = contexts.useFormInstanceMaybe();
  const nameKey = JSON.stringify(props.name);
  const prevPropValues = React__default.default.useRef({ nameKey });
  const { fireOnValuesChange, forceRemount } = React__default.default.useContext(contexts.InternalFormInstanceContext) ?? {};
  const fullNameKey = JSON.stringify(fullFormItemName);
  React__default.default.useEffect(() => {
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
  return /* @__PURE__ */ jsxRuntime.jsx(FormList, { ...props, name: relativeFormItemName ?? [], children: (...args) => {
    operationsRef.current = args;
    return args[0].map((field, index) => /* @__PURE__ */ jsxRuntime.jsx(
      contexts.PathContext.Provider,
      {
        value: {
          relativePath: [field.name],
          fullPath: [...fullFormItemName ?? [], field.name]
        },
        children: /* @__PURE__ */ jsxRuntime.jsx(host.DataProvider, { name: "currentField", data: field, children: /* @__PURE__ */ jsxRuntime.jsx(host.DataProvider, { name: "currentFieldIndex", data: index, children: host.repeatedElement(index, props.children) }) })
      },
      field.key
    ));
  } });
});

exports.FormListWrapper = FormListWrapper;
//# sourceMappingURL=FormList.cjs.js.map
