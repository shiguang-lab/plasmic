'use strict';

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
  if (inCanvas) {
    const form = contexts.useFormInstanceMaybe();
    const prevPropValues = React__default.default.useRef({
      initialValue: props.initialValue,
      name: props.name
    });
    const { fireOnValuesChange, forceRemount } = React__default.default.useContext(contexts.InternalFormInstanceContext) ?? {};
    React__default.default.useEffect(() => {
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
  return /* @__PURE__ */ React__default.default.createElement(FormList, { ...props, name: relativeFormItemName ?? [] }, (...args) => {
    operationsRef.current = args;
    return args[0].map((field, index) => /* @__PURE__ */ React__default.default.createElement(
      contexts.PathContext.Provider,
      {
        key: field.key,
        value: {
          relativePath: [field.name],
          fullPath: [...fullFormItemName ?? [], field.name]
        }
      },
      /* @__PURE__ */ React__default.default.createElement(host.DataProvider, { name: "currentField", data: field }, /* @__PURE__ */ React__default.default.createElement(host.DataProvider, { name: "currentFieldIndex", data: index }, host.repeatedElement(index, props.children)))
    ));
  });
});

exports.FormListWrapper = FormListWrapper;
//# sourceMappingURL=FormList.cjs.js.map
