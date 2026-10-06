'use strict';

var Ant = require('antd');
var React = require('react');
var utils = require('./utils-DDtpTQdQ.cjs.js');
require('@plasmicapp/host/registerComponent');
require('@plasmicapp/host/registerGlobalContext');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var React__default = /*#__PURE__*/_interopDefault(React);

const sliderComponentName = "plasmic-antd6-slider";
function AntdSlider(props) {
  return /* @__PURE__ */ React__default.default.createElement(Ant.Slider, { ...props });
}
function registerSlider(loader) {
  utils.registerComponentHelper(loader, AntdSlider, {
    name: sliderComponentName,
    displayName: "Slider",
    defaultStyles: { width: "300px" },
    props: {
      range: { type: "object", description: "Boolean or Antd range configuration, such as { draggableTrack: true }." },
      value: { type: "object", editOnly: true, uncontrolledProp: "defaultValue", description: "Number for a single handle, array of numbers for range mode." },
      min: { type: "number", defaultValueHint: 0 },
      max: { type: "number", defaultValueHint: 100 },
      step: { type: "number", defaultValueHint: 1 },
      marks: { type: "object", description: "Antd marks keyed by numeric position." },
      tooltip: { type: "object" },
      disabled: "boolean",
      keyboard: { type: "boolean", defaultValueHint: true },
      dots: "boolean",
      included: { type: "boolean", defaultValueHint: true },
      reverse: "boolean",
      vertical: "boolean",
      autoFocus: "boolean",
      onChange: { type: "eventHandler", argTypes: [{ name: "value", type: "object" }] },
      onChangeComplete: { type: "eventHandler", argTypes: [{ name: "value", type: "object" }] }
    },
    states: {
      value: { type: "writable", valueProp: "value", onChangeProp: "onChange", variableType: "object" }
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerSlider",
    importName: "AntdSlider"
  });
}

exports.AntdSlider = AntdSlider;
exports.registerSlider = registerSlider;
exports.sliderComponentName = sliderComponentName;
//# sourceMappingURL=registerSlider.cjs.js.map
