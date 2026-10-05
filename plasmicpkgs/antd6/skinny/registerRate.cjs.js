"use strict";

var Ant = require("antd");
var React = require("react");
var utils = require("./utils-CRCm44nj.cjs.js");
require("@plasmicapp/host/registerComponent");
require("@plasmicapp/host/registerGlobalContext");

function _interopDefault(e) {
  return e && e.__esModule ? e : { default: e };
}

var React__default = /*#__PURE__*/ _interopDefault(React);

function getSymbols(symbols) {
  return React__default.default.Children.toArray(
    React__default.default.isValidElement(symbols) &&
      Array.isArray(symbols.props.children)
      ? symbols.props.children
      : symbols,
  );
}
function AntdRate(props) {
  const { character, count, tooltips, multiCharacter, symbols, ...rest } =
    props;
  const symbolsProp = React.useMemo(() => getSymbols(symbols), [symbols]);
  const countProp = React.useMemo(() => {
    if (!multiCharacter) {
      return count;
    }
    return symbolsProp.length || count;
  }, [count, multiCharacter, symbolsProp?.length]);
  const characterProp = React.useMemo(() => {
    if (!multiCharacter) {
      return character;
    }
    return symbolsProp?.length ? ({ index }) => symbolsProp[index] : character;
  }, [character, multiCharacter, symbolsProp]);
  return /* @__PURE__ */ React__default.default.createElement(Ant.Rate, {
    tooltips: tooltips?.map((t) => t?.label),
    count: countProp,
    character: characterProp,
    ...rest,
  });
}
const rateComponentName = "plasmic-antd6-rate";
function registerRate(loader) {
  utils.registerComponentHelper(loader, AntdRate, {
    name: rateComponentName,
    displayName: "Rate",
    props: {
      allowClear: {
        type: "boolean",
        advanced: true,
        defaultValueHint: true,
        description: "Clear the rating when the user clicks again",
      },
      allowHalf: {
        type: "boolean",
        advanced: true,
        defaultValueHint: false,
        description: "Allow fractional rating.",
      },
      autoFocus: {
        type: "boolean",
        description: "Focus when component is rendered",
        defaultValueHint: false,
        advanced: true,
      },
      character: {
        type: "slot",
        displayName: "Symbol",
        hidePlaceholder: true,
        hidden: (ps) => Boolean(ps.multiCharacter),
      },
      multiCharacter: {
        type: "boolean",
        displayName: "Multi Symbol",
        description:
          "Allow different symbols for rating. (You can add these symbols in the component slots if this is enabled)",
        advanced: true,
      },
      symbols: {
        type: "slot",
        displayName: "Symbols",
        hidePlaceholder: true,
        defaultValue: ["1", "2", "3", "4", "5"],
        hidden: (ps) => !ps.multiCharacter,
      },
      count: {
        type: "number",
        description: "Rating count",
        defaultValueHint: 5,
        advanced: true,
        hidden: (ps) => Boolean(ps.multiCharacter),
      },
      value: {
        type: "number",
        editOnly: true,
        uncontrolledProp: "defaultValue",
        description: "Default rating",
        defaultValueHint: 0,
      },
      disabled: {
        type: "boolean",
        description: "Read-only rating",
        defaultValueHint: false,
      },
      tooltips: {
        type: "array",
        description: "Rating labels",
        displayName: "Labels",
        advanced: true,
        hidden: (ps) => ps.count === 0 && !ps.multiCharacter,
        itemType: {
          type: "object",
          fields: {
            label: "string",
          },
          nameFunc: (value) => value.label,
        },
        validator: (value, ps) => {
          const count = ps.multiCharacter
            ? getSymbols(ps.symbols).length || (ps.count ?? 5)
            : (ps.count ?? 5);
          if (!Array.isArray(value) || value.length === 0) {
            return true;
          }
          if (value.length < count) {
            return `You need ${count - value.length} more labels`;
          }
          if (value.length > count) {
            return "You have too many labels. Some labels will not be used";
          }
          return true;
        },
      },
      onChange: {
        type: "eventHandler",
        advanced: true,
        argTypes: [{ name: "value", type: "number" }],
      },
      onBlur: {
        type: "eventHandler",
        advanced: true,
        argTypes: [],
      },
      onFocus: {
        type: "eventHandler",
        advanced: true,
        argTypes: [],
      },
      onHoverChange: {
        type: "eventHandler",
        advanced: true,
        description: "Callback when an item is hovered",
        argTypes: [{ name: "value", type: "number" }],
      },
      onKeyDown: {
        type: "eventHandler",
        advanced: true,
        argTypes: [{ name: "event", type: "object" }],
      },
    },
    states: {
      value: {
        type: "writable",
        valueProp: "value",
        onChangeProp: "onChange",
        variableType: "number",
      },
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerRate",
    importName: "AntdRate",
  });
}

exports.AntdRate = AntdRate;
exports.rateComponentName = rateComponentName;
exports.registerRate = registerRate;
//# sourceMappingURL=registerRate.cjs.js.map
