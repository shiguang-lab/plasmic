'use strict';

var Ant = require('antd');
var React = require('react');
var names = require('./names-DbJduus8.cjs.js');
var utils = require('./utils-CRCm44nj.cjs.js');
require('@plasmicapp/host/registerComponent');
require('@plasmicapp/host/registerGlobalContext');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var React__default = /*#__PURE__*/_interopDefault(React);

const AntdButton = React__default.default.forwardRef(
  function AntdButton2(props, ref) {
    const { submitsForm = false, children, ...rest } = props;
    const target = props.target === true ? "_blank" : props.target === false ? void 0 : props.target;
    return /* @__PURE__ */ React__default.default.createElement(
      Ant.Button,
      {
        ...rest,
        ref,
        children: children != null && children !== "" ? /* @__PURE__ */ React__default.default.createElement(
          "div",
          {
            style: {
              display: "inline-block"
            }
          },
          children
        ) : void 0,
        htmlType: props.htmlType ?? (submitsForm ? "submit" : "button"),
        target
      }
    );
  }
);
function registerButton(loader) {
  utils.registerComponentHelper(loader, AntdButton, {
    name: names.buttonComponentName,
    displayName: "Button",
    props: {
      "aria-label": {
        type: "string",
        displayName: "Accessible name",
        description: "Describe the action of an icon-only button for assistive technology."
      },
      type: {
        type: "choice",
        options: ["default", "primary", "dashed", "link", "text"],
        description: "Can be set to primary, dashed, link, text, default",
        defaultValueHint: "default"
      },
      variant: {
        type: "choice",
        options: ["outlined", "dashed", "solid", "filled", "text", "link"]
      },
      color: {
        type: "choice",
        options: [
          "default",
          "primary",
          "danger",
          "blue",
          "purple",
          "cyan",
          "green",
          "magenta",
          "pink",
          "red",
          "orange",
          "yellow",
          "volcano",
          "geekblue",
          "lime",
          "gold"
        ]
      },
      iconPlacement: {
        type: "choice",
        options: ["start", "end"],
        defaultValueHint: "start"
      },
      size: {
        type: "choice",
        options: ["small", "medium", "large"],
        description: "Set the size of button",
        defaultValueHint: "medium"
      },
      shape: {
        type: "choice",
        options: ["default", "circle", "round"],
        description: "Set the button shape",
        defaultValueHint: "default"
      },
      disabled: {
        type: "boolean",
        description: "Whether the button is disabled",
        defaultValueHint: false
      },
      submitsForm: {
        type: "boolean",
        displayName: "Submits form?",
        defaultValueHint: false,
        description: "whether clicking this button should submit the enclosing form.",
        advanced: true
      },
      ghost: {
        type: "boolean",
        description: "Make background transparent and invert text and border colors",
        defaultValueHint: false,
        advanced: true
      },
      danger: {
        type: "boolean",
        description: "Set the danger status of button",
        defaultValueHint: false,
        advanced: true
      },
      loading: {
        type: "boolean",
        description: "Set the loading status of button",
        defaultValueHint: false,
        advanced: true
      },
      href: {
        displayName: "Link to",
        type: "href",
        description: "Use this button as a link to this url"
      },
      target: {
        type: "boolean",
        displayName: "Open in new tab?",
        description: "Whether to open the link in a new window",
        hidden: (props) => !props.href,
        defaultValueHint: false
      },
      children: {
        type: "slot",
        hidePlaceholder: true,
        defaultValue: [
          {
            type: "text",
            value: "Button"
          }
        ],
        ...{ mergeWithParent: true }
      },
      icon: {
        type: "slot",
        hidePlaceholder: true
      },
      onClick: {
        type: "eventHandler",
        argTypes: []
      }
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerButton",
    importName: "AntdButton"
  });
}

exports.AntdButton = AntdButton;
exports.registerButton = registerButton;
//# sourceMappingURL=registerButton.cjs.js.map
