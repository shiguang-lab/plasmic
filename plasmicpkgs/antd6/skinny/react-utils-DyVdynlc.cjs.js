"use strict";

var classNames = require("classnames");
var React = require("react");

function _interopDefault(e) {
  return e && e.__esModule ? e : { default: e };
}

var classNames__default = /*#__PURE__*/ _interopDefault(classNames);
var React__default = /*#__PURE__*/ _interopDefault(React);

const isBrowser = typeof window !== "undefined";
const NONE = /* @__PURE__ */ Symbol("NONE");
isBrowser
  ? React__default.default.useLayoutEffect
  : React__default.default.useEffect;
function mergeProps(props, ...restProps) {
  if (restProps.every((rest) => Object.keys(rest).length === 0)) {
    return props;
  }
  const result = { ...props };
  for (const rest of restProps) {
    for (const key of Object.keys(rest)) {
      result[key] = mergePropVals(key, result[key], rest[key]);
    }
  }
  return result;
}
function updateRef(ref, value) {
  if (!ref) {
    return;
  }
  if (typeof ref === "function") {
    ref(value);
  } else {
    if (!Object.isFrozen(ref)) {
      ref.current = value;
    }
  }
}
function mergeRefs(...refs) {
  return (value) => {
    for (const ref of refs) {
      updateRef(ref, value);
    }
  };
}
function mergePropVals(name, val1, val2) {
  if (val1 === NONE || val2 === NONE) {
    return null;
  } else if (val1 == null) {
    return val2;
  } else if (val2 == null) {
    return val1;
  } else if (name === "className") {
    return classNames__default.default(val1, val2);
  } else if (name === "style") {
    return { ...val1, ...val2 };
  } else if (name === "ref") {
    return mergeRefs(val1, val2);
  } else if (typeof val1 !== typeof val2) {
    return val2;
  } else if (name.startsWith("on") && typeof val1 === "function") {
    return (...args) => {
      let res;
      if (typeof val1 === "function") {
        res = val1(...args);
      }
      if (typeof val2 === "function") {
        res = val2(...args);
      }
      return res;
    };
  } else {
    return val2;
  }
}
function reactNodeToString(reactNode) {
  let string = "";
  if (typeof reactNode === "string") {
    string = reactNode;
  } else if (typeof reactNode === "number") {
    string = reactNode.toString();
  } else if (reactNode instanceof Array) {
    reactNode.forEach(function (child) {
      string += reactNodeToString(child);
    });
  } else if (React.isValidElement(reactNode)) {
    string += reactNodeToString(reactNode.props.children);
  }
  return string;
}
function useIsMounted() {
  const ref = React__default.default.useRef(false);
  const isMounted = React__default.default.useCallback(() => ref.current, []);
  React__default.default.useEffect(() => {
    ref.current = true;
    return () => {
      ref.current = false;
    };
  }, []);
  return isMounted;
}

exports.mergeProps = mergeProps;
exports.reactNodeToString = reactNodeToString;
exports.useIsMounted = useIsMounted;
//# sourceMappingURL=react-utils-DyVdynlc.cjs.js.map
